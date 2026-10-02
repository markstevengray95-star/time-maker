import { activeTimetable, slots, lessonSlots, weeks, periods, targets, matchesPeriod, longestRun } from './timetableCore.js';
export function staffWorkload(data, timetable=activeTimetable(data)) {
  const all=slots(data), lessons=timetable?.assignments || [];
  return (data.staff || []).map(t=>{
    const perWeek=weeks(data).map(week=>{
      const available=all.filter(s=>s.week===week && t.availability?.[s.dayKey]!==false &&
        !(data.constraints || []).some(c=>c.enabled!==false && c.severity==='hard' && c.ruleType==='unavailable' && targets(c,{teacherId:t.id}) && matchesPeriod(c,s)));
      const teaching=lessons.filter(a=>a.teacherId===t.id && a.week===week);
      const busy=new Set(teaching.flatMap(a=>lessonSlots(a,data).map(s=>s.id)));
      const free=available.filter(s=>!busy.has(s.id));
      const allocation=teaching.reduce((n,a)=>n+periods(a),0);
      const ppa=Number(t.ppaPeriods || 0), leadership=Number(t.leadershipPeriods || 0);
      const protectedSlots=(t.protectedSlots || []).filter(p=>available.some(s=>s.id===p.slotId));
      const protectedIds=new Set(protectedSlots.map(p=>p.slotId));
      const placedPpa=protectedSlots.filter(p=>p.kind==='PPA' && !busy.has(p.slotId)).length;
      const placedLeadership=protectedSlots.filter(p=>p.kind==='Leadership' && !busy.has(p.slotId)).length;
      const remainingProtected=Math.max(0,ppa-placedPpa)+Math.max(0,leadership-placedLeadership);
      const unprotectedFree=free.filter(s=>!protectedIds.has(s.id));
      const coverLimit=Number(t.coverPeriods ?? 2);
      const coverCapacity=Math.max(0,Math.min(coverLimit,unprotectedFree.length-remainingProtected));
      const daily=(data.days || []).filter(d=>d.enabled).map(d=>{
        const row=teaching.filter(a=>a.dayKey===d.key);
        return {dayKey:d.key,day:d.label,total:row.reduce((n,a)=>n+periods(a),0),consecutive:longestRun(row.flatMap(a=>lessonSlots(a,data).map(s=>s.periodIndex)))};
      });
      return {week,available:available.length,allocation,contactRatio:available.length ? allocation/available.length : 0,
        ppa,leadership,placedPpa,placedLeadership,coverLimit,coverCapacity,free,unprotectedFree,daily,
        deficit:Math.max(0,allocation+ppa+leadership-available.length),protectedClashes:protectedSlots.filter(p=>busy.has(p.slotId)).length};
    });
    return {...t,perWeek};
  });
}
