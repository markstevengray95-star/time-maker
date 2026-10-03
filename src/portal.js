import {activeTimetable,lessonSlots,slots,uid} from './timetableCore.js';
import {analyseIssues} from './issues.js';import {dailyView,dateSlots,dateInfo} from './daily.js';
export function publishTimetable(data) {
 const timetable=activeTimetable(data);if(!timetable)throw new Error('Generate and select a timetable first.');
 const issues=analyseIssues(data,timetable);
 if(issues.some(i=>i.category==='impossible'||i.title.includes('periods missing')))throw new Error('Resolve hard-rule violations and missing curriculum periods before publishing.');
 const fields=['school','days','blocks','dayOverrides','staff','classes','rooms','operationsSettings'];
 return {...data,publishedTimetable:structuredClone(timetable),publishedSchool:structuredClone(Object.fromEntries(fields.map(k=>[k,data[k]]))),publishedAt:new Date().toISOString(),publicationId:uid(),coverPlans:[]};
}
export function publishedSource(data) {return {...data,...data.publishedSchool,publishedTimetable:data.publishedTimetable};}
const cleanLesson=a=>Object.fromEntries(['id','subject','year','groupId','groupName','week','dayKey','dayLabel','periodName','periodIndex','periodIndices','slotIds','duration','teacherId','teacherName','teacherInitials','roomId','roomName','roomCode','originalTeacherId','originalRoomId','cover','cancelled','absent'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));
const ordered=(lessons,source)=>lessons.slice().sort((a,b)=>String(a.week).localeCompare(String(b.week)) || (source.days || []).findIndex(d=>d.key===a.dayKey)-(source.days || []).findIndex(d=>d.key===b.dayKey) || a.periodIndex-b.periodIndex);
export function staffPortal(data,teacherId,date) {
 const source=publishedSource(data),teacher=source.staff?.find(s=>s.id===teacherId);
 if(!teacher)throw new Error('Staff member not found in the published school.');
 const timetable=data.publishedTimetable;
 const master=ordered((timetable?.assignments || []).filter(a=>a.teacherId===teacherId),source),view=timetable?ordered(dailyView(source,date,timetable),source):[];
 const today=view.filter(a=>a.teacherId===teacherId||a.originalTeacherId===teacherId).map(cleanLesson);
 const busy=new Set(view.filter(a=>a.teacherId===teacherId&&!a.cancelled).flatMap(a=>lessonSlots(a,source).map(s=>s.id)));
 const free=dateSlots(source,date).filter(s=>teacher.availability?.[s.dayKey]!==false&&!busy.has(s.id)).map(s=>({...s,purpose:teacher.protectedSlots?.find(p=>p.slotId===s.id)?.kind || 'Free'}));
 const classes=[...new Set(master.map(a=>a.groupId))].map(id=>source.classes?.find(g=>g.id===id)).filter(Boolean).map(g=>({id:g.id,name:g.name,year:g.year,subject:g.subject,size:g.size}));
 const rooms=[...new Set([...master,...today].map(a=>a.roomId))].map(id=>source.rooms?.find(r=>r.id===id)).filter(Boolean).map(r=>({id:r.id,name:r.name,code:r.code,building:r.building}));
 const duties=(teacher.duties || []).filter(d=>(!d.date||d.date===date)&&(!d.week||d.week===dateInfo(source,date).week)&&(!d.dayKey||d.dayKey===dateInfo(source,date).dayKey)).map(d=>({title:d.title,location:d.location,slotId:d.slotId}));
 const protectedDuties=(teacher.protectedSlots || []).filter(p=>p.kind==='Duty'&&dateSlots(source,date).some(s=>s.id===p.slotId)).map(p=>({title:'Duty',slotId:p.slotId}));
 return {identity:{id:teacher.id,name:teacher.name,initials:teacher.initials},role:'staff',school:{name:source.school?.name},publishedAt:data.publishedAt,date,week:dateInfo(source,date).week,today,master:master.map(cleanLesson),classes,rooms,duties:[...duties,...protectedDuties],free,
  notices:(source.dailyChanges || []).filter(c=>c.date===date&&c.type==='event'&&(!c.groupId||classes.some(g=>g.id===c.groupId))).map(c=>({id:c.id,title:c.title}))};
}
export function studentPortal(data,studentId,date) {
 const student=data.students?.find(s=>s.id===studentId);if(!student)throw new Error('Pupil record not found.');
 const source=publishedSource(data),groups=new Set(student.groupIds || []),matches=a=>groups.has(a.groupId)||(!a.groupId&&a.year===student.year);
 const master=ordered((data.publishedTimetable?.assignments || []).filter(matches),source);
 const today=data.publishedTimetable?ordered(dailyView(source,date,data.publishedTimetable).filter(matches),source).map(a=>({...cleanLesson(a),notices:(a.changes || []).map(c=>({type:c.type,title:c.title}))})):[];
 return {role:'student',identity:{id:student.id,name:student.name,year:student.year},school:{name:source.school?.name},publishedAt:data.publishedAt,date,week:dateInfo(source,date).week,
  today,master:master.map(cleanLesson),weeks:source.school?.cycle==='two-week'?['A','B']:['A'],
  notices:(source.dailyChanges || []).filter(c=>c.date===date&&c.type==='event'&&(!c.groupId||groups.has(c.groupId))).map(c=>({id:c.id,title:c.title}))};
}
