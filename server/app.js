import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {hashPassword,verifyPassword,token} from './auth.js';import {staffPortal,studentPortal} from '../src/portal.js';import {schoolToday} from '../src/daily.js';

export async function createApp({dataDir=path.resolve('server-data'),distDir=path.resolve('dist'),adminUser=process.env.TIMEMAKER_ADMIN_USER,adminPassword=process.env.TIMEMAKER_ADMIN_PASSWORD,secureCookies=process.env.NODE_ENV==='production',origin=process.env.TIMEMAKER_ORIGIN}={}) {
 fs.mkdirSync(dataDir,{recursive:true});const dbPath=path.join(dataDir,'school.json');
 let state=fs.existsSync(dbPath)?JSON.parse(fs.readFileSync(dbPath,'utf8')):{accounts:[],school:{},revision:0};
 function persist(){const temp=dbPath+'.tmp';fs.writeFileSync(temp,JSON.stringify(state),{mode:0o600});fs.renameSync(temp,dbPath);}
 if(!state.accounts.length){if(!adminUser||!adminPassword)throw new Error('Set TIMEMAKER_ADMIN_USER and TIMEMAKER_ADMIN_PASSWORD for the first start.');state.accounts.push({id:token(),username:adminUser.toLowerCase(),role:'admin',...(await hashPassword(adminPassword))});persist();}
 const sessions=new Map(),limits=new Map();
 const publicAccount=a=>({id:a.id,username:a.username,role:a.role,entityId:a.entityId});
 function send(res,status,value,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));}
 function fail(status,message){const e=new Error(message);e.status=status;throw e;}
 async function body(req){let raw='',length=0;for await(const chunk of req){length+=chunk.length;if(length>10*1024*1024)fail(413,'Upload exceeds 10 MB.');raw+=chunk;}try{return JSON.parse(raw || '{}');}catch{fail(400,'Invalid JSON.');}}
 function session(req){const cookie=(req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('tm_session='))?.slice(11);const s=sessions.get(cookie);if(!s||s.expires<Date.now()){sessions.delete(cookie);return null;}const account=state.accounts.find(a=>a.id===s.accountId&&!a.disabled);return account?{...s,account,cookie}:null;}
 function cookie(value,maxAge){return `tm_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookies?'; Secure':''}`;}
 async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  try{
   const url=new URL(req.url,'http://localhost'),route=url.pathname;
   if(!route.startsWith('/api/')){
    if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed.'});
    const decoded=decodeURIComponent(route),file=path.resolve(distDir,'.'+decoded),root=path.resolve(distDir);
    if(!file.startsWith(root+path.sep)&&file!==root)return send(res,404,{error:'Not found.'});
    const target=fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(root,'index.html');
    if(!fs.existsSync(target))return send(res,404,{error:'Build the app with npm run build first.'});
    const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(target)] || 'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':path.extname(target)==='.html'?'no-store':'public, max-age=3600'});if(req.method==='HEAD')res.end();else fs.createReadStream(target).pipe(res);return;
   }
   const s=session(req);
   if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
    const expected=origin || `${secureCookies?'https':'http'}://${req.headers.host}`;
    if(req.headers.origin&&req.headers.origin!==expected)fail(403,'Cross-origin request blocked.');
    if(route!=='/api/login'&&(!s||req.headers['x-csrf-token']!==s.csrf))fail(403,'Session or request token is missing.');
   }
   if(route==='/api/session'&&req.method==='GET')return send(res,200,{enabled:true,user:s?publicAccount(s.account):null,csrf:s?.csrf});
   if(route==='/api/login'&&req.method==='POST'){
    const input=await body(req),username=String(input.username || '').toLowerCase(),key=(req.socket.remoteAddress || '')+':'+username;
    const limit=limits.get(key);if(limit&&limit.until>Date.now()&&limit.count>=10)fail(429,'Too many login attempts. Try again later.');
    const account=state.accounts.find(a=>a.username===username&&!a.disabled),valid=await verifyPassword(input.password,account);
    if(!valid){limits.set(key,{count:limit?.until>Date.now()?limit.count+1:1,until:Date.now()+900000});fail(401,'Incorrect username or password.');}limits.delete(key);
    const value=token(),csrf=token();for(const [id,entry] of sessions)if(entry.expires<Date.now())sessions.delete(id);
    sessions.set(value,{accountId:account.id,csrf,expires:Date.now()+8*3600000});return send(res,200,{user:publicAccount(account),csrf},{'Set-Cookie':cookie(value,8*3600)});
   }
   if(!s)fail(401,'Sign in to continue.');
   if(route==='/api/logout'&&req.method==='POST'){sessions.delete(s.cookie);return send(res,200,{ok:true},{'Set-Cookie':cookie('',0)});}
   if(route==='/api/portal'&&req.method==='GET'){
    if(!['staff','student'].includes(s.account.role))fail(403,'This account does not have a personal portal.');
    const date=url.searchParams.get('date') || schoolToday(state.school);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(400,'Invalid date.');
    return send(res,200,s.account.role==='student'?studentPortal(state.school,s.account.entityId,date):staffPortal(state.school,s.account.entityId,date));
   }
   if(s.account.role!=='admin')fail(403,'Administrator access required.');
   if(route==='/api/school'&&req.method==='GET')return send(res,200,{data:state.school,revision:state.revision});
   if(route==='/api/school'&&req.method==='POST'){
    const input=await body(req);if(input.revision!==state.revision)fail(409,'Another administrator changed the school. Reload before saving.');
    if(!input.data||typeof input.data!=='object'||Array.isArray(input.data))fail(400,'Invalid school data.');state.school=input.data;state.revision++;persist();return send(res,200,{revision:state.revision});
   }
   if(route==='/api/accounts'&&req.method==='GET')return send(res,200,{accounts:state.accounts.map(publicAccount)});
   if(route==='/api/accounts'&&req.method==='POST'){
    const input=await body(req);if(!['staff','student','admin'].includes(input.role))fail(400,'Choose an account role.');
    const username=String(input.username || '').trim().toLowerCase();if(!/^[a-z0-9._@-]{3,120}$/.test(username))fail(400,'Use a username of 3–120 letters, digits, dots, hyphens or @.');
    if(state.accounts.some(a=>a.username===username))fail(400,'Username already exists.');
    if(input.role==='staff'&&!state.school.staff?.some(t=>t.id===input.entityId))fail(400,'Select a staff record in the synced school.');
    if(input.role==='student'&&!state.school.students?.some(t=>t.id===input.entityId))fail(400,'Select a pupil record in the synced school.');
    const credentials=await hashPassword(input.password);
    if(state.accounts.some(a=>a.username===username))fail(400,'Username already exists.');
    const a={id:token(),username,role:input.role,entityId:input.entityId,...credentials};state.accounts.push(a);persist();return send(res,201,{account:publicAccount(a)});
   }
   if(route.startsWith('/api/accounts/')&&req.method==='DELETE'){
    const id=route.slice('/api/accounts/'.length);if(id===s.account.id)fail(400,'You cannot remove your own account.');state.accounts=state.accounts.filter(a=>a.id!==id);for(const [key,value] of sessions)if(value.accountId===id)sessions.delete(key);persist();return send(res,200,{ok:true});
   }
   fail(404,'API route not found.');
  }catch(e){send(res,e.status || 400,{error:e.status?e.message:'Unable to complete this request. Check the supplied data.'});}
 }
 const server=http.createServer(handler);server.requestTimeout=30000;server.headersTimeout=10000;return server;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const server=await createApp();server.listen(Number(process.env.PORT || 3000),process.env.HOST || '127.0.0.1',()=>console.log('Time Maker server is ready.'));
}
