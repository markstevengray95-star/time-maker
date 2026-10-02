import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData } from '../src/demoData.js';
import { analyseIssues } from '../src/issues.js';
test('diagnoses a teacher clash with a practical fix',()=>{
  const data=buildDemoData(), option=data.generatedTimetables[0];
  option.assignments.push({...option.assignments[0],id:'clash'});
  assert.ok(analyseIssues(data).some(i=>i.category==='impossible' && i.title.includes('teacher clash') && i.fix.includes('Move')));
});
test('unscheduled lessons are difficult, not proof of impossibility',()=>{
  const data=buildDemoData();data.generatedTimetables[0].assignments=[];
  assert.ok(analyseIssues(data).some(i=>i.category==='difficult' && i.title.includes('missing')));
});
test('missing fixed teacher is impossible even before generation',()=>{
  const data=buildDemoData();data.staff=[];data.generatedTimetables=[];
  assert.ok(analyseIssues(data).some(i=>i.category==='impossible'&&i.title.includes('no eligible teacher')));
});
