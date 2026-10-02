import React, { useMemo, useState } from 'react';

const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const ROOM_TYPES = [
  'General classroom', 'Science lab', 'Computer room', 'Art room', 'Music room', 'Drama space',
  'Sports facility', 'Workshop / DT room', 'Kitchen / food room', 'Library / study space', 'Other specialist room',
];

function Metric({ label, value, note, className = '' }) {
  return <div className="metric-card"><span>{label}</span><strong className={className}>{value}</strong><small>{note}</small></div>;
}

function Section({ eyebrow, title, description, children, actions }) {
  return <section className="panel"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="section-actions">{actions}</div>}</div>{children}</section>;
}

function EmptyState({ onClick }) {
  return <div className="empty-state"><div className="empty-icon">+</div><strong>No rooms entered yet</strong><p>Add classrooms, labs and specialist spaces so the generator can allocate lessons without room clashes.</p><button className="primary" onClick={onClick}>Add first room</button></div>;
}

export default function RoomsManager({ data, setData }) {
  const enabledDays = data.days.filter((d) => d.enabled);
  const lessonBlocks = data.blocks.filter((b) => b.type === 'lesson');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');

  const rooms = data.rooms || [];

  function addRoom(seed = {}) {
    setData((p) => ({ ...p, rooms: [...(p.rooms || []), {
      id: uid(), name: seed.name || '', code: seed.code || '', building: seed.building || '', floor: seed.floor || '',
      department: seed.department || '', type: seed.type || 'General classroom', capacity: seed.capacity ?? 30,
      accessible: seed.accessible ?? true, shared: seed.shared ?? true, features: seed.features || [],
      unavailableSlots: seed.unavailableSlots || [], notes: seed.notes || '',
    }] }));
  }

  function updateRoom(id, field, value) {
    setData((p) => ({ ...p, rooms: (p.rooms || []).map((r) => r.id === id ? { ...r, [field]: value } : r) }));
  }

  function toggleUnavailable(room, dayKey, blockName) {
    const key = `${dayKey}|${blockName}`;
    const current = room.unavailableSlots || [];
    updateRoom(room.id, 'unavailableSlots', current.includes(key) ? current.filter((x) => x !== key) : [...current, key]);
  }

  const visible = rooms.filter((r) => {
    const matchesType = typeFilter === 'All' || r.type === typeFilter;
    const matchesDept = deptFilter === 'All' || r.department === deptFilter;
    const haystack = `${r.name} ${r.code} ${r.building} ${r.department} ${r.type} ${(r.features || []).join(' ')}`.toLowerCase();
    return matchesType && matchesDept && haystack.includes(search.toLowerCase());
  });

  const totalCapacity = rooms.reduce((n, r) => n + Number(r.capacity || 0), 0);
  const specialistRooms = rooms.filter((r) => r.type !== 'General classroom').length;
  const unavailableCount = rooms.reduce((n, r) => n + (r.unavailableSlots || []).length, 0);

  const roomErrors = useMemo(() => {
    const errors = [];
    const codes = new Map();
    const names = new Map();
    rooms.forEach((r) => {
      const label = r.name || r.code || 'A room';
      if (!r.name?.trim()) errors.push('A room is missing its name.');
      if (!r.code?.trim()) errors.push(`${label} is missing a room code.`);
      if (!r.type) errors.push(`${label} needs a room type.`);
      if (Number(r.capacity) < 1) errors.push(`${label} must have a capacity of at least 1.`);
      if (r.code?.trim()) codes.set(r.code.trim().toLowerCase(), (codes.get(r.code.trim().toLowerCase()) || 0) + 1);
      if (r.name?.trim()) names.set(r.name.trim().toLowerCase(), (names.get(r.name.trim().toLowerCase()) || 0) + 1);
    });
    codes.forEach((count, code) => { if (count > 1) errors.push(`Room code “${code}” is duplicated.`); });
    names.forEach((count, name) => { if (count > 1) errors.push(`Room name “${name}” is duplicated.`); });

    (data.curriculumRequirements || []).forEach((req) => {
      if (!req.roomType || ['No specialist room', 'General classroom'].includes(req.roomType)) return;
      const suitable = rooms.filter((room) => room.type === req.roomType);
      if (!suitable.length) errors.push(`${req.name || `${req.year} ${req.subject}`}: no ${req.roomType} has been added.`);
      const group = data.classes.find((c) => c.id === req.targetGroupId);
      if (group && suitable.length && !suitable.some((room) => Number(room.capacity) >= Number(group.size || 0))) {
        errors.push(`${req.name || group.name}: no ${req.roomType} is large enough for ${group.size || 0} students.`);
      }
    });
    return [...new Set(errors)];
  }, [rooms, data.curriculumRequirements, data.classes]);

  const demandByType = useMemo(() => ROOM_TYPES.map((type) => {
    const roomCount = rooms.filter((r) => r.type === type).length;
    const demand = (data.curriculumRequirements || []).filter((r) => r.roomType === type).reduce((n, r) => n + Number(r.lessonsPerWeek || 0), 0);
    const rawSlots = roomCount * enabledDays.length * lessonBlocks.length;
    const unavailable = rooms.filter((r) => r.type === type).reduce((n, r) => n + (r.unavailableSlots || []).length, 0);
    return { type, roomCount, demand, capacity: Math.max(0, rawSlots - unavailable) };
  }).filter((row) => row.roomCount || row.demand), [rooms, data.curriculumRequirements, enabledDays.length, lessonBlocks.length]);

  const largestClass = data.classes.reduce((max, c) => Math.max(max, Number(c.size || 0)), 0);
  const largestRoom = rooms.reduce((max, r) => Math.max(max, Number(r.capacity || 0)), 0);

  return <>
    <div className="page-title"><div><span className="eyebrow">PHASE 5</span><h1>Rooms & resources</h1><p>Define where lessons can happen and the specialist facilities the timetable generator must protect.</p></div><button className="primary" onClick={() => addRoom()}>+ Add room</button></div>

    <div className="summary-grid compact">
      <Metric label="Rooms" value={rooms.length} note="teaching spaces entered" />
      <Metric label="Specialist rooms" value={specialistRooms} note="labs and specialist spaces" />
      <Metric label="Total room capacity" value={totalCapacity} note="student places across rooms" />
      <Metric label="Unavailable slots" value={unavailableCount} note="room closures / restrictions" />
    </div>

    <Section eyebrow="5A · ROOM REGISTER" title="Teaching spaces" description="Add every room that can appear on the timetable, including labs, sports areas and specialist spaces.">
      <div className="curriculum-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rooms, codes, buildings or equipment…" /><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option>All</option>{ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}</select><select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}><option>All</option>{data.departments.map((d) => <option key={d}>{d}</option>)}</select></div>
      {!rooms.length ? <EmptyState onClick={() => addRoom()} /> : <div className="staff-list">{visible.map((room) => <article className="staff-card" key={room.id}>
        <div className="staff-card-head"><div className="avatar">{room.code || 'RM'}</div><div className="staff-identity"><input className="name-input" value={room.name} onChange={(e) => updateRoom(room.id, 'name', e.target.value)} placeholder="Room name, e.g. Physics Lab 1" /><div className="mini-grid"><label><span>Room code</span><input value={room.code} onChange={(e) => updateRoom(room.id, 'code', e.target.value.toUpperCase().slice(0, 12))} placeholder="S1" /></label><label><span>Room type</span><select value={room.type} onChange={(e) => updateRoom(room.id, 'type', e.target.value)}>{ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label></div></div><button className="danger-outline small" onClick={() => setData((p) => ({ ...p, rooms: (p.rooms || []).filter((r) => r.id !== room.id) }))}>Remove</button></div>

        <div className="staff-fields">
          <label><span>Capacity</span><input type="number" min="1" value={room.capacity} onChange={(e) => updateRoom(room.id, 'capacity', e.target.value)} /></label>
          <label><span>Department / home area</span><select value={room.department || ''} onChange={(e) => updateRoom(room.id, 'department', e.target.value)}><option value="">Shared / none</option>{data.departments.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label><span>Building</span><input value={room.building || ''} onChange={(e) => updateRoom(room.id, 'building', e.target.value)} placeholder="Main building" /></label>
          <label><span>Floor / area</span><input value={room.floor || ''} onChange={(e) => updateRoom(room.id, 'floor', e.target.value)} placeholder="Ground / first" /></label>
          <label className="wide"><span>Equipment / features</span><input value={(room.features || []).join(', ')} onChange={(e) => updateRoom(room.id, 'features', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="Projector, sinks, gas taps, computers" /><small>Separate features with commas.</small></label>
          <label><span>Accessible</span><select value={room.accessible ? 'yes' : 'no'} onChange={(e) => updateRoom(room.id, 'accessible', e.target.value === 'yes')}><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label><span>Can be shared</span><select value={room.shared ? 'yes' : 'no'} onChange={(e) => updateRoom(room.id, 'shared', e.target.value === 'yes')}><option value="yes">Yes</option><option value="no">Department priority</option></select></label>
        </div>

        <div className="availability"><div><strong>Room availability</strong><small>Ticking a slot below marks the room unavailable for teaching at that time.</small></div></div>
        <div className="class-table-wrap"><table className="data-table"><thead><tr><th>Day</th>{lessonBlocks.map((b) => <th key={b.id}>{b.name}</th>)}</tr></thead><tbody>{enabledDays.map((day) => <tr key={day.key}><td><strong>{day.label}</strong></td>{lessonBlocks.map((block) => { const unavailable = (room.unavailableSlots || []).includes(`${day.key}|${block.name}`); return <td key={`${day.key}-${block.id}`}><label className={`slot-toggle ${unavailable ? 'blocked' : ''}`}><input type="checkbox" checked={unavailable} onChange={() => toggleUnavailable(room, day.key, block.name)} />{unavailable ? 'Unavailable' : 'Available'}</label></td>; })}</tr>)}</tbody></table></div>
        <label style={{ marginTop: 14, display: 'block' }}><span>Notes / restrictions</span><input value={room.notes || ''} onChange={(e) => updateRoom(room.id, 'notes', e.target.value)} placeholder="e.g. Exams use this room every Wednesday P5" /></label>
      </article>)}</div>}
    </Section>

    <Section eyebrow="5B · ROOM CAPACITY" title="Room demand vs availability" description="A first-pass check of specialist-room pressure before the constraint solver is introduced.">
      {!demandByType.length ? <p className="hint">Add rooms or specialist-room curriculum requirements to see room demand.</p> : <div className="subject-demand-grid">{demandByType.map((row) => <div className="subject-demand-card" key={row.type}><div><strong>{row.type}</strong><span>{row.demand} required periods/week</span></div><div className="subject-demand-stats"><span><b>{row.roomCount}</b> rooms</span><span><b>{row.capacity}</b> usable slots</span></div><div className={`capacity-bar ${row.demand > row.capacity ? 'risk' : ''}`}><span style={{ width: `${row.capacity ? Math.min(100, (row.demand / row.capacity) * 100) : 100}%` }} /></div></div>)}</div>}
      <div className="demand-grid" style={{ marginTop: 14 }}><div><span>Largest class/group</span><strong>{largestClass || '—'}</strong></div><div><span>Largest room</span><strong>{largestRoom || '—'}</strong></div><div><span>Capacity check</span><strong className={largestClass && largestRoom && largestRoom < largestClass ? 'warn-text' : 'good-text'}>{!largestClass || !largestRoom ? 'Waiting for data' : largestRoom >= largestClass ? 'Room available' : 'Check capacity'}</strong></div></div>
    </Section>

    <Section eyebrow="5C · GENERATOR READINESS" title="Room validation" description="These checks catch room problems before hard timetable constraints are added.">
      <div className={`validation-panel embedded ${roomErrors.length ? 'warning' : 'success'}`}><div><span className="eyebrow">ROOM DATA CHECK</span><h2>{roomErrors.length ? `${roomErrors.length} issue${roomErrors.length > 1 ? 's' : ''} to fix` : 'Room data is ready'}</h2><p>Curriculum room requirements are now cross-checked against actual spaces.</p></div>{roomErrors.length ? <ul>{roomErrors.map((error) => <li key={error}>{error}</li>)}</ul> : <p>{rooms.length ? 'Rooms are ready for Phase 6 scheduling constraints.' : 'Add rooms to begin validation.'}</p>}</div>
    </Section>
  </>;
}
