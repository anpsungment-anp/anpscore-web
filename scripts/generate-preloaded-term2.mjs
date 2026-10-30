import fs from 'fs';

const backup = JSON.parse(fs.readFileSync('C:/Users/Ohunited/Downloads/anpscore_backup_2026-10-21.json', 'utf8'));
const coreTeachers = backup.db.teachers || [];
const coreClasses = backup.db.classes || {};
const coreSubjects = backup.db.subjects || [];

const norm = s => String(s || '').replace(/\s+/g, '');

const stableId = function (prefix, text) {
  const s = norm(text);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return prefix + h.toString(36);
};

// Teacher matching
function getTeacher(rawName) {
  const n = norm(rawName);
  let t = coreTeachers.find(ct => norm(ct.name) === n);
  if (t) return { id: t.id, name: t.name, external: false };
  const cleanTitle = s => s.replace(/^(นางสาว|นาง|นาย|ครู|teacher\s*)/i, '').trim();
  const nWithoutTitle = cleanTitle(n);
  t = coreTeachers.find(ct => cleanTitle(norm(ct.name)) === nWithoutTitle);
  if (t) return { id: t.id, name: t.name, external: false };
  const firstName = nWithoutTitle.slice(0, 5);
  const matches = coreTeachers.filter(ct => cleanTitle(norm(ct.name)).startsWith(firstName));
  if (matches.length === 1) return { id: matches[0].id, name: matches[0].name, external: false };
  return { id: stableId('tt_t_', rawName), name: rawName.trim(), external: true };
}

// Class matching
const classKey = function (value) {
  const text = String(value || '').trim();
  const pair = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!pair) return '';
  let level = '';
  if (/มัธยมศึกษา|^\s*ม\s*\./.test(text)) level = 'ม';
  else if (/อนุบาล|^\s*อ\s*\./.test(text)) level = 'อ';
  else if (/ประถมศึกษา|^\s*ป\s*\./.test(text)) level = 'ป';
  if (!level) return '';
  return level + '.' + Number(pair[1]) + '/' + Number(pair[2]);
};

const classIndex = new Map();
Object.entries(coreClasses).forEach(([id, c]) => {
  const k = classKey(c.name);
  if (k) classIndex.set(k, { id, name: c.name, external: false });
});

function getClass(rawName) {
  const k = classKey(rawName);
  if (k && classIndex.has(k)) return classIndex.get(k);
  const n = norm(rawName);
  for (const [id, c] of Object.entries(coreClasses)) {
    if (norm(c.name) === n) return { id, name: c.name, external: false };
  }
  return { id: stableId('tt_c_', rawName), name: rawName.trim(), external: true };
}

// Subject matching
const subjectIndex = new Map();
coreSubjects.forEach(s => {
  subjectIndex.set(norm(s.name), s);
  if (s.code) subjectIndex.set(norm(s.code), s);
});

function getSubject(code, name) {
  let effectiveCode = code;
  let effectiveName = name;

  if (norm(code) === 'บูรณาการ' || norm(name) === 'สุพัตรา') {
    effectiveCode = 'บูรณาการ';
    effectiveName = 'บูรณาการ';
  }

  const nCode = norm(effectiveCode);
  const nName = norm(effectiveName);

  let s = null;
  if (nCode && subjectIndex.has(nCode)) s = subjectIndex.get(nCode);
  if (!s && nName && subjectIndex.has(nName)) s = subjectIndex.get(nName);
  if (s) {
    return { id: s.id, name: s.name, code: effectiveCode || s.code || '', short: effectiveName || s.name, external: false };
  }

  let fullName = effectiveName;
  if (nName === 'ไทย') fullName = 'ภาษาไทย';
  else if (nName === 'คณิต') fullName = 'คณิตศาสตร์';
  else if (nName === 'วิทย์') fullName = 'วิทยาศาสตร์';
  else if (nName === 'วิทย์คำนวณ' || nCode === 'ว') fullName = 'วิทยาการคำนวณ';
  else if (nName === 'อังกฤษ') fullName = 'ภาษาอังกฤษ';
  else if (nName === 'สังคม') fullName = 'สังคมศึกษา';
  else if (nName === 'จีน') fullName = 'ภาษาจีน';
  else if (nName === 'Communication') fullName = 'ภาษาอังกฤษเพื่อการสื่อสาร';
  else if (nName === 'บูรณาการ' || nCode === 'บูรณาการ') fullName = 'บูรณาการ';
  else if (nName === 'การเขียน') fullName = 'การเขียนเชิงสร้างสรรค์';
  else if (nName === 'อ่านคิด') fullName = 'การอ่านและการคิดวิเคราะห์';
  else if (nName === 'ว่ายน้ำ') fullName = 'ว่ายน้ำ';

  if (subjectIndex.has(norm(fullName))) {
    const matched = subjectIndex.get(norm(fullName));
    return { id: matched.id, name: matched.name, code: effectiveCode || matched.code || '', short: effectiveName || matched.name, external: false };
  }

  const subKey = effectiveCode && effectiveCode !== 'บูรณาการ' ? nCode : norm(fullName);
  return {
    id: stableId('tt_s_', subKey),
    name: fullName || effectiveCode,
    code: effectiveCode || '',
    short: effectiveName || fullName || effectiveCode,
    external: true
  };
}

const text = fs.readFileSync('C:/Users/Ohunited/Desktop/anpscore-web/schedule_term2_raw.csv', 'utf8');
const lines = text.split(/\r?\n/).map(line => {
  const row = [];
  let insideQuote = false;
  let entry = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      insideQuote = !insideQuote;
    } else if (c === ',' && !insideQuote) {
      row.push(entry.trim());
      entry = '';
    } else {
      entry += c;
    }
  }
  row.push(entry.trim());
  return row;
});

const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
const dayMap = { 'จันทร์': 'mon', 'อังคาร': 'tue', 'พุธ': 'wed', 'พฤหัสบดี': 'thu', 'ศุกร์': 'fri' };

let currentTeacher = null;
const rawSlots = [];
const extraTeachersMap = new Map();
const extraClassesMap = new Map();
const extraSubjectsMap = new Map();
const subjectShortsMap = new Map();
const allParsedTeachers = new Set();
const allParsedClasses = new Set();
const allParsedSubjects = new Set();

for (let i = 0; i < lines.length; i++) {
  const row = lines[i];
  const rowStr = row.join(' ');

  const m = rowStr.match(/ตารางสอนของ\s*([^\s,]+(?:\s+[^\s,]+)*?)\s*ภาคเรียนที่\s*(\d+)\s+ปีการศึกษา\s*(\d+)/);
  if (m) {
    const tName = m[1].trim();
    currentTeacher = tName.includes('...') ? null : tName;
    continue;
  }
  if (rowStr.includes('ตารางสอนลูกเสือ') || rowStr.includes('กรณีเอกลักษณ์') || rowStr.includes('ตารางคาบบูรณาการ') || rowStr.includes('ตารางคาบลูกเสือ')) {
    currentTeacher = null;
    continue;
  }
  if (!currentTeacher) continue;

  const firstCol = row[0] || '';
  if (days.includes(firstCol)) {
    const codesRow = row;
    const namesRow = lines[i + 1] || [];
    const classesRow = lines[i + 2] || [];

    const dayId = dayMap[firstCol];
    allParsedTeachers.add(currentTeacher);
    const teacherObj = getTeacher(currentTeacher);
    if (teacherObj.external) extraTeachersMap.set(teacherObj.id, teacherObj);

    for (let p = 1; p <= 8; p++) {
      let code = (codesRow[p] || '').trim();
      let name = (namesRow[p] || '').trim();
      const cls = (classesRow[p] || '').trim();

      if (!code && !name && !cls) continue;
      if (name === 'ว่าง' || name === 'พักกลางวัน' || name === 'Lunch') continue;

      // Clean special case: สุพัตรา in row 2 when code is บูรณาการ
      if (norm(code) === 'บูรณาการ' || norm(name) === 'สุพัตรา') {
        code = 'บูรณาการ';
        name = 'บูรณาการ';
      }

      const periodId = 'p' + p;

      const isActivity = (!code && !name.includes('วิทย์') && !name.includes('คณิต') && !name.includes('ไทย') && !name.includes('อังกฤษ') && !name.includes('จีน') && !name.includes('บูรณาการ')) ||
        name.includes('ทำงาน') || name.includes('ติว') || name.includes('ลูกเสือ') || name.includes('อบ.') || name.includes('Nuersery') || name.includes('kindergarten');

      let classObj = null;
      if (cls) {
        allParsedClasses.add(cls);
        classObj = getClass(cls);
        if (classObj.external) extraClassesMap.set(classObj.id, classObj);
      }

      let subObj = null;
      if (!isActivity) {
        allParsedSubjects.add(code || name);
        subObj = getSubject(code, name);
        if (subObj.external) extraSubjectsMap.set(subObj.id, subObj);
        if (subObj.short) subjectShortsMap.set(subObj.id, subObj.short);
      }

      rawSlots.push({
        teacherId: teacherObj.id,
        teacherName: teacherObj.name,
        classId: classObj ? classObj.id : '',
        className: classObj ? classObj.name : '',
        subjectId: subObj ? subObj.id : '',
        subjectName: subObj ? subObj.name : '',
        code,
        name,
        day: dayId,
        periodId,
        isActivity
      });
    }
    i += 2;
  }
}

// Merge co-teachers
const classSlotMap = new Map();
const dutyEntries = [];

rawSlots.forEach(slot => {
  if (slot.classId) {
    const key = `${slot.classId}_${slot.day}_${slot.periodId}`;
    if (!classSlotMap.has(key)) {
      classSlotMap.set(key, {
        id: stableId('en_', `${slot.classId}_${slot.day}_${slot.periodId}`),
        classId: slot.classId,
        subjectId: slot.subjectId,
        teacherId: slot.teacherId,
        coTeacherIds: [],
        roomId: '',
        day: slot.day,
        periodId: slot.periodId,
        kind: slot.isActivity ? 'activity' : 'subject',
        label: slot.isActivity ? slot.name : '',
        locked: slot.isActivity
      });
    } else {
      const existing = classSlotMap.get(key);
      if (existing.teacherId !== slot.teacherId && !existing.coTeacherIds.includes(slot.teacherId)) {
        existing.coTeacherIds.push(slot.teacherId);
      }
      if (!existing.subjectId && slot.subjectId) {
        existing.subjectId = slot.subjectId;
        existing.kind = 'subject';
      }
    }
  } else {
    dutyEntries.push({
      id: stableId('en_', `${slot.teacherId}_${slot.day}_${slot.periodId}_duty`),
      classId: '',
      subjectId: '',
      teacherId: slot.teacherId,
      coTeacherIds: [],
      roomId: '',
      day: slot.day,
      periodId: slot.periodId,
      kind: 'activity',
      label: slot.name || 'ภารกิจ',
      locked: true
    });
  }
});

const allEntries = Array.from(classSlotMap.values()).concat(dutyEntries);

// Allocations
const allocMap = new Map();
allEntries.forEach(e => {
  if (e.kind !== 'subject' || !e.classId || !e.subjectId) return;
  const key = `${e.classId}|${e.subjectId}|${e.teacherId}`;
  if (!allocMap.has(key)) {
    allocMap.set(key, {
      id: stableId('al_', key),
      classId: e.classId,
      subjectId: e.subjectId,
      teacherId: e.teacherId,
      coTeacherIds: e.coTeacherIds.slice(),
      periodsPerWeek: 0,
      doublePeriod: false,
      roomId: '',
      preferDays: [],
      avoidDays: [],
      note: 'ภาคเรียนที่ 2 ปีการศึกษา 2569'
    });
  }
  allocMap.get(key).periodsPerWeek++;
});

// Periods
const periods = [
  { id: 'p1', no: 1, label: 'คาบที่ 1', start: '08:30', end: '09:30', type: 'class' },
  { id: 'p2', no: 2, label: 'คาบที่ 2', start: '09:30', end: '10:30', type: 'class' },
  { id: 'p3', no: 3, label: 'คาบที่ 3', start: '10:30', end: '11:20', type: 'class' },
  { id: 'p4', no: 4, label: 'คาบที่ 4', start: '11:20', end: '12:05', type: 'class' },
  { id: 'p5', no: 5, label: 'คาบที่ 5', start: '12:05', end: '12:50', type: 'class' },
  { id: 'p6', no: 6, label: 'คาบที่ 6', start: '12:50', end: '13:40', type: 'class' },
  { id: 'p7', no: 7, label: 'คาบที่ 7', start: '13:40', end: '14:30', type: 'class' },
  { id: 'p8', no: 8, label: 'คาบที่ 8', start: '14:30', end: '15:30', type: 'class' }
];

const plan = {
  year: '2569',
  term: '2',
  name: 'ตารางสอนภาคเรียนที่ 2 ปีการศึกษา 2569',
  status: 'published',
  publishedAt: Date.now(),
  version: 1,
  allocations: Array.from(allocMap.values()),
  entries: allEntries,
  updatedAt: Date.now()
};

const extras = {
  teachers: Array.from(extraTeachersMap.values()),
  classes: Array.from(extraClassesMap.values()),
  subjects: Array.from(extraSubjectsMap.values()),
  subjectShorts: Array.from(subjectShortsMap.entries())
};

const planImport = {
  periods,
  entries: allEntries,
  allocations: Array.from(allocMap.values()),
  extras,
  subjectShorts: Array.from(subjectShortsMap.entries()),
  report: {
    totalRows: lines.length,
    activityCount: allEntries.filter(e => e.kind === 'activity').length,
    subjectCount: allEntries.filter(e => e.kind === 'subject').length,
    registeredOnly: 0,
    noTeacherCount: 0,
    skipped: {},
    matchedClasses: allParsedClasses.size - extraClassesMap.size,
    matchedTeachers: allParsedTeachers.size - extraTeachersMap.size,
    matchedSubjects: allParsedSubjects.size - extraSubjectsMap.size,
    totalClasses: allParsedClasses.size,
    totalTeachers: allParsedTeachers.size,
    totalSubjects: allParsedSubjects.size,
    unmatchedClasses: Array.from(extraClassesMap.values()).map(c => c.name),
    unmatchedTeachers: Array.from(extraTeachersMap.values()).map(t => t.name),
    unmatchedSubjects: Array.from(extraSubjectsMap.values()).map(s => s.name)
  }
};

const output = `/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — ข้อมูลตารางสอนเทอม 2 ปีการศึกษา 2569
   สร้างขึ้นจากไฟล์ข้อมูลตารางสอนโรงเรียนอนุพงศ์พัชรินทร์
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT = window.TT || {};

    TT.TERM2_PERIODS = ${JSON.stringify(periods, null, 4)};

    TT.TERM2_EXTRAS = ${JSON.stringify(extras, null, 4)};

    TT.TERM2_PLAN = ${JSON.stringify(plan, null, 4)};

    TT.TERM2_PLAN_IMPORT = ${JSON.stringify(planImport, null, 4)};

    console.log('[Schedule] Preloaded Term 2 / 2569 ready: ${allEntries.length} entries, ${allocMap.size} allocations');
})();
`;

fs.writeFileSync('C:/Users/Ohunited/Desktop/anpscore-web/schedule/preloaded-term2.js', output, 'utf8');
console.log('Saved to schedule/preloaded-term2.js successfully!');
console.log('Activities:', planImport.report.activityCount, 'Subjects:', planImport.report.subjectCount);
console.log('Unmatched subjects:', planImport.report.unmatchedSubjects);
