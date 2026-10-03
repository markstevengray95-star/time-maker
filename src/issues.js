import { activeTimetable, slots, weeks, periods, qualified, targets, matchesPeriod, lessonSlots, roomClosed, longestRun } from './timetableCore.js';
import { demand } from './planning.js';

export const issueGroups = [
  ['impossible','🔴','Impossible constraints'], ['difficult','🟠','Difficult constraints'],
  ['preference','🟡','Preferences not met'], ['workload','🔵','Workload concerns'],
];
export function analyseIssues(data, timetable = activeTimetable(data)) {
  const findings = [], all = slots(data), assignments = timetable?.assignments || [];
  const add = (category,title,detail,fix) => findings.push({ id:`${category}-${findings.length}`, category,title,detail,fix });
  const requirements = data.curriculumRequirements || [];
  requirements.forEach(r => {
    const teachers = (data.staff || []).filter(s => r.staffingMode === 'fixed' ? s.id === r.teacherId : qualified(r.subject,s));
    const group = (data.classes || []).find(g => g.id === r.targetGroupId);
    const rooms = (data.rooms || []).filter(room => Number(room.capacity) >= Number(group?.size || 0) &&
      (!r.roomType || r.roomType === 'No specialist room' || room.type === r.roomType));
    if (!teachers.length) add('impossible',`${r.name || r.subject}: no eligible teacher`,'The required teacher is missing, or no staff member has the required subject.','Assign a qualified teacher or correct the staff subject list.');
    if (!rooms.length) add('impossible',`${r.name || r.subject}: no suitable room`,'No room meets the room type and class capacity requirement.','Add a suitable room, correct the class size, or review the specialist-room requirement.');
    const eligibleSlots = all.filter(s => teachers.some(t => t.availability?.[s.dayKey] !== false &&
      !(data.constraints || []).some(c => c.enabled !== false && c.severity === 'hard' && c.ruleType === 'unavailable' && targets(c,{teacherId:t.id,groupId:group?.id,year:r.year,subject:r.subject}) && matchesPeriod(c,s))));
    const needed = Number(r.lessonsPerWeek || 0) * weeks(data).length;
    if (eligibleSlots.length < needed) add('impossible',`${r.name || r.subject}: insufficient available periods`,`${needed} teaching periods are required across the cycle, but only ${eligibleSlots.length} eligible time slots exist.`, 'Increase staff availability or reduce the allocation; check hard unavailable-period rules.');
    else if (teachers.length === 1 || rooms.length === 1) add('difficult',`${r.name || r.subject}: limited choices`,`${teachers.length} eligible teacher(s) and ${rooms.length} suitable room(s). This is a bottleneck, not proof that the timetable is impossible.`, 'Add another specialist or suitable room, or relax fixed staffing where appropriate.');
    if (timetable) weeks(data).forEach(week => {
      const placed = assignments.filter(a => a.requirementId === r.id && a.week === week).reduce((n,a) => n + periods(a),0);
      if (placed < demand(r,data)) add('difficult',`${r.name || r.subject}: ${demand(r,data)-placed} periods missing in Week ${week}`,'The selected timetable does not deliver the full curriculum allocation. A failed placement does not establish mathematical impossibility.', 'Check teacher and room bottlenecks, conflicting hard rules, and regenerate after changes.');
    });
  });
  const busy = new Map();
  assignments.forEach(a => {
    const teacher = data.staff?.find(s => s.id === a.teacherId), room = data.rooms?.find(r => r.id === a.roomId);
    if (!teacher) add('impossible',`${a.subject}: missing teacher`,'The assignment references a deleted or missing member of staff.','Reassign the lesson in the visual editor.');
    if (!room) add('impossible',`${a.subject}: missing room`,'The assignment references a deleted or missing room.','Assign a valid room in the visual editor.');
    const group=data.classes?.find(g=>g.id===a.groupId),requirement=data.curriculumRequirements?.find(r=>r.id===a.requirementId);
    if(room&&Number(room.capacity || 0)<Number(group?.size || 0))add('impossible',`${a.subject}: room capacity exceeded`,'The assigned room is too small for the current class size.','Move the lesson to a larger suitable room.');
    if(room&&requirement?.roomType&&!['No specialist room',room.type].includes(requirement.roomType))add('impossible',`${a.subject}: unsuitable room`,'The assigned room does not meet the specialist-room requirement.','Assign a room of the required type.');
    if(requirement?.staffingMode==='fixed'&&a.teacherId!==requirement.teacherId)add('impossible',`${a.subject}: fixed teacher changed`,'The assignment uses a different teacher from the curriculum requirement.','Correct the allocation or the fixed-teacher setting.');
    const occupied = lessonSlots(a,data);
    if (occupied.length !== periods(a)) add('impossible',`${a.subject}: invalid timetable slot`,'The school day has changed since this timetable was generated.','Regenerate or move this lesson into valid periods.');
    occupied.forEach(s => {
      if(teacher?.protectedSlots?.some(p=>p.slotId===s.id))add('impossible',`${a.subject}: protected-time clash`,`${teacher.initials || teacher.name} has protected time during ${s.dayLabel} ${s.name}.`,'Move the lesson or review the protected-time reservation.');
      ['teacherId','roomId','groupId'].forEach(field => {
        if (!a[field]) return;
        const key = `${field}:${a[field]}:${s.id}`, previous = busy.get(key);
        if (previous) add('impossible',`${field.replace('Id','')} clash: ${a.subject}`,`${previous.subject} and ${a.subject} occupy ${s.dayLabel} ${s.name}, Week ${s.week}.`, 'Move one lesson or assign a different teacher/room.');
        busy.set(key,a);
      });
      if (teacher?.availability?.[s.dayKey] === false || roomClosed(room,s)) add('impossible',`${a.subject}: unavailable resource`,`${s.dayLabel} ${s.name} uses unavailable staff or a closed room.`, 'Move this lesson or update availability after checking the school requirements.');
    });
  });
  (data.constraints || []).filter(c => c.enabled !== false).forEach(c => {
    const relevant = assignments.filter(a => targets(c,a));
    let violated = [];
    if (['unavailable','avoid-period'].includes(c.ruleType)) violated = relevant.filter(a => lessonSlots(a,data).some(s => matchesPeriod(c,s)));
    if (['prefer-period','fixed-period'].includes(c.ruleType)) violated = relevant.filter(a => !lessonSlots(a,data).some(s => matchesPeriod(c,s)));
    if (c.ruleType === 'preferred-room') violated = relevant.filter(a => a.roomId !== c.roomId);
    const buckets = new Map();
    relevant.forEach(a => {const key = `${a.week}:${a.dayKey}`; buckets.set(key,[...(buckets.get(key)||[]),a]);});
    if (c.ruleType === 'max-daily') violated = [...buckets.values()].flatMap(row => row.reduce((n,a)=>n+periods(a),0) > Number(c.value) ? row : []);
    if (c.ruleType === 'max-consecutive') violated = [...buckets.values()].flatMap(row => longestRun(row.flatMap(a => lessonSlots(a,data).map(s=>s.periodIndex))) > Number(c.value) ? row : []);
    if (c.ruleType === 'different-days') violated = [...buckets.values()].flatMap(row => row.length > 1 ? row : []);
    if (c.ruleType === 'same-day') violated = weeks(data).flatMap(w => new Set(relevant.filter(a=>a.week===w).map(a=>a.dayKey)).size > 1 ? relevant.filter(a=>a.week===w) : []);
    if (c.ruleType === 'min-free') violated = weeks(data).flatMap(w => {
      const teacher = data.staff?.find(s=>s.id===c.targetId);
      const available = all.filter(s=>s.week===w && (!teacher || teacher.availability?.[s.dayKey]!==false)).length;
      const used = new Set(relevant.filter(a=>a.week===w).flatMap(a=>lessonSlots(a,data).map(s=>s.id))).size;
      return available-used < Number(c.value) ? relevant.filter(a=>a.week===w) : [];
    });
    if (violated.length) add(c.severity === 'hard' ? 'impossible' : 'preference',c.name || c.ruleType,`${violated.length} lesson block(s) violate this ${c.severity === 'hard' ? 'hard rule' : 'preference'} in the selected timetable.`, 'Review affected lessons in the visual editor, change this rule if appropriate, or compare another generated option.');
  });
  (data.staff || []).forEach(t => weeks(data).forEach(w => {
    const row = assignments.filter(a=>a.teacherId===t.id && a.week===w), load = row.reduce((n,a)=>n+periods(a),0);
    const available = all.filter(s=>s.week===w && t.availability?.[s.dayKey]!==false).length;
    if (load > Number(t.maxPeriods || 0) || load + Number(t.ppaPeriods || 0) + Number(t.leadershipPeriods || 0) > available)
      add('workload',`${t.initials || t.name}: workload in Week ${w}`,`${load} teaching periods, ${t.ppaPeriods || 0} PPA and ${t.leadershipPeriods || 0} leadership periods against ${available} available periods.`, 'Reduce teaching allocation or ensure protected time and contracted availability are correctly entered.');
    (data.days || []).filter(d=>d.enabled).forEach(d=>{
      const daily = row.filter(a=>a.dayKey===d.key), count = daily.reduce((n,a)=>n+periods(a),0);
      const run = longestRun(daily.flatMap(a=>lessonSlots(a,data).map(s=>s.periodIndex)));
      if (count > Number(t.maxDaily || Infinity) || run > Number(t.maxConsecutive || Infinity)) add('workload',`${t.initials || t.name}: ${d.label}, Week ${w}`,`${count} teaching periods; longest run ${run}.`, 'Move lessons to another day or insert a free period.');
    });
  }));
  return findings;
}
