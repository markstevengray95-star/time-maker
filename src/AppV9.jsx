import { saveSchool } from './schoolStorage.js';
import React, { useEffect, useState } from 'react';
import AppV8 from './AppV8.jsx';
import EditorManager from './EditorManager.jsx';

const KEY = 'time-maker-v3';

function loadData() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function EditorScreen({ onBack }) {
  const [data, setData] = useState(loadData);
  useEffect(() => { saveSchool(data); }, [data]);
  return <EditorManager data={data} setData={setData} onBack={onBack} />;
}

export default function AppV9() {
  const [mode, setMode] = useState('builder');
  const [revision, setRevision] = useState(0);

  if (mode === 'editor') {
    return <EditorScreen onBack={() => { setMode('builder'); setRevision((value) => value + 1); }} />;
  }

  return <div className="phase9-wrapper">
    <button className="phase9-launcher" onClick={() => setMode('editor')}>
      <span>PHASE 9</span>
      <strong>Visual timetable editor</strong>
      <small>Drag, lock & repair lessons →</small>
    </button>
    <AppV8 key={revision} />
  </div>;
}

