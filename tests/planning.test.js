import test from 'node:test';import assert from 'node:assert/strict';import {modelCurriculum,applyCurriculumScenario} from '../src/planning.js';
test('15 groups moving from 4 to 5 lessons need 15 extra periods with 8 shortfall',()=>{
 const d={days:[{key:'mon',enabled:true}],blocks:Array.from({length:100},(_,i)=>({id:`p${i}`,type:'lesson'})),staff:[{id:'t',subjects:['Science'],maxPeriods:67,ppaPeriods:0,leadershipPeriods:0}],classes:Array.from({length:15},(_,i)=>({id:`g${i}`,year:'Year 8',name:`8${i}`,type:'Teaching group'})),curriculumRequirements:[{id:'r',year:'Year 8',subject:'Science',lessonsPerWeek:4,targetType:'year'}]};
 const s={year:'Year 8',subject:'Science',lessonsPerWeek:5},m=modelCurriculum(d,s);
 assert.equal(m.delta,15);assert.equal(m.spare,7);assert.equal(m.shortfall,8);
 assert.equal(applyCurriculumScenario(d,s).curriculumRequirements.length,15);assert.equal(d.curriculumRequirements[0].lessonsPerWeek,4);
});
test('shared subject teacher cannot supply full capacity independently to two subjects',()=>{
 const d={days:[{key:'mon',enabled:true}],blocks:Array.from({length:10},(_,i)=>({id:`p${i}`,type:'lesson'})),staff:[{id:'t',subjects:['Science','Maths'],maxPeriods:10}],classes:[{id:'g',year:'Y',type:'Teaching group'}],curriculumRequirements:[{id:'s',year:'Y',subject:'Science',targetGroupId:'g',lessonsPerWeek:4},{id:'m',year:'Y',subject:'Maths',targetGroupId:'g',lessonsPerWeek:5}]};
 assert.equal(modelCurriculum(d,{year:'Y',subject:'Science',lessonsPerWeek:7}).shortfall,2);
});
