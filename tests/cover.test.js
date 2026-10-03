import test from 'node:test';import assert from 'node:assert/strict';import {buildDemoData} from '../src/demoData.js';import {suggestCover,coverCandidates} from '../src/cover.js';import {dateInfo,dailyView} from '../src/daily.js';
test('date anchor handles Week A/B and dates before anchor',()=>{const d={school:{cycle:'two-week'},operationsSettings:{cycleAnchor:'2026-09-07'}};assert.equal(dateInfo(d,'2026-09-08').week,'A');assert.equal(dateInfo(d,'2026-09-15').week,'B');assert.equal(dateInfo(d,'2026-08-31').week,'B');});
test('suggestions exclude absent and protected staff and do not mutate master',()=>{
 const d=buildDemoData(),date='2026-10-06',lesson=d.generatedTimetables[0].assignments.find(a=>a.dayKey==='tue'),before=JSON.stringify(d.generatedTimetables);
 d.staffAbsences=[{date,teacherId:lesson.teacherId}];const candidates=coverCandidates(d,date,lesson);
 assert.ok(candidates.every(c=>c.teacherId!==lesson.teacherId));if(candidates[0]){const t=d.staff.find(s=>s.id===candidates[0].teacherId);t.protectedSlots=lesson.slotIds.map(slotId=>({slotId,kind:'PPA'}));assert.ok(!coverCandidates(d,date,lesson).some(c=>c.teacherId===t.id));}
 const plan=suggestCover(d,date);assert.equal(JSON.stringify(d.generatedTimetables),before);d.coverPlans=[plan];assert.ok(dailyView(d,date).every(a=>!a.cover||a.originalTeacherId!==a.teacherId));
});
test('a cover teacher cannot be allocated to two simultaneous lessons',()=>{const d=buildDemoData(),date='2026-10-06';d.staffAbsences=d.staff.map(t=>({date,teacherId:t.id}));const plan=suggestCover(d,date);assert.equal(plan.assignments.length,0);assert.ok(plan.unfilled.length);});
