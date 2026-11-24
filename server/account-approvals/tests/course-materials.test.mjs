import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleCourseMaterial} from '../lib/course-materials.mjs';
const key='a'.repeat(32)+'.pdf',sha='b'.repeat(64),url='https://github.com/grenthoxha/fakulteti-online/releases/download/materiale-psikologji-2026-s3/sample.pdf';
const manifest={[key]:{url,mime:'application/pdf',sha256:sha,size:10}};
const req=(path=key,options={})=>new Request('https://example.test/api/materials/'+path,options);
test('only allowlisted inspected keys can be read; unrelated routes untouched',async()=>{
 let calls=0;const opts={manifest,fetchFile:async()=>{calls++;return new Response('pdf');}};
 assert.equal((await handleCourseMaterial(req('unknown.pdf'),opts)).status,404);
 assert.equal((await handleCourseMaterial(req(key+'?url=https://evil.test'),{...opts,manifest:{}})).status,404);
 assert.equal(await handleCourseMaterial(new Request('https://example.test/health'),opts),null);
 assert.equal(calls,0);
});
test('CORS and range preflight never fetch a binary or touch accounts',async()=>{
 const result=await handleCourseMaterial(req(key,{method:'OPTIONS',headers:{Origin:'https://grenthoxha.github.io','Access-Control-Request-Headers':'Range'}}),{manifest,fetchFile:()=>{throw Error('unexpected fetch');}});
 assert.equal(result.status,204);assert.equal(result.headers.get('Access-Control-Allow-Origin'),'*');assert.match(result.headers.get('Access-Control-Allow-Headers'),/Range/);
});
test('streams PDF bytes inline, forwards only Range, and hides the upstream redirect',async()=>{
 const seen=[];
 const result=await handleCourseMaterial(req(key,{headers:{Range:'bytes=2-4',Cookie:'private-account=secret',Authorization:'Bearer private'}}),{manifest,fetchFile:async(target,options)=>{
  seen.push({target,options});return seen.length===1?new Response(null,{status:302,headers:{Location:'https://release-assets.githubusercontent.com/example/file?signature=private'}}):new Response('pdf',{status:206,headers:{'Content-Range':'bytes 2-4/10','Content-Length':'3'}});
 }});
 assert.equal(result.status,206);assert.equal(await result.text(),'pdf');assert.equal(seen.length,2);assert.equal(seen[1].options.headers.Range,'bytes=2-4');assert.equal(seen[0].options.headers.Cookie,undefined);assert.equal(seen[0].options.headers.Authorization,undefined);
 assert.equal(result.headers.get('Content-Type'),'application/pdf');assert.equal(result.headers.get('Content-Disposition'),'inline');assert.equal(result.headers.get('Content-Range'),'bytes 2-4/10');assert.equal(result.headers.get('Location'),null);assert.equal(result.headers.get('Access-Control-Allow-Origin'),'*');
});
test('rejects arbitrary upstreams, external redirects, multipart ranges and writes',async()=>{
 let calls=0;const fetchFile=async()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});};
 assert.equal((await handleCourseMaterial(req(),{manifest,fetchFile})).status,502);assert.equal(calls,1);
 assert.equal((await handleCourseMaterial(req(key,{headers:{Range:'bytes=0-2,5-9'}}),{manifest,fetchFile})).status,416);
 assert.equal((await handleCourseMaterial(req(key,{method:'POST'}),{manifest,fetchFile})).status,405);
 assert.equal((await handleCourseMaterial(req(),{manifest:{[key]:{...manifest[key],url:'https://example.com/secret'}},fetchFile})).status,502);assert.equal(calls,1);
});
test('HEAD has no body; immutable checksum validators and upstream failures are safe',async()=>{
 const opts={manifest,fetchFile:async()=>new Response('file',{headers:{'Content-Length':'4'}})};
 const head=await handleCourseMaterial(req(key,{method:'HEAD'}),opts);assert.equal(await head.text(),'');assert.equal(head.headers.get('Content-Length'),'4');
 const notModified=await handleCourseMaterial(req(key,{headers:{'If-None-Match':'"sha256-'+sha+'"'}}),{manifest,fetchFile:()=>{throw Error('must not fetch');}});assert.equal(notModified.status,304);
 const failure=await handleCourseMaterial(req(),{manifest,fetchFile:async()=>{throw Error('private upstream url');}});assert.equal(failure.status,502);assert.equal(await failure.text(),'');assert.equal(failure.headers.get('Cache-Control'),'no-store');
});
test('ZIP package ranges are translated into independent app files without downloading the package',async()=>{
 const packed={[key]:{...manifest[key],start:100}};let calls=0;
 const fetchFile=async(target,opts)=>{calls++;assert.equal(opts.headers.Range,'bytes=102-104');return new Response('abc',{status:206,headers:{'Content-Range':'bytes 102-104/1000','Content-Length':'3'}});};
 const result=await handleCourseMaterial(req(key,{headers:{Range:'bytes=2-4'}}),{manifest:packed,fetchFile});
 assert.equal(result.status,206);assert.equal(result.headers.get('Content-Range'),'bytes 2-4/10');assert.equal(result.headers.get('Content-Length'),'3');assert.equal(await result.text(),'abc');assert.equal(calls,1);
 const head=await handleCourseMaterial(req(key,{method:'HEAD'}),{manifest:packed,fetchFile});assert.equal(head.status,200);assert.equal(head.headers.get('Content-Length'),'10');assert.equal(calls,1);
});
test('whole-file and suffix reads expose only file bytes; ignored upstream ranges fail closed',async()=>{
 const packed={[key]:{...manifest[key],start:100,title:'Libri im.pdf'}};
 const full=await handleCourseMaterial(req(key+'?download=1'),{manifest:packed,fetchFile:async(target,opts)=>{assert.equal(opts.headers.Range,'bytes=100-109');return new Response('0123456789',{status:206,headers:{'Content-Range':'bytes 100-109/1000','Content-Length':'10'}});}});
 assert.equal(full.status,200);assert.equal(full.headers.get('Content-Range'),null);assert.match(full.headers.get('Content-Disposition'),/attachment/);assert.equal(await full.text(),'0123456789');
 const suffix=await handleCourseMaterial(req(key,{headers:{Range:'bytes=-3'}}),{manifest:packed,fetchFile:async(target,opts)=>{assert.equal(opts.headers.Range,'bytes=107-109');return new Response('789',{status:206,headers:{'Content-Range':'bytes 107-109/1000','Content-Length':'3'}});}});assert.equal(suffix.headers.get('Content-Range'),'bytes 7-9/10');
 const bad=await handleCourseMaterial(req(key),{manifest:packed,fetchFile:async()=>new Response('whole ZIP')});assert.equal(bad.status,502);assert.equal(await bad.text(),'');
 const outside=await handleCourseMaterial(req(key,{headers:{Range:'bytes=10-15'}}),{manifest:packed,fetchFile:()=>{throw Error('unexpected')}});assert.equal(outside.status,416);assert.equal(outside.headers.get('Content-Range'),'bytes */10');
});
