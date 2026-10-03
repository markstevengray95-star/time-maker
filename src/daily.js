import {activeTimetable,slots,lessonSlots,weeks} from './timetableCore.js';
export function schoolToday(data) {return new Intl.DateTimeFormat('en-CA',{timeZone:data.school?.timezone || 'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function dateInfo(data,date) {
 const parsed=new Date(date+'T12:00:00Z');if(Number.isNaN(parsed.getTime()))throw new Error('Choose a valid date.');
 const dayKey=['sun','mon','tue','wed','thu','fri','sat'][parsed.getUTCDay()];
 const anchor=data.operationsSettings?.cycleAnchor || data.terms?.[0]?.start || '2026-09-07';
 const origin=new Date(anchor+'T12:00:00Z');origin.setUTCDate(origin.getUTCDate()-((origin.getUTCDay()+6)%7));
 const diff=Math.floor((parsed-origin)/604800000),week=weeks(data).length===2&&((diff%2)+2)%2===1?'B':'A';
 const monday=new Date(parsed);monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
 return {dayKey,week,monday:monday.toISOString().slice(0,10),date};
}
export function absentAt(data,teacherId,date,slotIds) {
 return (data.staffAbsences || []).some(a=>a.teacherId===teacherId&&a.date===date&&(!a.slotIds?.length||a.slotIds.some(s=>slotIds.includes(s))));
}
export function dayLessons(data,date,timetable=activeTimetable(data)) {
 const info=dateInfo(data,date);return (timetable?.assignments || []).filter(a=>a.week===info.week&&a.dayKey===info.dayKey);
}
export function dailyView(data,date,timetable=data.publishedTimetable || activeTimetable(data)) {
 const master=dayLessons(data,date,timetable),changes=(data.dailyChanges || []).filter(c=>c.date===date);
 const plan=(data.coverPlans || []).find(p=>p.date===date&&p.timetableId===timetable?.id);
 return master.map(a=>{
  const cover=plan?.assignments.find(c=>c.lessonId===a.id),relevant=changes.filter(c=>(!c.lessonId||c.lessonId===a.id)&&(!c.groupId||c.groupId===a.groupId)&&(!c.slotId||a.slotIds?.includes(c.slotId)));
  const roomChange=relevant.filter(c=>c.type==='room').at(-1),cancelled=relevant.some(c=>['cancelled','trip','exam'].includes(c.type));
  const teacher=data.staff?.find(s=>s.id===(cover?.teacherId || a.teacherId)),room=data.rooms?.find(r=>r.id===(roomChange?.roomId || cover?.roomId || a.roomId));
  return {...a,date,originalTeacherId:a.teacherId,originalRoomId:a.roomId,teacherId:cover?.teacherId || a.teacherId,teacherName:teacher?.name || a.teacherName,teacherInitials:teacher?.initials || a.teacherInitials,
   roomId:roomChange?.roomId || cover?.roomId || a.roomId,roomName:room?.name || a.roomName,roomCode:room?.code || a.roomCode,cover:Boolean(cover),combinedWithLessonId:cover?.combinedWithLessonId,
   absent:absentAt(data,a.teacherId,date,a.slotIds || []),cancelled,changes:relevant};
 });
}
export function dateSlots(data,date) {const info=dateInfo(data,date);return slots(data).filter(s=>s.week===info.week&&s.dayKey===info.dayKey);}
