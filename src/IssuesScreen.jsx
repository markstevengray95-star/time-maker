import React, { useMemo, useState } from 'react';
import { analyseIssues, issueGroups } from './issues.js';
import { activeTimetable } from './timetableCore.js';
import { Panel, Metrics } from './OperationsUI.jsx';
export default function IssuesScreen({data}) {
  const [category,setCategory] = useState('all');
  const issues = useMemo(()=>analyseIssues(data),[data]);
  return <><Metrics items={issueGroups.map(([key,,title])=>[title,issues.filter(i=>i.category===key).length,'Findings'])}/>
    {!activeTimetable(data) && <p className="ops-notice">Pre-generation checks are shown. Generate a timetable to inspect actual clashes, unmet preferences and workload.</p>}
    <Panel title="Problems and suggested fixes" description="Expand a finding to see the evidence and practical changes you can make.">
      <label>Show <select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All issues</option>{issueGroups.map(([key,icon,title])=><option key={key} value={key}>{icon} {title}</option>)}</select></label>
      {issues.filter(i=>category==='all'||i.category===category).map(i=><details key={i.id} className={`ops-issue ${i.category}`}><summary>{issueGroups.find(g=>g[0]===i.category)?.[1]} {i.title}</summary><p>{i.detail}</p><strong>Suggested fix</strong><p>{i.fix}</p></details>)}
      {!issues.length && <p>No issues detected by the current checks.</p>}
    </Panel></>;
}
