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
export async function createSession(){const payload=String(Date.now()+8*60*60*1000);return `${payload}.${await signature(payload)}`}
function secureEqual(left:string,right:string){if(left.length!==right.length)return false;let mismatch=0;for(let index=0;index<left.length;index+=1)mismatch|=left.charCodeAt(index)^right.charCodeAt(index);return mismatch===0}
export async function validSession(value?:string){if(!value)return false;const [expires,sig]=value.split('.');const expiresAt=Number(expires);if(!expires||!sig||!Number.isFinite(expiresAt)||expiresAt<Date.now())return false;return secureEqual(sig,await signature(expires))}
