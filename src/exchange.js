import {norm,uid,activeTimetable} from './timetableCore.js';import {staffWorkload} from './workload.js';
const field=(name,required=false,type='text',defaultValue=undefined)=>({name,required,type,defaultValue});
export const schemas={
 staff:[field('id',true),field('name',true),field('initials'),field('department'),field('subjects',true,'list'),field('fte',false,'fraction',1),field('maxPeriods',false,'number',30),field('ppaPeriods',false,'number',3),field('leadershipPeriods',false,'number',0),field('coverPeriods',false,'number',2),field('maxDaily',false,'number',6),field('maxConsecutive',false,'number',4),field('availableDays',false,'days')],
 students:[field('id',true),field('name',true),field('year',true),field('groupIds',false,'list',[])],
 classes:[field('id',true),field('name',true),field('year',true),field('type',false,'groupType','Teaching group'),field('subject'),field('size',false,'number',30),field('teacherId'),field('optionBlock')],
 subjects:[field('id',true),field('name',true),field('department')],
 yearGroups:[field('id',true),field('name',true),field('keyStage',true)],
 rooms:[field('id',true),field('name',true),field('code'),field('department'),field('type',false,'roomType','General classroom'),field('capacity',true,'number'),field('building')],
 curriculumRequirements:[field('id',true),field('name'),field('year',true),field('subject',true),field('targetType',false,'targetType','group'),field('targetGroupId'),field('lessonsPerWeek',true,'number'),field('doublePeriods',false,'number',0),field('maxSameDay',false,'number',1),field('staffingMode',false,'staffingMode','any-qualified'),field('teacherId'),field('roomType',false,'roomType','No specialist room')],
};
export const labels={staff:'Staff',students:'Pupils',classes:'Classes / teaching groups',subjects:'Subjects',yearGroups:'Year groups',rooms:'Rooms',curriculumRequirements:'Curriculum allocations'};
const enums={days:['mon','tue','wed','thu','fri','sat','sun'],groupType:['Form','Teaching group','Set','Option group','Sixth form','Mixed year','Intervention'],roomType:['No specialist room','General classroom','Science lab','Computer room','Art room','Music room','Drama space','Sports facility','Workshop / DT room','Kitchen / food room','Library / study space','Other'],targetType:['year','group'],staffingMode:['fixed','any-qualified']};
export function records(data,type) {if(type==='yearGroups')return data.yearGroups || (data.keyStages || []).flatMap(k=>k.years.map((name,i)=>({id:`${k.id}-${i}`,name,keyStage:k.name})));return data[type] || [];}
export function autoMapping(type,headers) {
 const aliases={id:['staffid','studentid','pupilid','classid','subjectid','yearid','roomid','requirementid'],name:['fullname','staffname','pupilname','studentname','classname','subjectname','roomname','yearname'],year:['yeargroup'],initials:['staffcode'],groupIds:['classids','teachinggroups'],size:['classsize'],maxPeriods:['teachingperiods'],subjects:['qualifiedsubjects']};
 const compact=x=>norm(x).replace(/[^a-z0-9]/g,'');
 return Object.fromEntries(schemas[type].map(f=>[f.name,headers.find(h=>compact(h)===compact(f.name)) || headers.find(h=>(aliases[f.name] || []).includes(compact(h))) || '']));
}
function convert(value,f) {
 const text=String(value ?? '').trim();
 if(f.required&&!text)throw new Error(`${f.name} is required.`);
 if(!text)return undefined;
 if(f.type==='number'||f.type==='fraction') {const n=Number(text);if(!Number.isFinite(n)||n<0||(f.type==='number'&&!Number.isInteger(n))||(f.type==='fraction'&&n>1))throw new Error(`${f.name} must be ${f.type==='fraction'?'between 0 and 1':'a non-negative whole number'}.`);return n;}
 if(f.type==='list'||f.type==='days'){const list=text.split(';').map(x=>x.trim()).filter(Boolean);if(f.type==='days'&&list.some(d=>!enums.days.includes(d.toLowerCase())))throw new Error('availableDays must use mon;tue;wed;thu;fri;sat;sun.');return [...new Set(f.type==='days'?list.map(x=>x.toLowerCase()):list)];}
 if(enums[f.type]&&!enums[f.type].includes(text))throw new Error(`${f.name}: choose ${enums[f.type].join(', ')}.`);
 if(text.length>1000)throw new Error(`${f.name} exceeds 1,000 characters.`);
 return text;
}
export function previewImport(data,type,rows,mapping=autoMapping(type,Object.keys(rows[0] || {}))) {
 if(!schemas[type])throw new Error('Unknown import type.');
 const errors=[],valid=[],seen=new Set(),existing=new Map(records(data,type).map(r=>[r.id,r]));
 if(!rows.length)errors.push({row:0,message:'The file contains no data rows.'});
 if(rows.length>5000)errors.push({row:0,message:'Import at most 5,000 rows at a time.'});
 schemas[type].filter(f=>f.required&&!mapping[f.name]).forEach(f=>errors.push({row:1,message:`Map the required ${f.name} column.`}));
 if(errors.length)return {valid,errors,insertCount:0,updateCount:0};
 rows.forEach((input,i)=>{
  try{
   const id=String(input[mapping.id] ?? '').trim();if(seen.has(id))throw new Error(`Duplicate ID ${id}.`);seen.add(id);
   const old=existing.get(id),record={...old};
   schemas[type].forEach(f=>{const converted=mapping[f.name]?convert(input[mapping[f.name]],f):undefined;if(converted!==undefined)record[f.name]=converted;else if(record[f.name]===undefined&&f.defaultValue!==undefined)record[f.name]=structuredClone(f.defaultValue);});
   if(!record.id)throw new Error('id is required.');
   if(type==='staff'){
    const allowed=record.availableDays || (data.days || []).filter(d=>d.enabled).map(d=>d.key);
    record.availability=record.availableDays?Object.fromEntries(enums.days.map(d=>[d,allowed.includes(d)])):record.availability || Object.fromEntries(enums.days.map(d=>[d,allowed.includes(d)]));delete record.availableDays;
   }
   const teacherExists=id=>!id||(data.staff || []).some(t=>t.id===id);
   if(['classes','curriculumRequirements'].includes(type)&&!teacherExists(record.teacherId))throw new Error(`Unknown teacherId ${record.teacherId}. Import staff first.`);
   if(type==='students'&&(record.groupIds || []).some(id=>!data.classes?.some(g=>g.id===id)))throw new Error('Unknown groupIds. Import classes first.');
   if(type==='curriculumRequirements'){
    if(record.targetType==='group'&&!data.classes?.some(g=>g.id===record.targetGroupId))throw new Error('Select a valid targetGroupId or use targetType year.');
    if(record.staffingMode==='fixed'&&!record.teacherId)throw new Error('Fixed staffing requires teacherId.');
    if(record.doublePeriods*2>record.lessonsPerWeek)throw new Error('Double periods exceed the lesson allocation.');
   }
   if(['students','classes','curriculumRequirements'].includes(type)&&data.keyStages?.length&&!data.keyStages.flatMap(k=>k.years).includes(record.year))throw new Error(`Unknown year ${record.year}. Import year groups first.`);
   valid.push(record);
  }catch(e){errors.push({row:i+2,message:e.message});}
 });
 return {valid,errors,insertCount:valid.filter(r=>!existing.has(r.id)).length,updateCount:valid.filter(r=>existing.has(r.id)).length};
}
export function applyImport(data,type,preview) {
 if(preview.errors.length)throw new Error('Fix all import errors before applying.');
 const values=new Map(records(data,type).map(r=>[r.id,r]));preview.valid.forEach(r=>values.set(r.id,r));let next={...data,[type]:[...values.values()]};
 if(type==='yearGroups'){
  const stages=[...new Set(next.yearGroups.map(y=>y.keyStage))];next.keyStages=stages.map(name=>({id:data.keyStages?.find(k=>k.name===name)?.id || uid(),name,years:next.yearGroups.filter(y=>y.keyStage===name).map(y=>y.name)}));
 }
 if(['staff','subjects','rooms'].includes(type))next.departments=[...new Set([...(data.departments || []),...preview.valid.map(r=>r.department).filter(Boolean)])];
 next.importHistory=[...(data.importHistory || []),{id:uid(),type,insertCount:preview.insertCount,updateCount:preview.updateCount,at:new Date().toISOString()}].slice(-50);
 return next;
}
export function exportRows(data,type,timetable=data.publishedTimetable || activeTimetable(data)) {
 if(type==='timetable'){
  const headers=['lessonId','week','day','period','startSlotIds','subject','year','groupId','class','teacherId','teacher','roomId','room','duration'];
  return {headers,rows:(timetable?.assignments || []).map(a=>[a.id,a.week,a.dayKey,a.periodName,(a.slotIds || []).join(';'),a.subject,a.year,a.groupId,a.groupName,a.teacherId,a.teacherName,a.roomId,a.roomCode || a.roomName,a.duration || 1])};
 }
 if(type==='staffAllocations')return {headers:['staffId','name','department','week','teachingPeriods','maxPeriods','contactRatio','ppa','leadership','freePeriods','coverCapacity'],rows:staffWorkload(data,timetable).flatMap(t=>t.perWeek.map(w=>[t.id,t.name,t.department,w.week,w.allocation,t.maxPeriods,w.contactRatio,w.ppa,w.leadership,w.free.length,w.coverCapacity]))};
 const headers=schemas[type].map(f=>f.name);
 return {headers,rows:records(data,type).map(r=>headers.map(h=>h==='availableDays'?Object.entries(r.availability || {}).filter(([,v])=>v).map(([d])=>d).join(';'):Array.isArray(r[h])?r[h].join(';'):r[h] ?? ''))};
}
export function makeBackup(data) {return {format:'time-maker',version:1,exportedAt:new Date().toISOString(),data};}
export function restoreBackup(input) {
 if(input?.format!=='time-maker'||input.version!==1||!input.data?.school||!Array.isArray(input.data.staff)||!Array.isArray(input.data.classes))throw new Error('This is not a supported Time Maker school backup.');
 return structuredClone(input.data);
}
