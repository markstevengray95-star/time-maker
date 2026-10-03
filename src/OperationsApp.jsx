import React, { useState } from 'react';
import AppV10 from './AppV10.jsx';
import IssuesScreen from './IssuesScreen.jsx';
import WorkloadScreen from './WorkloadScreen.jsx';
import PlanningScreen from './PlanningScreen.jsx';
import OptionsScreen from './OptionsScreen.jsx';
import CoverScreen from './CoverScreen.jsx';
import TodayScreen from './TodayScreen.jsx';
import StaffPortalScreen from './StaffPortalScreen.jsx';
import StudentPortalScreen from './StudentPortalScreen.jsx';
import DepartmentScreen from './DepartmentScreen.jsx';
import { KEY, activeTimetable } from './timetableCore.js';

const screens = [['issues','Timetable Issues',11,IssuesScreen],['workload','Staff Workload',12,WorkloadScreen],['planning','Curriculum Planning',13,PlanningScreen],['options','Option Blocks',14,OptionsScreen],['cover','Cover',15,CoverScreen],['today','Today',16,TodayScreen],['staff-portal','Staff Portal',17,StaffPortalScreen],['student-portal','Student Timetable',18,StudentPortalScreen],['departments','Department Dashboard',19,DepartmentScreen]];
function load() {try {return JSON.parse(localStorage.getItem(KEY) || '{}');} catch {return {};}}
export default function OperationsApp({serverSession,onSync}) {
  const [page,setPage] = useState('builder'), [data,setState] = useState(load), [revision,setRevision] = useState(0), [saveError,setSaveError] = useState('');
  function setData(update) {
    const next = typeof update==='function' ? update(data) : update;
    try {localStorage.setItem(KEY,JSON.stringify(next)); setSaveError('');} catch {setSaveError('Browser storage is full. Export a backup before closing.');}
    setState(next);
    if(onSync)onSync(next).catch(e=>setSaveError(e.message));
  }
  function navigate(next) {
    if (next !== 'builder') {const saved=load();setState(saved);if(onSync)onSync(saved).catch(e=>setSaveError(e.message));}
    if (next === 'builder') setRevision(r=>r+1);
    setPage(next);
  }
  const current = screens.find(s=>s[0]===page), Screen = current?.[3];
  return <><nav className="ops-nav" aria-label="Planning and daily operations"><strong>Time Maker</strong><button className={page==='builder'?'active':''} onClick={()=>navigate('builder')}>Timetable builder</button>{screens.map(([key,title])=><button key={key} className={page===key?'active':''} onClick={()=>navigate(key)}>{title}</button>)}</nav>
    {page === 'builder' ? <AppV10 key={revision}/> : <main className="ops-main"><div className="page-title"><div><span className="eyebrow">PHASE {current[2]}</span><h1>{current[1]}</h1><p>{data.school?.name || 'Set up your school in the timetable builder'} · {activeTimetable(data)?.name || 'No active timetable'}</p></div></div>{saveError && <p role="alert">{saveError}</p>}<Screen data={data} setData={setData} serverSession={serverSession} onSync={onSync}/><footer className="app-footer">{serverSession?'Connected school server':'School data saves in this browser.'}</footer></main>}
  </>;
}
