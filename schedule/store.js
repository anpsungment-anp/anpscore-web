/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — คลังข้อมูลกลางของหน้าจอ (Store)

   หน้าที่
     - เก็บสถานะที่ทุกหน้าจอใช้ร่วมกัน (ผู้ใช้ ปีการศึกษา ตารางที่กำลังดู)
     - กำหนดค่าเริ่มต้นของระบบ (วัน คาบ ห้อง กติกาการจัดตาราง)
     - รวมข้อมูลครู/ห้องเรียน/รายวิชา จากระบบคะแนน เข้ากับข้อมูลเสริมของระบบตาราง
     - ตรวจสิทธิ์การใช้งานของผู้ใช้แต่ละคน
     - บันทึกข้อมูลขึ้นคลาวด์แบบหน่วงเวลา เพื่อไม่ให้เขียนถี่เกินจำเป็น
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT = window.TT || {};

    /* ---------------------------------------------------------------- ค่าคงที่ */

    TT.SCHOOL = {
        name: 'โรงเรียนอนุพงศ์พัชรินทร์',
        address: '2 หมู่ 1 ตำบลสูงเม่น อำเภอสูงเม่น จังหวัดแพร่',
        director: 'นางพัชรินทร์ กันทะเสน',
        academicHead: ''
    };

    TT.DAY_NAMES = {
        mon: 'จันทร์', tue: 'อังคาร', wed: 'พุธ', thu: 'พฤหัสบดี',
        fri: 'ศุกร์', sat: 'เสาร์', sun: 'อาทิตย์'
    };

    /* ประเภทคาบ : เรียน / พัก / กิจกรรม (พักและกิจกรรมจะจัดวิชาลงไม่ได้) */
    TT.PERIOD_TYPES = {
        class: 'คาบเรียน',
        activity: 'คาบกิจกรรม',
        break: 'พัก'
    };

    TT.LEAVE_TYPES = {
        sick: 'ลาป่วย',
        personal: 'ลากิจ',
        official: 'ไปราชการ',
        training: 'อบรม',
        meeting: 'ประชุม',
        other: 'กิจกรรมอื่น'
    };

    /* ขั้นตอนของงานสอนแทน ตามลำดับการทำงานจริง */
    TT.SUB_STATUS = {
        pending: { label: 'รอจัดครูสอนแทน', color: 'bg-rose-100 text-rose-700 border-rose-200' },
        awaiting: { label: 'รอครูยืนยัน', color: 'bg-amber-100 text-amber-700 border-amber-200' },
        accepted: { label: 'ครูรับทราบแล้ว', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        declined: { label: 'ครูขอปฏิเสธ', color: 'bg-rose-100 text-rose-700 border-rose-200' },
        changing: { label: 'กำลังเปลี่ยนครู', color: 'bg-sky-100 text-sky-700 border-sky-200' },
        done: { label: 'สอนแทนเรียบร้อย', color: 'bg-slate-200 text-slate-700 border-slate-300' },
        cancelled: { label: 'ยกเลิก', color: 'bg-slate-100 text-slate-500 border-slate-200' }
    };

    TT.DEPARTMENTS = [
        'ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์และเทคโนโลยี', 'สังคมศึกษา ศาสนาและวัฒนธรรม',
        'สุขศึกษาและพลศึกษา', 'ศิลปะ', 'การงานอาชีพ', 'ภาษาต่างประเทศ', 'กิจกรรมพัฒนาผู้เรียน', 'ปฐมวัย'
    ];

    /* สีประจำวิชา เลือกให้ตัวหนังสือสีเข้มอ่านได้ชัดบนพื้นอ่อน */
    TT.COLORS = [
        '#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#ede9fe', '#cffafe',
        '#fce7f3', '#ecfccb', '#ffedd5', '#e0e7ff', '#d1fae5', '#f5f5f4'
    ];

    /* ---------------------------------------------------- ค่าเริ่มต้นของการตั้งค่า */

    const thisYear = String(new Date().getFullYear() + 543);

    TT.defaultPeriods = function () {
        return [
            { id: 'a0', no: 0, label: 'หน้าเสาธง', start: '08:00', end: '08:30', type: 'activity' },
            { id: 'p1', no: 1, label: 'คาบที่ 1', start: '08:30', end: '09:30', type: 'class' },
            { id: 'p2', no: 2, label: 'คาบที่ 2', start: '09:30', end: '10:30', type: 'class' },
            { id: 'b1', no: 0, label: 'พัก', start: '10:30', end: '10:45', type: 'break' },
            { id: 'p3', no: 3, label: 'คาบที่ 3', start: '10:45', end: '11:45', type: 'class' },
            { id: 'b2', no: 0, label: 'พักกลางวัน', start: '11:45', end: '12:45', type: 'break' },
            { id: 'p4', no: 4, label: 'คาบที่ 4', start: '12:45', end: '13:45', type: 'class' },
            { id: 'p5', no: 5, label: 'คาบที่ 5', start: '13:45', end: '14:45', type: 'class' },
            { id: 'p6', no: 6, label: 'คาบที่ 6', start: '14:45', end: '15:45', type: 'class' }
        ];
    };

    TT.defaultDays = function () {
        return ['mon', 'tue', 'wed', 'thu', 'fri'].map((id, i) => ({
            id, name: TT.DAY_NAMES[id], no: i + 1, active: true
        }));
    };

    TT.defaultRooms = function () {
        return [
            { id: 'rm_comp', code: 'COM', name: 'ห้องคอมพิวเตอร์', type: 'special', building: 'อาคาร 2', capacity: 40 },
            { id: 'rm_sci', code: 'SCI', name: 'ห้องวิทยาศาสตร์', type: 'special', building: 'อาคาร 2', capacity: 40 },
            { id: 'rm_music', code: 'MUS', name: 'ห้องดนตรี', type: 'special', building: 'อาคาร 3', capacity: 35 },
            { id: 'rm_sport', code: 'GYM', name: 'สนามกีฬา', type: 'special', building: 'สนาม', capacity: 80 },
            { id: 'rm_lib', code: 'LIB', name: 'ห้องสมุด', type: 'special', building: 'อาคาร 1', capacity: 40 }
        ];
    };

    /* น้ำหนักของเงื่อนไข "เพื่อคุณภาพตาราง" ผู้จัดตารางปรับได้เอง */
    TT.defaultRules = function () {
        return {
            maxPerDayTeacher: 6,          // คาบสอนสูงสุดของครูต่อวัน
            maxConsecutive: 4,            // สอนติดกันได้ไม่เกินกี่คาบ
            maxPerDayClass: 7,            // คาบเรียนสูงสุดของนักเรียนต่อวัน
            coreMorning: true,            // วิชาหลักควรอยู่ช่วงเช้า
            coreSubjects: ['ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์และเทคโนโลยี', 'ภาษาต่างประเทศ'],
            weights: {
                spread: 5,                // กระจายคาบของวิชาตลอดสัปดาห์
                sameDayRepeat: 8,         // ไม่ซ้ำวิชาหลายคาบในวันเดียว
                coreMorning: 4,           // วิชาหลักช่วงเช้า
                teacherGap: 6,            // ลดคาบว่างแทรกของครู
                consecutive: 5,           // ไม่สอนติดกันเกินกำหนด
                balance: 5,               // กระจายภาระงานครูให้สมดุล
                buildingMove: 3           // ลดการเดินข้ามอาคาร
            },
            substituteMaxPerWeek: 6       // เพดานการถูกจัดสอนแทนต่อสัปดาห์
        };
    };

    TT.defaultSettings = function () {
        return {
            activeYear: thisYear,
            activeTerm: '1',
            years: [{
                year: thisYear,
                terms: {
                    '1': { start: '', end: '', status: 'open' },
                    '2': { start: '', end: '', status: 'open' }
                }
            }],
            days: TT.defaultDays(),
            periods: TT.defaultPeriods(),
            rooms: TT.defaultRooms(),
            gradeLevels: [],       // เว้นว่างไว้ = ให้ระบบอ่านจากชื่อห้องเรียนของระบบคะแนน
            classMeta: {},         // ข้อมูลเสริมของห้องเรียน (สี ห้องประจำ)
            teacherMeta: {},       // ข้อมูลเสริมของครู (กลุ่มสาระ วิชาเอก เพดานคาบ ช่วงที่ไม่สะดวก)
            subjectMeta: {},       // ข้อมูลเสริมของรายวิชา (สี ชื่อย่อ คาบคู่ ห้องพิเศษ)
            permissions: {},       // สิทธิ์ของครูแต่ละคนในระบบตารางสอน
            rules: TT.defaultRules(),
            school: Object.assign({}, TT.SCHOOL),
            sessionTimeoutMin: 60,
            updatedAt: 0
        };
    };

    TT.emptyPlan = function (year, term) {
        return {
            year: String(year), term: String(term),
            name: 'ตารางสอนภาคเรียนที่ ' + term + ' ปีการศึกษา ' + year,
            status: 'draft',
            publishedAt: 0,
            version: 1,
            allocations: [],
            entries: [],
            updatedAt: 0
        };
    };

    TT.emptyOps = function (year, term) {
        return {
            year: String(year), term: String(term),
            leaves: [],
            substitutes: [],
            notifications: [],
            updatedAt: 0
        };
    };

    /* ---------------------------------------------------------------- สถานะกลาง */

    TT.state = {
        user: null,            // { role:'admin'|'teacher', id, name }
        core: null,            // ข้อมูลจากระบบคะแนน
        settings: null,
        plan: null,
        ops: null,
        page: '',
        loading: true,
        filters: {},
        undoStack: [],
        redoStack: []
    };

    TT.uid = function (prefix) {
        return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    };

    TT.clone = function (v) { return JSON.parse(JSON.stringify(v === undefined ? null : v)); };

    /* --------------------------------------------------------------- ผู้ใช้/สิทธิ์ */

    /* ระดับสิทธิ์
         admin      ผู้ดูแลระบบ        ทำได้ทุกอย่าง รวมถึงกำหนดสิทธิ์ให้ผู้อื่น
         scheduler  ผู้จัดตารางสอน     จัดการข้อมูลพื้นฐานและตารางสอนทั้งหมด
         substitute ผู้จัดครูสอนแทน    จัดครูสอนแทนและดูแลการลา
         executive  ผู้บริหาร          ดูภาพรวมทั้งโรงเรียนและรับทราบการสอนแทน
         teacher    ครูผู้สอน          ดูตารางของตนเอง แจ้งลา ยืนยันการสอนแทน
    */
    TT.ROLE_LABELS = {
        admin: 'ผู้ดูแลระบบ',
        scheduler: 'ผู้จัดตารางสอน',
        substitute: 'ผู้จัดครูสอนแทน',
        executive: 'ผู้บริหาร',
        teacher: 'ครูผู้สอน'
    };

    /* สิทธิ์ที่บันทึกไว้ของครูหนึ่งคน (ค่าเริ่มต้นคือดูอย่างเดียว) */
    TT.permOf = function (teacherId) {
        const s = TT.state.settings;
        const p = (s && s.permissions && s.permissions[teacherId]) || {};
        return {
            canSchedule: !!p.canSchedule,
            canSubstitute: !!p.canSubstitute,
            isExecutive: !!p.isExecutive,
            note: p.note || ''
        };
    };

    TT.currentPerm = function () {
        const u = TT.state.user;
        if (!u) return { canSchedule: false, canSubstitute: false, isExecutive: false };
        if (u.role === 'admin') return { canSchedule: true, canSubstitute: true, isExecutive: true };
        return TT.permOf(u.id);
    };

    /* ป้ายบทบาทสำหรับแสดงผล */
    TT.roleLabel = function () {
        const u = TT.state.user;
        if (!u) return '';
        if (u.role === 'admin') return TT.ROLE_LABELS.admin;
        const p = TT.currentPerm();
        const parts = [];
        if (p.canSchedule) parts.push(TT.ROLE_LABELS.scheduler);
        if (p.canSubstitute) parts.push(TT.ROLE_LABELS.substitute);
        if (p.isExecutive) parts.push(TT.ROLE_LABELS.executive);
        return parts.length ? parts.join(' · ') : TT.ROLE_LABELS.teacher;
    };

    /* ตรวจสิทธิ์รายความสามารถ ใช้คุมทั้งเมนูและปุ่มทำงาน */
    TT.can = function (what) {
        const u = TT.state.user;
        if (!u) return false;
        const admin = u.role === 'admin';
        const p = TT.currentPerm();
        switch (what) {
            case 'admin': return admin;
            case 'manageUsers': return admin;                       // กำหนดสิทธิ์ผู้อื่น = แอดมินเท่านั้น
            case 'settings': return admin || p.canSchedule;
            case 'baseData': return admin || p.canSchedule;
            case 'schedule': return admin || p.canSchedule;
            case 'substitute': return admin || p.canSchedule || p.canSubstitute;
            case 'approve': return admin || p.isExecutive;
            case 'viewAll': return admin || p.canSchedule || p.canSubstitute || p.isExecutive;
            default: return false;
        }
    };

    /* --------------------------------------------------- ข้อมูลครู/ห้องเรียน/วิชา */

    /* ครูหนึ่งคน = ข้อมูลจากระบบคะแนน + ข้อมูลเสริมของระบบตาราง */
    TT.teachers = function () {
        const core = TT.state.core || {};
        const meta = (TT.state.settings && TT.state.settings.teacherMeta) || {};
        return (core.teachers || []).map(t => {
            const m = meta[t.id] || {};
            return {
                id: t.id,
                name: t.name || 'ครู',
                picUrl: t.picUrl || '',
                code: m.code || '',
                position: m.position || 'ครู',
                dept: m.dept || '',
                major: m.major || '',
                canTeachSubjects: Array.isArray(m.canTeachSubjects) ? m.canTeachSubjects : [],
                canTeachGrades: Array.isArray(m.canTeachGrades) ? m.canTeachGrades : [],
                homeRoom: m.homeRoom || '',
                building: m.building || '',
                minPeriods: Number(m.minPeriods || 0),
                maxPeriods: Number(m.maxPeriods || 0),
                unavailable: Array.isArray(m.unavailable) ? m.unavailable : [],
                phone: m.phone || '',
                email: m.email || '',
                status: m.status || 'active',
                assignments: t.assignments || {},
                homeroomClasses: t.homeroomClasses || {}
            };
        });
    };

    TT.teacher = function (id) {
        return TT.teachers().find(t => String(t.id) === String(id)) || null;
    };

    TT.teacherName = function (id) {
        const t = TT.teacher(id);
        return t ? t.name : '—';
    };

    /* ห้องเรียนที่ครูเป็นครูประจำชั้น ในภาคเรียนที่กำลังดู */
    TT.homeroomOf = function (teacherId) {
        const t = TT.teacher(teacherId);
        if (!t) return [];
        const hr = t.homeroomClasses;
        if (Array.isArray(hr)) return hr;
        const term = TT.state.settings ? TT.state.settings.activeTerm : '1';
        return Array.isArray(hr && hr[term]) ? hr[term] : [];
    };

    /* เรียงชื่อห้องแบบไทย : อ.1/1 → ป.1/1 → ป.1/2 → ป.2/1 */
    const gradeRank = (name) => {
        const s = String(name || '');
        const m = s.match(/(อ|อนุบาล|ป|ม)\.?\s*(\d+)\s*\/?\s*(\d+)?/);
        if (!m) return [9, 99, 99, s];
        const lvl = m[1] === 'ม' ? 3 : (m[1] === 'ป' ? 2 : 1);
        return [lvl, Number(m[2] || 0), Number(m[3] || 0), s];
    };

    TT.compareClassName = function (a, b) {
        const ra = gradeRank(a), rb = gradeRank(b);
        for (let i = 0; i < 3; i++) { if (ra[i] !== rb[i]) return ra[i] - rb[i]; }
        return String(a).localeCompare(String(b), 'th');
    };

    /* ระดับชั้นของห้อง เช่น "ป.1/2" → "ป.1" ใช้จัดกลุ่มและกำหนดคาบต่อสัปดาห์ */
    TT.gradeOf = function (className) {
        const m = String(className || '').match(/^\s*(อ|อนุบาล|ป|ม)\.?\s*(\d+)/);
        if (!m) return String(className || '').trim();
        const prefix = m[1] === 'อนุบาล' ? 'อ' : m[1];
        return prefix + '.' + m[2];
    };

    TT.classes = function () {
        const core = TT.state.core || {};
        const meta = (TT.state.settings && TT.state.settings.classMeta) || {};
        const rows = Object.keys(core.classes || {}).map(id => {
            const c = core.classes[id] || {};
            const m = meta[id] || {};
            return {
                id,
                name: c.name || id,
                grade: TT.gradeOf(c.name || id),
                studentCount: Array.isArray(c.students) ? c.students.length : 0,
                color: m.color || '',
                roomId: m.roomId || '',
                homeroomTeachers: TT.teachers().filter(t => TT.homeroomOf(t.id).includes(id)).map(t => t.id),
                active: m.active === false ? false : true
            };
        });
        rows.sort((a, b) => TT.compareClassName(a.name, b.name));
        return rows;
    };

    TT.classById = function (id) {
        return TT.classes().find(c => String(c.id) === String(id)) || null;
    };

    TT.className = function (id) {
        const c = TT.classById(id);
        return c ? c.name : '—';
    };

    TT.grades = function () {
        const set = [];
        TT.classes().forEach(c => { if (!set.includes(c.grade)) set.push(c.grade); });
        set.sort(TT.compareClassName);
        return set;
    };

    TT.subjects = function () {
        const core = TT.state.core || {};
        const meta = (TT.state.settings && TT.state.settings.subjectMeta) || {};
        return (core.subjects || []).map((s, i) => {
            const m = meta[s.id] || {};
            return {
                id: s.id,
                code: s.code || '',
                name: s.name || 'รายวิชา',
                short: m.short || (s.name || '').slice(0, 6),
                dept: m.dept || '',
                color: m.color || TT.COLORS[i % TT.COLORS.length],
                grades: Array.isArray(m.grades) ? m.grades : [],
                periodsPerWeek: m.periodsPerWeek || {},   // { 'ป.1': 4 }
                doublePeriod: !!m.doublePeriod,
                noAdjacent: !!m.noAdjacent,
                roomId: m.roomId || '',
                isCore: m.isCore === undefined ? TT.defaultRules().coreSubjects.includes(m.dept || '') : !!m.isCore,
                headName: s.headName || ''
            };
        });
    };

    TT.subject = function (id) {
        return TT.subjects().find(s => String(s.id) === String(id)) || null;
    };

    TT.subjectName = function (id) {
        const s = TT.subject(id);
        return s ? s.name : '—';
    };

    TT.rooms = function () {
        return ((TT.state.settings && TT.state.settings.rooms) || []).slice();
    };

    TT.room = function (id) {
        return TT.rooms().find(r => String(r.id) === String(id)) || null;
    };

    TT.roomName = function (id) {
        const r = TT.room(id);
        return r ? r.name : '';
    };

    /* วันเรียนและคาบที่เปิดใช้งาน */
    TT.days = function () {
        return ((TT.state.settings && TT.state.settings.days) || []).filter(d => d.active !== false);
    };

    TT.allPeriods = function () {
        return ((TT.state.settings && TT.state.settings.periods) || []).slice();
    };

    /* เฉพาะคาบที่จัดวิชาลงได้จริง */
    TT.periods = function () {
        return TT.allPeriods().filter(p => p.type === 'class');
    };

    TT.period = function (id) {
        return TT.allPeriods().find(p => String(p.id) === String(id)) || null;
    };

    TT.periodLabel = function (id) {
        const p = TT.period(id);
        return p ? p.label : '';
    };

    TT.dayName = function (id) {
        const d = (TT.state.settings.days || []).find(x => x.id === id);
        return d ? d.name : (TT.DAY_NAMES[id] || id);
    };

    /* ------------------------------------------------------------ ตาราง (plan) */

    TT.entries = function () {
        return (TT.state.plan && TT.state.plan.entries) || [];
    };

    TT.allocations = function () {
        return (TT.state.plan && TT.state.plan.allocations) || [];
    };

    TT.entryAt = function (classId, day, periodId) {
        return TT.entries().find(e =>
            String(e.classId) === String(classId) &&
            e.day === day && e.periodId === periodId) || null;
    };

    TT.entriesOfTeacher = function (teacherId) {
        return TT.entries().filter(e =>
            String(e.teacherId) === String(teacherId) ||
            (Array.isArray(e.coTeacherIds) && e.coTeacherIds.map(String).includes(String(teacherId))));
    };

    /* ------------------------------------------------------------ การบันทึกข้อมูล */

    const docIdPlan = () => 'plan__' + TT.state.settings.activeYear + '__' + TT.state.settings.activeTerm;
    const docIdOps = () => 'ops__' + TT.state.settings.activeYear + '__' + TT.state.settings.activeTerm;
    TT.docIdPlan = docIdPlan;
    TT.docIdOps = docIdOps;

    const timers = {};
    const queueSave = (key, fn, delay) => {
        if (timers[key]) clearTimeout(timers[key]);
        timers[key] = setTimeout(() => { timers[key] = null; fn(); }, delay === undefined ? 700 : delay);
    };

    /* ในโหมดข้อมูลตัวอย่าง ทุกการบันทึกจะเก็บไว้ในเครื่องเท่านั้น ไม่ส่งขึ้นคลาวด์ */
    const demoSave = function () {
        if (window.TTSeed && TTSeed.persist) TTSeed.persist();
        return true;
    };

    /* บันทึกทันที (ใช้กับปุ่มที่ผู้ใช้กดเอง) */
    TT.saveSettingsNow = async function () {
        TT.state.settings.updatedAt = Date.now();
        if (TT.state.demo) return demoSave();
        TT.cacheLocal();
        await window.ttCloud.save('settings', TT.state.settings, { kind: 'settings' });
    };

    TT.savePlanNow = async function () {
        if (!TT.state.plan) return;
        TT.state.plan.updatedAt = Date.now();
        if (TT.state.demo) return demoSave();
        TT.cacheLocal();
        await window.ttCloud.save(docIdPlan(), TT.state.plan, {
            kind: 'plan',
            year: String(TT.state.settings.activeYear),
            term: String(TT.state.settings.activeTerm)
        });
    };

    TT.saveOpsNow = async function () {
        if (!TT.state.ops) return;
        TT.state.ops.updatedAt = Date.now();
        if (TT.state.demo) return demoSave();
        TT.cacheLocal();
        await window.ttCloud.save(docIdOps(), TT.state.ops, {
            kind: 'ops',
            year: String(TT.state.settings.activeYear),
            term: String(TT.state.settings.activeTerm)
        });
    };

    /* บันทึกแบบหน่วงเวลา (ใช้กับการลากวางหรือพิมพ์ต่อเนื่อง) */
    TT.saveSettings = function (delay) { queueSave('settings', () => TT.saveSettingsNow().catch(errToast), delay); };
    TT.savePlan = function (delay) { queueSave('plan', () => TT.savePlanNow().catch(errToast), delay); };
    TT.saveOps = function (delay) { queueSave('ops', () => TT.saveOpsNow().catch(errToast), delay); };

    const errToast = (e) => {
        console.error(e);
        if (window.TTUI && TTUI.notify) TTUI.notify('บันทึกขึ้นคลาวด์ไม่สำเร็จ ระบบเก็บไว้ในเครื่องแล้ว', 'error');
    };

    /* สำเนาไว้ในเครื่อง กันข้อมูลหายเมื่อเน็ตหลุด */
    TT.cacheLocal = function () {
        try {
            localStorage.setItem('anp_tt_cache', JSON.stringify({
                settings: TT.state.settings,
                plan: TT.state.plan,
                ops: TT.state.ops,
                at: Date.now()
            }));
        } catch (e) { /* พื้นที่เต็ม — ข้ามไป ไม่ให้กระทบการใช้งาน */ }
    };

    TT.readLocalCache = function () {
        try { return JSON.parse(localStorage.getItem('anp_tt_cache') || 'null'); } catch (e) { return null; }
    };

    /* ------------------------------------------------------------- ประวัติการแก้ไข */

    TT.log = function (action, detail) {
        const u = TT.state.user || {};
        if (TT.state.demo) return { action, detail };   // โหมดตัวอย่างไม่บันทึกประวัติขึ้นคลาวด์
        return window.ttCloud.log({
            action,
            detail: detail || '',
            actorId: u.id || '',
            actorName: u.name || (u.role === 'admin' ? 'ผู้ดูแลระบบ' : ''),
            role: u.role || '',
            year: TT.state.settings ? TT.state.settings.activeYear : '',
            term: TT.state.settings ? TT.state.settings.activeTerm : ''
        });
    };

    /* --------------------------------------------------------- ย้อนกลับ/ทำซ้ำตาราง */

    TT.pushUndo = function (label) {
        if (!TT.state.plan) return;
        TT.state.undoStack.push({ label, entries: TT.clone(TT.state.plan.entries) });
        if (TT.state.undoStack.length > 40) TT.state.undoStack.shift();
        TT.state.redoStack.length = 0;
    };

    TT.undo = function () {
        if (!TT.state.undoStack.length) return false;
        const prev = TT.state.undoStack.pop();
        TT.state.redoStack.push({ label: prev.label, entries: TT.clone(TT.state.plan.entries) });
        TT.state.plan.entries = prev.entries;
        TT.savePlan(200);
        return true;
    };

    TT.redo = function () {
        if (!TT.state.redoStack.length) return false;
        const next = TT.state.redoStack.pop();
        TT.state.undoStack.push({ label: next.label, entries: TT.clone(TT.state.plan.entries) });
        TT.state.plan.entries = next.entries;
        TT.savePlan(200);
        return true;
    };

    /* ------------------------------------------------------------- การแจ้งเตือน */

    TT.notifyUsers = function (targetIds, title, message, link) {
        if (!TT.state.ops) return;
        const list = Array.isArray(targetIds) ? targetIds : [targetIds];
        list.filter(Boolean).forEach(id => {
            TT.state.ops.notifications.unshift({
                id: TT.uid('nt'),
                to: String(id),
                title, message,
                link: link || '',
                read: false,
                at: Date.now()
            });
        });
        /* เก็บเฉพาะ 300 รายการล่าสุด ไม่ให้เอกสารโตเกินจำเป็น */
        if (TT.state.ops.notifications.length > 300) TT.state.ops.notifications.length = 300;
        TT.saveOps(400);
    };

    TT.myNotifications = function () {
        const u = TT.state.user;
        if (!u || !TT.state.ops) return [];
        const mine = u.role === 'admin' ? 'admin' : String(u.id);
        return (TT.state.ops.notifications || []).filter(n => String(n.to) === mine || n.to === 'all');
    };

    /* ---------------------------------------------------------------- โหลดข้อมูล */

    /* เติมค่าที่ขาดให้ครบ เผื่อข้อมูลเก่าถูกบันทึกไว้ก่อนจะมีฟิลด์ใหม่ */
    const fillSettings = (s) => {
        const d = TT.defaultSettings();
        const out = Object.assign({}, d, s || {});
        out.rules = Object.assign({}, d.rules, (s && s.rules) || {});
        out.rules.weights = Object.assign({}, d.rules.weights, ((s && s.rules && s.rules.weights) || {}));
        out.school = Object.assign({}, d.school, (s && s.school) || {});
        ['days', 'periods', 'rooms'].forEach(k => {
            if (!Array.isArray(out[k]) || !out[k].length) out[k] = d[k];
        });
        ['classMeta', 'teacherMeta', 'subjectMeta', 'permissions'].forEach(k => {
            if (!out[k] || typeof out[k] !== 'object') out[k] = {};
        });
        if (!Array.isArray(out.years) || !out.years.length) out.years = d.years;
        return out;
    };

    TT.loadAll = async function () {
        /* โหมดข้อมูลตัวอย่าง : ใช้ชุดข้อมูลในเครื่อง ไม่แตะข้อมูลจริง */
        const demo = window.TTSeed && TTSeed.isOn() ? TTSeed.load() : null;
        if (demo && demo.core) {
            TT.state.demo = true;
            TT.state.core = demo.core;
            TT.state.settings = fillSettings(demo.settings);
            TT.state.plan = demo.plan || TT.emptyPlan('ตัวอย่าง', '1');
            TT.state.ops = demo.ops || TT.emptyOps('ตัวอย่าง', '1');
            TT.state.loading = false;
            return;
        }

        await window.ttCloud.connect();
        const [core, settings] = await Promise.all([
            window.ttCloud.loadCore(),
            window.ttCloud.load('settings')
        ]);
        TT.state.core = core || { teachers: [], classes: {}, subjects: [], schoolInfo: {} };
        TT.state.settings = fillSettings(settings);

        /* ปีการศึกษา/ภาคเรียนตั้งต้น ให้ตรงกับระบบคะแนนถ้ายังไม่เคยตั้งค่า */
        const info = TT.state.core.schoolInfo || {};
        if (!settings && info.year) {
            TT.state.settings.activeYear = String(info.year);
            TT.state.settings.activeTerm = String(info.term || '1');
            TT.state.settings.years = [{
                year: String(info.year),
                terms: { '1': { start: '', end: '', status: 'open' }, '2': { start: '', end: '', status: 'open' } }
            }];
        }
        if (info.name) TT.state.settings.school.name = info.name;
        if (info.director) TT.state.settings.school.director = info.director;
        if (info.academicHead) TT.state.settings.school.academicHead = info.academicHead;
        if (info.logo) TT.state.settings.school.logo = info.logo;

        await TT.loadTermData();
        TT.state.loading = false;
        TT.cacheLocal();
    };

    /* โหลดตารางและงานสอนแทนของปี/ภาคที่เลือก (เรียกซ้ำได้เมื่อสลับภาคเรียน) */
    TT.loadTermData = async function () {
        if (TT.state.demo) {
            /* โหมดตัวอย่างมีเพียงชุดเดียว จึงไม่ต้องโหลดใหม่ */
            if (!TT.state.plan) TT.state.plan = TT.emptyPlan(TT.state.settings.activeYear, TT.state.settings.activeTerm);
            if (!TT.state.ops) TT.state.ops = TT.emptyOps(TT.state.settings.activeYear, TT.state.settings.activeTerm);
            return;
        }
        const [plan, ops] = await Promise.all([
            window.ttCloud.load(docIdPlan()),
            window.ttCloud.load(docIdOps())
        ]);
        const y = TT.state.settings.activeYear, t = TT.state.settings.activeTerm;
        TT.state.plan = plan || TT.emptyPlan(y, t);
        TT.state.ops = ops || TT.emptyOps(y, t);
        if (!Array.isArray(TT.state.plan.allocations)) TT.state.plan.allocations = [];
        if (!Array.isArray(TT.state.plan.entries)) TT.state.plan.entries = [];
        ['leaves', 'substitutes', 'notifications'].forEach(k => {
            if (!Array.isArray(TT.state.ops[k])) TT.state.ops[k] = [];
        });
        TT.state.undoStack.length = 0;
        TT.state.redoStack.length = 0;
    };

    /* คัดลอกโครงสร้างจากภาคเรียนก่อนหน้า (วิชา คาบ ครูผู้สอน) */
    TT.copyFromTerm = async function (fromYear, fromTerm, includeEntries) {
        const src = await window.ttCloud.load('plan__' + fromYear + '__' + fromTerm);
        if (!src) return { ok: false, message: 'ไม่พบตารางของภาคเรียนที่เลือก' };
        TT.state.plan.allocations = TT.clone(src.allocations || []).map(a => Object.assign({}, a, { id: TT.uid('al') }));
        if (includeEntries) {
            TT.state.plan.entries = TT.clone(src.entries || []).map(e => Object.assign({}, e, { id: TT.uid('en') }));
        }
        TT.state.plan.status = 'draft';
        await TT.savePlanNow();
        TT.log('copy_term', 'คัดลอกจากปี ' + fromYear + ' ภาค ' + fromTerm);
        return { ok: true, message: 'คัดลอกข้อมูลเรียบร้อย' };
    };

    /* วันที่ไทยแบบสั้น ใช้ทั่วทั้งระบบ */
    TT.thaiDate = function (input) {
        if (!input) return '—';
        const d = (input instanceof Date) ? input : new Date(input);
        if (isNaN(d.getTime())) return String(input);
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    };

    TT.thaiDateTime = function (input) {
        if (!input) return '—';
        const d = (input instanceof Date) ? input : new Date(input);
        if (isNaN(d.getTime())) return String(input);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return TT.thaiDate(d) + ' ' + hh + ':' + mm + ' น.';
    };

    /* วันในสัปดาห์ของวันที่หนึ่ง ๆ → รหัสวัน (mon…sun) ใช้จับคู่การลากับตาราง */
    TT.dayIdOfDate = function (dateStr) {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()];
    };

    TT.datesBetween = function (from, to) {
        const out = [];
        const a = new Date(from), b = new Date(to || from);
        if (isNaN(a.getTime())) return out;
        for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
            out.push(new Date(d).toISOString().slice(0, 10));
        }
        return out;
    };
})();
