import {activeTimetable,lessonSlots,qualified,targets,matchesPeriod,longestRun,periods} from './timetableCore.js';
import {staffWorkload} from './workload.js';import {absentAt,dateInfo,dayLessons,dailyView} from './daily.js';
export function coverCandidates(data,date,lesson,bookings=[],allowCombine=false,timetable=activeTimetable(data)) {
 const info=dateInfo(data,date),needed=lessonSlots(lesson,data),ids=needed.map(s=>s.id),master=dailyView({...data,coverPlans:[]},date,timetable).filter(a=>!a.cancelled);
 const workloads=staffWorkload(data,timetable);
 const existing=(data.coverPlans || []).filter(p=>p.date!==date&&p.timetableId===timetable?.id&&dateInfo(data,p.date).monday===info.monday).flatMap(p=>p.assignments);
 return (data.staff || []).flatMap(t=>{
  if(t.id===lesson.teacherId||t.availability?.[info.dayKey]===false||absentAt(data,t.id,date,ids))return [];
  if((t.protectedSlots || []).some(p=>ids.includes(p.slotId)))return [];
  if((data.constraints || []).some(c=>c.enabled!==false&&c.severity==='hard'&&c.ruleType==='unavailable'&&targets(c,{teacherId:t.id})&&needed.some(s=>matchesPeriod(c,s))))return [];
  const workload=workloads.find(w=>w.id===t.id)?.perWeek.find(w=>w.week===info.week);
  const booked=[...existing,...bookings].filter(b=>b.teacherId===t.id).reduce((n,b)=>n+Number(b.periods || 1),0);
  if(!workload||booked+periods(lesson)>workload.coverCapacity)return [];
  if(bookings.some(b=>b.teacherId===t.id&&b.slotIds.some(s=>ids.includes(s))))return [];
  const clash=master.filter(a=>a.teacherId===t.id&&lessonSlots(a,data).some(s=>ids.includes(s.id)));
  let combine=null;
  if(clash.length){
   if(!allowCombine||clash.length!==1)return [];
   const a=clash[0],room=data.rooms?.find(r=>r.id===a.roomId),group=data.classes?.find(g=>g.id===a.groupId),missing=data.classes?.find(g=>g.id===lesson.groupId);
   if(a.subject!==lesson.subject||a.year!==lesson.year||a.groupId===lesson.groupId||a.slotIds?.length!==ids.length||!ids.every(s=>a.slotIds.includes(s)))return [];
   const already=bookings.filter(b=>b.combinedWithLessonId===a.id).reduce((n,b)=>n+Number(data.classes?.find(g=>g.id===b.groupId)?.size||0),0);
   if(!group?.size||!missing?.size||Number(group.size)+Number(missing.size)+already>Number(room?.capacity || 0))return [];
   combine=a;
  }
  const teaching=master.filter(a=>a.teacherId===t.id),bookedToday=bookings.filter(b=>b.teacherId===t.id);
  const count=teaching.reduce((n,a)=>n+periods(a),0)+bookedToday.filter(b=>!b.combinedWithLessonId).reduce((n,b)=>n+b.periods,0)+(combine?0:periods(lesson));
  const indices=[...teaching.flatMap(a=>lessonSlots(a,data).map(s=>s.periodIndex)),...bookedToday.flatMap(b=>b.periodIndices || []),...needed.map(s=>s.periodIndex)];
  if(count>Number(t.maxDaily || Infinity)||longestRun(indices)>Number(t.maxConsecutive || Infinity))return [];
  const specialist=qualified(lesson.subject,t);
  return [{teacherId:t.id,name:t.name,initials:t.initials,specialist,used:booked,remaining:workload.coverCapacity-booked,
   combinedWithLessonId:combine?.id,roomId:combine?.roomId || lesson.roomId,score:(specialist?100:0)-booked*10-(combine?40:0),
   reason:combine?'Combine same-year subject groups within room capacity; check practical supervision.':specialist?'Free subject specialist within cover allocation.':'Free teacher within cover allocation; subject specialist unavailable.'}];
 }).sort((a,b)=>b.score-a.score||String(a.name || a.initials || a.teacherId).localeCompare(String(b.name || b.initials || b.teacherId)));
}
export function suggestCover(data,date,allowCombine=false,timetable=activeTimetable(data)) {
 if(!timetable)throw new Error('Generate or publish a timetable first.');
 const lessons=dailyView({...data,coverPlans:[]},date,timetable).filter(a=>!a.cancelled&&absentAt(data,a.teacherId,date,a.slotIds || [])),assignments=[],unfilled=[];
 lessons.sort((a,b)=>coverCandidates(data,date,a,[],allowCombine,timetable).length-coverCandidates(data,date,b,[],allowCombine,timetable).length);
 lessons.forEach(a=>{
  const candidate=coverCandidates(data,date,a,assignments,allowCombine,timetable)[0];
  if(candidate)assignments.push({lessonId:a.id,groupId:a.groupId,subject:a.subject,...candidate,slotIds:lessonSlots(a,data).map(s=>s.id),periodIndices:lessonSlots(a,data).map(s=>s.periodIndex),periods:periods(a)});
  else unfilled.push({lessonId:a.id,subject:a.subject,groupName:a.groupName || a.year,reason:'No available teacher within cover, protected-time and daily workload limits.'});
 });
 return {date,timetableId:timetable.id,week:dateInfo(data,date).week,assignments,unfilled,createdAt:new Date().toISOString()};
}
