// Build only this isolated module. Run from assets/brain: npm install && npm run build.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const esbuild = require('esbuild');
const root = __dirname;
const inputs = [
  ['left', 'pial_Full_obj/lh.pial.obj'],
  ['right', 'pial_Full_obj/rh.pial.obj'],
  ['cerebellum-left', 'subcortical_obj/Left-Cerebellum-Cortex.obj'],
  ['cerebellum-right', 'subcortical_obj/Right-Cerebellum-Cortex.obj'],
  ['brainstem', 'subcortical_obj/Brain-Stem.obj']
];
const records = [];
const meshes = inputs.map(([id, file]) => {
  const source = fs.readFileSync(path.join(root, '.build', file), 'utf8');
  const positions = [], indices = [];
  for (const line of source.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields[0] === 'v') positions.push(...fields.slice(1, 4).map(Number));
    if (fields[0] === 'f') {
      if (fields.length !== 4) throw new Error('Expected original triangular mesh: ' + file);
      indices.push(...fields.slice(1).map(field => Number(field.split('/')[0]) - 1));
    }
  }
  if (!positions.length || !indices.length || positions.some(v => !Number.isFinite(v)) || indices.some(i => i < 0 || i >= positions.length / 3)) throw new Error('Invalid OBJ: ' + file);
  const vertices = new Float32Array(positions);
  const triangles = new Uint32Array(indices);
  const binary = Buffer.concat([Buffer.from(vertices.buffer), Buffer.from(triangles.buffer)]);
  const limits = [0, 1, 2].map(axis => {
    let min = Infinity, max = -Infinity;
    for (let i = axis; i < positions.length; i += 3) { min = Math.min(min, positions[i]); max = Math.max(max, positions[i]); }
    return [min, max];
  });
  const record = { id, file, vertices: vertices.length / 3, triangles: triangles.length / 3, bounds: limits, sha256: crypto.createHash('sha256').update(source).digest('hex') };
  records.push(record);
  return { id, vertices: record.vertices, triangles: record.triangles, gzip: zlib.gzipSync(binary, { level: 9 }).toString('base64') };
});
const notice = 'Brain for Blender — Anderson Winkler, CC BY-SA 3.0. Source: https://brainder.org/research/brain-for-blender/. Lossless gzip; original topology retained; positions stored as Float32.';
fs.writeFileSync(path.join(root, 'brain-model.js'), `/* ${notice} */\nwindow.UnitBrainMeshPayload = ${JSON.stringify(meshes)};\n`);
fs.writeFileSync(path.join(root, 'model-manifest.json'), JSON.stringify({ source: 'https://brainder.org/research/brain-for-blender/', license: 'https://creativecommons.org/licenses/by-sa/3.0/', author: 'Anderson Winkler', transformation: 'OBJ to Float32 positions and Uint32 indices; no decimation or smoothing; lossless gzip. Viewer rotates RAS to Y-up without mirroring.', meshes: records }, null, 2) + '\n');
fs.copyFileSync(path.join(root, 'node_modules/three/LICENSE'), path.join(root, 'THREE-LICENSE.txt'));
esbuild.buildSync({ entryPoints: [path.join(root, 'src/viewer.js')], bundle: true, minify: true, format: 'iife', target: ['chrome110', 'safari16.4'], loader: { '.css': 'text' }, legalComments: 'eof', outfile: path.join(root, 'brain-viewer.js') });
console.log(JSON.stringify({ meshes: records, payloadBytes: fs.statSync(path.join(root, 'brain-model.js')).size, bundleBytes: fs.statSync(path.join(root, 'brain-viewer.js')).size }, null, 2));
