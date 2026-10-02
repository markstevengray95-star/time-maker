import React, { useMemo, useState } from 'react';

function Metric({ label, value, note, className = '' }) {
  return <div className="metric-card"><span>{label}</span><strong className={className}>{value}</strong><small>{note}</small></div>;
}
function Section({ eyebrow, title, description, actions, children }) {
  return <section className="panel"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="section-actions">{actions}</div>}</div>{children}</section>;
}
const pct = (value) => `${Math.round(value)}%`;

function analyse(option, data) {
  if (!option) return null;
  const assignments = option.assignments || [];
  const teacherLoads = (data.staff || []).map((teacher) => {
    const periods = assignments.filter((a) => a.teacherId === teacher.id).reduce((n, a) => n + Number(a.duration || 1), 0);
    const max = Math.max(1, Number(teacher.maxPeriods || 1));
    return { ...teacher, periods, max, ratio: periods / max };
  }).filter((teacher) => teacher.periods > 0);
  const ratios = teacherLoads.map((teacher) => teacher.ratio);
  const range = ratios.length ? Math.max(...ratios) - Math.min(...ratios) : 0;
  const workloadBalance = Math.max(0, Math.min(100, 100 - range * 100));

  const requirementMap = new Map((data.curriculumRequirements || []).map((r) => [r.id, r]));
  const spreadCounter = new Map();
  assignments.forEach((a) => {
    const key = `${a.requirementId}|${a.week}|${a.dayKey}`;
    spreadCounter.set(key, (spreadCounter.get(key) || 0) + Number(a.duration || 1));
  });
  let spreadViolations = 0;
  spreadCounter.forEach((count, key) => {
    const requirement = requirementMap.get(key.split('|')[0]);
    const maxSameDay = Math.max(1, Number(requirement?.maxSameDay || 1));
    if (count > maxSameDay) spreadViolations += count - maxSameDay;
  });
  const lessonSpread = Math.max(0, 100 - spreadViolations * 12);

  const roomRows = (data.rooms || []).map((room) => {
    const sessions = assignments.filter((a) => a.roomId === room.id);
    const occupancyValues = sessions.map((a) => {
      const group = (data.classes || []).find((c) => c.id === a.groupId);
      return Number(room.capacity || 0) > 0 ? Math.min(1, Number(group?.size || 0) / Number(room.capacity)) : 0;
    });
    const occupancy = occupancyValues.length ? occupancyValues.reduce((n, x) => n + x, 0) / occupancyValues.length : 0;
    return { ...room, sessions: sessions.length, occupancy };
  }).filter((room) => room.sessions > 0);
  const usedOccupancy = roomRows.length ? roomRows.reduce((n, room) => n + room.occupancy, 0) / roomRows.length : 0;

  const preferencePenalty = Number(option.softPenalty || 0);
  const preferenceSatisfaction = Math.max(0, Math.min(100, 100 - (preferencePenalty / Math.max(1, Number(option.scheduledPeriods || assignments.length))) * 8));
  const completion = Number(option.completion ?? (option.requiredPeriods ? (option.scheduledPeriods / option.requiredPeriods) * 100 : 0));

  const issues = [];
  if ((option.unscheduled || []).length) issues.push(`${option.unscheduled.length} lesson block${option.unscheduled.length === 1 ? '' : 's'} could not be placed.`);
  teacherLoads.filter((teacher) => teacher.periods > teacher.max).forEach((teacher) => issues.push(`${teacher.initials || teacher.name} exceeds their maximum teaching load.`));
  if (range > .35) issues.push('Teacher utilisation varies substantially across the selected timetable.');
  if (spreadViolations) issues.push(`${spreadViolations} lesson-period spread issue${spreadViolations === 1 ? '' : 's'} exceed current max-per-day curriculum settings.`);
  if (preferencePenalty > Math.max(8, Number(option.scheduledPeriods || 0) * .4)) issues.push('A relatively high number of soft-preference penalties remain.');

  return { assignments, teacherLoads, roomRows, workloadBalance, lessonSpread, spreadViolations, usedOccupancy, preferenceSatisfaction, preferencePenalty, completion, issues };
}

export default function ReviewManager({ data, setData, onBack }) {
  const options = data.generatedTimetables || [];
  const [selectedId, setSelectedId] = useState(data.activeTimetableId || options[0]?.id || '');
  const selected = options.find((option) => option.id === selectedId) || options[0];
  const analysis = useMemo(() => analyse(selected, data), [selected, data]);

  function activate() {
    if (!selected) return;
    setData((prev) => ({ ...prev, activeTimetableId: selected.id }));
  }

  if (!options.length) {
    return <div className="review-page"><div className="review-topbar"><div><button className="text-button" onClick={onBack}>← Back to app</button><span className="eyebrow">PHASE 8</span><h1>Review & optimise</h1><p>Generate a timetable in Phase 7 before running the review.</p></div></div><div className="validation-panel warning"><div><span className="eyebrow">NO GENERATED TIMETABLE</span><h2>Nothing to analyse yet</h2><p>Return to the app and run Phase 7, or load the demo data to see Phase 8 immediately.</p></div></div></div>;
  }

  const active = data.activeTimetableId === selected?.id;
  return <div className="review-page">
    <div className="review-topbar"><div><button className="text-button" onClick={onBack}>← Back to app</button><span className="eyebrow">PHASE 8</span><h1>Timetable review & optimisation</h1><p>Compare generated options and inspect curriculum completion, staff load, lesson spread, room use and preference satisfaction.</p></div><button className="primary large" onClick={activate} disabled={active}>{active ? 'Active timetable' : 'Use this timetable'}</button></div>

    <Section eyebrow="8A · OPTIONS" title="Compare generated timetables" description="No single hidden score decides for you. The key measures are shown separately so the trade-offs are visible.">
      <div className="review-option-grid">{options.map((option) => {
        const summary = analyse(option, data);
        return <button key={option.id} className={`review-option ${selected?.id === option.id ? 'selected' : ''}`} onClick={() => setSelectedId(option.id)}><div><strong>{option.name}</strong><span>{option.scheduledPeriods}/{option.requiredPeriods} periods placed</span></div><div className="review-option-metrics"><span><b>{pct(summary?.completion || 0)}</b> completion</span><span><b>{pct(summary?.workloadBalance || 0)}</b> load balance</span><span><b>{option.unscheduled?.length || 0}</b> unresolved</span></div></button>;
      })}</div>
    </Section>

    {analysis && <>
      <div className="summary-grid compact">
        <Metric label="Curriculum completion" value={pct(analysis.completion)} note={`${selected.scheduledPeriods}/${selected.requiredPeriods} periods placed`} className={analysis.completion === 100 ? 'good-text' : 'warn-text'} />
        <Metric label="Workload balance" value={pct(analysis.workloadBalance)} note="based on spread of teacher load ratios" />
        <Metric label="Lesson distribution" value={pct(analysis.lessonSpread)} note={`${analysis.spreadViolations} max-per-day spread issues`} className={analysis.spreadViolations ? 'warn-text' : 'good-text'} />
        <Metric label="Preference satisfaction" value={pct(analysis.preferenceSatisfaction)} note={`${analysis.preferencePenalty} weighted penalty points`} />
      </div>

      <Section eyebrow="8B · REVIEW FINDINGS" title="Issues to inspect" description="These are diagnostic flags, not automatic reasons to reject a timetable.">
        {!analysis.issues.length ? <div className="success-banner"><strong>No major review flags found.</strong><span>The selected option has complete curriculum placement and no obvious load or spread warnings under the current rules.</span></div> : <div className="review-findings">{analysis.issues.map((issue) => <div key={issue}><span>!</span><p>{issue}</p></div>)}</div>}
      </Section>

      <Section eyebrow="8C · STAFF LOAD" title="Teacher workload balance" description="Teaching load is shown against each staff member's maximum teaching-period setting. The balance percentage uses the range between the highest and lowest utilisation ratios.">
        <div className="workload-review-grid">{analysis.teacherLoads.map((teacher) => <div className="workload-review-card" key={teacher.id}><div><strong>{teacher.initials || teacher.name}</strong><span>{teacher.name}</span></div><div className="review-bar"><span style={{ width: `${Math.min(100, teacher.ratio * 100)}%` }} /></div><small>{teacher.periods} / {teacher.max} periods · {pct(teacher.ratio * 100)} utilisation</small></div>)}</div>
      </Section>

      <Section eyebrow="8D · ROOMS" title="Room use and capacity fit" description="Occupancy is the average class size divided by room capacity for lessons placed in that room; it is shown as context rather than treated as a hard quality verdict.">
        <div className="room-review-grid">{analysis.roomRows.map((room) => <div className="room-review-card" key={room.id}><div><strong>{room.code || room.name}</strong><span>{room.type}</span></div><b>{room.sessions}</b><small>lesson blocks</small><div className="review-bar"><span style={{ width: `${Math.min(100, room.occupancy * 100)}%` }} /></div><small>{pct(room.occupancy * 100)} average seat use</small></div>)}</div>
        <p className="hint">Across used rooms, average seat utilisation is {pct(analysis.usedOccupancy * 100)}. Lower utilisation may still be appropriate for practical work, accessibility or specialist equipment.</p>
      </Section>

      <Section eyebrow="8E · OPTIMISATION GUIDE" title="What to improve next" description="Use these measures to decide what to adjust before manual editing in the next phase.">
        <div className="optimisation-grid">
          <div><strong>Unresolved lessons</strong><p>{selected.unscheduled?.length ? 'Return to Phase 6 or 7 and relax conflicting hard rules, add staff/rooms, or regenerate.' : 'All curriculum periods are currently placed.'}</p></div>
          <div><strong>Teacher balance</strong><p>{analysis.workloadBalance < 75 ? 'Try another generated option or add soft workload preferences for heavily used staff.' : 'Teacher utilisation is relatively even under the current maximum-load settings.'}</p></div>
          <div><strong>Lesson spread</strong><p>{analysis.spreadViolations ? 'Review repeated same-day lessons and adjust max-per-day or spread rules in Phase 4/6.' : 'Current allocations respect the entered max-per-day lesson patterns.'}</p></div>
          <div><strong>Preferences</strong><p>{analysis.preferencePenalty ? 'Compare alternatives with lower preference penalties where the hard-constraint completion is similar.' : 'No weighted soft-preference penalties are recorded for this option.'}</p></div>
        </div>
      </Section>
    </>}
  </div>;
}
