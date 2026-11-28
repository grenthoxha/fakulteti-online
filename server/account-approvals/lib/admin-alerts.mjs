// A revocable, device-bound read-only credential for the APK's background check.
// It can only read pending request IDs/counts; all administrative writes stay signed.
const utf8=new TextEncoder();
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',utf8.encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const key=id=>'admin_alert_device:'+id;
const fail=(code,status)=>{throw Object.assign(new Error(code),{code,status});};
export async function issueAdminAlertToken(db,deviceId,adminId,account,now){
  const token=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const expires=now+30*86400000;
  const value={hash:await hash(token),adminId,accountId:account?.id||null,revision:account?.revision||null,expires};
  await db.prepare('INSERT INTO approval_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key(deviceId),JSON.stringify(value)).run();
  return {token,deviceId,expires};
}
export async function revokeAdminAlertToken(db,deviceId){await db.prepare('DELETE FROM approval_settings WHERE key=?').bind(key(deviceId)).run();return {revoked:true};}
export async function readAdminAlerts(request,db,now,cloudAccount,isLinkedAdmin){
  if(request.method!=='GET')fail('METHOD_NOT_ALLOWED',405);
  const deviceId=request.headers.get('X-Fakulteti-Device')||'',token=request.headers.get('X-Fakulteti-Alert')||'';
  if(!/^[a-f0-9]{64}$/.test(deviceId)||!/^[a-f0-9]{64}$/.test(token))fail('ALERT_AUTH_REQUIRED',401);
  const saved=await db.prepare('SELECT value FROM approval_settings WHERE key=?').bind(key(deviceId)).first();
  let value;try{value=JSON.parse(saved?.value||'null');}catch{}
  if(!value||value.hash!==await hash(token)||value.expires<=now)fail('ALERT_TOKEN_INVALID',401);
  const account=await cloudAccount(db,deviceId);
  if((account?.id||null)!==value.accountId||(account?.revision||null)!==value.revision||(account&&account.approval_id!==value.adminId))fail('ALERT_TOKEN_REVOKED',403);
  const admin=await db.prepare('SELECT * FROM approval_requests WHERE id=?').bind(value.adminId).first();
  if(!admin||admin.email!=='grent@gmail.com'||admin.status!=='approved'||admin.role!=='admin'||!await isLinkedAdmin(db,admin.id))fail('ADMIN_REQUIRED',403);
  const rows=await db.prepare("SELECT r.id FROM approval_requests r WHERE r.status='pending' AND r.role<>'admin' AND NOT EXISTS (SELECT 1 FROM cloud_accounts a WHERE a.email=r.email AND a.approval_id<>r.id) ORDER BY r.created_at DESC,r.id DESC LIMIT 1000").all();
  return {ids:rows.results.map(row=>row.id),pending:rows.results.length,checkedAt:now};
}
