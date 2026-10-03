import { saveSchool } from './schoolStorage.js';
import React, { useEffect, useState } from 'react';
import AppV6 from './AppV6.jsx';
import GeneratorManager from './GeneratorManager.jsx';

const KEY = 'time-maker-v3';

function loadGeneratorData() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function GeneratorScreen({ onBack }) {
  const [data, setData] = useState(loadGeneratorData);

  useEffect(() => {
    saveSchool(data);
  }, [data]);

  return <GeneratorManager data={data} setData={setData} onBack={onBack} />;
}

export default function AppV7() {
  const [mode, setMode] = useState('builder');
  const [revision, setRevision] = useState(0);

  if (mode === 'generator') {
    return <GeneratorScreen onBack={() => { setMode('builder'); setRevision((value) => value + 1); }} />;
  }

  return <div className="phase7-wrapper">
    <button className="phase7-launcher" onClick={() => setMode('generator')}>
      <span>PHASE 7</span>
      <strong>Generate timetable</strong>
      <small>Run the automatic scheduler →</small>
    </button>
    <AppV6 key={revision} />
  </div>;
}

