import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';import {promisify} from 'node:util';
const derive=promisify(scrypt);
export async function hashPassword(password) {
 if(typeof password!=='string'||password.length<12||password.length>256)throw new Error('Use a password of 12–256 characters.');
 const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt,64,{N:16384,r:8,p:1})).toString('hex');
 return {salt,hash};
}
export async function verifyPassword(password,record) {
 if(typeof password!=='string'||password.length>256)return false;
 const actual=await derive(password,record?.salt || 'invalid-account-salt',64,{N:16384,r:8,p:1});
 const expected=Buffer.from(record?.hash || '00'.repeat(64),'hex');
 return expected.length===actual.length&&timingSafeEqual(actual,expected);
}
export const token=()=>randomBytes(32).toString('hex');
