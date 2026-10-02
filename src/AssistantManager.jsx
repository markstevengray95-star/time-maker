import React, { useMemo, useState } from 'react';

const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const norm = (value) => String(value || '').trim().toLowerCase();

function Section({ eyebrow, title, description, actions, children }) {
  return <section className="panel"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="section-actions">{actions}</div>}</div>{children}</section>;
}
function Metric({ label, value, note, className = '' }) {
  return <div className="metric-card"><span>{label}</span><strong className={className}>{value}</strong><small>{note}</small></div>;
}

function lessonBlocks(data) {
  return (data.blocks || []).filter((block) => block.type === 'lesson');
}

function findDay(text, data) {
  const lower = norm(text);
  return (data.days || []).find((day) => {
    const label = norm(day.label);
    return lower.includes(label) || lower.includes(label.slice(0, 3));
  });
}

function findPeriods(text, data) {
  const lower = norm(text);
  const blocks = lessonBlocks(data);
  const found = [];
  const re = /\b(?:p|period)\s*(\d+)\b/gi;
  let match;
  while ((match = re.exec(text))) {
    const number = Number(match[1]);
    const block = blocks.find((item, index) => index + 1 === number || norm(item.name).includes(`period ${number}`));
    if (block) found.push(block);
  }
  blocks.forEach((block) => {
    if (lower.includes(norm(block.name)) && !found.some((item) => item.id === block.id)) found.push(block);
  });
  if (lower.includes('afternoon')) {
    const lunch = (data.blocks || []).find((block) => block.type === 'break' && norm(block.name).includes('lunch'));
    const threshold = lunch?.end || '13:00';
    blocks.filter((block) => block.start >= threshold).forEach((block) => { if (!found.some((item) => item.id === block.id)) found.push(block); });
  }
  if (lower.includes('morning')) {
    const lunch = (data.blocks || []).find((block) => block.type === 'break' && norm(block.name).includes('lunch'));
    const threshold = lunch?.start || '12:00';
    blocks.filter((block) => block.start < threshold).forEach((block) => { if (!found.some((item) => item.id === block.id)) found.push(block); });
  }
  return found;
}

function resolveStaff(text, data) {
  const lower = norm(text);
  const matches = (data.staff || []).filter((staff) => {
    const initials = norm(staff.initials);
    const name = norm(staff.name);
    const last = name.split(' ').filter(Boolean).at(-1) || '';
    return (initials && new RegExp(`\\b${initials.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) || (name && lower.includes(name)) || (last.length > 3 && lower.includes(last));
  });
  return matches;
}

function subjectNames(data) {
  const values = new Set();
  (data.curriculumRequirements || []).forEach((item) => item.subject && values.add(item.subject));
  (data.classes || []).forEach((item) => item.subject && values.add(item.subject));
  (data.staff || []).forEach((item) => (item.subjects || []).forEach((subject) => values.add(subject)));
  return [...values].sort((a, b) => b.length - a.length);
}

function findSubject(text, data) {
  const lower = norm(text);
  return subjectNames(data).find((subject) => lower.includes(norm(subject))) || '';
}

function findYear(text, data) {
  const lower = norm(text);
  const years = (data.keyStages || []).flatMap((stage) => stage.years || []).sort((a, b) => b.length - a.length);
  return years.find((year) => lower.includes(norm(year))) || '';
}

function findGroup(text, data) {
  const lower = norm(text);
  return (data.classes || []).filter((group) => group.name && lower.includes(norm(group.name))).sort((a, b) => b.name.length - a.name.length)[0] || null;
}

function findRoom(text, data) {
  const lower = norm(text);
  return (data.rooms || []).filter((room) => [room.name, room.code].filter(Boolean).some((name) => lower.includes(norm(name)))).sort((a, b) => Math.max((b.name || '').length, (b.code || '').length) - Math.max((a.name || '').length, (a.code || '').length))[0] || null;
}

function findNumber(text) {
  const match = String(text).match(/\b(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function activeOption(data) {
  const options = data.generatedTimetables || [];
  return options.find((option) => option.id === data.activeTimetableId) || options[0] || null;
}

function assignmentMatchesText(assignment, text, data) {
  const lower = norm(text);
  const group = findGroup(text, data);
  const subject = findSubject(text, data);
  const year = findYear(text, data);
  const staffMatches = resolveStaff(text, data);
  if (group && assignment.groupId !== group.id) return false;
  if (subject && norm(assignment.subject) !== norm(subject)) return false;
  if (year && norm(assignment.year) !== norm(year)) return false;
  if (staffMatches.length === 1 && assignment.teacherId !== staffMatches[0].id) return false;
  return Boolean(group || subject || year || staffMatches.length === 1) && lower.length > 0;
}

function buildSlots(data) {
  const weeks = data.school?.cycle === 'two-week' ? ['A', 'B'] : ['A'];
  const days = (data.days || []).filter((day) => day.enabled);
  const base = lessonBlocks(data);
  const slots = [];
  weeks.forEach((week) => days.forEach((day, dayIndex) => {
    const blocks = (data.dayOverrides?.[day.key] || data.blocks || []).filter((block) => block.type === 'lesson');
    blocks.forEach((block, periodIndex) => slots.push({ id: `${week}:${day.key}:${block.id}`, week, dayKey: day.key, dayLabel: day.label, dayIndex, periodId: block.id, basePeriodId: base[periodIndex]?.id || block.id, periodName: block.name, periodIndex }));
  }));
  return slots;
}

function roomUnavailable(room, slot) {
  return (room?.unavailableSlots || []).some((item) => {
    if (typeof item === 'string') return [slot.id, `${slot.dayKey}:${slot.periodId}`, `${slot.dayKey}:${slot.basePeriodId}`, `${slot.dayKey}|${slot.periodId}`, `${slot.dayKey}-${slot.periodId}`].includes(item);
    return item && item.day === slot.dayKey && [slot.periodId, slot.basePeriodId, 'all'].includes(item.periodId);
  });
}

function constraintApplies(constraint, assignment) {
  if (constraint.enabled === false) return false;
  if (constraint.scope === 'global') return true;
  if (constraint.scope === 'staff') return constraint.targetId === assignment.teacherId;
  if (constraint.scope === 'class') return constraint.targetId === assignment.groupId;
  if (constraint.scope === 'year') return constraint.targetId === assignment.year;
  if (constraint.scope === 'subject') return norm(constraint.targetId) === norm(assignment.subject);
  if (constraint.scope === 'room') return constraint.targetId === assignment.roomId;
  return false;
}

function validateMove(assignment, destination, data, option) {
  const assignments = option?.assignments || [];
  const slots = buildSlots(data);
  const daySlots = slots.filter((slot) => slot.week === assignment.week && slot.dayKey === destination.dayKey).sort((a, b) => a.periodIndex - b.periodIndex);
  const startIndex = daySlots.findIndex((slot) => slot.periodIndex === destination.periodIndex);
  const duration = Math.max(1, Number(assignment.duration || 1));
  const targetSlots = startIndex >= 0 ? daySlots.slice(startIndex, startIndex + duration) : [];
  const reasons = [];
  if (targetSlots.length !== duration || targetSlots.some((slot, index) => index > 0 && slot.periodIndex !== targetSlots[index - 1].periodIndex + 1)) reasons.push('The lesson would not fit into consecutive teaching periods.');
  const teacher = (data.staff || []).find((item) => item.id === assignment.teacherId);
  const room = (data.rooms || []).find((item) => item.id === assignment.roomId);
  const group = (data.classes || []).find((item) => item.id === assignment.groupId);
  const requirement = (data.curriculumRequirements || []).find((item) => item.id === assignment.requirementId);
  if (teacher?.availability?.[destination.dayKey] === false) reasons.push(`${teacher.initials || teacher.name} is unavailable on ${destination.dayLabel}.`);
  if (room && targetSlots.some((slot) => roomUnavailable(room, slot))) reasons.push(`${room.code || room.name} is unavailable in the target period.`);
  if (room && group && Number(room.capacity || 0) < Number(group.size || 0)) reasons.push(`${room.code || room.name} is too small for ${group.name}.`);
  if (room && requirement?.roomType && !['No specialist room', 'General classroom'].includes(requirement.roomType) && room.type !== requirement.roomType) reasons.push(`${room.code || room.name} does not meet the ${requirement.roomType} requirement.`);
  const targetIndices = targetSlots.map((slot) => slot.periodIndex);
  assignments.filter((item) => item.id !== assignment.id && item.week === assignment.week && item.dayKey === destination.dayKey && (item.periodIndices || [item.periodIndex]).some((index) => targetIndices.includes(index))).forEach((other) => {
    if (other.teacherId === assignment.teacherId) reasons.push(`${assignment.teacherInitials || assignment.teacherName} already teaches at that time.`);
    if (other.roomId === assignment.roomId) reasons.push(`${assignment.roomCode || assignment.roomName} is already occupied.`);
    if (assignment.groupId && other.groupId === assignment.groupId) reasons.push(`${assignment.groupName} already has another lesson.`);
    if (!assignment.groupId && !other.groupId && assignment.year && other.year === assignment.year) reasons.push(`${assignment.year} already has another whole-year lesson.`);
  });
  (data.constraints || []).filter((constraint) => constraint.enabled !== false && constraint.severity === 'hard' && constraintApplies(constraint, assignment)).forEach((constraint) => {
    const dayMatches = !constraint.day || constraint.day === destination.dayKey;
    const periodMatches = constraint.periodId === 'all' || targetSlots.some((slot) => [slot.periodId, slot.basePeriodId].includes(constraint.periodId));
    if (constraint.ruleType === 'unavailable' && dayMatches && periodMatches) reasons.push(`${constraint.name || 'A hard constraint'} blocks the target time.`);
    if (constraint.ruleType === 'fixed-period' && (!dayMatches || !periodMatches)) reasons.push(`${constraint.name || 'A fixed-period rule'} requires another time.`);
  });
  return { valid: reasons.length === 0, reasons: [...new Set(reasons)], targetSlots };
}

function makeConstraint({ name, severity = 'hard', weight = 8, scope, targetId, ruleType, day = '', periodId = '', value = 1, roomId = '', notes = '' }) {
  return { id: uid(), name, enabled: true, severity, weight, scope, targetId, ruleType, day, periodId, value, roomId, notes, generatedFrom: 'assistant' };
}

function targetScopes(text, data) {
  const group = findGroup(text, data);
  const subject = findSubject(text, data);
  const year = findYear(text, data);
  if (group) return [{ scope: 'class', targetId: group.id, label: group.name }];
  if (year && subject) {
    const groups = (data.curriculumRequirements || []).filter((item) => norm(item.year) === norm(year) && norm(item.subject) === norm(subject) && item.targetGroupId).map((item) => (data.classes || []).find((groupItem) => groupItem.id === item.targetGroupId)).filter(Boolean);
    const unique = [...new Map(groups.map((item) => [item.id, item])).values()];
    if (unique.length) return unique.map((item) => ({ scope: 'class', targetId: item.id, label: `${item.name} (${subject})` }));
  }
  if (subject) return [{ scope: 'subject', targetId: subject, label: subject }];
  if (year) return [{ scope: 'year', targetId: year, label: year }];
  return [];
}

function parseInstruction(input, data) {
  const text = String(input || '').trim();
  const lower = norm(text);
  const actions = [];
  const errors = [];
  const notes = [];
  if (!text) return { input: text, actions, errors: ['Enter an instruction first.'], notes };

  const option = activeOption(data);
  const day = findDay(text, data);
  const periods = findPeriods(text, data);
  const staff = resolveStaff(text, data);
  const subject = findSubject(text, data);
  const year = findYear(text, data);
  const group = findGroup(text, data);

  if (/\b(lock|unlock)\b/i.test(text)) {
    if (!option) errors.push('There is no active generated timetable to edit.');
    else {
      let matches = (option.assignments || []).filter((assignment) => assignmentMatchesText(assignment, text, data));
      const sourceDay = day;
      if (sourceDay) matches = matches.filter((assignment) => assignment.dayKey === sourceDay.key);
      if (periods.length === 1) matches = matches.filter((assignment) => assignment.periodId === periods[0].id || assignment.periodIndices?.includes(lessonBlocks(data).findIndex((block) => block.id === periods[0].id)));
      if (!matches.length) errors.push('I could not find a matching lesson to lock or unlock.');
      else actions.push({ kind: 'edit-lock', lock: /\block\b/i.test(text) && !/\bunlock\b/i.test(text), assignmentIds: matches.map((item) => item.id), label: `${/\bunlock\b/i.test(text) ? 'Unlock' : 'Lock'} ${matches.length} matching lesson${matches.length === 1 ? '' : 's'}` });
    }
    return { input: text, actions, errors, notes };
  }

  if (/\b(move|put)\b/i.test(text) && /\bto\b/i.test(text)) {
    if (!option) errors.push('There is no active generated timetable to move a lesson in.');
    const parts = text.split(/\bto\b/i);
    const sourceText = parts[0];
    const destinationText = parts.slice(1).join(' to ');
    const destDay = findDay(destinationText, data);
    const destPeriods = findPeriods(destinationText, data);
    if (!destDay) errors.push('I could not identify the destination day.');
    if (destPeriods.length !== 1) errors.push('Give one destination period, for example “Tuesday P3”.');
    if (option) {
      let matches = (option.assignments || []).filter((assignment) => assignmentMatchesText(assignment, sourceText, data));
      const sourceDay = findDay(sourceText, data);
      const sourcePeriods = findPeriods(sourceText, data);
      if (sourceDay) matches = matches.filter((assignment) => assignment.dayKey === sourceDay.key);
      if (sourcePeriods.length === 1) matches = matches.filter((assignment) => assignment.periodId === sourcePeriods[0].id || assignment.periodIndices?.includes(lessonBlocks(data).findIndex((block) => block.id === sourcePeriods[0].id)));
      if (!matches.length) errors.push('I could not find a matching lesson in the active timetable.');
      else if (matches.length > 1) errors.push(`I found ${matches.length} matching lessons. Add the current day and period so I know which one to move.`);
      else if (destDay && destPeriods.length === 1) {
        const destination = buildSlots(data).find((slot) => slot.week === matches[0].week && slot.dayKey === destDay.key && [slot.periodId, slot.basePeriodId].includes(destPeriods[0].id));
        if (!destination) errors.push('That destination period does not exist in the timetable structure.');
        else {
          const check = validateMove(matches[0], destination, data, option);
          if (!check.valid) errors.push(...check.reasons.map((reason) => `Move blocked: ${reason}`));
          else actions.push({ kind: 'edit-move', optionId: option.id, assignmentId: matches[0].id, destination, targetSlots: check.targetSlots, label: `Move ${matches[0].groupName || matches[0].year} ${matches[0].subject} to ${destination.dayLabel} ${destination.periodName}` });
        }
      }
    }
    return { input: text, actions, errors: [...new Set(errors)], notes };
  }

  if (/\bfree\b/i.test(text) && staff.length) {
    if (staff.length > 1) errors.push('More than one staff member matches that instruction. Use their initials or full name.');
    if (!day) errors.push('I could not identify the day.');
    if (!periods.length) errors.push('I could not identify the period or periods to keep free.');
    if (staff.length === 1 && day && periods.length) {
      periods.forEach((period) => actions.push({ kind: 'constraint', constraint: makeConstraint({ name: `${staff[0].initials || staff[0].name} free ${day.label} ${period.name}`, severity: 'hard', scope: 'staff', targetId: staff[0].id, ruleType: 'unavailable', day: day.key, periodId: period.id, notes: `Created from assistant instruction: ${text}` }), label: `Keep ${staff[0].initials || staff[0].name} free ${day.label} ${period.name}` }));
    }
    return { input: text, actions, errors, notes };
  }

  if (/\b(consecutive)\b/i.test(text) && staff.length) {
    const value = findNumber(text);
    if (staff.length > 1) errors.push('More than one staff member matches. Use initials or a full name.');
    if (value === null) errors.push('I could not find the maximum number of consecutive lessons.');
    if (staff.length === 1 && value !== null) actions.push({ kind: 'constraint', constraint: makeConstraint({ name: `${staff[0].initials || staff[0].name} max ${value} consecutive`, severity: 'hard', scope: 'staff', targetId: staff[0].id, ruleType: 'max-consecutive', value, notes: `Created from assistant instruction: ${text}` }), label: `Limit ${staff[0].initials || staff[0].name} to ${value} consecutive lessons` });
    return { input: text, actions, errors, notes };
  }

  if (/\b(limit|max(?:imum)?)\b/i.test(text) && /\b(day|daily)\b/i.test(text) && staff.length) {
    const value = findNumber(text);
    if (staff.length > 1) errors.push('More than one staff member matches. Use initials or a full name.');
    if (value === null) errors.push('I could not find the daily lesson limit.');
    if (staff.length === 1 && value !== null) actions.push({ kind: 'constraint', constraint: makeConstraint({ name: `${staff[0].initials || staff[0].name} max ${value} per day`, severity: 'hard', scope: 'staff', targetId: staff[0].id, ruleType: 'max-daily', value, notes: `Created from assistant instruction: ${text}` }), label: `Limit ${staff[0].initials || staff[0].name} to ${value} lessons per day` });
    return { input: text, actions, errors, notes };
  }

  if (/\b(prefer|preferred)\b/i.test(text)) {
    const room = findRoom(text, data);
    const scopes = targetScopes(text, data);
    if (room && scopes.length) {
      scopes.forEach((target) => actions.push({ kind: 'constraint', constraint: makeConstraint({ name: `${target.label} prefer ${room.code || room.name}`, severity: 'soft', weight: 7, scope: target.scope, targetId: target.targetId, ruleType: 'preferred-room', roomId: room.id, notes: `Created from assistant instruction: ${text}` }), label: `Prefer ${room.code || room.name} for ${target.label}` }));
      return { input: text, actions, errors, notes };
    }
    if (day && periods.length && scopes.length) {
      scopes.forEach((target) => periods.forEach((period) => actions.push({ kind: 'constraint', constraint: makeConstraint({ name: `${target.label} prefer ${day.label} ${period.name}`, severity: 'soft', weight: 7, scope: target.scope, targetId: target.targetId, ruleType: 'prefer-period', day: day.key, periodId: period.id, notes: `Created from assistant instruction: ${text}` }), label: `Prefer ${day.label} ${period.name} for ${target.label}` })));
      return { input: text, actions, errors, notes };
    }
  }

  if (/\b(spread|different days)\b/i.test(text)) {
    const scopes = targetScopes(text, data);
    if (!scopes.length) errors.push('I could not identify which class, year or subject should be spread out.');
    scopes.forEach((target) => actions.push({ kind: 'constraint', constraint: makeConstraint({ name: `${target.label} spread across days`, severity: 'soft', weight: 8, scope: target.scope, targetId: target.targetId, ruleType: 'different-days', notes: `Created from assistant instruction: ${text}` }), label: `Spread ${target.label} across different days` }));
    return { input: text, actions, errors, notes };
  }

  if (/\b(avoid|never|must not|mustn't|do not|don't|out of)\b/i.test(text)) {
    const scopes = targetScopes(text, data);
    const hard = /\b(never|must not|mustn't|do not|don't|out of)\b/i.test(text);
    if (!scopes.length) errors.push('I could not identify which class, year or subject the restriction applies to.');
    if (!day) errors.push('I could not identify the day to avoid.');
    const periodList = periods.length ? periods : [{ id: 'all', name: 'all periods' }];
    if (scopes.length && day) scopes.forEach((target) => periodList.forEach((period) => actions.push({ kind: 'constraint', constraint: makeConstraint({ name: `${target.label} ${hard ? 'blocked' : 'avoid'} ${day.label} ${period.name}`, severity: hard ? 'hard' : 'soft', weight: hard ? 10 : 7, scope: target.scope, targetId: target.targetId, ruleType: hard ? 'unavailable' : 'avoid-period', day: day.key, periodId: period.id, notes: `Created from assistant instruction: ${text}` }), label: `${hard ? 'Block' : 'Avoid'} ${day.label} ${period.name} for ${target.label}` })));
    return { input: text, actions, errors, notes };
  }

  if (subject || year || group || staff.length) notes.push('I recognised part of the instruction, but not the requested action. Try one of the examples below.');
  else notes.push('I could not confidently interpret this instruction. Use a staff initial, class/year/subject, day and period where relevant.');
  return { input: text, actions, errors, notes };
}

function applyPlan(plan, data) {
  let next = { ...data };
  const constraints = [...(data.constraints || [])];
  const added = [];
  const duplicateKey = (c) => [c.scope, c.targetId, c.ruleType, c.day || '', c.periodId || '', c.value || '', c.roomId || '', c.severity].join('|');
  const existing = new Set(constraints.map(duplicateKey));
  plan.actions.filter((action) => action.kind === 'constraint').forEach((action) => {
    const key = duplicateKey(action.constraint);
    if (!existing.has(key)) {
      constraints.push(action.constraint);
      existing.add(key);
      added.push(action.label);
    }
  });
  next.constraints = constraints;

  const editActions = plan.actions.filter((action) => action.kind.startsWith('edit-'));
  if (editActions.length) {
    next.generatedTimetables = (next.generatedTimetables || []).map((option) => {
      const relevant = editActions.filter((action) => !action.optionId || action.optionId === option.id);
      if (!relevant.length && !editActions.some((action) => action.kind === 'edit-lock')) return option;
      let assignments = [...(option.assignments || [])];
      relevant.forEach((action) => {
        if (action.kind === 'edit-move') {
          assignments = assignments.map((assignment) => assignment.id === action.assignmentId ? {
            ...assignment,
            dayKey: action.destination.dayKey,
            dayLabel: action.destination.dayLabel,
            periodId: action.destination.basePeriodId,
            periodName: action.targetSlots.map((slot) => slot.periodName).join(' + '),
            periodIndex: action.destination.periodIndex,
            periodIndices: action.targetSlots.map((slot) => slot.periodIndex),
            slotIds: action.targetSlots.map((slot) => slot.id),
            manuallyEdited: true,
          } : assignment);
        }
        if (action.kind === 'edit-lock') {
          assignments = assignments.map((assignment) => action.assignmentIds.includes(assignment.id) ? { ...assignment, locked: action.lock } : assignment);
        }
      });
      return { ...option, assignments, lastEditedAt: new Date().toISOString() };
    });
  }

  next.assistantHistory = [{ id: uid(), input: plan.input, appliedAt: new Date().toISOString(), actions: plan.actions.map((action) => action.label) }, ...(next.assistantHistory || [])].slice(0, 30);
  if (added.length) next.needsRegeneration = true;
  return { next, added };
}

export default function AssistantManager({ data, setData, onBack }) {
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState(null);
  const [message, setMessage] = useState(null);
  const option = activeOption(data);
  const examples = [
    'Keep MG free Wednesday P5 and P6',
    'Move Year 10 Physics out of Friday afternoon',
    'Prefer Science in Lab 1',
    'Limit AP to 4 lessons per day',
    'Spread Year 8 Science across different days',
    'Lock 12P Physics Monday P1',
    'Move 12P Physics Monday P1 to Tuesday P3',
  ];

  const stats = useMemo(() => ({
    rules: (data.constraints || []).length,
    generated: (data.generatedTimetables || []).length,
    history: (data.assistantHistory || []).length,
    locked: (option?.assignments || []).filter((assignment) => assignment.locked).length,
  }), [data, option]);

  function interpret(value = input) {
    const result = parseInstruction(value, data);
    setPlan(result);
    setMessage(null);
  }

  function apply() {
    if (!plan || plan.errors.length || !plan.actions.length) return;
    const result = applyPlan(plan, data);
    setData(result.next);
    setMessage({ type: 'success', text: `${plan.actions.length} action${plan.actions.length === 1 ? '' : 's'} applied.${result.added.length ? ' Regenerate the timetable in Phase 7 to fully optimise the new rule changes.' : ''}` });
    setInput('');
    setPlan(null);
  }

  return <div className="assistant-page">
    <div className="assistant-topbar">
      <div><button className="text-button" onClick={onBack}>← Back to app</button><span className="eyebrow">PHASE 10</span><h1>AI timetable assistant</h1><p>Describe timetable changes in normal language. The assistant converts supported requests into transparent constraints or safe edits for the active timetable.</p></div>
      <div className="assistant-status"><span>LOCAL INTERPRETER</span><strong>No AI key required</strong><small>Every action is previewed before it changes school data.</small></div>
    </div>

    <div className="summary-grid compact">
      <Metric label="Current rules" value={stats.rules} note="hard and soft constraints" />
      <Metric label="Timetable options" value={stats.generated} note="available for direct edits" />
      <Metric label="Locked lessons" value={stats.locked} note="in active timetable" />
      <Metric label="Assistant history" value={stats.history} note="recent applied requests" />
    </div>

    <Section eyebrow="10A · INSTRUCTION" title="Tell Time Maker what you want" description="Use staff initials, class names, year groups, subjects, days and period names naturally. Nothing is applied until you confirm the preview.">
      <div className="assistant-compose">
        <textarea rows="4" value={input} onChange={(event) => setInput(event.target.value)} placeholder="e.g. Keep MG free Wednesday P5 and P6" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') interpret(); }} />
        <div className="assistant-compose-actions"><span>Ctrl/⌘ + Enter to interpret</span><button className="primary large" onClick={() => interpret()} disabled={!input.trim()}>Interpret request</button></div>
      </div>
      <div className="assistant-examples">{examples.map((example) => <button key={example} onClick={() => { setInput(example); interpret(example); }}>{example}</button>)}</div>
    </Section>

    {plan && <Section eyebrow="10B · PREVIEW" title="What I understood" description="Check the structured changes before applying them.">
      <div className="assistant-original"><span>Your instruction</span><strong>{plan.input}</strong></div>
      {plan.errors.length > 0 && <div className="assistant-errors"><strong>Needs clarification</strong>{plan.errors.map((error) => <p key={error}>{error}</p>)}</div>}
      {plan.notes.length > 0 && <div className="assistant-notes">{plan.notes.map((note) => <p key={note}>{note}</p>)}</div>}
      {plan.actions.length > 0 && <div className="assistant-actions-list">{plan.actions.map((action, index) => <div key={`${action.label}-${index}`} className={`assistant-action ${action.kind}`}><span>{action.kind === 'constraint' ? 'RULE' : 'EDIT'}</span><strong>{action.label}</strong>{action.kind === 'constraint' && <small>{action.constraint.severity === 'hard' ? 'Hard constraint' : `Soft preference · weight ${action.constraint.weight}`}</small>}</div>)}</div>}
      <div className="assistant-preview-footer"><button className="secondary" onClick={() => setPlan(null)}>Cancel</button><button className="primary" disabled={plan.errors.length > 0 || plan.actions.length === 0} onClick={apply}>Apply {plan.actions.length || ''} change{plan.actions.length === 1 ? '' : 's'}</button></div>
    </Section>}

    {message && <div className={`assistant-message ${message.type}`}><strong>{message.text}</strong></div>}

    <Section eyebrow="10C · SUPPORTED LANGUAGE" title="What the assistant can currently do" description="This first version uses a deterministic language interpreter, so its decisions are auditable and it does not require a third-party model connection.">
      <div className="assistant-capability-grid">
        <div><strong>Protect staff time</strong><p>“Keep MG free Wednesday P5 and P6.”</p></div>
        <div><strong>Avoid bad lesson times</strong><p>“Move Year 10 Physics out of Friday afternoon.”</p></div>
        <div><strong>Set workload limits</strong><p>“Limit AP to 4 lessons per day.”</p></div>
        <div><strong>Room preferences</strong><p>“Prefer Science in Lab 1.”</p></div>
        <div><strong>Lesson distribution</strong><p>“Spread Year 8 Science across different days.”</p></div>
        <div><strong>Direct timetable edits</strong><p>Lock lessons or move a precisely identified lesson to another valid period.</p></div>
      </div>
    </Section>

    <Section eyebrow="10D · RECENT REQUESTS" title="Assistant change history" description="A short audit trail of natural-language requests that were applied.">
      {(data.assistantHistory || []).length === 0 ? <p className="hint">No assistant changes have been applied yet.</p> : <div className="assistant-history">{(data.assistantHistory || []).map((item) => <div key={item.id}><div><strong>{item.input}</strong><span>{new Date(item.appliedAt).toLocaleString()}</span></div><small>{(item.actions || []).join(' · ')}</small></div>)}</div>}
    </Section>
  </div>;
}
