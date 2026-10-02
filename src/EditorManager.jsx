import React, { useMemo, useRef, useState } from 'react';

function Metric({ label, value, note, className = '' }) {
  return <div className="metric-card"><span>{label}</span><strong className={className}>{value}</strong><small>{note}</small></div>;
}
function Section({ eyebrow, title, description, actions, children }) {
  return <section className="panel"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="section-actions">{actions}</div>}</div>{children}</section>;
}

const norm = (value) => String(value || '').trim().toLowerCase();
const overlap = (a = [], b = []) => a.some((value) => b.includes(value));

function getWeeks(data) {
  return data.school?.cycle === 'two-week' ? ['A', 'B'] : ['A'];
}

function buildSlots(data) {
  const baseLessons = (data.blocks || []).filter((block) => block.type === 'lesson');
  const days = (data.days || []).filter((day) => day.enabled);
  const slots = [];
  getWeeks(data).forEach((week) => {
    days.forEach((day, dayIndex) => {
      const lessons = (data.dayOverrides?.[day.key] || data.blocks || []).filter((block) => block.type === 'lesson');
      lessons.forEach((block, periodIndex) => slots.push({
        id: `${week}:${day.key}:${block.id}`,
        week,
        dayKey: day.key,
        dayLabel: day.label,
        dayIndex,
        periodId: block.id,
        basePeriodId: baseLessons[periodIndex]?.id || block.id,
        periodName: block.name,
        periodIndex,
        start: block.start,
        end: block.end,
      }));
    });
  });
  return slots;
}

function roomUnavailable(room, slot) {
  return (room?.unavailableSlots || []).some((item) => {
    if (typeof item === 'string') {
      return [slot.id, `${slot.dayKey}:${slot.periodId}`, `${slot.dayKey}:${slot.basePeriodId}`, `${slot.dayKey}|${slot.periodId}`, `${slot.dayKey}-${slot.periodId}`].includes(item);
    }
    return item && item.day === slot.dayKey && [slot.periodId, slot.basePeriodId, 'all'].includes(item.periodId);
  });
}

function appliesTo(constraint, assignment) {
  if (constraint.enabled === false) return false;
  if (constraint.scope === 'global') return true;
  if (constraint.scope === 'staff') return constraint.targetId === assignment.teacherId;
  if (constraint.scope === 'class') return constraint.targetId === assignment.groupId;
  if (constraint.scope === 'year') return constraint.targetId === assignment.year;
  if (constraint.scope === 'subject') return norm(constraint.targetId) === norm(assignment.subject);
  if (constraint.scope === 'room') return constraint.targetId === assignment.roomId;
  return false;
}

function targetSlotsFor(start, duration, slotMap) {
  const key = `${start.week}:${start.dayKey}`;
  const daySlots = slotMap.get(key) || [];
  const index = daySlots.findIndex((slot) => slot.id === start.id);
  if (index < 0 || index + duration > daySlots.length) return null;
  const result = daySlots.slice(index, index + duration);
  for (let i = 1; i < result.length; i += 1) {
    if (result[i].periodIndex !== result[i - 1].periodIndex + 1) return null;
  }
  return result;
}

function dailyAssignments(assignments, assignment, dayKey, week) {
  return assignments.filter((item) => item.id !== assignment.id && item.week === week && item.dayKey === dayKey);
}

function validateMove(assignment, startSlot, data, option) {
  const assignments = option?.assignments || [];
  const slots = buildSlots(data);
  const slotMap = new Map();
  slots.forEach((slot) => {
    const key = `${slot.week}:${slot.dayKey}`;
    const rows = slotMap.get(key) || [];
    rows.push(slot);
    rows.sort((a, b) => a.periodIndex - b.periodIndex);
    slotMap.set(key, rows);
  });
  const duration = Math.max(1, Number(assignment.duration || assignment.periodIndices?.length || 1));
  const targetSlots = targetSlotsFor(startSlot, duration, slotMap);
  const reasons = [];
  if (!targetSlots) return { valid: false, reasons: ['A double or multi-period lesson would run beyond the available consecutive periods.'], targetSlots: [] };

  const teacher = (data.staff || []).find((item) => item.id === assignment.teacherId);
  const room = (data.rooms || []).find((item) => item.id === assignment.roomId);
  const requirement = (data.curriculumRequirements || []).find((item) => item.id === assignment.requirementId);
  const group = (data.classes || []).find((item) => item.id === assignment.groupId);

  if (teacher?.availability?.[startSlot.dayKey] === false) reasons.push(`${teacher.initials || teacher.name} is not available on ${startSlot.dayLabel}.`);
  if (room && targetSlots.some((slot) => roomUnavailable(room, slot))) reasons.push(`${room.code || room.name} is unavailable for one of the target periods.`);
  if (room && group && Number(room.capacity || 0) < Number(group.size || 0)) reasons.push(`${room.code || room.name} is too small for ${group.name}.`);
  if (room && requirement?.roomType && !['No specialist room', 'General classroom'].includes(requirement.roomType) && room.type !== requirement.roomType) reasons.push(`${room.code || room.name} does not meet the ${requirement.roomType} requirement.`);

  const targetIndices = targetSlots.map((slot) => slot.periodIndex);
  assignments.filter((item) => item.id !== assignment.id && item.week === startSlot.week && item.dayKey === startSlot.dayKey && overlap(item.periodIndices || [item.periodIndex], targetIndices)).forEach((other) => {
    if (other.teacherId && other.teacherId === assignment.teacherId) reasons.push(`${assignment.teacherInitials || assignment.teacherName} is already teaching ${other.groupName || other.year} ${other.subject}.`);
    if (other.roomId && other.roomId === assignment.roomId) reasons.push(`${assignment.roomCode || assignment.roomName} is already used by ${other.groupName || other.year} ${other.subject}.`);
    if (assignment.groupId && other.groupId === assignment.groupId) reasons.push(`${assignment.groupName} already has ${other.subject} at this time.`);
    if (!assignment.groupId && !other.groupId && assignment.year && other.year === assignment.year) reasons.push(`${assignment.year} already has another whole-year lesson at this time.`);
  });

  const hard = (data.constraints || []).filter((constraint) => constraint.enabled !== false && constraint.severity === 'hard' && appliesTo(constraint, assignment));
  hard.forEach((constraint) => {
    const periodMatches = constraint.periodId === 'all' || targetSlots.some((slot) => [slot.periodId, slot.basePeriodId].includes(constraint.periodId));
    const dayMatches = !constraint.day || constraint.day === startSlot.dayKey;
    if (constraint.ruleType === 'unavailable' && dayMatches && periodMatches) reasons.push(`${constraint.name || 'Hard constraint'} blocks this time.`);
    if (constraint.ruleType === 'fixed-period' && (!dayMatches || !periodMatches)) reasons.push(`${constraint.name || 'Fixed-period rule'} requires a different slot.`);
  });

  const sameDay = dailyAssignments(assignments, assignment, startSlot.dayKey, startSlot.week);
  const staffDay = sameDay.filter((item) => item.teacherId === assignment.teacherId).reduce((n, item) => n + Number(item.duration || 1), 0) + duration;
  const maxDailyConstraint = hard.filter((constraint) => constraint.ruleType === 'max-daily').map((constraint) => Number(constraint.value || 0)).filter(Boolean);
  const maxDaily = Math.min(...[Number(teacher?.maxDaily || Infinity), ...maxDailyConstraint, Infinity]);
  if (Number.isFinite(maxDaily) && staffDay > maxDaily) reasons.push(`${teacher?.initials || teacher?.name || 'Teacher'} would exceed the maximum of ${maxDaily} lessons on this day.`);

  const staffIndices = sameDay.filter((item) => item.teacherId === assignment.teacherId).flatMap((item) => item.periodIndices || [item.periodIndex]).concat(targetIndices).sort((a, b) => a - b);
  let run = 0;
  let longest = 0;
  let previous = null;
  [...new Set(staffIndices)].forEach((index) => {
    run = previous !== null && index === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = index;
  });
  const maxConsecutiveConstraint = hard.filter((constraint) => constraint.ruleType === 'max-consecutive').map((constraint) => Number(constraint.value || 0)).filter(Boolean);
  const maxConsecutive = Math.min(...[Number(teacher?.maxConsecutive || Infinity), ...maxConsecutiveConstraint, Infinity]);
  if (Number.isFinite(maxConsecutive) && longest > maxConsecutive) reasons.push(`${teacher?.initials || teacher?.name || 'Teacher'} would exceed ${maxConsecutive} consecutive lessons.`);

  return { valid: reasons.length === 0, reasons: [...new Set(reasons)], targetSlots };
}

function softScore(assignment, startSlot, data) {
  let score = 0;
  (data.constraints || []).filter((constraint) => constraint.enabled !== false && constraint.severity === 'soft' && appliesTo(constraint, assignment)).forEach((constraint) => {
    const weight = Number(constraint.weight || 5);
    const periodMatches = constraint.periodId === 'all' || [startSlot.periodId, startSlot.basePeriodId].includes(constraint.periodId);
    const dayMatches = !constraint.day || constraint.day === startSlot.dayKey;
    if (constraint.ruleType === 'prefer-period') score += dayMatches && periodMatches ? -weight : weight;
    if (constraint.ruleType === 'avoid-period' && dayMatches && periodMatches) score += weight;
    if (constraint.ruleType === 'preferred-room' && constraint.roomId === assignment.roomId) score -= weight;
  });
  return score;
}

function applyMove(assignment, startSlot, targetSlots) {
  return {
    ...assignment,
    week: startSlot.week,
    dayKey: startSlot.dayKey,
    dayLabel: startSlot.dayLabel,
    periodId: startSlot.basePeriodId,
    periodName: targetSlots.map((slot) => slot.periodName).join(' + '),
    periodIndex: startSlot.periodIndex,
    periodIndices: targetSlots.map((slot) => slot.periodIndex),
    slotIds: targetSlots.map((slot) => slot.id),
    manuallyEdited: true,
  };
}

export default function EditorManager({ data, setData, onBack }) {
  const options = data.generatedTimetables || [];
  const [selectedOptionId, setSelectedOptionId] = useState(data.activeTimetableId || options[0]?.id || '');
  const selected = options.find((option) => option.id === selectedOptionId) || options[0];
  const [week, setWeek] = useState('A');
  const [search, setSearch] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [dragId, setDragId] = useState('');
  const [hoverTarget, setHoverTarget] = useState(null);
  const [message, setMessage] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [history, setHistory] = useState([]);
  const initialAssignments = useRef(selected ? JSON.parse(JSON.stringify(selected.assignments || [])) : []);

  const slots = useMemo(() => buildSlots(data), [data.school?.cycle, data.days, data.blocks, data.dayOverrides]);
  const weeks = getWeeks(data);
  const days = (data.days || []).filter((day) => day.enabled);
  const baseLessons = (data.blocks || []).filter((block) => block.type === 'lesson');
  const assignments = selected?.assignments || [];
  const selectedLesson = assignments.find((assignment) => assignment.id === selectedLessonId);
  const lockedCount = assignments.filter((assignment) => assignment.locked).length;
  const editedCount = assignments.filter((assignment) => assignment.manuallyEdited).length;

  function saveAssignments(nextAssignments, logEntry) {
    if (!selected) return;
    if (logEntry) setHistory((items) => [...items, { ...logEntry, before: assignments }]);
    setData((prev) => ({
      ...prev,
      generatedTimetables: (prev.generatedTimetables || []).map((option) => option.id === selected.id ? { ...option, assignments: nextAssignments, lastEditedAt: new Date().toISOString() } : option),
      activeTimetableId: prev.activeTimetableId || selected.id,
    }));
  }

  function moveLesson(assignment, targetSlot) {
    if (!assignment || !targetSlot) return false;
    if (assignment.locked) {
      setMessage({ type: 'error', text: 'This lesson is locked. Unlock it before moving it.' });
      return false;
    }
    const result = validateMove(assignment, targetSlot, data, selected);
    if (!result.valid) {
      setMessage({ type: 'error', text: 'Move blocked', reasons: result.reasons });
      return false;
    }
    const updated = applyMove(assignment, targetSlot, result.targetSlots);
    const next = assignments.map((item) => item.id === assignment.id ? updated : item);
    saveAssignments(next, { type: 'move', label: `${assignment.groupName || assignment.year} ${assignment.subject}`, text: `${assignment.dayLabel} ${assignment.periodName} → ${targetSlot.dayLabel} ${updated.periodName}` });
    setSelectedLessonId(assignment.id);
    setAlternatives([]);
    setMessage({ type: 'success', text: `${assignment.groupName || assignment.year} ${assignment.subject} moved to ${targetSlot.dayLabel} ${updated.periodName}.` });
    return true;
  }

  function toggleLock(assignment) {
    if (!assignment) return;
    const next = assignments.map((item) => item.id === assignment.id ? { ...item, locked: !item.locked } : item);
    saveAssignments(next, { type: 'lock', label: `${assignment.groupName || assignment.year} ${assignment.subject}`, text: assignment.locked ? 'Unlocked lesson' : 'Locked lesson' });
    setMessage({ type: 'success', text: assignment.locked ? 'Lesson unlocked.' : 'Lesson locked in place.' });
  }

  function findAlternatives(assignment) {
    if (!assignment || assignment.locked) return;
    const valid = slots.filter((slot) => slot.week === assignment.week && !(slot.dayKey === assignment.dayKey && slot.periodIndex === assignment.periodIndex)).map((slot) => {
      const result = validateMove(assignment, slot, data, selected);
      if (!result.valid) return null;
      const distance = Math.abs((slot.dayIndex * 10 + slot.periodIndex) - (((data.days || []).findIndex((day) => day.key === assignment.dayKey)) * 10 + Number(assignment.periodIndex || 0)));
      return { slot, result, score: softScore(assignment, slot, data) + distance * .1 };
    }).filter(Boolean).sort((a, b) => a.score - b.score).slice(0, 10);
    setAlternatives(valid);
    setMessage(valid.length ? { type: 'info', text: `${valid.length} valid alternative${valid.length === 1 ? '' : 's'} found.` } : { type: 'error', text: 'No valid alternative slots were found under the current hard constraints.' });
  }

  function undoLast() {
    const previous = history[history.length - 1];
    if (!previous) return;
    saveAssignments(previous.before);
    setHistory((items) => items.slice(0, -1));
    setAlternatives([]);
    setMessage({ type: 'success', text: 'Last timetable edit undone.' });
  }

  function resetEdits() {
    if (!selected) return;
    if (!window.confirm('Reset manual edits for this timetable option?')) return;
    saveAssignments(JSON.parse(JSON.stringify(initialAssignments.current)));
    setHistory([]);
    setSelectedLessonId('');
    setAlternatives([]);
    setMessage({ type: 'success', text: 'Manual edits for this editor session were reset.' });
  }

  function selectOption(id) {
    setSelectedOptionId(id);
    const option = options.find((item) => item.id === id);
    initialAssignments.current = option ? JSON.parse(JSON.stringify(option.assignments || [])) : [];
    setHistory([]);
    setSelectedLessonId('');
    setAlternatives([]);
    setMessage(null);
  }

  const filtered = assignments.filter((assignment) => assignment.week === week && `${assignment.groupName} ${assignment.year} ${assignment.subject} ${assignment.teacherName} ${assignment.teacherInitials} ${assignment.roomName} ${assignment.roomCode}`.toLowerCase().includes(search.toLowerCase()));
  const inCell = (dayKey, periodIndex) => filtered.filter((assignment) => assignment.dayKey === dayKey && (assignment.periodIndices || [assignment.periodIndex]).includes(periodIndex));
  const dragLesson = assignments.find((assignment) => assignment.id === dragId);

  if (!options.length) {
    return <div className="editor-page"><div className="editor-topbar"><div><button className="text-button" onClick={onBack}>← Back to app</button><span className="eyebrow">PHASE 9</span><h1>Visual timetable editor</h1><p>Generate a timetable in Phase 7 before editing it.</p></div></div><div className="validation-panel warning"><div><span className="eyebrow">NO TIMETABLE</span><h2>Nothing to edit yet</h2><p>Run Phase 7 or load the demo school first.</p></div></div></div>;
  }

  return <div className="editor-page">
    <div className="editor-topbar">
      <div><button className="text-button" onClick={onBack}>← Back to app</button><span className="eyebrow">PHASE 9</span><h1>Visual timetable editor</h1><p>Drag lessons to valid slots, lock important placements and inspect alternatives before committing changes.</p></div>
      <div className="editor-top-actions"><button className="secondary" onClick={undoLast} disabled={!history.length}>Undo</button><button className="danger-outline" onClick={resetEdits} disabled={!history.length && !editedCount}>Reset session edits</button></div>
    </div>

    <div className="summary-grid compact">
      <Metric label="Lessons" value={assignments.length} note="blocks in selected option" />
      <Metric label="Locked" value={lockedCount} note="protected placements" />
      <Metric label="Manual edits" value={editedCount} note="moved in editor" />
      <Metric label="Edit history" value={history.length} note="undoable this session" />
    </div>

    <Section eyebrow="9A · TIMETABLE OPTION" title="Choose what to edit" description="Edits are saved directly into the selected generated option and remain available to later phases.">
      <div className="editor-option-row">{options.map((option) => <button key={option.id} className={`editor-option ${selected?.id === option.id ? 'selected' : ''}`} onClick={() => selectOption(option.id)}><strong>{option.name}</strong><span>{option.completion ?? 0}% complete · {(option.unscheduled || []).length} unresolved</span>{data.activeTimetableId === option.id && <small>Active timetable</small>}</button>)}</div>
    </Section>

    {message && <div className={`editor-message ${message.type}`}><div><strong>{message.text}</strong>{message.reasons?.length ? <ul>{message.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}</div><button onClick={() => setMessage(null)}>×</button></div>}

    <div className="editor-workspace">
      <section className="panel editor-grid-panel">
        <div className="section-heading"><div><span className="eyebrow">9B · DRAG & DROP</span><h2>Whole-school timetable</h2><p>Drop a lesson only where all hard constraints remain valid. Invalid targets are highlighted while dragging.</p></div><div className="editor-view-actions">{weeks.map((item) => <button key={item} className={`secondary small ${week === item ? 'active-choice' : ''}`} onClick={() => setWeek(item)}>Week {item}</button>)}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter class, teacher, room…" /></div></div>
        <div className="editor-grid-wrap"><table className="editor-grid"><thead><tr><th>Period</th>{days.map((day) => <th key={day.key}>{day.label}</th>)}</tr></thead><tbody>{baseLessons.map((block, periodIndex) => <tr key={block.id}><th><strong>{block.name}</strong><span>{block.start}–{block.end}</span></th>{days.map((day) => {
          const startSlot = slots.find((slot) => slot.week === week && slot.dayKey === day.key && slot.periodIndex === periodIndex);
          const preview = dragLesson && startSlot ? validateMove(dragLesson, startSlot, data, selected) : null;
          const hovering = hoverTarget?.dayKey === day.key && hoverTarget?.periodIndex === periodIndex;
          return <td key={day.key} className={`${dragLesson ? 'drop-target' : ''} ${hovering && preview ? (preview.valid ? 'drop-valid' : 'drop-invalid') : ''}`} onDragOver={(event) => event.preventDefault()} onDragEnter={() => startSlot && setHoverTarget(startSlot)} onDragLeave={() => hovering && setHoverTarget(null)} onDrop={(event) => { event.preventDefault(); if (dragLesson && startSlot) moveLesson(dragLesson, startSlot); setDragId(''); setHoverTarget(null); }}>
            <div className="editor-cell">{inCell(day.key, periodIndex).map((assignment) => {
              const isStart = Number(assignment.periodIndex) === periodIndex;
              return <button key={`${assignment.id}-${periodIndex}`} draggable={isStart && !assignment.locked} onDragStart={(event) => { if (!isStart || assignment.locked) return; event.dataTransfer.effectAllowed = 'move'; setDragId(assignment.id); setSelectedLessonId(assignment.id); }} onDragEnd={() => { setDragId(''); setHoverTarget(null); }} onClick={() => setSelectedLessonId(assignment.id)} className={`editor-lesson ${assignment.locked ? 'locked' : ''} ${assignment.manuallyEdited ? 'edited' : ''} ${selectedLessonId === assignment.id ? 'selected' : ''} ${!isStart ? 'continuation' : ''}`}>
                <strong>{assignment.groupName || assignment.year} · {assignment.subject}</strong><span>{assignment.teacherInitials || assignment.teacherName} · {assignment.roomCode || assignment.roomName}</span>{assignment.duration > 1 && isStart && <small>Double</small>}{assignment.locked && <small>Locked</small>}
              </button>;
            })}</div>
          </td>;
        })}</tr>)}</tbody></table></div>
      </section>

      <aside className="editor-inspector">
        <div className="panel sticky-inspector"><span className="eyebrow">9C · LESSON INSPECTOR</span>{!selectedLesson ? <><h2>Select a lesson</h2><p>Click a lesson to see its details, lock it, or find valid alternatives.</p></> : <>
          <div className="inspector-title"><div><h2>{selectedLesson.groupName || selectedLesson.year}</h2><p>{selectedLesson.subject}</p></div><span className={selectedLesson.locked ? 'lock-badge locked' : 'lock-badge'}>{selectedLesson.locked ? 'Locked' : 'Editable'}</span></div>
          <dl className="lesson-details"><div><dt>Current slot</dt><dd>Week {selectedLesson.week} · {selectedLesson.dayLabel} · {selectedLesson.periodName}</dd></div><div><dt>Teacher</dt><dd>{selectedLesson.teacherInitials || selectedLesson.teacherName} · {selectedLesson.teacherName}</dd></div><div><dt>Room</dt><dd>{selectedLesson.roomCode || selectedLesson.roomName}</dd></div><div><dt>Duration</dt><dd>{selectedLesson.duration > 1 ? `${selectedLesson.duration} periods` : 'Single period'}</dd></div></dl>
          <div className="inspector-actions"><button className="secondary" onClick={() => toggleLock(selectedLesson)}>{selectedLesson.locked ? 'Unlock lesson' : 'Lock lesson'}</button><button className="primary" onClick={() => findAlternatives(selectedLesson)} disabled={selectedLesson.locked}>Find alternatives</button></div>
          {alternatives.length > 0 && <div className="alternative-list"><strong>Valid alternatives</strong>{alternatives.map(({ slot, score, result }) => <button key={slot.id} onClick={() => moveLesson(selectedLesson, slot)}><div><b>{slot.dayLabel} · {result.targetSlots.map((item) => item.periodName).join(' + ')}</b><span>{slot.start}–{result.targetSlots[result.targetSlots.length - 1]?.end}</span></div><small>{score < 0 ? 'Strong preference fit' : score <= 2 ? 'Good fit' : 'Valid'}</small></button>)}</div>}
        </>}</div>

        <div className="panel"><span className="eyebrow">9D · LIVE RULE CHECK</span><h2>What the editor protects</h2><div className="rule-check-list"><span>✓ Teacher clashes</span><span>✓ Class/group clashes</span><span>✓ Room clashes</span><span>✓ Staff working days</span><span>✓ Room closures</span><span>✓ Specialist room type</span><span>✓ Room capacity</span><span>✓ Fixed-period hard rules</span><span>✓ Max lessons/day</span><span>✓ Max consecutive lessons</span><span>✓ Double-period continuity</span></div></div>
      </aside>
    </div>

    <Section eyebrow="9E · EDIT HISTORY" title="Changes made this session" description="The editor keeps a lightweight undo history while this Phase 9 screen remains open.">
      {!history.length ? <p className="hint">No timetable edits have been made in this editor session.</p> : <div className="edit-history-list">{[...history].reverse().map((item, index) => <div key={`${item.label}-${index}`}><span>{item.type === 'move' ? '↔' : '🔒'}</span><div><strong>{item.label}</strong><small>{item.text}</small></div></div>)}</div>}
    </Section>
  </div>;
}
