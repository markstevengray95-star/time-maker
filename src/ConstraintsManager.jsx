import React, { useMemo, useState } from 'react';

const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const RULE_TYPES = [
  ['unavailable','Unavailable at specific period'],
  ['prefer-period','Prefer specific period'],
  ['avoid-period','Avoid specific period'],
  ['max-daily','Maximum lessons per day'],
  ['max-consecutive','Maximum consecutive lessons'],
  ['min-free','Minimum free periods per week'],
  ['fixed-period','Must occur at specific period'],
  ['same-day','Keep selected lessons on same day'],
  ['different-days','Spread lessons across different days'],
  ['preferred-room','Prefer a specific room'],
];

function Metric({label,value,note,className=''}){return <div className="metric-card"><span>{label}</span><strong className={className}>{value}</strong><small>{note}</small></div>}
function Section({eyebrow,title,description,children,actions}){return <section className="panel"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description&&<p>{description}</p>}</div>{actions&&<div className="section-actions">{actions}</div>}</div>{children}</section>}

export default function ConstraintsManager({data,setData}){
  const constraints=data.constraints||[];
  const enabledDays=data.days.filter(d=>d.enabled);
  const lessonBlocks=data.blocks.filter(b=>b.type==='lesson');
  const [filter,setFilter]=useState('All');
  const [search,setSearch]=useState('');

  const builtIns=[
    ['Teacher clash','A teacher cannot teach two lessons at once.'],
    ['Class clash','A student group cannot have two lessons at once.'],
    ['Room clash','A room cannot host two groups at once.'],
    ['Staff availability','Part-time and unavailable staff periods are blocked.'],
    ['Room suitability','Specialist-room requirements must match room type.'],
    ['Room capacity','A room must hold the class size.'],
    ['Curriculum completion','Every required lesson allocation must be placed.'],
    ['Fixed teacher','Fixed-teacher curriculum requirements must keep that teacher.'],
    ['Room closures','Periods marked unavailable in Phase 5 cannot be used.'],
  ];

  const hard=constraints.filter(c=>c.severity==='hard').length;
  const soft=constraints.filter(c=>c.severity==='soft').length;
  const active=constraints.filter(c=>c.enabled!==false).length;
  const scopeCounts=constraints.reduce((acc,c)=>({...acc,[c.scope]:(acc[c.scope]||0)+1}),{});

  function targetOptions(scope){
    if(scope==='staff') return data.staff.map(x=>[x.id,`${x.initials||''} ${x.name}`.trim()]);
    if(scope==='class') return data.classes.map(x=>[x.id,x.name||'Unnamed class']);
    if(scope==='room') return (data.rooms||[]).map(x=>[x.id,x.name||x.code||'Unnamed room']);
    if(scope==='year') return data.keyStages.flatMap(k=>k.years.map(y=>[y,y]));
    if(scope==='subject') return [...new Set((data.curriculumRequirements||[]).map(r=>r.subject).filter(Boolean))].map(x=>[x,x]);
    return [['global','Whole school']];
  }

  function addConstraint(){
    setData(p=>({...p,constraints:[...(p.constraints||[]),{
      id:uid(),name:'',enabled:true,severity:'soft',weight:5,scope:'staff',targetId:p.staff[0]?.id||'',ruleType:'unavailable',day:p.days.find(d=>d.enabled)?.key||'mon',periodId:p.blocks.find(b=>b.type==='lesson')?.id||'',value:1,roomId:'',notes:''
    }]}));
  }
  const update=(id,field,value)=>setData(p=>({...p,constraints:(p.constraints||[]).map(c=>c.id===id?{...c,[field]:value}:c)}));
  const remove=id=>setData(p=>({...p,constraints:(p.constraints||[]).filter(c=>c.id!==id)}));

  function makeAvailabilityRules(){
    setData(p=>{
      const existing=new Set((p.constraints||[]).filter(c=>c.generatedFrom==='staff-day').map(c=>`${c.targetId}|${c.day}`));
      const add=[];
      p.staff.forEach(s=>p.days.filter(d=>d.enabled&&s.availability?.[d.key]===false).forEach(d=>{
        const key=`${s.id}|${d.key}`; if(existing.has(key))return;
        add.push({id:uid(),name:`${s.initials||s.name} unavailable ${d.label}`,enabled:true,severity:'hard',weight:10,scope:'staff',targetId:s.id,ruleType:'unavailable',day:d.key,periodId:'all',value:1,roomId:'',notes:'Created from staff availability',generatedFrom:'staff-day'});
      }));
      return {...p,constraints:[...(p.constraints||[]),...add]};
    });
  }

  const errors=useMemo(()=>{
    const out=[];
    constraints.forEach(c=>{
      const label=c.name||'Unnamed constraint';
      if(!c.scope)out.push(`${label} needs a scope.`);
      if(c.scope!=='global'&&!c.targetId)out.push(`${label} needs a target.`);
      if(['unavailable','prefer-period','avoid-period','fixed-period'].includes(c.ruleType)&&!c.day)out.push(`${label} needs a day.`);
      if(['unavailable','prefer-period','avoid-period','fixed-period'].includes(c.ruleType)&&!c.periodId)out.push(`${label} needs a period.`);
      if(['max-daily','max-consecutive','min-free'].includes(c.ruleType)&&Number(c.value)<0)out.push(`${label} has an invalid numeric value.`);
      if(c.ruleType==='preferred-room'&&!c.roomId)out.push(`${label} needs a preferred room.`);
      const options=targetOptions(c.scope).map(x=>x[0]);
      if(c.scope!=='global'&&c.targetId&&!options.includes(c.targetId))out.push(`${label} points to a target that no longer exists.`);
    });
    return [...new Set(out)];
  },[constraints,data.staff,data.classes,data.rooms,data.curriculumRequirements,data.keyStages]);

  const visible=constraints.filter(c=>(filter==='All'||c.severity===filter.toLowerCase())&&`${c.name} ${c.scope} ${c.ruleType} ${c.notes}`.toLowerCase().includes(search.toLowerCase()));

  return <>
    <div className="page-title"><div><span className="eyebrow">PHASE 6</span><h1>Constraints engine</h1><p>Tell the timetable generator what it must never break and what it should try to optimise.</p></div><button className="primary" onClick={addConstraint}>+ Add constraint</button></div>
    <div className="summary-grid compact"><Metric label="Built-in safeguards" value={builtIns.length} note="always enforced"/><Metric label="Custom hard rules" value={hard} note="must be satisfied"/><Metric label="Soft preferences" value={soft} note="optimisation goals"/><Metric label="Active rules" value={active} note={`${constraints.length-active} disabled`}/></div>

    <Section eyebrow="6A · BUILT-IN" title="Automatic hard constraints" description="These protections are always part of timetable generation and do not need to be entered manually.">
      <div className="constraint-safeguards">{builtIns.map(([name,text])=><div className="safeguard-card" key={name}><div className="safeguard-icon">✓</div><div><strong>{name}</strong><p>{text}</p></div><span>Hard</span></div>)}</div>
    </Section>

    <Section eyebrow="6B · CUSTOM RULES" title="School-specific constraints" description="Hard rules are mandatory. Soft rules are scored so the generator can balance competing preferences." actions={<button className="secondary" onClick={makeAvailabilityRules}>Create rules from staff availability</button>}>
      <div className="constraint-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search constraints…"/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Hard</option><option>Soft</option></select></div>
      {!constraints.length?<div className="empty-state"><div className="empty-icon">+</div><strong>No custom constraints yet</strong><p>Built-in safeguards already prevent clashes. Add school-specific restrictions and preferences here.</p><button className="primary" onClick={addConstraint}>Add first constraint</button></div>:<div className="constraint-list">{visible.map(c=>{
        const targets=targetOptions(c.scope); const needsPeriod=['unavailable','prefer-period','avoid-period','fixed-period'].includes(c.ruleType); const needsValue=['max-daily','max-consecutive','min-free'].includes(c.ruleType);
        return <article className={`constraint-card ${c.severity}`} key={c.id}>
          <div className="constraint-head"><label className="constraint-enable"><input type="checkbox" checked={c.enabled!==false} onChange={e=>update(c.id,'enabled',e.target.checked)}/><span>{c.enabled!==false?'Active':'Disabled'}</span></label><input className="constraint-name" value={c.name||''} onChange={e=>update(c.id,'name',e.target.value)} placeholder="Rule name"/><select className={`severity-select ${c.severity}`} value={c.severity} onChange={e=>update(c.id,'severity',e.target.value)}><option value="hard">Hard rule</option><option value="soft">Soft preference</option></select><button className="danger-outline small" onClick={()=>remove(c.id)}>Remove</button></div>
          <div className="constraint-grid">
            <label><span>Applies to</span><select value={c.scope} onChange={e=>{update(c.id,'scope',e.target.value);update(c.id,'targetId',e.target.value==='global'?'global':'')}}><option value="global">Whole school</option><option value="staff">Staff member</option><option value="class">Class/group</option><option value="year">Year group</option><option value="subject">Subject</option><option value="room">Room</option></select></label>
            <label><span>Target</span><select value={c.targetId||''} disabled={c.scope==='global'} onChange={e=>update(c.id,'targetId',e.target.value)}><option value="">Select…</option>{targets.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
            <label className="span-2"><span>Rule</span><select value={c.ruleType} onChange={e=>update(c.id,'ruleType',e.target.value)}>{RULE_TYPES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
            {needsPeriod&&<><label><span>Day</span><select value={c.day||''} onChange={e=>update(c.id,'day',e.target.value)}>{enabledDays.map(d=><option key={d.key} value={d.key}>{d.label}</option>)}</select></label><label><span>Period</span><select value={c.periodId||''} onChange={e=>update(c.id,'periodId',e.target.value)}><option value="all">All teaching periods</option>{lessonBlocks.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></>}
            {needsValue&&<label><span>Value</span><input type="number" min="0" value={c.value??0} onChange={e=>update(c.id,'value',e.target.value)}/></label>}
            {c.ruleType==='preferred-room'&&<label><span>Preferred room</span><select value={c.roomId||''} onChange={e=>update(c.id,'roomId',e.target.value)}><option value="">Select room…</option>{(data.rooms||[]).map(r=><option key={r.id} value={r.id}>{r.name||r.code}</option>)}</select></label>}
            {c.severity==='soft'&&<label><span>Preference weight</span><input type="range" min="1" max="10" value={c.weight||5} onChange={e=>update(c.id,'weight',Number(e.target.value))}/><small>{c.weight||5}/10 importance</small></label>}
            <label className="span-2"><span>Notes</span><input value={c.notes||''} onChange={e=>update(c.id,'notes',e.target.value)} placeholder="Reason or extra detail for the timetabler"/></label>
          </div>
        </article>})}</div>}
    </Section>

    <Section eyebrow="6C · COVERAGE" title="Constraint coverage" description="See where additional rules have been added before running the generator.">
      <div className="constraint-coverage"><div><span>Staff rules</span><strong>{scopeCounts.staff||0}</strong></div><div><span>Class rules</span><strong>{scopeCounts.class||0}</strong></div><div><span>Year rules</span><strong>{scopeCounts.year||0}</strong></div><div><span>Subject rules</span><strong>{scopeCounts.subject||0}</strong></div><div><span>Room rules</span><strong>{scopeCounts.room||0}</strong></div><div><span>Whole-school rules</span><strong>{scopeCounts.global||0}</strong></div></div>
    </Section>

    <Section eyebrow="6D · READINESS" title="Constraint validation" description="Invalid targets and incomplete rules are caught here before timetable generation starts.">
      <div className={`validation-panel embedded ${errors.length?'warning':'success'}`}><div><span className="eyebrow">CONSTRAINT DATA CHECK</span><h2>{errors.length?`${errors.length} issue${errors.length===1?'':'s'} to fix`:'Constraints are ready'}</h2><p>Phase 7 can use these rules as the input to the automatic timetable generator.</p></div>{errors.length?<ul>{errors.map(x=><li key={x}>{x}</li>)}</ul>:<p>{constraints.length?'All current custom rules have valid targets and parameters.':'Built-in constraints are ready; custom rules are optional.'}</p>}</div>
    </Section>
  </>;
}
