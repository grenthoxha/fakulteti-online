import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const palette = { left: '#d5a999', right: '#dfbdaa', 'cerebellum-left': '#b1acc7', 'cerebellum-right': '#b1acc7', brainstem: '#cebc92' };

// Original FreeSurfer surface RAS coordinates: +X right, +Y anterior, +Z superior.
// The group rotation maps them to +X right, +Y superior, -Z anterior (no reflection).
export async function createScene({ host, meshes, signal, onProgress, onChange, onError, dark, lightQuality }) {
  if (typeof DecompressionStream === 'undefined') throw new Error('decompression');
  const decoded = [];
  for (const mesh of meshes) {
    if (signal.aborted) return null;
    const bytes = Uint8Array.from(atob(mesh.gzip), value => value.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const data = await new Response(stream).arrayBuffer();
    if (data.byteLength !== (mesh.vertices + mesh.triangles) * 12) throw new Error('model-data');
    decoded.push({ ...mesh, positions: new Float32Array(data, 0, mesh.vertices * 3), indices: new Uint32Array(data, mesh.vertices * 12, mesh.triangles * 3) });
    onProgress(decoded.length / meshes.length);
  }
  if (signal.aborted) return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: !lightQuality, alpha: true, powerPreference: lightQuality ? 'low-power' : 'default' }); }
  catch { throw new Error('webgl'); }
  const scene = new THREE.Scene();
  const brain = new THREE.Group();
  let controls, observer, intersection, frame = 0, disposed = false, visible = true;
  const canvas = renderer.domElement;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    intersection?.disconnect();
    document.removeEventListener('visibilitychange', wake);
    canvas.removeEventListener('webglcontextlost', lost);
    controls?.dispose();
    scene.traverse(object => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach(material => material.dispose());
      object.shadow?.dispose();
    });
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 3000);
  function render() {
    frame = 0;
    if (disposed || document.hidden || !visible) return;
    renderer.render(scene, camera);
  }
  function invalidate() { if (!disposed && !frame) frame = requestAnimationFrame(render); }
  function wake() { if (!document.hidden) invalidate(); }
  function lost(event) { event.preventDefault(); if (!disposed) onError('context'); }
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lightQuality ? 1 : 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !lightQuality;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    for (const part of decoded) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(part.indices, 1));
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({ color: palette[part.id], roughness: 0.84, metalness: 0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = part.id;
      mesh.castShadow = mesh.receiveShadow = !lightQuality;
      brain.add(mesh);
    }
    brain.rotation.x = -Math.PI / 2;
    scene.add(brain);
    const bounds = new THREE.Box3().setFromObject(brain);
    brain.position.sub(bounds.getCenter(new THREE.Vector3()));
    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
    const ambient = new THREE.HemisphereLight(0xfff8ef, 0x75829a, 1.1);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffeee1, 3);
    key.position.set(-radius * 2, radius * 3, radius * 2);
    key.castShadow = !lightQuality;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: radius * 0.1, far: radius * 8 });
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.15;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xcad8ff, 1.05);
    fill.position.set(radius * 2, radius, -radius * 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(-radius, 0, -radius * 3);
    scene.add(rim);
    host.appendChild(canvas);
    canvas.setAttribute('aria-hidden', 'true');
    canvas.addEventListener('webglcontextlost', lost);
    controls = new OrbitControls(camera, host);
    controls.enableDamping = false; // Render only on input; no continuous animation or battery drain.
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.7;
    controls.minDistance = radius * 1.1;
    controls.maxTargetRadius = radius * 0.8;
    let fitDistance = radius * 3.4;
    const position = new THREE.Vector3(-2.8, 0.65, 1.6).normalize();
    let activePreset = 'overview', touched = false;
    const pose = () => onChange({ preset: activePreset, zoom: Math.round(fitDistance / camera.position.distanceTo(controls.target) * 100) });
    controls.addEventListener('change', () => { invalidate(); pose(); });
    controls.addEventListener('start', () => { touched = true; activePreset = 'free'; pose(); });
    const view = (name = 'overview') => {
      activePreset = name;
      touched = false;
      controls.target.set(0, 0, 0);
      camera.up.set(0, 1, 0);
      const direction = name === 'left' ? new THREE.Vector3(-1, 0, 0) : name === 'front' ? new THREE.Vector3(0, 0, -1) : name === 'top' ? new THREE.Vector3(0, 1, 0.001) : position;
      camera.position.copy(direction).normalize().multiplyScalar(fitDistance);
      controls.update();
      pose();
      invalidate();
    };
    const resize = () => {
      if (disposed) return;
      const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const vfov = THREE.MathUtils.degToRad(camera.fov / 2);
      fitDistance = radius / Math.sin(Math.min(vfov, Math.atan(Math.tan(vfov) * camera.aspect))) * 0.92;
      controls.maxDistance = fitDistance * 2.5;
      if (!touched) view(activePreset);
      invalidate();
    };
    const zoom = factor => {
      touched = true;
      const offset = camera.position.clone().sub(controls.target);
      camera.position.copy(controls.target).add(offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance)));
      controls.update();
      pose();
      invalidate();
    };
    const rotate = (horizontal, vertical) => {
      touched = true;
      activePreset = 'free';
      const sphere = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      sphere.theta += horizontal;
      sphere.phi = THREE.MathUtils.clamp(sphere.phi + vertical, 0.03, Math.PI - 0.03);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sphere));
      controls.update();
      pose();
      invalidate();
    };
    const pan = (x, y) => {
      touched = true;
      const shift = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).multiplyScalar(x * radius * 0.06);
      shift.add(new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar(y * radius * 0.06));
      camera.position.add(shift);
      controls.target.add(shift);
      controls.update();
      invalidate();
    };
    const theme = isDark => { ambient.intensity = isDark ? 0.85 : 1.1; invalidate(); };
    observer = new ResizeObserver(resize);
    observer.observe(host);
    intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) invalidate(); });
    intersection.observe(host);
    document.addEventListener('visibilitychange', wake);
    resize();
    theme(dark);
    return { dispose: cleanup, view, zoom, rotate, pan, theme };
  } catch (error) { cleanup(); throw error; }
}
