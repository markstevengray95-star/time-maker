import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'time-maker-v3';
const LEGACY_KEY = 'time-maker-phase-1-v1';
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const DAY_DEFS = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
  ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
];

const defaultBlocks = [
  { id: uid(), name: 'Period 1', type: 'lesson', start: '08:55', end: '09:50' },
  { id: uid(), name: 'Period 2', type: 'lesson', start: '09:55', end: '10:50' },
  { id: uid(), name: 'Break', type: 'break', start: '10:50', end: '11:10' },
  { id: uid(), name: 'Period 3', type: 'lesson', start: '11:10', end: '12:05' },
  { id: uid(), name: 'Period 4', type: 'lesson', start: '12:10', end: '13:05' },
  { id: uid(), name: 'Lunch', type: 'break', start: '13:05', end: '14:05' },
  { id: uid(), name: 'Period 5', type: 'lesson', start: '14:05', end: '15:00' },
  { id: uid(), name: 'Period 6', type: 'lesson', start: '15:05', end: '16:00' },
];

const makeAvailability = () => Object.fromEntries(DAY_DEFS.map(([key]) => [key, !['sat', 'sun'].includes(key)]));

const initialState = {
  school: { name: '', academicYear: '2026/27', timezone: 'Europe/London', cycle: 'one-week' },
  days: DAY_DEFS.map(([key, label]) => ({ key, label, enabled: !['sat', 'sun'].includes(key) })),
  blocks: defaultBlocks,
  dayOverrides: {},
  keyStages: [
    { id: uid(), name: 'KS3', years: ['Year 7', 'Year 8', 'Year 9'] },
    { id: uid(), name: 'KS4', years: ['Year 10', 'Year 11'] },
    { id: uid(), name: 'KS5', years: ['Year 12', 'Year 13'] },
  ],
  terms: [
    { id: uid(), name: 'Autumn', start: '2026-09-01', end: '2026-12-18', halfStart: '2026-10-26', halfEnd: '2026-10-30' },
    { id: uid(), name: 'Spring', start: '2027-01-04', end: '2027-03-26', halfStart: '2027-02-15', halfEnd: '2027-02-19' },
    { id: uid(), name: 'Summer', start: '2027-04-12', end: '2027-07-23', halfStart: '2027-05-31', halfEnd: '2027-06-04' },
  ],
  departments: ['Science', 'Mathematics', 'English', 'Humanities', 'Languages', 'PE', 'Arts', 'Technology', 'SEND', 'Sixth Form'],
  staff: [],
  classes: [],
};

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return { ...initialState, ...JSON.parse(current) };
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return { ...initialState, ...JSON.parse(legacy), departments: initialState.departments, staff: [], classes: [] };
  } catch {
    // Fall back to clean starter data.
  }
  return initialState;
}

function toMinutes(time) {
  const [h, m] = (time || '0:0').split(':').map(Number);
  return h * 60 + m;
}

function validateBlocks(blocks) {
  const errors = [];
  blocks.forEach((block, index) => {
    if (!block.name?.trim()) errors.push(`Block ${index + 1} needs a name.`);
    if (!block.start || !block.end || toMinutes(block.start) >= toMinutes(block.end)) errors.push(`${block.name || `Block ${index + 1}`} has an invalid time range.`);
  });
  for (let i = 0; i < blocks.length - 1; i += 1) {
    if (toMinutes(blocks[i].end) > toMinutes(blocks[i + 1].start)) errors.push(`${blocks[i].name} overlaps ${blocks[i + 1].name}.`);
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
      if (!inHalf && d.getDay() !== 0 && d.getDay() !== 6) {
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        weekKeys.add(monday.toISOString().slice(0, 10));
      }
    }
  });
  return weekKeys.size;
}

function Section({ eyebrow, title, description, actions, children }) {
  return <section className="panel">
    <div className="section-heading">
      <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {actions && <div className="section-actions">{actions}</div>}
    </div>
    {children}
  </section>;
}

function EmptyState({ title, text, action, onClick }) {
  return <div className="empty-state"><div className="empty-icon">+</div><strong>{title}</strong><p>{text}</p><button className="primary" onClick={onClick}>{action}</button></div>;
}

function SchoolSetup({ data, setData }) {
  const [editingDay, setEditingDay] = useState('mon');
  const enabledDays = data.days.filter((d) => d.enabled);
  const blockErrors = useMemo(() => {
    const errors = validateBlocks(data.blocks).map((m) => `Default day: ${m}`);
    Object.entries(data.dayOverrides || {}).forEach(([dayKey, blocks]) => {
      const day = data.days.find((d) => d.key === dayKey);
      validateBlocks(blocks).forEach((m) => errors.push(`${day?.label || dayKey}: ${m}`));
    });
    return errors;
  }, [data.blocks, data.dayOverrides, data.days]);
  const teachingWeeks = countTeachingWeeks(data.terms);

  const updateSchool = (field, value) => setData((p) => ({ ...p, school: { ...p.school, [field]: value } }));
  const selectedOverride = data.dayOverrides?.[editingDay];
  const selectedBlocks = selectedOverride || data.blocks;

  function updateBlock(index, field, value) {
    setData((p) => {
      if (p.dayOverrides?.[editingDay]) {
        const next = [...p.dayOverrides[editingDay]];
        next[index] = { ...next[index], [field]: value };
        return { ...p, dayOverrides: { ...p.dayOverrides, [editingDay]: next } };
      }
      const next = [...p.blocks];
      next[index] = { ...next[index], [field]: value };
      return { ...p, blocks: next };
    });
  }

  function addBlock() {
    setData((p) => {
      const item = { id: uid(), name: 'New period', type: 'lesson', start: '16:05', end: '17:00' };
      if (p.dayOverrides?.[editingDay]) return { ...p, dayOverrides: { ...p.dayOverrides, [editingDay]: [...p.dayOverrides[editingDay], item] } };
      return { ...p, blocks: [...p.blocks, item] };
    });
  }

  function removeBlock(index) {
    setData((p) => {
      if (p.dayOverrides?.[editingDay]) return { ...p, dayOverrides: { ...p.dayOverrides, [editingDay]: p.dayOverrides[editingDay].filter((_, i) => i !== index) } };
      return { ...p, blocks: p.blocks.filter((_, i) => i !== index) };
    });
  }

  function toggleOverride(enabled) {
    setData((p) => {
      const overrides = { ...(p.dayOverrides || {}) };
      if (enabled) overrides[editingDay] = p.blocks.map((b) => ({ ...b, id: uid() }));
      else delete overrides[editingDay];
      return { ...p, dayOverrides: overrides };
    });
  }

  return <>
    <div className="page-title"><div><span className="eyebrow">PHASE 1</span><h1>School setup</h1><p>Define the structure every later timetable rule uses.</p></div></div>
    <div className="summary-grid compact">
      <div className="metric-card"><span>Teaching days</span><strong>{enabledDays.length}</strong><small>enabled each week</small></div>
      <div className="metric-card"><span>Teaching weeks</span><strong>{teachingWeeks || '—'}</strong><small>from term dates</small></div>
      <div className="metric-card"><span>Cycle</span><strong>{data.school.cycle === 'two-week' ? 'A / B' : '1 week'}</strong><small>timetable pattern</small></div>
      <div className="metric-card"><span>Day validation</span><strong className={blockErrors.length ? 'warn-text' : 'good-text'}>{blockErrors.length ? `${blockErrors.length} issue${blockErrors.length > 1 ? 's' : ''}` : 'Ready'}</strong><small>time structure</small></div>
    </div>

    <Section eyebrow="1 · SCHOOL" title="School profile" description="Set the academic context and timetable cycle.">
      <div className="form-grid three">
        <label><span>School name</span><input value={data.school.name} onChange={(e) => updateSchool('name', e.target.value)} placeholder="School name" /></label>
        <label><span>Academic year</span><input value={data.school.academicYear} onChange={(e) => updateSchool('academicYear', e.target.value)} /></label>
        <label><span>Timezone</span><select value={data.school.timezone} onChange={(e) => updateSchool('timezone', e.target.value)}><option>Europe/London</option><option>Europe/Dublin</option><option>UTC</option></select></label>
      </div>
      <div className="choice-row">
        <button className={`choice ${data.school.cycle === 'one-week' ? 'active' : ''}`} onClick={() => updateSchool('cycle', 'one-week')}><strong>One-week cycle</strong><span>Same timetable each week</span></button>
        <button className={`choice ${data.school.cycle === 'two-week' ? 'active' : ''}`} onClick={() => updateSchool('cycle', 'two-week')}><strong>Week A / Week B</strong><span>Two-week repeating cycle</span></button>
      </div>
    </Section>

    <Section eyebrow="2 · WEEK" title="Teaching week" description="Enable the days your school can timetable lessons on.">
      <div className="day-toggles">{data.days.map((day) => <label key={day.key} className={`day-toggle ${day.enabled ? 'enabled' : ''}`}><input type="checkbox" checked={day.enabled} onChange={(e) => setData((p) => ({ ...p, days: p.days.map((d) => d.key === day.key ? { ...d, enabled: e.target.checked } : d) }))} /><span>{day.label}</span><small>{day.enabled ? 'Teaching day' : 'Off'}</small></label>)}</div>
    </Section>

    <Section eyebrow="3 · PERIODS" title="School day" description="Edit standard lesson, break and activity times. Individual days can use a different pattern.">
      <div className="subtoolbar">
        <div className="day-selector">{enabledDays.map((day) => <button key={day.key} className={editingDay === day.key ? 'selected' : ''} onClick={() => setEditingDay(day.key)}>{day.label.slice(0, 3)}</button>)}</div>
        <label className="switch-label"><input type="checkbox" checked={Boolean(selectedOverride)} onChange={(e) => toggleOverride(e.target.checked)} /> Custom times for this day</label>
      </div>
      <div className="block-list">{selectedBlocks.map((block, index) => <div className={`time-block ${block.type}`} key={block.id}>
        <input className="block-name" value={block.name} onChange={(e) => updateBlock(index, 'name', e.target.value)} />
        <select value={block.type} onChange={(e) => updateBlock(index, 'type', e.target.value)}><option value="lesson">Lesson</option><option value="break">Break</option><option value="activity">Activity</option></select>
        <input type="time" value={block.start} onChange={(e) => updateBlock(index, 'start', e.target.value)} /><span className="to">to</span><input type="time" value={block.end} onChange={(e) => updateBlock(index, 'end', e.target.value)} />
        <button className="danger-icon" onClick={() => removeBlock(index)}>×</button>
      </div>)}</div>
      <button className="secondary" onClick={addBlock}>+ Add time block</button>
      {blockErrors.length > 0 && <div className="inline-warning">{blockErrors.map((e) => <div key={e}>{e}</div>)}</div>}
    </Section>

    <Section eyebrow="4 · YEAR GROUPS" title="Key stages and year groups" description="These year groups feed directly into the class builder in Phase 3." actions={<button className="secondary" onClick={() => setData((p) => ({ ...p, keyStages: [...p.keyStages, { id: uid(), name: 'New stage', years: ['New year'] }] }))}>+ Key stage</button>}>
      <div className="ks-grid">{data.keyStages.map((ks, ksIndex) => <div className="ks-card" key={ks.id}>
        <div className="ks-title"><input value={ks.name} onChange={(e) => setData((p) => ({ ...p, keyStages: p.keyStages.map((x, i) => i === ksIndex ? { ...x, name: e.target.value } : x) }))} /><button className="danger-icon" onClick={() => setData((p) => ({ ...p, keyStages: p.keyStages.filter((_, i) => i !== ksIndex) }))}>×</button></div>
        <div className="year-tags">{ks.years.map((year, yearIndex) => <div className="year-row" key={`${ks.id}-${yearIndex}`}><input value={year} onChange={(e) => setData((p) => ({ ...p, keyStages: p.keyStages.map((x, i) => i === ksIndex ? { ...x, years: x.years.map((y, j) => j === yearIndex ? e.target.value : y) } : x) }))} /><button onClick={() => setData((p) => ({ ...p, keyStages: p.keyStages.map((x, i) => i === ksIndex ? { ...x, years: x.years.filter((_, j) => j !== yearIndex) } : x) }))}>×</button></div>)}</div>
        <button className="text-button" onClick={() => setData((p) => ({ ...p, keyStages: p.keyStages.map((x, i) => i === ksIndex ? { ...x, years: [...x.years, 'New year'] } : x) }))}>+ Add year</button>
      </div>)}</div>
    </Section>

    <Section eyebrow="5 · TERMS" title="Term dates" description="Used to calculate teaching weeks and later timetable publication dates.">
      <div className="term-list">{data.terms.map((term, index) => <div className="term-card" key={term.id}>
        <input className="term-title" value={term.name} onChange={(e) => setData((p) => ({ ...p, terms: p.terms.map((t, i) => i === index ? { ...t, name: e.target.value } : t) }))} />
        {['start', 'end', 'halfStart', 'halfEnd'].map((field) => <label key={field}><span>{{ start: 'Term starts', end: 'Term ends', halfStart: 'Half term starts', halfEnd: 'Half term ends' }[field]}</span><input type="date" value={term[field] || ''} onChange={(e) => setData((p) => ({ ...p, terms: p.terms.map((t, i) => i === index ? { ...t, [field]: e.target.value } : t) }))} /></label>)}
      </div>)}</div>
    </Section>
  </>;
}

function StaffManager({ data, setData }) {
  const enabledDays = data.days.filter((d) => d.enabled);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [newDepartment, setNewDepartment] = useState('');

  const staffErrors = useMemo(() => {
    const errors = [];
    const initials = new Map();
    data.staff.forEach((person) => {
      if (!person.name?.trim()) errors.push('A staff member is missing a name.');
      if (!person.initials?.trim()) errors.push(`${person.name || 'A staff member'} is missing initials.`);
      if (!person.department) errors.push(`${person.name || person.initials || 'A staff member'} needs a department.`);
      if (!person.subjects?.length) errors.push(`${person.name || person.initials || 'A staff member'} has no teachable subjects.`);
      if ((Number(person.ppaPeriods) + Number(person.leadershipPeriods)) > Number(person.maxPeriods)) errors.push(`${person.name || person.initials}: PPA + leadership time exceeds maximum teaching periods.`);
      const key = person.initials?.trim().toUpperCase();
      if (key) initials.set(key, (initials.get(key) || 0) + 1);
    });
    initials.forEach((count, key) => { if (count > 1) errors.push(`Initials ${key} are used by more than one member of staff.`); });
    return [...new Set(errors)];
  }, [data.staff]);

  const filtered = data.staff.filter((s) => (filter === 'All' || s.department === filter) && `${s.name} ${s.initials} ${s.subjects?.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const totalFte = data.staff.reduce((n, s) => n + Number(s.fte || 0), 0);
  const totalCapacity = data.staff.reduce((n, s) => n + Number(s.maxPeriods || 0), 0);
  const partTime = data.staff.filter((s) => Number(s.fte) < 1).length;

  function addStaff() {
    setData((p) => ({ ...p, staff: [...p.staff, {
      id: uid(), name: '', initials: '', department: p.departments[0] || '', subjects: [], fte: 1,
      contractHours: 37.5, maxPeriods: 42, ppaPeriods: 5, leadershipPeriods: 0, formTutor: '',
      maxDaily: 6, maxConsecutive: 4, availability: makeAvailability(), notes: '',
    }] }));
  }

  function updateStaff(id, field, value) {
    setData((p) => ({ ...p, staff: p.staff.map((s) => s.id === id ? { ...s, [field]: value } : s) }));
  }

  return <>
    <div className="page-title"><div><span className="eyebrow">PHASE 2</span><h1>Staff manager</h1><p>Set who can teach, when they work, and the workload limits the generator must respect.</p></div><button className="primary" onClick={addStaff}>+ Add staff member</button></div>
    <div className="summary-grid compact">
      <div className="metric-card"><span>Staff</span><strong>{data.staff.length}</strong><small>teaching staff entered</small></div>
      <div className="metric-card"><span>Total FTE</span><strong>{totalFte.toFixed(1)}</strong><small>staffing capacity</small></div>
      <div className="metric-card"><span>Max teaching periods</span><strong>{totalCapacity}</strong><small>combined weekly ceiling</small></div>
      <div className="metric-card"><span>Part-time</span><strong>{partTime}</strong><small>staff below 1.0 FTE</small></div>
    </div>

    <Section eyebrow="2A · DEPARTMENTS" title="Departments" description="Departments make staffing and workload views easier to organise.">
      <div className="tag-editor">{data.departments.map((dept) => <span className="tag" key={dept}>{dept}<button onClick={() => setData((p) => ({ ...p, departments: p.departments.filter((d) => d !== dept), staff: p.staff.map((s) => s.department === dept ? { ...s, department: '' } : s) }))}>×</button></span>)}</div>
      <div className="inline-add"><input value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="New department" /><button className="secondary" onClick={() => { const v = newDepartment.trim(); if (v && !data.departments.includes(v)) setData((p) => ({ ...p, departments: [...p.departments, v] })); setNewDepartment(''); }}>Add department</button></div>
    </Section>

    <Section eyebrow="2B · STAFF" title="Teaching staff" description="Each staff record contains the hard limits later used by the timetable engine.">
      <div className="table-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff or subject…" /><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>All</option>{data.departments.map((d) => <option key={d}>{d}</option>)}</select></div>
      {data.staff.length === 0 ? <EmptyState title="No staff yet" text="Add your first teacher, then set subjects, hours and availability." action="Add first staff member" onClick={addStaff} /> : <div className="staff-list">{filtered.map((person) => <article className="staff-card" key={person.id}>
        <div className="staff-card-head"><div className="avatar">{person.initials || '?'}</div><div className="staff-identity"><input className="name-input" value={person.name} onChange={(e) => updateStaff(person.id, 'name', e.target.value)} placeholder="Full name" /><div className="mini-grid"><label><span>Initials</span><input value={person.initials} onChange={(e) => updateStaff(person.id, 'initials', e.target.value.toUpperCase().slice(0, 6))} placeholder="ABC" /></label><label><span>Department</span><select value={person.department} onChange={(e) => updateStaff(person.id, 'department', e.target.value)}><option value="">Select…</option>{data.departments.map((d) => <option key={d}>{d}</option>)}</select></label></div></div><button className="danger-outline small" onClick={() => setData((p) => ({ ...p, staff: p.staff.filter((s) => s.id !== person.id), classes: p.classes.map((c) => c.teacherId === person.id ? { ...c, teacherId: '' } : c) }))}>Remove</button></div>
        <div className="staff-fields">
          <label className="wide"><span>Subjects they can teach</span><input value={(person.subjects || []).join(', ')} onChange={(e) => updateStaff(person.id, 'subjects', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="Physics, Science, Maths" /><small>Separate subjects with commas.</small></label>
          <label><span>FTE</span><input type="number" min="0.1" max="1" step="0.1" value={person.fte} onChange={(e) => updateStaff(person.id, 'fte', e.target.value)} /></label>
          <label><span>Contract hours/week</span><input type="number" min="1" step="0.5" value={person.contractHours} onChange={(e) => updateStaff(person.id, 'contractHours', e.target.value)} /></label>
          <label><span>Max teaching periods</span><input type="number" min="0" value={person.maxPeriods} onChange={(e) => updateStaff(person.id, 'maxPeriods', e.target.value)} /></label>
          <label><span>PPA periods</span><input type="number" min="0" value={person.ppaPeriods} onChange={(e) => updateStaff(person.id, 'ppaPeriods', e.target.value)} /></label>
          <label><span>Leadership/non-contact</span><input type="number" min="0" value={person.leadershipPeriods} onChange={(e) => updateStaff(person.id, 'leadershipPeriods', e.target.value)} /></label>
          <label><span>Max lessons/day</span><input type="number" min="1" value={person.maxDaily} onChange={(e) => updateStaff(person.id, 'maxDaily', e.target.value)} /></label>
          <label><span>Max consecutive</span><input type="number" min="1" value={person.maxConsecutive} onChange={(e) => updateStaff(person.id, 'maxConsecutive', e.target.value)} /></label>
          <label><span>Form tutor</span><input value={person.formTutor} onChange={(e) => updateStaff(person.id, 'formTutor', e.target.value)} placeholder="e.g. 10MG" /></label>
        </div>
        <div className="availability"><div><strong>Working availability</strong><small>Untick any day this person cannot be timetabled.</small></div><div className="availability-days">{enabledDays.map((day) => <label key={day.key} className={person.availability?.[day.key] !== false ? 'available' : ''}><input type="checkbox" checked={person.availability?.[day.key] !== false} onChange={(e) => updateStaff(person.id, 'availability', { ...person.availability, [day.key]: e.target.checked })} />{day.label.slice(0, 3)}</label>)}</div></div>
        <label><span>Notes / restrictions</span><input value={person.notes || ''} onChange={(e) => updateStaff(person.id, 'notes', e.target.value)} placeholder="e.g. Prefer no P6 on Thursday" /></label>
      </article>)}</div>}
    </Section>

    <div className={`validation-panel ${staffErrors.length ? 'warning' : 'success'}`}><div><span className="eyebrow">STAFF DATA CHECK</span><h2>{staffErrors.length ? `${staffErrors.length} issue${staffErrors.length > 1 ? 's' : ''} to fix` : 'Staff data is ready'}</h2><p>These checks prevent avoidable generation failures later.</p></div>{staffErrors.length ? <ul>{staffErrors.map((e) => <li key={e}>{e}</li>)}</ul> : <p>Add classes in Phase 3 and the app can start comparing lesson demand against staff capacity.</p>}</div>
  </>;
}

function ClassesManager({ data, setData }) {
  const years = data.keyStages.flatMap((ks) => ks.years.map((year) => ({ year, ks: ks.name })));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const groupTypes = ['Form', 'Teaching group', 'Set', 'Option group', 'Sixth form', 'Mixed year', 'Intervention'];

  function addClass(type = 'Teaching group') {
    setData((p) => ({ ...p, classes: [...p.classes, {
      id: uid(), name: '', year: years[0]?.year || '', type, subject: '', size: 20,
      lessonsPerWeek: 1, optionBlock: '', teacherId: '', notes: '',
    }] }));
  }
  const updateClass = (id, field, value) => setData((p) => ({ ...p, classes: p.classes.map((c) => c.id === id ? { ...c, [field]: value } : c) }));
  const visible = data.classes.filter((c) => (typeFilter === 'All' || c.type === typeFilter) && `${c.name} ${c.year} ${c.subject} ${c.optionBlock}`.toLowerCase().includes(search.toLowerCase()));
  const totalStudents = data.classes.reduce((n, c) => n + Number(c.size || 0), 0);
  const lessonDemand = data.classes.reduce((n, c) => n + Number(c.lessonsPerWeek || 0), 0);
  const unstaffed = data.classes.filter((c) => c.subject && !c.teacherId).length;
  const optionGroups = data.classes.filter((c) => c.type === 'Option group').length;

  const classErrors = useMemo(() => {
    const errors = [];
    const names = new Map();
    data.classes.forEach((c) => {
      if (!c.name?.trim()) errors.push('A class/group is missing its name.');
      if (!c.year && c.type !== 'Mixed year') errors.push(`${c.name || 'A group'} needs a year group.`);
      if (c.type !== 'Form' && !c.subject?.trim()) errors.push(`${c.name || 'A group'} needs a subject/course.`);
      if (Number(c.lessonsPerWeek) < 0) errors.push(`${c.name || 'A group'} has an invalid lesson allocation.`);
      const key = c.name?.trim().toLowerCase();
      if (key) names.set(key, (names.get(key) || 0) + 1);
    });
    names.forEach((count, key) => { if (count > 1) errors.push(`Group name “${key}” is duplicated.`); });
    return [...new Set(errors)];
  }, [data.classes]);

  const yearSummary = years.map(({ year, ks }) => ({ year, ks, groups: data.classes.filter((c) => c.year === year).length, periods: data.classes.filter((c) => c.year === year).reduce((n, c) => n + Number(c.lessonsPerWeek || 0), 0) }));

  return <>
    <div className="page-title"><div><span className="eyebrow">PHASE 3</span><h1>Classes & groups</h1><p>Build the student structures that need to be placed into the whole-school timetable.</p></div><button className="primary" onClick={() => addClass()}>+ Add class or group</button></div>
    <div className="summary-grid compact">
      <div className="metric-card"><span>Groups</span><strong>{data.classes.length}</strong><small>forms, sets and classes</small></div>
      <div className="metric-card"><span>Student places</span><strong>{totalStudents}</strong><small>sum of group sizes</small></div>
      <div className="metric-card"><span>Lesson demand</span><strong>{lessonDemand}</strong><small>group periods/week</small></div>
      <div className="metric-card"><span>Option groups</span><strong>{optionGroups}</strong><small>GCSE / sixth-form blocks</small></div>
    </div>

    <Section eyebrow="3A · STRUCTURE" title="Year structure" description="Year groups come directly from School Setup, so changes remain linked.">
      <div className="year-summary">{yearSummary.map((row) => <div className="year-summary-card" key={`${row.ks}-${row.year}`}><span>{row.ks}</span><strong>{row.year}</strong><small>{row.groups} groups · {row.periods} periods</small></div>)}</div>
    </Section>

    <Section eyebrow="3B · GROUP BUILDER" title="Forms, sets, options and teaching groups" description="Use the same flexible record for standard classes, ability sets, option groups, interventions and mixed-year teaching.">
      <div className="quick-create">{groupTypes.map((type) => <button key={type} className="secondary small" onClick={() => addClass(type)}>+ {type}</button>)}</div>
      <div className="table-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups, subjects or blocks…" /><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option>All</option>{groupTypes.map((t) => <option key={t}>{t}</option>)}</select></div>
      {data.classes.length === 0 ? <EmptyState title="No groups yet" text="Start with forms or teaching groups. GCSE and sixth-form option groups can use the Option Block field." action="Add first group" onClick={() => addClass()} /> : <div className="class-table-wrap"><table className="data-table"><thead><tr><th>Group</th><th>Type</th><th>Year</th><th>Subject / course</th><th>Size</th><th>Lessons/wk</th><th>Option block</th><th>Required teacher</th><th /></tr></thead><tbody>{visible.map((group) => <tr key={group.id}>
        <td><input value={group.name} onChange={(e) => updateClass(group.id, 'name', e.target.value)} placeholder="e.g. 10S1" /></td>
        <td><select value={group.type} onChange={(e) => updateClass(group.id, 'type', e.target.value)}>{groupTypes.map((t) => <option key={t}>{t}</option>)}</select></td>
        <td><select value={group.year} onChange={(e) => updateClass(group.id, 'year', e.target.value)}><option value="">Mixed / select…</option>{years.map((y) => <option key={`${y.ks}-${y.year}`} value={y.year}>{y.year}</option>)}</select></td>
        <td><input value={group.subject} onChange={(e) => updateClass(group.id, 'subject', e.target.value)} placeholder={group.type === 'Form' ? 'Optional' : 'Science'} /></td>
        <td><input type="number" min="0" value={group.size} onChange={(e) => updateClass(group.id, 'size', e.target.value)} /></td>
        <td><input type="number" min="0" value={group.lessonsPerWeek} onChange={(e) => updateClass(group.id, 'lessonsPerWeek', e.target.value)} /></td>
        <td><input value={group.optionBlock || ''} onChange={(e) => updateClass(group.id, 'optionBlock', e.target.value)} placeholder="e.g. A" /></td>
        <td><select value={group.teacherId || ''} onChange={(e) => updateClass(group.id, 'teacherId', e.target.value)}><option value="">Any suitable teacher</option>{data.staff.map((s) => <option key={s.id} value={s.id}>{s.initials || s.name} · {s.name}</option>)}</select></td>
        <td><button className="danger-icon" onClick={() => setData((p) => ({ ...p, classes: p.classes.filter((c) => c.id !== group.id) }))}>×</button></td>
      </tr>)}</tbody></table></div>}
    </Section>

    <Section eyebrow="3C · PLANNING CHECK" title="Demand snapshot" description="This starts linking class demand to staffing, ready for later curriculum and constraint phases.">
      <div className="demand-grid"><div><span>Weekly group periods requested</span><strong>{lessonDemand}</strong></div><div><span>Combined staff max teaching periods</span><strong>{data.staff.reduce((n, s) => n + Number(s.maxPeriods || 0), 0)}</strong></div><div><span>Groups with subject but no fixed teacher</span><strong>{unstaffed}</strong></div></div>
      <p className="hint">A blank required-teacher field is not an error: it means the future generator can choose any suitably qualified available teacher.</p>
    </Section>

    <div className={`validation-panel ${classErrors.length ? 'warning' : 'success'}`}><div><span className="eyebrow">CLASS DATA CHECK</span><h2>{classErrors.length ? `${classErrors.length} issue${classErrors.length > 1 ? 's' : ''} to fix` : 'Class structure is ready'}</h2><p>Clean group data is essential before curriculum allocations and automatic generation.</p></div>{classErrors.length ? <ul>{classErrors.map((e) => <li key={e}>{e}</li>)}</ul> : <p>{data.classes.length ? 'The structure is ready for Phase 4 curriculum requirements.' : 'Add groups to begin the timetable demand model.'}</p>}</div>
  </>;
}

function App() {
  const [data, setData] = useState(loadState);
  const [page, setPage] = useState('setup');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSavedAt(new Date());
    }, 250);
    return () => clearTimeout(timer);
  }, [data]);

  const nav = [
    ['setup', 'School setup', 'Phase 1'], ['staff', 'Staff', 'Phase 2'], ['classes', 'Classes', 'Phase 3'],
    ['curriculum', 'Curriculum', 'Next'], ['rooms', 'Rooms', 'Later'], ['constraints', 'Constraints', 'Later'],
    ['generate', 'Generate timetable', 'Later'], ['timetables', 'Timetables', 'Later'], ['cover', 'Cover', 'Later'],
  ];

  const phaseReady = {
    setup: Boolean(data.school.name && data.days.some((d) => d.enabled) && data.blocks.length),
    staff: data.staff.length > 0,
    classes: data.classes.length > 0,
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TM</div><div><strong>Time Maker</strong><span>Whole-school timetabling</span></div></div>
      <nav>{nav.map(([key, label, meta]) => {
        const enabled = ['setup', 'staff', 'classes'].includes(key);
        return <button key={key} className={`nav-item ${page === key ? 'active' : ''}`} disabled={!enabled} onClick={() => enabled && setPage(key)}><span>{label}</span><small>{enabled && phaseReady[key] ? '✓ Ready' : meta}</small></button>;
      })}</nav>
      <div className="sidebar-footer"><strong>Build progress</strong><span>Phases 1–3 enabled</span></div>
    </aside>

    <main className="main-content">
      <div className="global-bar"><div className="crumb">{data.school.name || 'Unnamed school'} <span>·</span> {data.school.academicYear}</div><div className="save-state"><span className="status-dot" />{savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saving locally…'}</div></div>
      {page === 'setup' && <SchoolSetup data={data} setData={setData} />}
      {page === 'staff' && <StaffManager data={data} setData={setData} />}
      {page === 'classes' && <ClassesManager data={data} setData={setData} />}
      <footer className="app-footer">Time Maker · Whole-school timetable builder · Data currently saves in this browser</footer>
    </main>
  </div>;
}

export default App;
