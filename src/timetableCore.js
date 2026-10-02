export const KEY = 'time-maker-v3';
export const uid = () => globalThis.crypto.randomUUID();
export const norm = value => String(value || '').trim().toLowerCase();
export const weeks = data => data.school?.cycle === 'two-week' ? ['A', 'B'] : ['A'];
export const activeTimetable = data => (data.generatedTimetables || []).find(t => t.id === data.activeTimetableId) || data.generatedTimetables?.[0];
export const periods = lesson => lesson.slotIds?.length || Number(lesson.duration || 1);
export function slots(data) {
  const base = (data.blocks || []).filter(b => b.type === 'lesson');
  return weeks(data).flatMap(week => (data.days || []).filter(d => d.enabled).flatMap(day =>
    (data.dayOverrides?.[day.key] || data.blocks || []).filter(b => b.type === 'lesson').map((b, index) => ({
      ...b, id: `${week}:${day.key}:${b.id}`, periodId: b.id, basePeriodId: base[index]?.id || b.id,
      week, dayKey: day.key, dayLabel: day.label, periodIndex: index,
    }))));
}
export function lessonSlots(lesson, data) {
  const all = slots(data);
  if (lesson.slotIds?.length) return all.filter(s => lesson.slotIds.includes(s.id));
  return all.filter(s => s.week === (lesson.week || 'A') && s.dayKey === lesson.dayKey &&
    (lesson.periodIndices || [lesson.periodIndex]).includes(s.periodIndex));
}
export function qualified(subject, teacher) {
  const wanted = norm(subject), list = (teacher.subjects || []).map(norm);
  return list.includes(wanted) || (['science','physics','chemistry','biology'].includes(wanted) &&
    (list.includes('science') || wanted === 'science' && list.some(x => ['physics','chemistry','biology'].includes(x)))) ||
    (['maths','mathematics'].includes(wanted) && list.some(x => ['maths','mathematics'].includes(x)));
}
export function targets(c, a) {
  return c.scope === 'global' || ({staff:a.teacherId,class:a.groupId,year:a.year,room:a.roomId,subject:norm(a.subject)})[c.scope] === (c.scope === 'subject' ? norm(c.targetId) : c.targetId);
}
export function matchesPeriod(c, s) {
  return c.day === s.dayKey && [s.periodId,s.basePeriodId,'all'].includes(c.periodId);
}
export function roomClosed(room, s) {
  return (room?.unavailableSlots || []).some(x => typeof x === 'string' ?
    [s.id,`${s.dayKey}:${s.periodId}`,`${s.dayKey}:${s.basePeriodId}`,`${s.dayKey}|${s.basePeriodId}`,`${s.dayKey}-${s.basePeriodId}`].includes(x) :
    x?.day === s.dayKey && [s.periodId,s.basePeriodId,'all'].includes(x.periodId));
}
export function longestRun(indices) {
  let best = 0, run = 0, last = -2;
  [...new Set(indices)].sort((a,b) => a-b).forEach(i => { run = i === last + 1 ? run + 1 : 1; best = Math.max(best,run); last = i; });
  return best;
}
