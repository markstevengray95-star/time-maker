const ids = {
  staff: { gray: 'demo-staff-gray', patel: 'demo-staff-patel', taylor: 'demo-staff-taylor', lewis: 'demo-staff-lewis', khan: 'demo-staff-khan', evans: 'demo-staff-evans' },
  rooms: { g1: 'demo-room-g1', g2: 'demo-room-g2', m1: 'demo-room-m1', e1: 'demo-room-e1', s1: 'demo-room-s1', s2: 'demo-room-s2' },
  groups: { y7: 'demo-group-7a', y8: 'demo-group-8a', y10: 'demo-group-10s1', y12: 'demo-group-12p' },
};

const days = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'],
];

const blocks = [
  ['p1', 'Period 1', '08:55', '09:50'], ['p2', 'Period 2', '09:55', '10:50'], ['break', 'Break', '10:50', '11:10'],
  ['p3', 'Period 3', '11:10', '12:05'], ['p4', 'Period 4', '12:10', '13:05'], ['lunch', 'Lunch', '13:05', '14:05'],
  ['p5', 'Period 5', '14:05', '15:00'], ['p6', 'Period 6', '15:05', '16:00'],
].map(([id, name, start, end]) => ({ id, name, type: name === 'Break' || name === 'Lunch' ? 'break' : 'lesson', start, end }));

const lessonBlocks = blocks.filter((block) => block.type === 'lesson');

const staff = [
  { id: ids.staff.gray, name: 'Mark Gray', initials: 'MG', department: 'Science', subjects: ['Science', 'Physics'], fte: 1, maxPeriods: 24, ppaPeriods: 4, leadershipPeriods: 2, maxDaily: 5, maxConsecutive: 4, availability: { mon: true, tue: true, wed: true, thu: true, fri: true }, notes: 'Demo Head of Physics' },
  { id: ids.staff.patel, name: 'Asha Patel', initials: 'AP', department: 'Mathematics', subjects: ['Mathematics', 'Maths'], fte: 1, maxPeriods: 25, ppaPeriods: 4, leadershipPeriods: 0, maxDaily: 5, maxConsecutive: 4, availability: { mon: true, tue: true, wed: true, thu: true, fri: true }, notes: '' },
  { id: ids.staff.taylor, name: 'Sophie Taylor', initials: 'ST', department: 'English', subjects: ['English'], fte: 1, maxPeriods: 24, ppaPeriods: 4, leadershipPeriods: 0, maxDaily: 5, maxConsecutive: 4, availability: { mon: true, tue: true, wed: true, thu: true, fri: true }, notes: '' },
  { id: ids.staff.lewis, name: 'Daniel Lewis', initials: 'DL', department: 'English', subjects: ['English'], fte: 0.8, maxPeriods: 19, ppaPeriods: 3, leadershipPeriods: 0, maxDaily: 5, maxConsecutive: 4, availability: { mon: true, tue: true, wed: true, thu: true, fri: false }, notes: 'Not available Friday' },
  { id: ids.staff.khan, name: 'Nadia Khan', initials: 'NK', department: 'Science', subjects: ['Science', 'Chemistry'], fte: 1, maxPeriods: 24, ppaPeriods: 4, leadershipPeriods: 0, maxDaily: 5, maxConsecutive: 4, availability: { mon: true, tue: true, wed: true, thu: true, fri: true }, notes: '' },
  { id: ids.staff.evans, name: 'Rachel Evans', initials: 'RE', department: 'Science', subjects: ['Science', 'Biology'], fte: 1, maxPeriods: 24, ppaPeriods: 4, leadershipPeriods: 0, maxDaily: 5, maxConsecutive: 4, availability: { mon: true, tue: true, wed: true, thu: true, fri: true }, notes: '' },
];

const classes = [
  { id: ids.groups.y7, name: '7A', year: 'Year 7', type: 'Teaching group', subject: '', size: 26, lessonsPerWeek: 12, optionBlock: '', teacherId: '' },
  { id: ids.groups.y8, name: '8A', year: 'Year 8', type: 'Teaching group', subject: '', size: 27, lessonsPerWeek: 12, optionBlock: '', teacherId: '' },
  { id: ids.groups.y10, name: '10S1', year: 'Year 10', type: 'Teaching group', subject: '', size: 24, lessonsPerWeek: 17, optionBlock: '', teacherId: '' },
  { id: ids.groups.y12, name: '12P', year: 'Year 12', type: 'Sixth form', subject: 'Physics', size: 12, lessonsPerWeek: 5, optionBlock: 'A', teacherId: ids.staff.gray },
];

const req = (id, groupId, year, subject, lessons, teacherId, roomType = 'No specialist room', extras = {}) => ({
  id, name: `${classes.find((group) => group.id === groupId)?.name || year} ${subject}`, year, subject,
  targetType: 'group', targetGroupId: groupId, lessonsPerWeek: lessons, doublePeriods: extras.doublePeriods || 0,
  maxSameDay: extras.maxSameDay || 1, spread: extras.spread || 'balanced', roomType,
  staffingMode: 'fixed', teacherId, priority: extras.priority || 'core', notes: extras.notes || '',
});

const curriculumRequirements = [
  req('demo-r1', ids.groups.y7, 'Year 7', 'English', 4, ids.staff.taylor),
  req('demo-r2', ids.groups.y7, 'Year 7', 'Mathematics', 4, ids.staff.patel),
  req('demo-r3', ids.groups.y7, 'Year 7', 'Science', 4, ids.staff.gray, 'Science lab'),
  req('demo-r4', ids.groups.y8, 'Year 8', 'English', 4, ids.staff.lewis),
  req('demo-r5', ids.groups.y8, 'Year 8', 'Mathematics', 4, ids.staff.patel),
  req('demo-r6', ids.groups.y8, 'Year 8', 'Science', 4, ids.staff.khan, 'Science lab'),
  req('demo-r7', ids.groups.y10, 'Year 10', 'English', 4, ids.staff.taylor),
  req('demo-r8', ids.groups.y10, 'Year 10', 'Mathematics', 4, ids.staff.patel),
  req('demo-r9', ids.groups.y10, 'Year 10', 'Physics', 3, ids.staff.gray, 'Science lab'),
  req('demo-r10', ids.groups.y10, 'Year 10', 'Chemistry', 3, ids.staff.khan, 'Science lab'),
  req('demo-r11', ids.groups.y10, 'Year 10', 'Biology', 3, ids.staff.evans, 'Science lab'),
  req('demo-r12', ids.groups.y12, 'Year 12', 'Physics', 5, ids.staff.gray, 'Science lab', { doublePeriods: 1, maxSameDay: 2, notes: 'Include one double period where possible.' }),
];

const rooms = [
  { id: ids.rooms.g1, name: 'G1', code: 'G1', building: 'Main', floor: 'Ground', department: '', type: 'General classroom', capacity: 30, accessible: true, shared: true, features: ['Projector'], unavailableSlots: [], notes: '' },
  { id: ids.rooms.g2, name: 'G2', code: 'G2', building: 'Main', floor: 'Ground', department: '', type: 'General classroom', capacity: 30, accessible: true, shared: true, features: ['Projector'], unavailableSlots: [], notes: '' },
  { id: ids.rooms.m1, name: 'M1', code: 'M1', building: 'Main', floor: 'First', department: 'Mathematics', type: 'General classroom', capacity: 28, accessible: true, shared: false, features: ['Projector'], unavailableSlots: [], notes: '' },
  { id: ids.rooms.e1, name: 'E1', code: 'E1', building: 'Main', floor: 'First', department: 'English', type: 'General classroom', capacity: 30, accessible: true, shared: false, features: ['Projector'], unavailableSlots: [], notes: '' },
  { id: ids.rooms.s1, name: 'Lab 1', code: 'S1', building: 'Science', floor: 'Ground', department: 'Science', type: 'Science lab', capacity: 28, accessible: true, shared: true, features: ['Gas taps', 'Sinks', 'Projector'], unavailableSlots: [], notes: '' },
  { id: ids.rooms.s2, name: 'Lab 2', code: 'S2', building: 'Science', floor: 'First', department: 'Science', type: 'Science lab', capacity: 26, accessible: true, shared: true, features: ['Gas taps', 'Sinks', 'Projector'], unavailableSlots: [{ day: 'wed', periodId: 'p6' }], notes: 'Unavailable Wednesday P6 for maintenance.' },
];

const constraints = [
  { id: 'demo-c1', name: 'DL unavailable Friday', enabled: true, severity: 'hard', weight: 10, scope: 'staff', targetId: ids.staff.lewis, ruleType: 'unavailable', day: 'fri', periodId: 'all', value: 1, roomId: '', notes: 'Part-time working pattern' },
  { id: 'demo-c2', name: 'Year 12 Physics prefer morning', enabled: true, severity: 'soft', weight: 7, scope: 'class', targetId: ids.groups.y12, ruleType: 'prefer-period', day: 'mon', periodId: 'p1', value: 1, roomId: '', notes: 'A-level class preference' },
  { id: 'demo-c3', name: 'MG max four consecutive', enabled: true, severity: 'hard', weight: 10, scope: 'staff', targetId: ids.staff.gray, ruleType: 'max-consecutive', day: 'mon', periodId: 'p1', value: 4, roomId: '', notes: '' },
  { id: 'demo-c4', name: 'Science prefer Lab 1', enabled: true, severity: 'soft', weight: 5, scope: 'subject', targetId: 'Science', ruleType: 'preferred-room', day: 'mon', periodId: 'p1', value: 1, roomId: ids.rooms.s1, notes: '' },
];

const roomForRequirement = (requirement, index) => requirement.roomType === 'Science lab'
  ? [ids.rooms.s1, ids.rooms.s2][index % 2]
  : requirement.subject === 'Mathematics' ? ids.rooms.m1
    : requirement.subject === 'English' ? ids.rooms.e1
      : [ids.rooms.g1, ids.rooms.g2][index % 2];

function buildDemoOption(optionIndex = 0) {
  const teacherBusy = new Set();
  const groupBusy = new Set();
  const roomBusy = new Set();
  const assignments = [];
  const slots = [];
  days.forEach(([dayKey, dayLabel], dayIndex) => lessonBlocks.forEach((block, periodIndex) => slots.push({ dayKey, dayLabel, dayIndex, periodIndex, block })));

  curriculumRequirements.forEach((requirement, requirementIndex) => {
    const group = classes.find((item) => item.id === requirement.targetGroupId);
    for (let lessonIndex = 0; lessonIndex < Number(requirement.lessonsPerWeek || 0); lessonIndex += 1) {
      const start = (requirementIndex * 5 + lessonIndex * 7 + optionIndex * 3) % slots.length;
      let chosen = null;
      for (let step = 0; step < slots.length; step += 1) {
        const slot = slots[(start + step) % slots.length];
        const preferredRoom = roomForRequirement(requirement, requirementIndex + lessonIndex + optionIndex);
        const roomId = [...rooms].sort((a, b) => Number(b.id === preferredRoom) - Number(a.id === preferredRoom)).find(room =>
          room.capacity >= group.size && (requirement.roomType === 'No specialist room' || room.type === requirement.roomType) &&
          !roomBusy.has(`${slot.dayKey}:${slot.block.id}:${room.id}`) &&
          !room.unavailableSlots.some(closed => closed.day === slot.dayKey && closed.periodId === slot.block.id))?.id;
        if (!roomId) continue;
        const key = `${slot.dayKey}:${slot.block.id}`;
        if (teacherBusy.has(`${key}:${requirement.teacherId}`)) continue;
        if (groupBusy.has(`${key}:${group.id}`)) continue;
        if (roomBusy.has(`${key}:${roomId}`)) continue;
        if (requirement.teacherId === ids.staff.lewis && slot.dayKey === 'fri') continue;
        chosen = { ...slot, roomId };
        break;
      }
      if (!chosen) continue;
      const room = rooms.find((item) => item.id === chosen.roomId);
      const teacher = staff.find((item) => item.id === requirement.teacherId);
      const busyKey = `${chosen.dayKey}:${chosen.block.id}`;
      teacherBusy.add(`${busyKey}:${teacher.id}`);
      groupBusy.add(`${busyKey}:${group.id}`);
      roomBusy.add(`${busyKey}:${room.id}`);
      assignments.push({
        id: `demo-a-${optionIndex}-${requirement.id}-${lessonIndex}`, requirementId: requirement.id, label: requirement.name,
        subject: requirement.subject, year: requirement.year, groupId: group.id, groupName: group.name, optionBlock: group.optionBlock || '',
        week: 'A', dayKey: chosen.dayKey, dayLabel: chosen.dayLabel, periodId: chosen.block.id, periodName: chosen.block.name,
        periodIndex: chosen.periodIndex, periodIndices: [chosen.periodIndex], slotIds: [`A:${chosen.dayKey}:${chosen.block.id}`], duration: 1,
        teacherId: teacher.id, teacherName: teacher.name, teacherInitials: teacher.initials,
        roomId: room.id, roomName: room.name, roomCode: room.code, penalty: optionIndex + ((requirementIndex + lessonIndex) % 3 === 0 ? 1 : 0),
      });
    }
  });

  const requiredPeriods = curriculumRequirements.reduce((total, requirement) => total + Number(requirement.lessonsPerWeek || 0), 0);
  const scheduledPeriods = assignments.length;
  const softPenalty = assignments.reduce((total, assignment) => total + Number(assignment.penalty || 0), 0);
  return {
    id: `demo-option-${optionIndex + 1}`, name: `Demo option ${optionIndex + 1}`, createdAt: new Date().toISOString(), seed: 100 + optionIndex,
    assignments, unscheduled: [], requiredPeriods, scheduledPeriods,
    completion: requiredPeriods ? Math.round((scheduledPeriods / requiredPeriods) * 1000) / 10 : 0,
    quality: Math.max(0, 96 - optionIndex * 4), softPenalty,
  };
}

export function buildDemoData() {
  const generatedTimetables = [buildDemoOption(0), buildDemoOption(1), buildDemoOption(2)];
  return {
    school: { name: 'Oakfield Academy (Demo)', academicYear: '2026/27', timezone: 'Europe/London', cycle: 'one-week' },
    days: days.map(([key, label]) => ({ key, label, enabled: true })).concat([{ key: 'sat', label: 'Saturday', enabled: false }, { key: 'sun', label: 'Sunday', enabled: false }]),
    blocks, dayOverrides: {},
    keyStages: [
      { id: 'demo-ks3', name: 'KS3', years: ['Year 7', 'Year 8', 'Year 9'] },
      { id: 'demo-ks4', name: 'KS4', years: ['Year 10', 'Year 11'] },
      { id: 'demo-ks5', name: 'KS5', years: ['Year 12', 'Year 13'] },
    ],
    terms: [
      { id: 'demo-autumn', name: 'Autumn', start: '2026-09-01', end: '2026-12-18', halfStart: '2026-10-26', halfEnd: '2026-10-30' },
      { id: 'demo-spring', name: 'Spring', start: '2027-01-04', end: '2027-03-26', halfStart: '2027-02-15', halfEnd: '2027-02-19' },
      { id: 'demo-summer', name: 'Summer', start: '2027-04-12', end: '2027-07-23', halfStart: '2027-05-31', halfEnd: '2027-06-04' },
    ],
    departments: ['Science', 'Mathematics', 'English', 'Humanities', 'Languages', 'PE', 'Arts', 'Technology', 'SEND', 'Sixth Form'],
    staff, classes, curriculumRequirements, rooms, constraints,
    generatedTimetables, activeTimetableId: generatedTimetables[0].id,
    demoLoaded: true,
  };
}
