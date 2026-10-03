import {norm,qualified,slots,uid} from './timetableCore.js';
export function requirementGroups(r,data) {
  if(r.targetGroupId)return (data.classes || []).filter(g=>g.id===r.targetGroupId);
  return (data.classes || []).filter(g=>g.year===r.year && ['Form','Teaching group','Set','Sixth form','Mixed year'].includes(g.type));
}
export const demand = (r,data) => Number(r.lessonsPerWeek || 0)*(r.targetGroupId ? 1 : requirementGroups(r,data).length || 1);
export function expandCurriculum(data) {
 const result=[],cycle=data.school?.cycle==='two-week'?['A','B']:['A'];
 (data.curriculumRequirements || []).forEach(r=>{
  const total=Math.max(0,Number(r.lessonsPerWeek || 0)),doubles=Math.min(Math.floor(total/2),Math.max(0,Number(r.doublePeriods || 0)));
  const groups=requirementGroups(r,data),targets=groups.length?groups:[null];
  targets.forEach(g=>cycle.forEach(week=>{
   const target={groupId:g?.id || '',groupName:g?.name || '',year:r.year || g?.year || '',size:Number(g?.size || 0),optionBlock:g?.optionBlock || ''};
   const create=duration=>({id:uid(),requirementId:r.id,week,duration,subject:r.subject,label:r.name || `${target.groupName || target.year} ${r.subject}`,...target,requirement:r});
   for(let i=0;i<doubles;i++)result.push(create(2));for(let i=0;i<total-doubles*2;i++)result.push(create(1));
  }));
 });return result;
}
export function teachingCapacity(t,data) {
  const available=slots(data).filter(s=>s.week==='A' && t.availability?.[s.dayKey]!==false);
  const daily=(data.days || []).filter(d=>d.enabled).reduce((n,d)=>n+Math.min(available.filter(s=>s.dayKey===d.key).length,Number(t.maxDaily || Infinity)),0);
  return Math.max(0,Math.min(Number(t.maxPeriods || 0),daily-Number(t.ppaPeriods || 0)-Number(t.leadershipPeriods || 0)));
}
// Allocate the other curriculum first using a residual network, so a multi-subject
// teacher's capacity is never independently counted for each subject.
export function remainingCapacity(data,subject) {
  const staff=data.staff || [], other=(data.curriculumRequirements || []).filter(r=>norm(r.subject)!==norm(subject));
  const size=2+other.length+staff.length, source=0,sink=size-1;
  const edges=Array.from({length:size},()=>Array(size).fill(0));
  other.forEach((r,i)=>{
    edges[source][1+i]=demand(r,data);
    staff.forEach((t,j)=>{if(r.staffingMode==='fixed'?t.id===r.teacherId:qualified(r.subject,t))edges[1+i][1+other.length+j]=100000;});
  });
  staff.forEach((t,j)=>{edges[1+other.length+j][sink]=teachingCapacity(t,data);});
  let allocated=0;
  while(true){
    const parent=Array(size).fill(-1),queue=[source];parent[source]=source;
    for(let k=0;k<queue.length;k++){const u=queue[k];for(let v=0;v<size;v++)if(parent[v]<0&&edges[u][v]>0){parent[v]=u;queue.push(v);}}
    if(parent[sink]<0)break;
    let amount=Infinity;for(let v=sink;v!==source;v=parent[v])amount=Math.min(amount,edges[parent[v]][v]);
    for(let v=sink;v!==source;v=parent[v]){edges[parent[v]][v]-=amount;edges[v][parent[v]]+=amount;}allocated+=amount;
  }
  const rows=staff.filter(t=>qualified(subject,t)).map(t=>{
    const index=staff.indexOf(t),remaining=edges[1+other.length+index][sink];
    return {teacher:t,capacity:teachingCapacity(t,data),remaining};
  });
  return {rows,capacity:rows.reduce((n,r)=>n+r.remaining,0),otherShortfall:other.reduce((n,r)=>n+demand(r,data),0)-allocated};
}
export function modelCurriculum(data,{year,subject,lessonsPerWeek}) {
  const relevant=(data.curriculumRequirements || []).filter(r=>r.year===year&&norm(r.subject)===norm(subject));
  const groupIds=new Set(relevant.flatMap(r=>requirementGroups(r,data).map(g=>g.id)));
  const groups=groupIds.size || relevant.length;
  const current=relevant.reduce((n,r)=>n+demand(r,data),0),proposed=groups*Number(lessonsPerWeek);
  const existingSubject=(data.curriculumRequirements || []).filter(r=>norm(r.subject)===norm(subject)).reduce((n,r)=>n+demand(r,data),0);
  const staffing=remainingCapacity(data,subject),spare=staffing.capacity-existingSubject,delta=proposed-current;
  return {groups,current,proposed,delta,spare,capacity:staffing.capacity,totalProposed:existingSubject+delta,
    shortfall:Math.max(0,existingSubject+delta-staffing.capacity),otherShortfall:staffing.otherShortfall,staff:staffing.rows};
}
export function applyCurriculumScenario(data,scenario) {
  return {...data,curriculumRequirements:(data.curriculumRequirements || []).flatMap(r=>{
    if(r.year!==scenario.year||norm(r.subject)!==norm(scenario.subject))return [r];
    const groups=requirementGroups(r,data);
    if(!r.targetGroupId&&groups.length)return groups.map(g=>({...r,id:uid(),name:`${g.name} ${r.subject}`,targetType:'group',targetGroupId:g.id,lessonsPerWeek:Number(scenario.lessonsPerWeek)}));
    return [{...r,lessonsPerWeek:Number(scenario.lessonsPerWeek)}];
  })};
}
