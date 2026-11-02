/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — ข้อมูลตัวอย่างสำหรับทดสอบระบบ

   โหมดข้อมูลตัวอย่างทำงานแยกจากข้อมูลจริงทั้งหมด
     - ครู ห้องเรียน รายวิชา ถูกสร้างขึ้นในหน่วยความจำ ไม่เขียนลงระบบคะแนน
     - ตารางสอน การลา และงานสอนแทน เก็บไว้ในเครื่อง (localStorage) ไม่ขึ้นคลาวด์
   จึงทดลองใช้ได้ทุกฟังก์ชันโดยไม่กระทบข้อมูลของโรงเรียน
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT;
    const UI = window.TTUI;
    const S = window.TTSeed = {};

    const DEMO_KEY = 'anp_tt_demo';

    const TEACHER_NAMES = [
        ['นางสาวสุภาพร ใจงาม', 'ภาษาไทย', 'ภาษาไทย'],
        ['นายวิทยา ก้าวหน้า', 'คณิตศาสตร์', 'คณิตศาสตร์'],
        ['นางมาลี ศรีทอง', 'วิทยาศาสตร์และเทคโนโลยี', 'วิทยาศาสตร์'],
        ['นายสมชาย พงษ์ไพร', 'สังคมศึกษา ศาสนาและวัฒนธรรม', 'สังคมศึกษา'],
        ['นางสาวปาริชาต แก้วมณี', 'ภาษาต่างประเทศ', 'ภาษาอังกฤษ'],
        ['นายอนุชา ทองดี', 'สุขศึกษาและพลศึกษา', 'พลศึกษา'],
        ['นางสาวกมลวรรณ ดวงจันทร์', 'ศิลปะ', 'ทัศนศิลป์'],
        ['นายภาณุพงศ์ วงค์คำ', 'การงานอาชีพ', 'คอมพิวเตอร์'],
        ['นางอารีย์ สุขสวัสดิ์', 'ภาษาไทย', 'ภาษาไทย'],
        ['นายธนกฤต ปัญญาดี', 'คณิตศาสตร์', 'คณิตศาสตร์'],
        ['นางสาวจิราพร บุญมี', 'ปฐมวัย', 'ปฐมวัย'],
        ['นายเอกชัย รักเรียน', 'วิทยาศาสตร์และเทคโนโลยี', 'วิทยาศาสตร์']
    ];

    const SUBJECT_DEFS = [
        ['ท1110', 'ภาษาไทย', 'ไทย', 'ภาษาไทย', 5, true],
        ['ค1110', 'คณิตศาสตร์', 'คณิต', 'คณิตศาสตร์', 5, true],
        ['ว1110', 'วิทยาศาสตร์และเทคโนโลยี', 'วิทย์', 'วิทยาศาสตร์และเทคโนโลยี', 3, true],
        ['ส1110', 'สังคมศึกษา', 'สังคม', 'สังคมศึกษา ศาสนาและวัฒนธรรม', 2, false],
        ['ส1120', 'ประวัติศาสตร์', 'ประวัติ', 'สังคมศึกษา ศาสนาและวัฒนธรรม', 1, false],
        ['พ1110', 'สุขศึกษาและพลศึกษา', 'สุขศึกษา', 'สุขศึกษาและพลศึกษา', 2, false],
        ['ศ1110', 'ศิลปะ', 'ศิลปะ', 'ศิลปะ', 1, false],
        ['ง1110', 'การงานอาชีพ', 'การงาน', 'การงานอาชีพ', 1, false],
        ['อ1110', 'ภาษาอังกฤษ', 'อังกฤษ', 'ภาษาต่างประเทศ', 3, true],
        ['ว1120', 'วิทยาการคำนวณ', 'คอม', 'วิทยาศาสตร์และเทคโนโลยี', 1, false]
    ];

    /* ---------------------------------------------------------- สร้างชุดข้อมูล */

    const buildCore = function () {
        const teachers = TEACHER_NAMES.map((t, i) => ({
            id: 'demo_t' + (i + 1),
            name: t[0],
            password: '1234',
            picUrl: '',
            assignments: { '1': {}, '2': {} },
            homeroomClasses: { '1': [], '2': [] }
        }));

        const classes = {};
        for (let g = 1; g <= 6; g++) {
            for (let r = 1; r <= 2; r++) {
                const id = 'demo_c' + g + r;
                classes[id] = {
                    name: 'ป.' + g + '/' + r,
                    students: Array.from({ length: 18 + ((g + r) % 6) }, (_, k) => ({
                        studentId: String(g) + String(r) + String(k + 1).padStart(2, '0'),
                        name: 'นักเรียนตัวอย่าง ' + (k + 1)
                    }))
                };
            }
        }
        /* ครูประจำชั้น : กระจายให้ครู 12 ห้อง */
        Object.keys(classes).forEach((cid, i) => {
            const t = teachers[i % teachers.length];
            t.homeroomClasses['1'].push(cid);
            t.homeroomClasses['2'].push(cid);
        });

        const subjects = SUBJECT_DEFS.map((s, i) => ({
            id: 'demo_s' + (i + 1), code: s[0], name: s[1], headName: ''
        }));

        return {
            teachers, classes, subjects,
            schoolInfo: {
                name: TT.SCHOOL.name, director: TT.SCHOOL.director,
                academicHead: 'นางสาวสุภาพร ใจงาม', year: 'ตัวอย่าง', term: '1'
            }
        };
    };

    const buildSettings = function (core) {
        const s = TT.defaultSettings();
        s.activeYear = 'ตัวอย่าง';
        s.activeTerm = '1';
        s.years = [{ year: 'ตัวอย่าง', terms: { '1': { start: '2026-05-16', end: '2026-10-10', status: 'open' }, '2': { start: '2026-11-01', end: '2027-03-31', status: 'open' } } }];
        s.school = Object.assign({}, TT.SCHOOL, { academicHead: 'นางสาวสุภาพร ใจงาม' });

        core.teachers.forEach((t, i) => {
            const def = TEACHER_NAMES[i] || [];
            s.teacherMeta[t.id] = {
                code: 'T' + String(i + 1).padStart(3, '0'),
                position: i === 0 ? 'ครูชำนาญการ' : 'ครู',
                dept: def[1] || '',
                major: def[2] || '',
                building: i % 2 ? 'อาคาร 2' : 'อาคาร 1',
                minPeriods: 12,
                /* ตั้งเพดานของครูสองท่านแรกไว้ต่ำ เพื่อให้เห็นตัวอย่างครูที่ภาระงานเกินเกณฑ์ */
                maxPeriods: i < 2 ? 20 : 26,
                phone: '08' + (10000000 + i * 111111),
                email: 'teacher' + (i + 1) + '@anp.ac.th',
                status: 'active',
                canTeachSubjects: [],
                canTeachGrades: [],
                /* ตัวอย่างครูที่ไม่สะดวกสอนบ่ายวันศุกร์ */
                unavailable: i === 5 ? [{ day: 'fri', periodId: 'p6' }] : []
            };
        });

        core.subjects.forEach((sub, i) => {
            const def = SUBJECT_DEFS[i];
            const ppw = {};
            ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'].forEach(g => { ppw[g] = def[4]; });
            s.subjectMeta[sub.id] = {
                short: def[2], dept: def[3], color: TT.COLORS[i % TT.COLORS.length],
                periodsPerWeek: ppw,
                doublePeriod: def[1] === 'สุขศึกษาและพลศึกษา',
                noAdjacent: false,
                roomId: def[1] === 'วิทยาการคำนวณ' ? 'rm_comp'
                    : (def[1] === 'วิทยาศาสตร์และเทคโนโลยี' ? '' : (def[1] === 'สุขศึกษาและพลศึกษา' ? 'rm_sport' : '')),
                isCore: def[5]
            };
        });

        /* ตัวอย่างการกำหนดสิทธิ์ : ครูคนที่ 1 เป็นผู้จัดตาราง ครูคนที่ 4 เป็นผู้บริหาร */
        s.permissions[core.teachers[0].id] = { canSchedule: true, canSubstitute: true, isExecutive: false };
        s.permissions[core.teachers[3].id] = { canSchedule: false, canSubstitute: true, isExecutive: true };
        return s;
    };

    const buildPlan = function (core) {
        const plan = TT.emptyPlan('ตัวอย่าง', '1');
        const classIds = Object.keys(core.classes);

        classIds.forEach((cid, ci) => {
            core.subjects.forEach((sub, si) => {
                const def = SUBJECT_DEFS[si];
                /* ห้องสุดท้ายตั้งใจให้จัดไม่ครบ เพื่อทดสอบการแจ้งเตือนคาบขาด */
                const teacher = core.teachers[(ci + si) % core.teachers.length];
                plan.allocations.push({
                    id: TT.uid('al'),
                    classId: cid,
                    subjectId: sub.id,
                    teacherId: teacher.id,
                    coTeacherIds: [],
                    periodsPerWeek: def[4],
                    doublePeriod: def[1] === 'สุขศึกษาและพลศึกษา',
                    roomId: def[1] === 'วิทยาการคำนวณ' ? 'rm_comp' : '',
                    preferDays: [], avoidDays: [], note: ''
                });
            });
        });
        return plan;
    };

    /* --------------------------------------------------------------- เปิด/ปิด */

    S.open = function () {
        const on = S.isOn();
        UI.modal('ข้อมูลตัวอย่างสำหรับทดสอบระบบ', `
            <div class="space-y-4">
                <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 font-semibold leading-relaxed">
                    <i class="ph ph-flask mr-1"></i> โหมดนี้สร้างข้อมูลจำลองไว้ในเครื่องของท่านเท่านั้น
                    <b>ไม่มีการเขียนทับข้อมูลจริงของโรงเรียน</b> และไม่ส่งขึ้นคลาวด์
                    เมื่อออกจากโหมดตัวอย่าง ระบบจะกลับมาใช้ข้อมูลจริงทันที
                </div>
                <div>
                    <div class="font-extrabold text-slate-800 mb-2">ข้อมูลที่จะถูกสร้าง</div>
                    <ul class="text-sm text-slate-600 font-semibold space-y-1 list-disc list-inside">
                        <li>ครูผู้สอน 12 ท่าน พร้อมกลุ่มสาระและวิชาเอก</li>
                        <li>ระดับชั้น ป.1–ป.6 ระดับชั้นละ 2 ห้อง รวม 12 ห้องเรียน</li>
                        <li>รายวิชาหลักและรายวิชาเพิ่มเติม 10 รายวิชา</li>
                        <li>ตารางเรียนตัวอย่าง 1 สัปดาห์ (จัดโดยระบบอัตโนมัติ)</li>
                        <li>ตัวอย่างคาบชนกัน 1 จุด และห้องที่จัดคาบไม่ครบ 1 ห้อง</li>
                        <li>ครูลา 2 กรณี พร้อมรายการค้นหาและมอบหมายครูสอนแทน</li>
                    </ul>
                </div>
                ${on ? `<div class="p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800 font-bold">
                    <i class="ph ph-info mr-1"></i> ขณะนี้ระบบกำลังอยู่ในโหมดข้อมูลตัวอย่าง
                </div>` : ''}
            </div>`, {
            width: 'max-w-xl',
            footer: on
                ? `<button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ปิด</button>
                   <button id="btn-seed-off" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-rose-600 shadow-lg">ออกจากโหมดตัวอย่าง</button>`
                : `<button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ยกเลิก</button>
                   <button id="btn-seed-on" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white accent-gradient shadow-lg">สร้างข้อมูลตัวอย่าง</button>`,
            onOpen: () => {
                const on1 = document.getElementById('btn-seed-on');
                if (on1) on1.onclick = () => S.enable();
                const off = document.getElementById('btn-seed-off');
                if (off) off.onclick = () => S.disable();
            }
        });
    };

    S.isOn = function () {
        try { return !!JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) { return false; }
    };

    S.enable = function () {
        UI.notify('กำลังสร้างข้อมูลตัวอย่าง...', 'info');

        const core = buildCore();
        const settings = buildSettings(core);
        const plan = buildPlan(core);
        const ops = TT.emptyOps('ตัวอย่าง', '1');

        /* สลับสถานะไปใช้ข้อมูลตัวอย่างชั่วคราว เพื่อให้เครื่องมือคำนวณทำงานกับชุดนี้ */
        const backup = { core: TT.state.core, settings: TT.state.settings, plan: TT.state.plan, ops: TT.state.ops };
        TT.state.core = core;
        TT.state.settings = settings;
        TT.state.plan = plan;
        TT.state.ops = ops;

        const classIds = Object.keys(core.classes);

        /* วางคาบกิจกรรมลูกเสือ–เนตรนารี (บ่ายวันพฤหัสบดี) ก่อนเป็นอันดับแรกและล็อกไว้
           ครูผู้ดูแลใช้ครูประจำชั้นของห้องนั้น เพื่อไม่ให้ครูคนเดียวถูกจัดหลายห้องพร้อมกัน
           จากนั้นจึงให้ระบบจัดวิชาลงในช่องที่เหลือ */
        plan.entries = classIds.map(cid => {
            const homeroom = core.teachers.find(t => (t.homeroomClasses['1'] || []).includes(cid));
            return {
                id: TT.uid('en'), classId: cid, subjectId: '', teacherId: homeroom ? homeroom.id : '',
                coTeacherIds: [], roomId: '', day: 'thu', periodId: 'p6',
                locked: true, kind: 'activity', label: 'ลูกเสือ–เนตรนารี'
            };
        });

        /* จัดตารางอัตโนมัติให้ทุกห้อง ยกเว้นห้องสุดท้ายที่ตั้งใจให้จัดไม่ครบ */
        const scope = classIds.slice(0, classIds.length - 1);
        const result = window.TTEngine.autoGenerate({ classIds: scope, attempts: 6 });
        plan.entries = result.entries;

        /* ห้องสุดท้าย : จัดเพียงบางส่วน เพื่อให้เห็นสถานะ "ยังขาดคาบ" */
        const lastClass = classIds[classIds.length - 1];
        const partial = window.TTEngine.autoGenerate({ classIds: [lastClass], attempts: 2 });
        const lastEntries = partial.entries.filter(e => String(e.classId) === String(lastClass) && e.kind !== 'activity').slice(0, 8);
        plan.entries = plan.entries.concat(lastEntries);

        /* ตัวอย่างคาบชนกัน : ให้ครูคนเดียวสอนสองห้องในคาบเดียวกัน */
        const sample = plan.entries.find(e => e.kind !== 'activity' && e.day === 'mon' && e.periodId === 'p1');
        const other = plan.entries.find(e => e.kind !== 'activity' && e.day === 'mon' && e.periodId === 'p1' &&
            String(e.classId) !== String(sample && sample.classId));
        if (sample && other) other.teacherId = sample.teacherId;

        /* กรณีลา 2 กรณี พร้อมรายการสอนแทนที่ระบบตรวจพบ */
        const day1 = nextWeekday('mon'), day2 = nextWeekday('wed');
        const leaves = [
            {
                id: TT.uid('lv'), teacherId: core.teachers[1].id, type: 'sick',
                from: day1, to: day1, allDay: true, periodIds: [],
                reason: 'มีไข้สูง พักรักษาตัวตามคำแนะนำแพทย์', attachment: '', deputy: '', note: '',
                status: 'active', createdAt: Date.now(), createdBy: core.teachers[1].id
            },
            {
                id: TT.uid('lv'), teacherId: core.teachers[4].id, type: 'official',
                from: day2, to: day2, allDay: false, periodIds: ['p1', 'p2', 'p3'],
                reason: 'ไปราชการ ประชุมวิชาการระดับเขตพื้นที่การศึกษา', attachment: '', deputy: '', note: '',
                status: 'active', createdAt: Date.now(), createdBy: core.teachers[4].id
            }
        ];
        ops.leaves = leaves;
        leaves.forEach(l => {
            window.TTEngine.periodsNeedingCover(l).forEach(c => {
                ops.substitutes.push({
                    id: TT.uid('sb'), leaveId: l.id, teacherId: l.teacherId,
                    date: c.date, day: c.day, periodId: c.periodId,
                    classId: c.classId, subjectId: c.subjectId, roomId: c.roomId,
                    substituteId: '', status: 'pending',
                    assignedAt: 0, assignedBy: '', acknowledgedAt: 0, declineReason: '',
                    history: [{ at: Date.now(), by: 'ระบบ', action: 'สร้างรายการจากการแจ้งลา' }]
                });
            });
        });

        /* มอบหมายครูสอนแทนให้สองคาบแรกอัตโนมัติ เพื่อให้เห็นครบทุกสถานะ */
        ops.substitutes.slice(0, 2).forEach((s, i) => {
            const best = window.TTEngine.bestSubstitute(s);
            if (!best) return;
            s.substituteId = best.teacherId;
            s.status = i === 0 ? 'accepted' : 'awaiting';
            s.assignedAt = Date.now();
            s.assignedBy = 'ระบบตัวอย่าง';
            if (i === 0) s.acknowledgedAt = Date.now();
            s.history.push({ at: Date.now(), by: 'ระบบตัวอย่าง', action: 'มอบหมายให้ ' + best.name });
        });

        try {
            localStorage.setItem(DEMO_KEY, JSON.stringify({ core, settings, plan, ops, at: Date.now() }));
        } catch (e) {
            /* กลับไปใช้ข้อมูลจริงถ้าพื้นที่ในเครื่องไม่พอ */
            TT.state.core = backup.core; TT.state.settings = backup.settings;
            TT.state.plan = backup.plan; TT.state.ops = backup.ops;
            UI.notify('พื้นที่จัดเก็บในเครื่องไม่พอสำหรับข้อมูลตัวอย่าง', 'error');
            return;
        }

        UI.notify('สร้างข้อมูลตัวอย่างแล้ว กำลังเปิดโหมดตัวอย่าง');
        setTimeout(() => location.reload(), 700);
    };

    S.disable = function () {
        try { localStorage.removeItem(DEMO_KEY); } catch (e) { }
        UI.notify('ออกจากโหมดตัวอย่าง กำลังกลับไปใช้ข้อมูลจริง');
        setTimeout(() => location.reload(), 600);
    };

    S.load = function () {
        try { return JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) { return null; }
    };

    S.persist = function () {
        try {
            localStorage.setItem(DEMO_KEY, JSON.stringify({
                core: TT.state.core, settings: TT.state.settings,
                plan: TT.state.plan, ops: TT.state.ops, at: Date.now()
            }));
        } catch (e) { console.warn('บันทึกข้อมูลตัวอย่างไม่สำเร็จ', e); }
    };

    /* วันถัดไปในสัปดาห์หน้าที่ตรงกับวันที่ต้องการ ใช้สร้างตัวอย่างการลา */
    const nextWeekday = function (dayId) {
        const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
        const want = map[dayId];
        const d = new Date();
        let guard = 0;
        while (d.getDay() !== want && guard++ < 10) d.setDate(d.getDate() + 1);
        if (d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)) d.setDate(d.getDate() + 7);
        return d.toISOString().slice(0, 10);
    };
})();
