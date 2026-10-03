import {activeTimetable,qualified,norm,slots,lessonSlots,roomClosed,weeks,periods} from './timetableCore.js';import {staffWorkload} from './workload.js';import {demand} from './planning.js';
export function departmentDashboard(data,department,week='A',timetable=activeTimetable(data)) {
 const staff=(data.staff || []).filter(t=>t.department===department),ids=new Set(staff.map(t=>t.id));
 const requirements=(data.curriculumRequirements || []).filter(r=>{
  const subject=(data.subjects || []).find(s=>norm(s.name)===norm(r.subject));if(subject?.department)return subject.department===department;
  if(r.staffingMode==='fixed')return ids.has(r.teacherId);
  return staff.some(t=>qualified(r.subject,t));
 });
 const reqIds=new Set(requirements.map(r=>r.id)),assignments=(timetable?.assignments || []).filter(a=>a.week===week&&(ids.has(a.teacherId)||reqIds.has(a.requirementId)));
 const workload=staffWorkload(data,timetable).filter(t=>ids.has(t.id)).map(t=>({...t,...t.perWeek.find(w=>w.week===week)}));
 const curriculum=requirements.map(r=>{const delivered=assignments.filter(a=>a.requirementId===r.id).reduce((n,a)=>n+periods(a),0);return {...r,required:demand(r,data),delivered,missing:Math.max(0,demand(r,data)-delivered)};});
 const groups=new Set(assignments.map(a=>a.groupId).filter(Boolean));requirements.forEach(r=>{if(r.targetGroupId)groups.add(r.targetGroupId);else (data.classes || []).filter(g=>g.year===r.year).forEach(g=>groups.add(g.id));});
 const unstaffed=[...groups].map(id=>data.classes?.find(g=>g.id===id)).filter(Boolean).filter(g=>{
  const lessons=assignments.filter(a=>a.groupId===g.id);return !lessons.length||lessons.some(a=>!data.staff?.some(t=>t.id===a.teacherId));
 });
 const rooms=(data.rooms || []).filter(r=>r.department===department||assignments.some(a=>a.roomId===r.id)).map(r=>{
  const available=slots(data).filter(s=>s.week===week&&!roomClosed(r,s)).length;
  const used=new Set(assignments.filter(a=>a.roomId===r.id).flatMap(a=>lessonSlots(a,data).map(s=>s.id))).size;
  const allUsed=new Set((timetable?.assignments || []).filter(a=>a.week===week&&a.roomId===r.id).flatMap(a=>lessonSlots(a,data).map(s=>s.id))).size;
  return {...r,used,available,allUsed,ratio:available?used/available:0};
 });
 return {staff:workload,assignments,curriculum,unstaffed,rooms,week,department,teaching:workload.reduce((n,t)=>n+t.allocation,0),required:curriculum.reduce((n,r)=>n+r.required,0),delivered:curriculum.reduce((n,r)=>n+r.delivered,0)};
}
