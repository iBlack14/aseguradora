const encoder=new TextEncoder();
export const SESSION_COOKIE='falabella_admin_session';
const secret=()=>process.env.AUTH_SECRET||'development-only-change-this-secret';

function toBase64Url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function signature(payload:string){const key=await crypto.subtle.importKey('raw',encoder.encode(secret()),{name:'HMAC',hash:'SHA-256'},false,['sign']);return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(payload))))}
export async function createSession(){const payload=String(Date.now()+8*60*60*1000);return `${payload}.${await signature(payload)}`}
export async function validSession(value?:string){if(!value)return false;const [expires,sig]=value.split('.');if(!expires||!sig||Number(expires)<Date.now())return false;return sig===await signature(expires)}
