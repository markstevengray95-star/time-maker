import React, { useMemo, useState } from 'react';
import { expandCurriculum } from './planning.js';

const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const norm = (value) => String(value || '').trim().toLowerCase();

function Metric({ label, value, note, className = '' }) {
  return <div className="metric-card"><span>{label}</span><strong className={className}>{value}</strong><small>{note}</small></div>;
}
function Section({ eyebrow, title, description, actions, children }) {
  return <section className="panel"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="section-actions">{actions}</div>}</div>{children}</section>;
}

function rng(seed = 1) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => ((value = value * 16807 % 2147483647) - 1) / 2147483646;
}

function subjectMatch(subject, subjects = []) {
  const wanted = norm(subject);
  const values = subjects.map(norm);
  if (values.includes(wanted)) return true;
  if (wanted === 'science' && values.some((x) => ['science', 'biology', 'chemistry', 'physics'].includes(x))) return true;
  if (['biology', 'chemistry', 'physics'].includes(wanted) && values.includes('science')) return true;
  if (wanted === 'mathematics' && values.includes('maths')) return true;
  if (wanted === 'maths' && values.includes('mathematics')) return true;
  if (wanted === 'pe' && values.some((x) => ['physical education', 'sport'].includes(x))) return true;
  return false;
}

function getWeeks(data) {
  return data.school?.cycle === 'two-week' ? ['A', 'B'] : ['A'];
}

function buildSlots(data) {
  const baseLessons = (data.blocks || []).filter((b) => b.type === 'lesson');
  const days = (data.days || []).filter((d) => d.enabled);
  const slots = [];
  getWeeks(data).forEach((week) => {
    days.forEach((day, dayIndex) => {
      const blocks = (data.dayOverrides?.[day.key] || data.blocks || []).filter((b) => b.type === 'lesson');
      blocks.forEach((block, periodIndex) => {
        slots.push({
          id: `${week}:${day.key}:${block.id}`,
          week, dayKey: day.key, dayLabel: day.label, dayIndex,
          periodId: block.id, basePeriodId: baseLessons[periodIndex]?.id || block.id,
          periodName: block.name, periodIndex, start: block.start, end: block.end,
        });
      });
    });
  });
  return slots;
}

function roomIsUnavailable(room, slot) {
  const unavailable = room?.unavailableSlots || [];
  return unavailable.some((item) => {
    if (typeof item === 'string') {
      return [slot.id, `${slot.dayKey}:${slot.periodId}`, `${slot.dayKey}:${slot.basePeriodId}`, `${slot.dayKey}|${slot.periodId}`, `${slot.dayKey}-${slot.periodId}`].includes(item);
    }
    return item && item.day === slot.dayKey && [slot.periodId, slot.basePeriodId, 'all'].includes(item.periodId);
  });
}

function roomMatches(requirement, room, size) {
  if (!room) return false;
  if (Number(size || 0) > 0 && Number(room.capacity || 0) < Number(size || 0)) return false;
  const type = requirement.roomType || 'No specialist room';
  if (type === 'No specialist room') return true;
  if (type === 'General classroom') return room.type === 'General classroom' || room.type === 'Library / study space';
  return room.type === type;
}

function targetInfo(requirement, data) {
  const group = requirement.targetGroupId ? (data.classes || []).find((c) => c.id === requirement.targetGroupId) : null;
  return {
    groupId: group?.id || '',
    groupName: group?.name || '',
    year: requirement.year || group?.year || '',
    size: Number(group?.size || 0),
    optionBlock: group?.optionBlock || '',
  };
}

function groupClash(a, b) {
  if (a.groupId && b.groupId) return a.groupId === b.groupId;
  if (!a.groupId && !b.groupId) return Boolean(a.year && b.year && a.year === b.year);
  if (!a.groupId && b.groupId) return Boolean(a.year && b.year && a.year === b.year);
  if (a.groupId && !b.groupId) return Boolean(a.year && b.year && a.year === b.year);
  return false;
}

function expandLessons(data) {
  return expandCurriculum(data);
}

function applies(constraint, lesson, teacher, room) {
  if (!constraint || constraint.enabled === false) return false;
  if (constraint.scope === 'global') return true;
  if (constraint.scope === 'staff') return teacher?.id === constraint.targetId;
  if (constraint.scope === 'class') return lesson.groupId === constraint.targetId;
  if (constraint.scope === 'year') return lesson.year === constraint.targetId;
  if (constraint.scope === 'subject') return norm(lesson.subject) === norm(constraint.targetId);
  if (constraint.scope === 'room') return room?.id === constraint.targetId;
  return false;
}

function periodMatches(constraint, slot) {
  if (!constraint.day || constraint.day !== slot.dayKey) return false;
  return constraint.periodId === 'all' || constraint.periodId === slot.periodId || constraint.periodId === slot.basePeriodId;
}

function longestRun(indices) {
  const values = [...new Set(indices)].sort((a, b) => a - b);
  let best = 0, run = 0, previous = null;
  values.forEach((value) => {
    run = previous !== null && value === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = value;
  });
  return best;
}

function assignmentTargets(assignment, constraint) {
  if (constraint.scope === 'global') return true;
  if (constraint.scope === 'staff') return assignment.teacherId === constraint.targetId;
  if (constraint.scope === 'class') return assignment.groupId === constraint.targetId;
  if (constraint.scope === 'year') return assignment.year === constraint.targetId;
  if (constraint.scope === 'subject') return norm(assignment.subject) === norm(constraint.targetId);
  if (constraint.scope === 'room') return assignment.roomId === constraint.targetId;
  return false;
}

function consecutiveSlotsFor(start, slotsByDay, duration) {
  if (duration === 1) return [start];
  const row = slotsByDay[`${start.week}:${start.dayKey}`] || [];
  const index = row.findIndex((s) => s.id === start.id);
  if (index < 0 || index + duration > row.length) return null;
  const selected = row.slice(index, index + duration);
  for (let i = 0; i < selected.length - 1; i += 1) {
    const a = selected[i], b = selected[i + 1];
    const [ah, am] = String(a.end || '00:00').split(':').map(Number);
    const [bh, bm] = String(b.start || '00:00').split(':').map(Number);
    const gap = (bh * 60 + bm) - (ah * 60 + am);
    if (gap > 10) return null;
  }
  return selected;
}

function makeCandidate(lesson, start, durationSlots, teacher, room, state, data, random) {
  const constraints = (data.constraints || []).filter((c) => c.enabled !== false);
  const hard = constraints.filter((c) => c.severity === 'hard');
  const soft = constraints.filter((c) => c.severity !== 'hard');
  const req = lesson.requirement;

  if (!teacher) return null;
  if (!room) return null;
  if (teacher.availability?.[start.dayKey] === false) return null;
  if ((teacher.protectedSlots || []).some(p => durationSlots.some(s => s.id === p.slotId))) return null;
  if (!roomMatches(req, room, lesson.size)) return null;
  if (durationSlots.some((slot) => roomIsUnavailable(room, slot))) return null;

  for (const slot of durationSlots) {
    if (state.teacherBusy.has(`${slot.id}:${teacher.id}`)) return null;
    if (state.roomBusy.has(`${slot.id}:${room.id}`)) return null;
    const existing = state.bySlot.get(slot.id) || [];
    if (existing.some((a) => groupClash(lesson, a))) return null;
  }

  const existingSameReqDay = state.assignments.filter((a) => a.requirementId === lesson.requirementId && a.groupId === lesson.groupId && a.week === lesson.week && a.dayKey === start.dayKey).length;
  if (Number(req.maxSameDay || 0) > 0 && existingSameReqDay >= Number(req.maxSameDay)) return null;

  const tentative = { teacherId: teacher.id, roomId: room.id, groupId: lesson.groupId, year: lesson.year, subject: lesson.subject, week: lesson.week, dayKey: start.dayKey, slotIds: durationSlots.map((s) => s.id), periodIndices: durationSlots.map((s) => s.periodIndex), requirementId: lesson.requirementId };

  for (const c of hard) {
    if (!applies(c, lesson, teacher, room)) continue;
    if (c.ruleType === 'unavailable' && durationSlots.some((slot) => periodMatches(c, slot))) return null;
    if (c.ruleType === 'fixed-period' && !durationSlots.some((slot) => periodMatches(c, slot))) return null;
    if (c.ruleType === 'preferred-room' && c.roomId && room.id !== c.roomId) return null;
    if (c.ruleType === 'different-days') {
      if (state.assignments.some((a) => assignmentTargets(a, c) && a.week === lesson.week && a.dayKey === start.dayKey)) return null;
    }
    if (c.ruleType === 'same-day') {
      const existing = state.assignments.filter((a) => assignmentTargets(a, c) && a.week === lesson.week);
      if (existing.length && existing.some((a) => a.dayKey !== start.dayKey)) return null;
    }
    if (c.ruleType === 'max-daily') {
      const count = state.assignments.filter((a) => assignmentTargets(a, c) && a.week === lesson.week && a.dayKey === start.dayKey).reduce((n, a) => n + a.slotIds.length, 0) + durationSlots.length;
      if (count > Number(c.value || 0)) return null;
    }
    if (c.ruleType === 'max-consecutive') {
      const indices = state.assignments.filter((a) => assignmentTargets(a, c) && a.week === lesson.week && a.dayKey === start.dayKey).flatMap((a) => a.periodIndices).concat(durationSlots.map((s) => s.periodIndex));
      if (longestRun(indices) > Number(c.value || 0)) return null;
    }
    if (c.ruleType === 'min-free' && c.scope === 'staff') {
      const totalWeekly = state.weekSlotCount[lesson.week] || 0;
      const current = state.assignments.filter((a) => a.week === lesson.week && a.teacherId === teacher.id).reduce((n, a) => n + a.slotIds.length, 0);
      if (current + durationSlots.length > totalWeekly - Number(c.value || 0)) return null;
    }
  }

  if (Number(teacher.maxPeriods || 0) > 0) {
    const load = state.teacherLoad[teacher.id] || 0;
    const divisor = getWeeks(data).length;
    if (load + durationSlots.length > Number(teacher.maxPeriods) * divisor) return null;
  }
  if (Number(teacher.maxDaily || 0) > 0) {
    const daily = state.assignments.filter((a) => a.teacherId === teacher.id && a.week === lesson.week && a.dayKey === start.dayKey).reduce((n, a) => n + a.slotIds.length, 0);
    if (daily + durationSlots.length > Number(teacher.maxDaily)) return null;
  }
  if (Number(teacher.maxConsecutive || 0) > 0) {
    const indices = state.assignments.filter((a) => a.teacherId === teacher.id && a.week === lesson.week && a.dayKey === start.dayKey).flatMap((a) => a.periodIndices).concat(durationSlots.map((s) => s.periodIndex));
    if (longestRun(indices) > Number(teacher.maxConsecutive)) return null;
  }

  let penalty = random() * 1.2;
  const teacherCap = Math.max(1, Number(teacher.maxPeriods || 40) * getWeeks(data).length);
  penalty += ((state.teacherLoad[teacher.id] || 0) / teacherCap) * 3;

  if (req.spread === 'balanced') penalty += existingSameReqDay * 5;
  if (req.spread === 'clustered' && existingSameReqDay > 0) penalty -= 1.5;
  if (req.roomType === 'No specialist room' && room.type !== 'General classroom') penalty += 1.5;

  soft.forEach((c) => {
    if (!applies(c, lesson, teacher, room)) return;
    const weight = Number(c.weight || 5);
    if (c.ruleType === 'unavailable' && durationSlots.some((slot) => periodMatches(c, slot))) penalty += weight * 5;
    if (c.ruleType === 'avoid-period' && durationSlots.some((slot) => periodMatches(c, slot))) penalty += weight * 3;
    if (c.ruleType === 'prefer-period') penalty += durationSlots.some((slot) => periodMatches(c, slot)) ? -weight * 2 : weight * .4;
    if (c.ruleType === 'fixed-period') penalty += durationSlots.some((slot) => periodMatches(c, slot)) ? -weight : weight * 2;
    if (c.ruleType === 'preferred-room') penalty += room.id === c.roomId ? -weight * 1.5 : weight * .5;
    if (c.ruleType === 'different-days') {
      if (state.assignments.some((a) => assignmentTargets(a, c) && a.week === lesson.week && a.dayKey === start.dayKey)) penalty += weight * 2;
    }
    if (c.ruleType === 'same-day') {
      const previous = state.assignments.filter((a) => assignmentTargets(a, c) && a.week === lesson.week);
      if (previous.length && previous.some((a) => a.dayKey !== start.dayKey)) penalty += weight * 2;
    }
  });

  return { lesson, start, durationSlots, teacher, room, penalty, tentative };
}

function solve(data, seed) {
  const random = rng(seed);
  const slots = buildSlots(data);
  const byWeekDay = {};
  slots.forEach((slot) => {
    const key = `${slot.week}:${slot.dayKey}`;
    if (!byWeekDay[key]) byWeekDay[key] = [];
    byWeekDay[key].push(slot);
  });
  Object.values(byWeekDay).forEach((row) => row.sort((a, b) => a.periodIndex - b.periodIndex));

  const lessons = expandLessons(data);
  lessons.sort((a, b) => {
    const score = (x) => (x.requirement.staffingMode === 'fixed' ? 8 : 0) + (x.duration === 2 ? 6 : 0) + (!['No specialist room', 'General classroom'].includes(x.requirement.roomType) ? 5 : 0) + (x.size > 25 ? 2 : 0) + random();
    return score(b) - score(a);
  });

  const state = {
    assignments: [], bySlot: new Map(), teacherBusy: new Set(), roomBusy: new Set(), teacherLoad: {},
    weekSlotCount: Object.fromEntries(getWeeks(data).map((week) => [week, slots.filter((s) => s.week === week).length])),
  };
  const unscheduled = [];

  lessons.forEach((lesson) => {
    const req = lesson.requirement;
    let teachers = req.staffingMode === 'fixed'
      ? (data.staff || []).filter((s) => s.id === req.teacherId)
      : (data.staff || []).filter((s) => subjectMatch(lesson.subject, s.subjects || []));
    if (!teachers.length) {
      unscheduled.push({ lesson, reason: req.staffingMode === 'fixed' ? 'Required teacher is missing.' : `No qualified teacher is available for ${lesson.subject || 'this subject'}.` });
      return;
    }
    teachers = [...teachers].sort((a, b) => ((state.teacherLoad[a.id] || 0) / Math.max(1, Number(a.maxPeriods || 40))) - ((state.teacherLoad[b.id] || 0) / Math.max(1, Number(b.maxPeriods || 40))));

    let rooms = (data.rooms || []).filter((room) => roomMatches(req, room, lesson.size));
    if (!rooms.length) {
      unscheduled.push({ lesson, reason: `No suitable ${req.roomType || 'room'} has enough capacity.` });
      return;
    }
    rooms = rooms.sort((a, b) => {
      const pa = req.roomType === 'No specialist room' && a.type !== 'General classroom' ? 1 : 0;
      const pb = req.roomType === 'No specialist room' && b.type !== 'General classroom' ? 1 : 0;
      return pa - pb || Number(a.capacity || 0) - Number(b.capacity || 0);
    });

    const starts = slots.filter((slot) => slot.week === lesson.week).sort(() => random() - .5);
    const candidates = [];
    for (const start of starts) {
      const durationSlots = consecutiveSlotsFor(start, byWeekDay, lesson.duration);
      if (!durationSlots) continue;
      for (const teacher of teachers.slice(0, 8)) {
        for (const room of rooms.slice(0, 12)) {
          const candidate = makeCandidate(lesson, start, durationSlots, teacher, room, state, data, random);
          if (candidate) candidates.push(candidate);
        }
      }
    }
    if (!candidates.length) {
      unscheduled.push({ lesson, reason: 'No valid period, teacher and room combination satisfies the current hard constraints.' });
      return;
    }
    candidates.sort((a, b) => a.penalty - b.penalty);
    const pickPool = candidates.slice(0, Math.min(3, candidates.length));
    const chosen = pickPool[Math.floor(random() * pickPool.length)];
    const assignment = {
      id: uid(), requirementId: lesson.requirementId, label: lesson.label, subject: lesson.subject,
      year: lesson.year, groupId: lesson.groupId, groupName: lesson.groupName, optionBlock: lesson.optionBlock,
      week: lesson.week, dayKey: chosen.start.dayKey, dayLabel: chosen.start.dayLabel,
      periodId: chosen.start.basePeriodId, periodName: chosen.durationSlots.map((s) => s.periodName).join(' + '),
      periodIndex: chosen.start.periodIndex, periodIndices: chosen.durationSlots.map((s) => s.periodIndex),
      slotIds: chosen.durationSlots.map((s) => s.id), duration: lesson.duration,
      teacherId: chosen.teacher.id, teacherName: chosen.teacher.name, teacherInitials: chosen.teacher.initials,
      roomId: chosen.room.id, roomName: chosen.room.name || chosen.room.code, roomCode: chosen.room.code,
      penalty: chosen.penalty,
    };
    state.assignments.push(assignment);
    state.teacherLoad[chosen.teacher.id] = (state.teacherLoad[chosen.teacher.id] || 0) + lesson.duration;
    chosen.durationSlots.forEach((slot) => {
      state.teacherBusy.add(`${slot.id}:${chosen.teacher.id}`);
      state.roomBusy.add(`${slot.id}:${chosen.room.id}`);
      const existing = state.bySlot.get(slot.id) || [];
      existing.push(assignment);
      state.bySlot.set(slot.id, existing);
    });
  });

  const requiredPeriods = lessons.reduce((n, lesson) => n + lesson.duration, 0);
  const scheduledPeriods = state.assignments.reduce((n, a) => n + a.duration, 0);
  const softPenalty = state.assignments.reduce((n, a) => n + Math.max(0, a.penalty), 0);
  const completion = requiredPeriods ? Math.round((scheduledPeriods / requiredPeriods) * 1000) / 10 : 0;
  const quality = Math.max(0, Math.round(100 - (unscheduled.length * 7) - (softPenalty / Math.max(1, scheduledPeriods)) * 2));
  return { id: uid(), name: `Option ${seed}`, createdAt: new Date().toISOString(), seed, assignments: state.assignments, unscheduled, requiredPeriods, scheduledPeriods, completion, quality, softPenalty: Math.round(softPenalty) };
}

function generateOptions(data, count = 3) {
  const options = [];
  const base = Date.now() % 100000;
  for (let i = 0; i < count; i += 1) {
    let best = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = solve(data, base + i * 97 + attempt * 19 + 1);
      if (!best || result.scheduledPeriods > best.scheduledPeriods || (result.scheduledPeriods === best.scheduledPeriods && result.softPenalty < best.softPenalty)) best = result;
      if (result.completion === 100 && result.softPenalty === 0) break;
    }
    best.name = `Option ${i + 1}`;
    options.push(best);
  }
  return options.sort((a, b) => b.scheduledPeriods - a.scheduledPeriods || a.softPenalty - b.softPenalty);
}

export default function GeneratorManager({ data, setData, onBack }) {
  const [optionCount, setOptionCount] = useState(3);
  const [selectedId, setSelectedId] = useState(data.activeTimetableId || data.generatedTimetables?.[0]?.id || '');
  const [week, setWeek] = useState('A');
  const [search, setSearch] = useState('');
  const options = data.generatedTimetables || [];
  const selected = options.find((x) => x.id === selectedId) || options[0];
  const slots = useMemo(() => buildSlots(data), [data.days, data.blocks, data.dayOverrides, data.school?.cycle]);
  const weeks = getWeeks(data);
  const lessonBlocks = (data.blocks || []).filter((b) => b.type === 'lesson');
  const enabledDays = (data.days || []).filter((d) => d.enabled);

  const readiness = useMemo(() => {
    const issues = [];
    if (!(data.curriculumRequirements || []).length) issues.push('Add curriculum requirements in Phase 4.');
    if (!(data.staff || []).length) issues.push('Add teaching staff in Phase 2.');
    if (!(data.rooms || []).length) issues.push('Add rooms in Phase 5.');
    (data.curriculumRequirements || []).forEach((r) => {
      if (!r.subject) issues.push('A curriculum requirement is missing its subject.');
      if (r.staffingMode === 'fixed' && !data.staff.some((s) => s.id === r.teacherId)) issues.push(`${r.name || r.subject || 'A requirement'} has no valid fixed teacher.`);
      if (!['No specialist room', 'General classroom'].includes(r.roomType) && !data.rooms.some((room) => room.type === r.roomType)) issues.push(`No ${r.roomType} exists for ${r.name || r.subject}.`);
    });
    return [...new Set(issues)];
  }, [data]);

  function runGenerator() {
    if (readiness.length) return;
    const generated = generateOptions(data, Number(optionCount));
    setData((p) => ({ ...p, generatedTimetables: generated, activeTimetableId: generated[0]?.id || '' }));
    setSelectedId(generated[0]?.id || '');
    setWeek('A');
  }

  function activate(option) {
    setSelectedId(option.id);
    setData((p) => ({ ...p, activeTimetableId: option.id }));
  }

  const visibleAssignments = (selected?.assignments || []).filter((a) => a.week === week && `${a.label} ${a.subject} ${a.year} ${a.groupName} ${a.teacherName} ${a.teacherInitials} ${a.roomName}`.toLowerCase().includes(search.toLowerCase()));
  const cellAssignments = (dayKey, periodIndex) => visibleAssignments.filter((a) => a.dayKey === dayKey && a.periodIndices.includes(periodIndex));

  return <div className="generator-page">
    <div className="generator-topbar">
      <div><button className="text-button" onClick={onBack}>← Back to setup</button><span className="eyebrow">PHASE 7</span><h1>Generate whole-school timetable</h1><p>Build alternative timetables from the curriculum, staffing, rooms and constraints entered in Phases 1–6.</p></div>
      <div className="generator-actions"><label><span>Options</span><select value={optionCount} onChange={(e) => setOptionCount(Number(e.target.value))}><option value={1}>1</option><option value={3}>3</option><option value={5}>5</option></select></label><button className="primary large" onClick={runGenerator} disabled={readiness.length > 0}>Generate timetable</button></div>
    </div>

    <div className="summary-grid compact">
      <Metric label="Curriculum requirements" value={(data.curriculumRequirements || []).length} note="input allocations" />
      <Metric label="Teachers" value={(data.staff || []).length} note="available to solver" />
      <Metric label="Rooms" value={(data.rooms || []).length} note="available spaces" />
      <Metric label="Active constraints" value={(data.constraints || []).filter((c) => c.enabled !== false).length} note="custom rules" />
    </div>

    {readiness.length > 0 && <div className="validation-panel warning generator-readiness"><div><span className="eyebrow">PRE-FLIGHT CHECK</span><h2>{readiness.length} item{readiness.length === 1 ? '' : 's'} before generation</h2><p>The generator is disabled until the minimum scheduling data is present.</p></div><ul>{readiness.map((x) => <li key={x}>{x}</li>)}</ul></div>}

    {!options.length ? <Section eyebrow="7A · READY TO SOLVE" title="Automatic scheduler" description="The solver places the most difficult lessons first, then balances teacher load and soft preferences while enforcing hard clashes and availability rules.">
      <div className="solver-explainer"><div><strong>1</strong><span>Expand curriculum into single and double lesson blocks.</span></div><div><strong>2</strong><span>Find qualified teachers and rooms with enough capacity.</span></div><div><strong>3</strong><span>Reject teacher, class, room and hard-constraint clashes.</span></div><div><strong>4</strong><span>Score valid placements against soft preferences and workload balance.</span></div><div><strong>5</strong><span>Return several alternatives and explain anything that remains unresolved.</span></div></div>
    </Section> : <>
      <Section eyebrow="7A · GENERATED OPTIONS" title="Alternative timetable solutions" description="Compare completion and unresolved lessons. Select any option to inspect it in the grid below.">
        <div className="option-grid">{options.map((option, index) => <button key={option.id} onClick={() => activate(option)} className={`timetable-option ${selected?.id === option.id ? 'selected' : ''}`}><div className="option-rank">{index + 1}</div><div><strong>{option.name}</strong><span>{option.scheduledPeriods} / {option.requiredPeriods} periods placed</span></div><div className="option-stats"><b>{option.completion}%</b><small>{option.unscheduled.length} unresolved</small></div></button>)}</div>
      </Section>

      {selected && <>
        <div className="summary-grid compact">
          <Metric label="Completion" value={`${selected.completion}%`} note={`${selected.scheduledPeriods}/${selected.requiredPeriods} periods`} className={selected.completion === 100 ? 'good-text' : 'warn-text'} />
          <Metric label="Placed lesson blocks" value={selected.assignments.length} note="including doubles" />
          <Metric label="Unresolved blocks" value={selected.unscheduled.length} note="need attention" className={selected.unscheduled.length ? 'warn-text' : 'good-text'} />
          <Metric label="Preference penalty" value={selected.softPenalty} note="lower is better within this run" />
        </div>

        <Section eyebrow="7B · TIMETABLE PREVIEW" title={`${selected.name} · Week ${week}`} description="Whole-school view. Search to focus on a class, teacher, subject or room." actions={<div className="generator-view-actions">{weeks.map((w) => <button className={`secondary small ${week === w ? 'active-choice' : ''}`} key={w} onClick={() => setWeek(w)}>Week {w}</button>)}<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter teacher, group, room…" /></div>}>
          <div className="generated-grid-wrap"><table className="generated-grid"><thead><tr><th>Period</th>{enabledDays.map((day) => <th key={day.key}>{day.label}</th>)}</tr></thead><tbody>{lessonBlocks.map((block, periodIndex) => <tr key={block.id}><th><strong>{block.name}</strong><span>{block.start}–{block.end}</span></th>{enabledDays.map((day) => <td key={day.key}><div className="generated-cell">{cellAssignments(day.key, periodIndex).map((a) => <div className={`generated-lesson ${a.duration === 2 ? 'double' : ''}`} key={`${a.id}-${periodIndex}`}><strong>{a.groupName || a.year} · {a.subject}</strong><span>{a.teacherInitials || a.teacherName} · {a.roomCode || a.roomName}</span>{a.duration === 2 && a.periodIndex === periodIndex && <small>Double period</small>}</div>)}</div></td>)}</tr>)}</tbody></table></div>
        </Section>

        <Section eyebrow="7C · SOLVER REPORT" title="Unresolved lessons and diagnostics" description="Anything the heuristic could not place is shown explicitly with the immediate reason.">
          {!selected.unscheduled.length ? <div className="success-banner"><strong>All required periods were placed.</strong><span>You can now move into the timetable review and editing phase.</span></div> : <div className="unscheduled-list">{selected.unscheduled.map((item, index) => <div className="unscheduled-item" key={`${item.lesson.id}-${index}`}><div><strong>{item.lesson.groupName || item.lesson.year} · {item.lesson.subject}</strong><span>Week {item.lesson.week} · {item.lesson.duration === 2 ? 'Double period' : 'Single period'}</span></div><p>{item.reason}</p></div>)}</div>}
        </Section>
      </>}
    </>}
  </div>;
}
