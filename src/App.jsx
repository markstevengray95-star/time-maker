import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'time-maker-phase-1-v1';

const defaultBlocks = [
  { id: crypto.randomUUID(), name: 'Period 1', type: 'lesson', start: '08:55', end: '09:50' },
  { id: crypto.randomUUID(), name: 'Period 2', type: 'lesson', start: '09:55', end: '10:50' },
  { id: crypto.randomUUID(), name: 'Break', type: 'break', start: '10:50', end: '11:10' },
  { id: crypto.randomUUID(), name: 'Period 3', type: 'lesson', start: '11:10', end: '12:05' },
  { id: crypto.randomUUID(), name: 'Period 4', type: 'lesson', start: '12:10', end: '13:05' },
  { id: crypto.randomUUID(), name: 'Lunch', type: 'break', start: '13:05', end: '14:05' },
  { id: crypto.randomUUID(), name: 'Period 5', type: 'lesson', start: '14:05', end: '15:00' },
  { id: crypto.randomUUID(), name: 'Period 6', type: 'lesson', start: '15:05', end: '16:00' },
];

const initialState = {
  school: {
    name: '',
    academicYear: '2026/27',
    timezone: 'Europe/London',
    cycle: 'one-week',
  },
  days: [
    { key: 'mon', label: 'Monday', enabled: true },
    { key: 'tue', label: 'Tuesday', enabled: true },
    { key: 'wed', label: 'Wednesday', enabled: true },
    { key: 'thu', label: 'Thursday', enabled: true },
    { key: 'fri', label: 'Friday', enabled: true },
    { key: 'sat', label: 'Saturday', enabled: false },
    { key: 'sun', label: 'Sunday', enabled: false },
  ],
  blocks: defaultBlocks,
  dayOverrides: {},
  keyStages: [
    { id: crypto.randomUUID(), name: 'KS3', years: ['Year 7', 'Year 8', 'Year 9'] },
    { id: crypto.randomUUID(), name: 'KS4', years: ['Year 10', 'Year 11'] },
    { id: crypto.randomUUID(), name: 'KS5', years: ['Year 12', 'Year 13'] },
  ],
  terms: [
    { id: crypto.randomUUID(), name: 'Autumn', start: '2026-09-01', end: '2026-12-18', halfStart: '2026-10-26', halfEnd: '2026-10-30' },
    { id: crypto.randomUUID(), name: 'Spring', start: '2027-01-04', end: '2027-03-26', halfStart: '2027-02-15', halfEnd: '2027-02-19' },
    { id: crypto.randomUUID(), name: 'Summer', start: '2027-04-12', end: '2027-07-23', halfStart: '2027-05-31', halfEnd: '2027-06-04' },
  ],
};

const navItems = [
  ['School setup', true],
  ['Staff', false],
  ['Curriculum', false],
  ['Classes', false],
  ['Rooms', false],
  ['Constraints', false],
  ['Generate timetable', false],
  ['Timetables', false],
  ['Cover', false],
];

function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getBlocksForDay(state, dayKey) {
  return state.dayOverrides[dayKey] || state.blocks;
}

function validateBlocks(blocks) {
  const errors = [];
  blocks.forEach((block, index) => {
    if (!block.name.trim()) errors.push(`Block ${index + 1} needs a name.`);
    if (!block.start || !block.end || toMinutes(block.start) >= toMinutes(block.end)) {
      errors.push(`${block.name || `Block ${index + 1}`} has an invalid time range.`);
    }
  });
  for (let i = 0; i < blocks.length - 1; i += 1) {
    if (toMinutes(blocks[i].end) > toMinutes(blocks[i + 1].start)) {
      errors.push(`${blocks[i].name} overlaps ${blocks[i + 1].name}.`);
    }
  }
  return errors;
}

function countTeachingWeeks(terms) {
  const weekKeys = new Set();
  terms.forEach((term) => {
    if (!term.start || !term.end) return;
    const start = new Date(`${term.start}T12:00:00`);
    const end = new Date(`${term.end}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const inHalf = term.halfStart && term.halfEnd && iso >= term.halfStart && iso <= term.halfEnd;
      const weekday = d.getDay();
      if (!inHalf && weekday !== 0 && weekday !== 6) {
        const monday = new Date(d);
        const offset = (d.getDay() + 6) % 7;
        monday.setDate(d.getDate() - offset);
        weekKeys.add(monday.toISOString().slice(0, 10));
      }
    }
  });
  return weekKeys.size;
}

function Section({ id, eyebrow, title, description, children }) {
  return (
    <section className="panel" id={id}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function App() {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialState;
    } catch {
      return initialState;
    }
  });
  const [editingDay, setEditingDay] = useState('mon');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSavedAt(new Date());
    }, 250);
    return () => clearTimeout(timer);
  }, [state]);

  const enabledDays = state.days.filter((d) => d.enabled);
  const blockErrors = useMemo(() => {
    const errors = validateBlocks(state.blocks).map((message) => `Default day: ${message}`);
    Object.entries(state.dayOverrides).forEach(([dayKey, blocks]) => {
      const day = state.days.find((d) => d.key === dayKey);
      validateBlocks(blocks).forEach((message) => errors.push(`${day?.label || dayKey}: ${message}`));
    });
    return errors;
  }, [state.blocks, state.dayOverrides, state.days]);

  const termErrors = useMemo(() => {
    return state.terms.flatMap((term) => {
      const errors = [];
      if (!term.start || !term.end) errors.push(`${term.name} term needs start and end dates.`);
      else if (term.start > term.end) errors.push(`${term.name} term ends before it starts.`);
      if (term.halfStart && term.halfEnd && term.halfStart > term.halfEnd) errors.push(`${term.name} half term dates are reversed.`);
      return errors;
    });
  }, [state.terms]);

  const completion = {
    school: Boolean(state.school.name.trim() && state.school.academicYear.trim()),
    week: enabledDays.length > 0,
    day: state.blocks.length > 0 && blockErrors.length === 0,
    years: state.keyStages.length > 0 && state.keyStages.every((ks) => ks.name.trim() && ks.years.length),
    terms: state.terms.length > 0 && termErrors.length === 0,
  };
  const completedCount = Object.values(completion).filter(Boolean).length;
  const progress = Math.round((completedCount / Object.keys(completion).length) * 100);
  const teachingWeeks = countTeachingWeeks(state.terms);

  function updateSchool(field, value) {
    setState((prev) => ({ ...prev, school: { ...prev.school, [field]: value } }));
  }

  function setDayEnabled(key, enabled) {
    setState((prev) => ({
      ...prev,
      days: prev.days.map((day) => (day.key === key ? { ...day, enabled } : day)),
    }));
  }

  function updateBlock(index, field, value, dayKey = null) {
    setState((prev) => {
      if (dayKey && prev.dayOverrides[dayKey]) {
        const next = [...prev.dayOverrides[dayKey]];
        next[index] = { ...next[index], [field]: value };
        return { ...prev, dayOverrides: { ...prev.dayOverrides, [dayKey]: next } };
      }
      const next = [...prev.blocks];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, blocks: next };
    });
  }

  function addBlock(dayKey = null) {
    const newBlock = { id: crypto.randomUUID(), name: 'New period', type: 'lesson', start: '16:05', end: '17:00' };
    setState((prev) => {
      if (dayKey && prev.dayOverrides[dayKey]) {
        return { ...prev, dayOverrides: { ...prev.dayOverrides, [dayKey]: [...prev.dayOverrides[dayKey], newBlock] } };
      }
      return { ...prev, blocks: [...prev.blocks, newBlock] };
    });
  }

  function removeBlock(index, dayKey = null) {
    setState((prev) => {
      if (dayKey && prev.dayOverrides[dayKey]) {
        return { ...prev, dayOverrides: { ...prev.dayOverrides, [dayKey]: prev.dayOverrides[dayKey].filter((_, i) => i !== index) } };
      }
      return { ...prev, blocks: prev.blocks.filter((_, i) => i !== index) };
    });
  }

  function moveBlock(index, direction, dayKey = null) {
    setState((prev) => {
      const source = dayKey && prev.dayOverrides[dayKey] ? [...prev.dayOverrides[dayKey]] : [...prev.blocks];
      const target = index + direction;
      if (target < 0 || target >= source.length) return prev;
      [source[index], source[target]] = [source[target], source[index]];
      if (dayKey && prev.dayOverrides[dayKey]) {
        return { ...prev, dayOverrides: { ...prev.dayOverrides, [dayKey]: source } };
      }
      return { ...prev, blocks: source };
    });
  }

  function enableCustomDay(dayKey, enabled) {
    setState((prev) => {
      const next = { ...prev.dayOverrides };
      if (enabled) next[dayKey] = prev.blocks.map((block) => ({ ...block, id: crypto.randomUUID() }));
      else delete next[dayKey];
      return { ...prev, dayOverrides: next };
    });
  }

  function addKeyStage() {
    setState((prev) => ({ ...prev, keyStages: [...prev.keyStages, { id: crypto.randomUUID(), name: 'New stage', years: ['Year'] }] }));
  }

  function resetPhase() {
    if (window.confirm('Reset all Phase 1 settings to the starter template?')) {
      localStorage.removeItem(STORAGE_KEY);
      setState(initialState);
      setEditingDay('mon');
    }
  }

  const selectedDay = state.days.find((d) => d.key === editingDay) || state.days[0];
  const selectedHasOverride = Boolean(state.dayOverrides[editingDay]);
  const selectedBlocks = getBlocksForDay(state, editingDay);
  const allErrors = [
    ...(!state.school.name.trim() ? ['School name has not been entered.'] : []),
    ...(enabledDays.length === 0 ? ['At least one teaching day must be enabled.'] : []),
    ...blockErrors,
    ...termErrors,
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">TM</div>
          <div><strong>Time Maker</strong><span>Whole-school timetabling</span></div>
        </div>
        <nav>
          {navItems.map(([label, active]) => (
            <button key={label} className={`nav-item ${active ? 'active' : ''}`} disabled={!active}>
              <span>{label}</span>{!active && <small>Later phase</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">Phase 1 · School structure</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">PHASE 1</span>
            <h1>School setup</h1>
            <p>Build the structure the timetable generator will use later.</p>
          </div>
          <div className="save-state"><span className="status-dot" />{savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saving locally…'}</div>
        </header>

        <div className="summary-grid">
          <div className="hero-card">
            <div className="progress-row"><div><span className="eyebrow">SETUP PROGRESS</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>
            <div className="check-grid">
              {Object.entries({ School: completion.school, Week: completion.week, 'Day structure': completion.day, 'Year groups': completion.years, Terms: completion.terms }).map(([label, done]) => (
                <div className={done ? 'check complete' : 'check'} key={label}><span>{done ? '✓' : '•'}</span>{label}</div>
              ))}
            </div>
          </div>
          <div className="metric-card"><span>Teaching days</span><strong>{enabledDays.length}</strong><small>per cycle week</small></div>
          <div className="metric-card"><span>Teaching weeks</span><strong>{teachingWeeks || '—'}</strong><small>calculated from term dates</small></div>
          <div className="metric-card"><span>Cycle</span><strong>{state.school.cycle === 'two-week' ? 'A / B' : '1 week'}</strong><small>timetable pattern</small></div>
        </div>

        <Section id="school" eyebrow="1 · SCHOOL" title="School profile" description="These details identify the timetable and set the academic context.">
          <div className="form-grid three">
            <label><span>School name</span><input value={state.school.name} onChange={(e) => updateSchool('name', e.target.value)} placeholder="e.g. Oakfield School" /></label>
            <label><span>Academic year</span><input value={state.school.academicYear} onChange={(e) => updateSchool('academicYear', e.target.value)} placeholder="2026/27" /></label>
            <label><span>Timezone</span><select value={state.school.timezone} onChange={(e) => updateSchool('timezone', e.target.value)}><option>Europe/London</option><option>Europe/Dublin</option><option>UTC</option></select></label>
          </div>
          <div className="choice-row">
            <button className={state.school.cycle === 'one-week' ? 'choice active' : 'choice'} onClick={() => updateSchool('cycle', 'one-week')}><strong>One-week cycle</strong><span>Same pattern every week</span></button>
            <button className={state.school.cycle === 'two-week' ? 'choice active' : 'choice'} onClick={() => updateSchool('cycle', 'two-week')}><strong>Week A / Week B</strong><span>Two-week repeating timetable</span></button>
          </div>
        </Section>

        <Section id="week" eyebrow="2 · SCHOOL WEEK" title="Teaching days" description="Enable the days your school can schedule lessons or activities.">
          <div className="day-toggles">
            {state.days.map((day) => (
              <label className={`day-toggle ${day.enabled ? 'enabled' : ''}`} key={day.key}>
                <input type="checkbox" checked={day.enabled} onChange={(e) => setDayEnabled(day.key, e.target.checked)} />
                <span>{day.label.slice(0, 3)}</span><small>{day.enabled ? 'Open' : 'Off'}</small>
              </label>
            ))}
          </div>
        </Section>

        <Section id="day" eyebrow="3 · DAY STRUCTURE" title="Periods, breaks and lunch" description="Create the standard school day, then override individual days if their timings differ.">
          <div className="subtoolbar">
            <div className="day-selector">
              {state.days.filter((day) => day.enabled).map((day) => <button key={day.key} className={editingDay === day.key ? 'selected' : ''} onClick={() => setEditingDay(day.key)}>{day.label.slice(0, 3)}</button>)}
            </div>
            {selectedDay && <label className="switch-label"><input type="checkbox" checked={selectedHasOverride} onChange={(e) => enableCustomDay(editingDay, e.target.checked)} />Custom {selectedDay.label} timings</label>}
          </div>
          <div className="block-list">
            {selectedBlocks.map((block, index) => (
              <div className={`time-block ${block.type}`} key={block.id}>
                <div className="move-controls"><button onClick={() => moveBlock(index, -1, selectedHasOverride ? editingDay : null)} disabled={index === 0}>↑</button><button onClick={() => moveBlock(index, 1, selectedHasOverride ? editingDay : null)} disabled={index === selectedBlocks.length - 1}>↓</button></div>
                <input className="block-name" value={block.name} onChange={(e) => updateBlock(index, 'name', e.target.value, selectedHasOverride ? editingDay : null)} />
                <select value={block.type} onChange={(e) => updateBlock(index, 'type', e.target.value, selectedHasOverride ? editingDay : null)}><option value="lesson">Lesson</option><option value="break">Break / lunch</option><option value="activity">Activity</option></select>
                <input type="time" value={block.start} onChange={(e) => updateBlock(index, 'start', e.target.value, selectedHasOverride ? editingDay : null)} />
                <span className="to">to</span>
                <input type="time" value={block.end} onChange={(e) => updateBlock(index, 'end', e.target.value, selectedHasOverride ? editingDay : null)} />
                <button className="danger-icon" onClick={() => removeBlock(index, selectedHasOverride ? editingDay : null)} aria-label={`Delete ${block.name}`}>×</button>
              </div>
            ))}
          </div>
          <button className="secondary" onClick={() => addBlock(selectedHasOverride ? editingDay : null)}>+ Add time block</button>
        </Section>

        <Section id="years" eyebrow="4 · SCHOOL STRUCTURE" title="Key stages and year groups" description="Set the pupil structure now; classes and option blocks will be added in later phases.">
          <div className="ks-grid">
            {state.keyStages.map((ks, ksIndex) => (
              <div className="ks-card" key={ks.id}>
                <div className="ks-title"><input value={ks.name} onChange={(e) => setState((prev) => ({ ...prev, keyStages: prev.keyStages.map((item, i) => i === ksIndex ? { ...item, name: e.target.value } : item) }))} /><button className="danger-icon" onClick={() => setState((prev) => ({ ...prev, keyStages: prev.keyStages.filter((_, i) => i !== ksIndex) }))}>×</button></div>
                <div className="year-tags">
                  {ks.years.map((year, yearIndex) => (
                    <div className="year-row" key={`${ks.id}-${yearIndex}`}><input value={year} onChange={(e) => setState((prev) => ({ ...prev, keyStages: prev.keyStages.map((item, i) => i === ksIndex ? { ...item, years: item.years.map((y, yi) => yi === yearIndex ? e.target.value : y) } : item) }))} /><button onClick={() => setState((prev) => ({ ...prev, keyStages: prev.keyStages.map((item, i) => i === ksIndex ? { ...item, years: item.years.filter((_, yi) => yi !== yearIndex) } : item) }))}>×</button></div>
                  ))}
                </div>
                <button className="text-button" onClick={() => setState((prev) => ({ ...prev, keyStages: prev.keyStages.map((item, i) => i === ksIndex ? { ...item, years: [...item.years, 'New year'] } : item) }))}>+ Add year group</button>
              </div>
            ))}
          </div>
          <button className="secondary" onClick={addKeyStage}>+ Add key stage / section</button>
        </Section>

        <Section id="terms" eyebrow="5 · ACADEMIC CALENDAR" title="Terms and holidays" description="Set the teaching year. These dates are used to estimate teaching weeks and later timetable coverage.">
          <div className="term-list">
            {state.terms.map((term, index) => (
              <div className="term-card" key={term.id}>
                <div className="term-name"><input value={term.name} onChange={(e) => setState((prev) => ({ ...prev, terms: prev.terms.map((t, i) => i === index ? { ...t, name: e.target.value } : t) }))} /><button className="danger-icon" onClick={() => setState((prev) => ({ ...prev, terms: prev.terms.filter((_, i) => i !== index) }))}>×</button></div>
                <label><span>Term starts</span><input type="date" value={term.start} onChange={(e) => setState((prev) => ({ ...prev, terms: prev.terms.map((t, i) => i === index ? { ...t, start: e.target.value } : t) }))} /></label>
                <label><span>Term ends</span><input type="date" value={term.end} onChange={(e) => setState((prev) => ({ ...prev, terms: prev.terms.map((t, i) => i === index ? { ...t, end: e.target.value } : t) }))} /></label>
                <label><span>Half term starts</span><input type="date" value={term.halfStart} onChange={(e) => setState((prev) => ({ ...prev, terms: prev.terms.map((t, i) => i === index ? { ...t, halfStart: e.target.value } : t) }))} /></label>
                <label><span>Half term ends</span><input type="date" value={term.halfEnd} onChange={(e) => setState((prev) => ({ ...prev, terms: prev.terms.map((t, i) => i === index ? { ...t, halfEnd: e.target.value } : t) }))} /></label>
              </div>
            ))}
          </div>
          <button className="secondary" onClick={() => setState((prev) => ({ ...prev, terms: [...prev.terms, { id: crypto.randomUUID(), name: 'New term', start: '', end: '', halfStart: '', halfEnd: '' }] }))}>+ Add term / teaching block</button>
        </Section>

        <Section id="preview" eyebrow="6 · PREVIEW" title="Week structure preview" description="A quick visual check before staff and curriculum are added in Phase 2 and beyond.">
          <div className="week-preview">
            {enabledDays.map((day) => (
              <div className="preview-day" key={day.key}>
                <div className="preview-day-title"><strong>{day.label}</strong>{state.dayOverrides[day.key] && <span>Custom</span>}</div>
                {getBlocksForDay(state, day.key).map((block) => <div key={block.id} className={`preview-block ${block.type}`}><strong>{block.name}</strong><span>{block.start}–{block.end}</span></div>)}
              </div>
            ))}
          </div>
        </Section>

        <section className={`validation-panel ${allErrors.length ? 'warning' : 'success'}`}>
          <div><span className="eyebrow">PHASE 1 VALIDATION</span><h2>{allErrors.length ? `${allErrors.length} item${allErrors.length === 1 ? '' : 's'} need attention` : 'School structure is ready'}</h2></div>
          {allErrors.length ? <ul>{allErrors.map((error, i) => <li key={`${error}-${i}`}>{error}</li>)}</ul> : <p>You can move on to staff setup when Phase 2 is added.</p>}
        </section>

        <div className="footer-actions"><button className="danger-outline" onClick={resetPhase}>Reset starter data</button><span>All changes are automatically saved in this browser.</span></div>
      </main>
    </div>
  );
}

export default App;
