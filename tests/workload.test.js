import test from 'node:test';import assert from 'node:assert/strict';
import {buildDemoData} from '../src/demoData.js';import {staffWorkload} from '../src/workload.js';
test('two-week load is reported per week, doubles consume two periods',()=>{
 const d=buildDemoData();d.school.cycle='two-week';d.generatedTimetables[0].assignments=[{teacherId:d.staff[0].id,week:'A',dayKey:'mon',duration:2,slotIds:['A:mon:p1','A:mon:p2']},{teacherId:d.staff[0].id,week:'B',dayKey:'mon',duration:1,slotIds:['B:mon:p1']}];
 const t=staffWorkload(d)[0];assert.equal(t.perWeek[0].allocation,2);assert.equal(t.perWeek[1].allocation,1);assert.equal(t.perWeek[0].daily[0].consecutive,2);
});
test('part-time availability and protected time reduce cover capacity',()=>{
 const d=buildDemoData();const t=d.staff[0];t.availability={mon:true,tue:false,wed:false,thu:false,fri:false};t.ppaPeriods=4;t.leadershipPeriods=2;d.generatedTimetables[0].assignments=[];
 assert.equal(staffWorkload(d)[0].perWeek[0].available,6);assert.equal(staffWorkload(d)[0].perWeek[0].coverCapacity,0);
});
