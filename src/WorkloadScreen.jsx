import React, {useMemo,useState} from 'react';
import { staffWorkload } from './workload.js';
import { weeks, slots, activeTimetable } from './timetableCore.js';
import { Panel, Metrics, Table } from './OperationsUI.jsx';
export default function WorkloadScreen({data,setData}) {
  const [department,setDepartment]=useState('all'),[week,setWeek]=useState('A'),[teacherId,setTeacherId]=useState(''),[slotId,setSlotId]=useState(''),[kind,setKind]=useState('PPA');
  const workloads=useMemo(()=>staffWorkload(data),[data]);
  const filtered=workloads.filter(t=>department==='all'||t.department===department);
  const teacher=workloads.find(t=>t.id===teacherId)||filtered[0], selected=teacher?.perWeek.find(w=>w.week===week);
  const rows=filtered.map(t=>({...t,...t.perWeek.find(w=>w.week===week)}));
  function protect() {if(!teacher || !slotId)return;setData(p=>({...p,staff:p.staff.map(t=>t.id===teacher.id?{...t,protectedSlots:[...(t.protectedSlots || []).filter(x=>x.slotId!==slotId),{slotId,kind}]}:t)}));setSlotId('');}
  return <>
    <div className="ops-controls"><label>Department<select value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">All departments</option>{[...new Set(workloads.map(t=>t.department))].map(d=><option key={d}>{d}</option>)}</select></label><label>Week<select value={week} onChange={e=>setWeek(e.target.value)}>{weeks(data).map(w=><option key={w}>{w}</option>)}</select></label></div>
    {!activeTimetable(data) && <p className="ops-notice">No active timetable. Teaching allocations will calculate after generation.</p>}
    <Metrics items={[["Teaching periods",rows.reduce((n,t)=>n+t.allocation,0),`Week ${week}`],["PPA required",rows.reduce((n,t)=>n+t.ppa,0),'Protected entitlement'],["Leadership",rows.reduce((n,t)=>n+t.leadership,0),'Reserved periods'],["Cover capacity",rows.reduce((n,t)=>n+t.coverCapacity,0),'After protected-time allowance']]}/>
    <Panel title="Department workload" description="All figures are per selected week. Contact ratio is teaching periods divided by available teaching slots. Staff teaching ceilings already reflect the contract; FTE is not applied again.">
      <Table head={['Teacher','Teaching / ceiling','Contact','PPA placed / required','Leadership placed / required','Free periods','Cover capacity','Concerns']} rows={rows.map(t=>[
        <button className="text-button" onClick={()=>setTeacherId(t.id)}>{t.initials || t.name}</button>,`${t.allocation} / ${t.maxPeriods || 0}`,`${Math.round(t.contactRatio*100)}%`,`${t.placedPpa} / ${t.ppa}`,`${t.placedLeadership} / ${t.leadership}`,t.free.length,t.coverCapacity,
        t.deficit ? `${t.deficit} protected-time shortfall` : t.protectedClashes ? `${t.protectedClashes} protected clashes` : t.allocation>Number(t.maxPeriods||0)?'Over teaching ceiling':'—'])}/>
    </Panel>
    {teacher && <Panel title={`${teacher.name || teacher.initials}: daily teaching and protected time`}>
      <label>Teacher<select value={teacher.id} onChange={e=>setTeacherId(e.target.value)}>{workloads.map(t=><option key={t.id} value={t.id}>{t.name || t.initials}</option>)}</select></label>
      <Table head={['Day','Teaching periods','Longest consecutive run','Daily limit','Consecutive limit']} rows={(selected?.daily || []).map(d=>[d.day,d.total,d.consecutive,teacher.maxDaily,teacher.maxConsecutive])}/>
      <div className="ops-controls"><label>Cover allocation / week<input type="number" min="0" value={teacher.coverPeriods ?? 2} onChange={e=>setData(p=>({...p,staff:p.staff.map(t=>t.id===teacher.id?{...t,coverPeriods:Math.max(0,Number(e.target.value))}:t)}))}/></label><label>Protected period<select value={slotId} onChange={e=>setSlotId(e.target.value)}><option value="">Select a free slot</option>{(selected?.free || []).map(s=><option key={s.id} value={s.id}>{s.dayLabel} {s.name}</option>)}</select></label><label>Purpose<select value={kind} onChange={e=>setKind(e.target.value)}><option>PPA</option><option>Leadership</option><option>Duty</option></select></label><button className="primary" onClick={protect} disabled={!slotId}>Protect period</button></div>
      {(teacher.protectedSlots || []).filter(p=>p.slotId.startsWith(week+':')).map(p=><div className="ops-card" key={p.slotId}>{p.kind} · {slots(data).find(s=>s.id===p.slotId)?.dayLabel} · {slots(data).find(s=>s.id===p.slotId)?.name}<button className="text-button" onClick={()=>setData(prev=>({...prev,staff:prev.staff.map(t=>t.id===teacher.id?{...t,protectedSlots:t.protectedSlots.filter(x=>x.slotId!==p.slotId)}:t)}))}>Remove</button></div>)}
      <p>Free periods are unallocated teaching slots, including any reserved PPA or leadership slots. Cover capacity deducts protected time even before its exact periods have been placed.</p>
    </Panel>}
  </>;
}
