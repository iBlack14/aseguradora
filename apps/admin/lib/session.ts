const encoder=new TextEncoder();
export const SESSION_COOKIE='falabella_admin_session';
const secret=()=>{
  const value=process.env.AUTH_SECRET;
  if(value)return value;
  if(process.env.NODE_ENV==='production')throw new Error('AUTH_SECRET is required in production');
  return 'development-only-change-this-secret';
};

function toBase64Url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function signature(payload:string){const key=await crypto.subtle.importKey('raw',encoder.encode(secret()),{name:'HMAC',hash:'SHA-256'},false,['sign']);return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(payload))))}
export type SessionRole='ADMIN'|'SALES'|'OPERATIONS'|'SUPPORT'|'AUDITOR';
export async function createSession(role:SessionRole='ADMIN'){const payload=`${Date.now()+8*60*60*1000}:${role}`;return `${payload}.${await signature(payload)}`}
function secureEqual(left:string,right:string){if(left.length!==right.length)return false;let mismatch=0;for(let index=0;index<left.length;index+=1)mismatch|=left.charCodeAt(index)^right.charCodeAt(index);return mismatch===0}
export async function sessionRole(value?:string):Promise<SessionRole|null>{if(!value)return null;const [payload,sig]=value.split('.');const [expires,role]=payload?.split(':')||[];const expiresAt=Number(expires);if(!payload||!sig||!Number.isFinite(expiresAt)||expiresAt<Date.now()||!['ADMIN','SALES','OPERATIONS','SUPPORT','AUDITOR'].includes(role))return null;return secureEqual(sig,await signature(payload))?role as SessionRole:null}
export async function validSession(value?:string){return Boolean(await sessionRole(value))}
