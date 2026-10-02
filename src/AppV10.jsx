import React, { useEffect, useState } from 'react';
import AppV9 from './AppV9.jsx';
import AssistantManager from './AssistantManager.jsx';

const KEY = 'time-maker-v3';

function loadData() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function AssistantScreen({ onBack }) {
  const [data, setData] = useState(loadData);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)); }, [data]);
  return <AssistantManager data={data} setData={setData} onBack={onBack} />;
}

export default function AppV10() {
  const [mode, setMode] = useState('builder');
  const [revision, setRevision] = useState(0);

  if (mode === 'assistant') {
    return <AssistantScreen onBack={() => { setMode('builder'); setRevision((value) => value + 1); }} />;
  }

  return <div className="phase10-wrapper">
    <button className="phase10-launcher" onClick={() => setMode('assistant')}>
      <span>PHASE 10</span>
      <strong>AI timetable assistant</strong>
      <small>Describe a change in plain English →</small>
    </button>
    <AppV9 key={revision} />
  </div>;
}
