import { saveSchool } from './schoolStorage.js';
import React, { useEffect, useState } from 'react';
import AppV7 from './AppV7.jsx';
import ReviewManager from './ReviewManager.jsx';
import { buildDemoData } from './demoData.js';

const KEY = 'time-maker-v3';

function loadData() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function ReviewScreen({ onBack }) {
  const [data, setData] = useState(loadData);
  useEffect(() => { saveSchool(data); }, [data]);
  return <ReviewManager data={data} setData={setData} onBack={onBack} />;
}

export default function AppV8() {
  const [mode, setMode] = useState('builder');
  const [revision, setRevision] = useState(0);

  function loadDemo() {
    const current = loadData();
    const hasCurrent = Boolean(current.school?.name || current.staff?.length || current.classes?.length || current.curriculumRequirements?.length);
    if (hasCurrent && !window.confirm('Load demo data? This will replace the timetable data currently saved in this browser.')) return;
    saveSchool(buildDemoData());
    setMode('builder');
    setRevision((value) => value + 1);
  }

  function openReview() {
    setMode('review');
  }

  if (mode === 'review') {
    return <ReviewScreen onBack={() => { setMode('builder'); setRevision((value) => value + 1); }} />;
  }

  return <div className="phase8-wrapper">
    <div className="phase8-commandbar">
      <button className="demo-data-button" onClick={loadDemo}><span>DEMO</span><strong>Load demo school</strong><small>Prefill every phase</small></button>
      <button className="phase8-launcher" onClick={openReview}><span>PHASE 8</span><strong>Review & optimise</strong><small>Analyse generated options →</small></button>
    </div>
    <AppV7 key={revision} />
  </div>;
}

