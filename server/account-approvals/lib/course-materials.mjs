import materials from './course-materials-manifest.mjs';
const prefix='/api/materials/';
const cors={ 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers':'Range, If-None-Match', 'Access-Control-Expose-Headers':'Content-Length, Content-Range, Accept-Ranges, ETag', 'X-Content-Type-Options':'nosniff', 'Cross-Origin-Resource-Policy':'cross-origin' };
export async function handleCourseMaterial(request,{manifest=materials,fetchFile=fetch}={}) {
 const path=new URL(request.url).pathname;
 if(!path.startsWith(prefix))return null;
 const key=path.slice(prefix.length),item=/^[a-f0-9]{32}\.[a-z0-9]{1,8}$/.test(key)?manifest[key]:null;
 const fail=status=>new Response(null,{status,headers:{...cors,'Cache-Control':'no-store'}});
 if(!item)return fail(404);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...cors,Allow:'GET, HEAD, OPTIONS'}});
 const downloading=new URL(request.url).searchParams.get('download')==='1';
 const disposition=downloading?'attachment; filename*=UTF-8\'\''+encodeURIComponent(item.title||key).replace(/'/g,'%27'):'inline';
 const etag='"sha256-'+item.sha256+'"',headers={...cors,'Content-Type':item.mime,'Content-Disposition':disposition,'Cache-Control':'public, max-age=31536000, immutable, no-transform','Accept-Ranges':'bytes',ETag:etag};
 if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers});
 const range=request.headers.get('Range');
 if(range&&!/^bytes=(?:\d+-\d*|-\d+)$/.test(range))return fail(416);
 const packed=Number.isSafeInteger(item.start)&&item.start>=0;
 let first=0,last=item.size-1;
 if(range){const [a,b]=range.slice(6).split('-');if(a){first=Number(a);last=b?Math.min(Number(b),last):last;}else{first=Math.max(0,item.size-Number(b));}if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first>last||first>=item.size)return new Response(null,{status:416,headers:{...cors,'Content-Range':'bytes */'+item.size}});}
 const outgoingRange=packed?'bytes='+(item.start+first)+'-'+(item.start+last):range;
 if(packed){headers['Content-Length']=String(last-first+1);if(range)headers['Content-Range']='bytes '+first+'-'+last+'/'+item.size;}
 if(packed&&request.method==='HEAD')return new Response(null,{status:range?206:200,headers});
 let target=item.url;
 if(!/^https:\/\/github\.com\/grenthoxha\/fakulteti-online\/releases\/download\/materiale-psikologji-2026-s[1-6]\/[A-Za-z0-9_.-]+$/.test(target))return fail(502);
 try {
  let upstream;
  for(let i=0;i<4;i++){
   const parsed=new URL(target);
   if(parsed.protocol!=='https:'||parsed.username||parsed.password||!['github.com','release-assets.githubusercontent.com'].includes(parsed.hostname))return fail(502);
   upstream=await fetchFile(target,{method:request.method,redirect:'manual',headers:{'User-Agent':'Fakulteti-Materials','Accept-Encoding':'identity',...(outgoingRange?{Range:outgoingRange}:{})},signal:request.signal});
   if(![301,302,303,307,308].includes(upstream.status))break;
   const location=upstream.headers.get('Location');if(!location)return fail(502);target=new URL(location,target).href;
  }
  if(!upstream||![200,206,416].includes(upstream.status))return fail(502);
  if(packed){
   const returned=upstream.headers.get('Content-Range')||'';const expected='bytes '+(item.start+first)+'-'+(item.start+last)+'/';
   if(upstream.status!==206||!returned.startsWith(expected)||Number(upstream.headers.get('Content-Length'))!==last-first+1)return fail(502);
  }else for(const name of ['Content-Length','Content-Range']){const value=upstream.headers.get(name);if(value)headers[name]=value;}
  return new Response(request.method==='HEAD'?null:upstream.body,{status:packed?(range?206:200):upstream.status,headers});
 }catch{return fail(502);}
}
