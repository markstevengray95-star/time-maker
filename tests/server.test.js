import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createApp} from '../server/app.js';import {buildDemoData} from '../src/demoData.js';
test('authenticated API enforces staff scope and administrator-only school writes',async()=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'time-maker-test-')),server=await createApp({dataDir,adminUser:'admin',adminPassword:'Test-only-password-2026'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'Test-only-password-2026'})});assert.equal(login.status,200);const auth=await login.json(),cookie=login.headers.get('set-cookie').split(';')[0],headers={Cookie:cookie,'X-CSRF-Token':auth.csrf,'Content-Type':'application/json'};
  const data=buildDemoData();data.publishedTimetable=structuredClone(data.generatedTimetables[0]);data.staff[0].notes='private';
  assert.equal((await fetch(base+'/api/school',{method:'POST',headers,body:JSON.stringify({data,revision:0})})).status,200);
  assert.equal((await fetch(base+'/api/school',{method:'POST',headers,body:JSON.stringify({data,revision:0})})).status,409);
  assert.equal((await fetch(base+'/api/accounts',{method:'POST',headers,body:JSON.stringify({username:'teacher',password:'Test-teacher-password',role:'staff',entityId:data.staff[0].id})})).status,201);
  const staffLogin=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'teacher',password:'Test-teacher-password'})});const staffCookie=staffLogin.headers.get('set-cookie').split(';')[0],staffAuth=await staffLogin.json();
  assert.equal((await fetch(base+'/api/school',{headers:{Cookie:staffCookie}})).status,403);
  const portal=await (await fetch(base+'/api/portal?date=2026-10-06&teacherId=other',{headers:{Cookie:staffCookie}})).json();assert.ok(portal.master.every(a=>a.teacherId===data.staff[0].id));assert.ok(!JSON.stringify(portal).includes('private'));
  assert.equal((await fetch(base+'/api/school',{method:'POST',headers:{Cookie:staffCookie,'X-CSRF-Token':staffAuth.csrf,'Content-Type':'application/json'},body:JSON.stringify({data:{},revision:1})})).status,403);
  data.students=[{id:'p1',name:'Pupil One',year:data.classes[0].year,groupIds:[data.classes[0].id]}];
  assert.equal((await fetch(base+'/api/school',{method:'POST',headers,body:JSON.stringify({data,revision:1})})).status,200);
  assert.equal((await fetch(base+'/api/accounts',{method:'POST',headers,body:JSON.stringify({username:'pupil',password:'Test-student-password',role:'student',entityId:'p1'})})).status,201);
  const pupilLogin=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'pupil',password:'Test-student-password'})}),pupilCookie=pupilLogin.headers.get('set-cookie').split(';')[0];
  const pupilPortal=await (await fetch(base+'/api/portal?date=2026-10-06&studentId=other',{headers:{Cookie:pupilCookie}})).json();assert.equal(pupilPortal.identity.id,'p1');assert.ok(pupilPortal.master.every(a=>a.groupId===data.classes[0].id));assert.equal((await fetch(base+'/api/school',{headers:{Cookie:pupilCookie}})).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(dataDir,{recursive:true,force:true});}
});
