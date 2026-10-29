/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — นำเข้าตารางสอนจากไฟล์ Excel

   รองรับไฟล์ของโปรแกรม "จัดตารางสอนด้วย Microsoft Excel" (.xlsm/.xlsx)
   ที่โรงเรียนใช้จัดตารางอยู่แล้ว โดยอ่านจากชีตเหล่านี้

       ตารางเวลา            คาบที่ / เวลาเริ่ม / เวลาสิ้นสุด
       ชั้นเรียน            รหัสชั้นของไฟล์ → ชื่อห้อง
       ครูผู้สอน            รหัสครูของไฟล์ → ชื่อ-นามสกุล
       วิชาเรียน            รหัสวิชาของไฟล์ → ชื่อวิชา
       ลงทะเบียนวิชาเรียน   ครู × ห้อง × วิชา
       ข้อมูลตารางสอน       วัน / คาบ / วิชาหรือกิจกรรม / ครู / ห้อง

   ไฟล์ใช้รหัสของตัวเอง (P101, T001, ท11101) ซึ่งไม่ตรงกับรหัสของ ANPSCORE
   ตัวนำเข้าจึงจับคู่ด้วย "ชื่อ" แล้วนำเข้าเฉพาะแถวที่จับคู่ได้ครบ
   ส่วนที่จับคู่ไม่ได้จะไม่ถูกเดาให้ แต่จะรายงานให้ผู้ใช้เห็นก่อนยืนยันเสมอ
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT;
    const UI = window.TTUI;
    const P = window.TTPages = window.TTPages || {};

    const SHEET = {
        periods: 'ตารางเวลา',
        classes: 'ชั้นเรียน',
        teachers: 'ครูผู้สอน',
        subjects: 'วิชาเรียน',
        rooms: 'ห้องเรียน',
        activities: 'กิจกรรม',
        registration: 'ลงทะเบียนวิชาเรียน',
        timetable: 'ข้อมูลตารางสอน'
    };

    /* ชีตที่ขาดได้โดยยังนำเข้าต่อได้ ที่เหลือถือว่าไฟล์ผิดรูปแบบ */
    const OPTIONAL_SHEETS = ['rooms', 'activities', 'registration'];

    /* ------------------------------------------------------- ตัวช่วยอ่านข้อความ */

    /* ตัดช่องว่างทั้งหมดออก เพราะข้อมูลในไฟล์มีเว้นวรรคท้ายชื่อปนอยู่บ่อย */
    const norm = (s) => String(s === undefined || s === null ? '' : s).replace(/\s+/g, '');

    const rowsOf = function (wb, name) {
        const ws = wb.Sheets[name];
        if (!ws) return null;
        return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
    };

    /* "ประถมศึกษาปีที่ 1/1" และ "ป.1/1" ให้ค่าเดียวกันคือ "ป.1/1"
       ห้องที่ไม่มีเลขห้อง (เช่น "ประถมศึกษาปีที่ 6 พิเศษ") จะได้ค่าว่าง = จับคู่ไม่ได้ */
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

    /* ชื่อวันในไฟล์เป็นภาษาไทย แปลงกลับเป็นรหัสวันของระบบ */
    const dayIdByName = function () {
        const map = {};
        Object.keys(TT.DAY_NAMES).forEach(id => { map[norm(TT.DAY_NAMES[id])] = id; });
        return map;
    };

    /* ------------------------------------------------- จับคู่ข้อมูลหลักกับ ANPSCORE */

    /* คืนค่าเดียวเมื่อมีผู้สมัครที่เข้าเกณฑ์เพียงรายเดียวเท่านั้น
       ถ้ากำกวม (เข้าได้หลายรายการ) ถือว่าจับคู่ไม่ได้ ดีกว่าเดาผิด */
    const onlyOne = (list) => (list.length === 1 ? list[0] : null);

    /* รหัสประจำตัวที่คำนวณจากชื่อ ทำให้นำเข้าไฟล์เดิมซ้ำแล้วได้รหัสเดิมเสมอ
       และไม่ผูกกับรหัสภายในของไฟล์ ซึ่งเปลี่ยนได้เมื่อโรงเรียนสร้างไฟล์ใหม่ */
    const stableId = function (prefix, text) {
        const s = norm(text);
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
        return prefix + h.toString(36);
    };

    const buildClassIndex = function () {
        const index = new Map();
        TT.classes().forEach(c => {
            const key = classKey(c.name);
            if (key && !index.has(key)) index.set(key, c);
        });
        return index;
    };

    const buildTeacherMatcher = function () {
        const anp = TT.teachers().map(t => ({ ref: t, key: norm(t.name) }));
        return function (row) {
            const withTitle = norm(row.title) + norm(row.first) + norm(row.last);
            const fullName = norm(row.first) + norm(row.last);
            const firstName = norm(row.first);

            let hit = anp.filter(a => a.key === withTitle || a.key === fullName);
            if (hit.length) return onlyOne(hit);

            /* ANPSCORE เก็บคำนำหน้ารวมกับชื่อ จึงเทียบแบบลงท้ายด้วยชื่อ-นามสกุล */
            if (fullName) {
                hit = anp.filter(a => a.key.endsWith(fullName));
                if (hit.length) return onlyOne(hit);
            }
            /* ครูบางคนในไฟล์ไม่มีนามสกุล ใช้ชื่อต้นเทียบได้ถ้าไม่ซ้ำกับใคร */
            if (firstName.length > 2) {
                hit = anp.filter(a => a.key.indexOf(firstName) >= 0);
                if (hit.length) return onlyOne(hit);
            }
            return null;
        };
    };

    const buildSubjectMatcher = function () {
        const anp = TT.subjects().map(s => ({ ref: s, key: norm(s.name), code: norm(s.code) }));
        return function (row) {
            const name = norm(row.name);
            const code = norm(row.code);

            let hit = anp.filter(a => a.key === name);
            if (hit.length) return onlyOne(hit);

            if (code) {
                hit = anp.filter(a => a.code && a.code === code);
                if (hit.length) return onlyOne(hit);
            }
            /* ชื่อในไฟล์มักยาวกว่าของ ANPSCORE เช่น
               "สังคมศึกษา ศาสนาและวัฒนธรรม" กับ "สังคมศึกษา"
               ยอมรับได้เมื่อชื่อหนึ่งเป็นคำขึ้นต้นของอีกชื่อ และเข้าได้รายการเดียว */
            if (name) {
                hit = anp.filter(a => a.key && (name.indexOf(a.key) === 0 || a.key.indexOf(name) === 0));
                if (hit.length) return onlyOne(hit);
            }
            return null;
        };
    };

    /* ห้องประจำชั้นในไฟล์ไม่ต้องนำเข้า (ระบบใช้ "ห้องประจำ" อยู่แล้ว)
       จับคู่เฉพาะห้องพิเศษที่ชื่อตรงกับห้องในหน้าตั้งค่า */
    const buildRoomMatcher = function () {
        const rooms = TT.rooms().map(r => ({ ref: r, key: norm(r.name), short: norm(r.code) }));
        return function (fullName, shortName) {
            if (classKey(fullName) || classKey(shortName)) return null;
            const a = norm(fullName), b = norm(shortName);
            let hit = rooms.filter(r => r.key === a || r.key === b);
            if (hit.length) return onlyOne(hit);
            hit = rooms.filter(r => (a && r.key.indexOf(a) === 0) || (b && r.short && r.short === b));
            return onlyOne(hit);
        };
    };

    /* ------------------------------------------------------------- อ่านทั้งไฟล์ */

    /* แปลงไฟล์ทั้งเล่มเป็นแผนการนำเข้า ยังไม่แตะข้อมูลจริง */
    const buildImportPlan = function (wb) {
        const missingSheets = Object.keys(SHEET)
            .filter(k => OPTIONAL_SHEETS.indexOf(k) < 0)
            .map(k => SHEET[k])
            .filter(name => !wb.Sheets[name]);
        if (missingSheets.length) {
            throw new Error('ไฟล์นี้ไม่มีชีต ' + missingSheets.join(', '));
        }

        /* ---- คาบเวลา ---- */
        const periodRows = (rowsOf(wb, SHEET.periods) || []).slice(1)
            .filter(r => String(r[1] || '').trim() && String(r[2] || '').trim());
        const toClock = (v) => {
            const m = String(v || '').trim().replace(/\./g, ':').match(/^(\d{1,2}):(\d{1,2})$/);
            if (!m) return '';
            return String(Number(m[1])).padStart(2, '0') + ':' + String(Number(m[2])).padStart(2, '0');
        };
        const periods = periodRows.map(r => {
            const no = Number(r[0]);
            return {
                id: 'p' + no, no,
                label: 'คาบที่ ' + no,
                start: toClock(r[1]), end: toClock(r[2]),
                type: 'class'
            };
        }).filter(p => Number.isFinite(p.no) && p.no > 0);

        /* ---- ข้อมูลหลักในไฟล์ ---- */
        const fileClasses = (rowsOf(wb, SHEET.classes) || []).slice(1)
            .filter(r => String(r[0] || '').trim())
            .map(r => ({ id: String(r[0]).trim(), name: String(r[1] || '').trim(), short: String(r[2] || '').trim() }));

        const fileTeachers = (rowsOf(wb, SHEET.teachers) || []).slice(1)
            .filter(r => String(r[0] || '').trim())
            .map(r => ({
                id: String(r[0]).trim(), short: String(r[1] || '').trim(),
                title: String(r[2] || '').trim(), first: String(r[3] || '').trim(), last: String(r[4] || '').trim()
            }));

        const fileSubjects = (rowsOf(wb, SHEET.subjects) || []).slice(1)
            .filter(r => String(r[0] || '').trim())
            .map(r => ({
                code: String(r[0]).trim(), name: String(r[1] || '').trim(),
                short: String(r[2] || '').trim(), hours: Number(r[4]) || 0, grade: String(r[5] || '').trim()
            }));

        /* ---- จับคู่กับ ANPSCORE ---- */
        const classIndex = buildClassIndex();
        const matchTeacher = buildTeacherMatcher();
        const matchSubject = buildSubjectMatcher();
        const matchRoom = buildRoomMatcher();

        /* ที่จับคู่กับระบบคะแนนไม่ได้ จะถูกสร้างเป็นรายการเฉพาะของระบบตารางสอน
           รหัสอ้างอิงรหัสในไฟล์ เพื่อให้นำเข้าไฟล์เดิมซ้ำแล้วไม่เกิดรายการซ้ำ */
        const extraTeachers = [];
        const extraClasses = [];
        const extraSubjects = [];

        const classById = new Map();     // รหัสห้องในไฟล์ → ห้องที่จะใช้จริง
        const unmatchedClasses = [];
        fileClasses.forEach(c => {
            const hit = classIndex.get(classKey(c.name)) || classIndex.get(classKey(c.short));
            if (hit) { classById.set(c.id, hit); return; }
            const name = c.short || c.name || c.id;
            const made = { id: stableId('tt_c_', name), name, external: true };
            extraClasses.push(made);
            classById.set(c.id, made);
            unmatchedClasses.push(name);
        });

        const teacherById = new Map();
        const unmatchedTeachers = [];
        fileTeachers.forEach(t => {
            const hit = matchTeacher(t);
            if (hit) { teacherById.set(t.id, hit.ref); return; }
            const name = (t.title + t.first + ' ' + t.last).trim() || t.short || t.id;
            const made = { id: stableId('tt_t_', name), name, external: true };
            extraTeachers.push(made);
            teacherById.set(t.id, made);
            unmatchedTeachers.push(name);
        });

        /* ไฟล์แยกรหัสวิชาตามระดับชั้น (อ11102, อ12102, … คือ Communication ทั้งหมด)
           แต่ระบบคะแนนเก็บรายวิชาเป็นชื่อเดียวใช้ทั้งโรงเรียน จึงยุบตามชื่อให้ตรงกัน */
        const subjectByCode = new Map();
        const madeSubjectByName = new Map();
        const unmatchedSubjects = [];

        /* ชื่อย่อจากคอลัมน์ "ชื่อย่อ" ของไฟล์ ใช้แสดงในช่องตารางซึ่งกว้างจำกัด */
        const shortById = new Map();
        const makeSubject = function (name, code, short) {
            const nameKey = norm(name);
            const found = madeSubjectByName.get(nameKey);
            if (found) return found;
            const made = {
                id: stableId('tt_s_', name), name: name,
                code: code || '', short: short || name, external: true
            };
            madeSubjectByName.set(nameKey, made);
            extraSubjects.push(made);
            unmatchedSubjects.push(name);
            return made;
        };
        fileSubjects.forEach(s => {
            const key = norm(s.code);
            if (subjectByCode.has(key)) return;
            const hit = matchSubject(s);
            const ref = hit ? hit.ref : makeSubject(s.name || s.code, s.code, s.short);
            subjectByCode.set(key, ref);
            if (s.short && !shortById.has(ref.id)) shortById.set(ref.id, s.short);
        });
        const hoursByCode = new Map(fileSubjects.map(s => [norm(s.code), s.hours]));

        /* ชีตข้อมูลตารางสอนเก็บไว้แค่ชื่อย่อของห้อง จึงต้องเปิดชื่อเต็มจากชีตห้องเรียน */
        const fileRoomById = new Map();
        (rowsOf(wb, SHEET.rooms) || []).slice(1)
            .filter(r => String(r[0] || '').trim())
            .forEach(r => fileRoomById.set(String(r[0]).trim(), {
                short: String(r[1] || '').trim(),
                full: String(r[2] || '').trim()
            }));

        /* ---- ตารางสอน ---- */
        const dayMap = dayIdByName();
        const periodIds = new Set(periods.map(p => p.id));
        const ttRows = (rowsOf(wb, SHEET.timetable) || []).slice(1).filter(r => String(r[0] || '').trim());

        /* ครูประจำชั้นของแต่ละห้อง ใช้ใส่ให้คาบแนะแนว/โฮมรูมตั้งแต่ตอนนำเข้า */
        const homeroomByClass = new Map();
        TT.classes().forEach(c => {
            if (c.homeroomTeachers && c.homeroomTeachers[0]) homeroomByClass.set(String(c.id), c.homeroomTeachers[0]);
        });

        const entries = [];
        const seenSlot = new Set();               // ห้อง+วัน+คาบ ต้องไม่ซ้ำ
        const skipped = {
            class: 0, teacher: 0, subject: 0, day: 0, period: 0, duplicate: 0
        };
        let noTeacherCount = 0;

        /* ห้อง+วิชา → รหัสวิชาในไฟล์ที่ใช้จริง (ใช้หา "จำนวนคาบ" ที่หลักสูตรกำหนด) */
        const codesByPair = new Map();

        ttRows.forEach(r => {
            const dayId = dayMap[norm(r[0])];
            const periodId = 'p' + Number(r[1]);
            const group = String(r[2] || '').trim();
            const label = String(r[3] || '').trim();
            const fileTeacherId = String(r[4] || '').trim();
            const fileSubjectCode = norm(r[7]);
            const fileClassId = String(r[9] || '').trim();
            const roomInfo = fileRoomById.get(String(r[11] || '').trim()) || {};

            if (!dayId) { skipped.day++; return; }
            if (!periodIds.has(periodId)) { skipped.period++; return; }

            const cls = classById.get(fileClassId);
            if (!cls) { skipped.class++; return; }

            const slotKey = cls.id + '|' + dayId + '|' + periodId;
            if (seenSlot.has(slotKey)) { skipped.duplicate++; return; }

            if (group === 'กิจกรรม') {
                seenSlot.add(slotKey);
                const act = {
                    id: TT.uid('en'), classId: cls.id, subjectId: '', teacherId: '',
                    coTeacherIds: [], roomId: '', day: dayId, periodId,
                    locked: true, kind: 'activity', label: label || 'กิจกรรม'
                };
                /* แนะแนว/โฮมรูม เป็นของครูประจำชั้น ใส่ชื่อให้เลยถ้ารู้ว่าใคร
                   (ไฟล์ไม่ได้ระบุครูในคาบกิจกรรม) */
                if (TT.isHomeroomEntry(act)) act.teacherId = homeroomByClass.get(String(cls.id)) || '';
                entries.push(act);
                return;
            }

            /* บางแถวอ้างรหัสวิชาที่ไม่มีอยู่ในชีตวิชาเรียน สร้างจากชื่อในแถวนั้นแทน */
            let sub = subjectByCode.get(fileSubjectCode);
            if (!sub) {
                if (!label) { skipped.subject++; return; }
                sub = makeSubject(label, String(r[7] || '').trim(), String(r[8] || '').trim());
                if (fileSubjectCode) subjectByCode.set(fileSubjectCode, sub);
            }

            /* คาบที่ไม่ได้ระบุครูในไฟล์ ยังนำเข้าได้ แต่ปล่อยครูว่างไว้ให้จัดทีหลัง */
            const teacher = teacherById.get(fileTeacherId) || null;
            if (!teacher) noTeacherCount++;

            const room = matchRoom(roomInfo.full || '', roomInfo.short || String(r[12] || ''));
            seenSlot.add(slotKey);
            entries.push({
                id: TT.uid('en'), classId: cls.id, subjectId: sub.id, teacherId: teacher ? teacher.id : '',
                coTeacherIds: [], roomId: room ? room.ref.id : '',
                day: dayId, periodId, kind: 'subject'
            });

            /* จำไว้ว่าคู่ห้อง+วิชานี้มาจากรหัสวิชาใดในไฟล์ ใช้อ่าน "จำนวนคาบ" ที่กำหนดไว้ */
            const codeKey = cls.id + '|' + sub.id;
            if (!codesByPair.has(codeKey)) codesByPair.set(codeKey, new Set());
            codesByPair.get(codeKey).add(fileSubjectCode);
        });

        /* ---- การจัดสรรวิชา ----
           "คาบ/สัปดาห์" คือจำนวนที่หลักสูตรกำหนด ไม่ใช่จำนวนที่นำเข้าได้
           ถ้าใช้จำนวนที่นำเข้าได้ หน้าจัดสรรจะขึ้นว่าครบทุกวิชาเสมอ
           ทั้งที่บางคาบถูกข้ามไป จึงอ่านจากชีตวิชาเรียนก่อน แล้วค่อยถอยไปใช้จำนวนที่วางจริง */
        const allocMap = new Map();
        const placedCount = new Map();
        entries.forEach(e => {
            if (e.kind !== 'subject') return;
            const key = e.classId + '|' + e.subjectId;
            placedCount.set(key, (placedCount.get(key) || 0) + 1);
            if (allocMap.has(key)) return;
            allocMap.set(key, {
                id: TT.uid('al'), classId: e.classId, subjectId: e.subjectId, teacherId: e.teacherId,
                coTeacherIds: [], periodsPerWeek: 0, doublePeriod: false,
                roomId: '', preferDays: [], avoidDays: [], note: 'นำเข้าจากไฟล์ Excel'
            });
        });
        allocMap.forEach((alloc, key) => {
            let required = 0;
            (codesByPair.get(key) || new Set()).forEach(code => {
                required += Number(hoursByCode.get(code)) || 0;
            });
            alloc.periodsPerWeek = required || placedCount.get(key) || 1;
        });

        /* วิชาที่ลงทะเบียนไว้แต่ยังไม่มีคาบในตาราง ให้ตั้งจำนวนคาบจากชีตวิชาเรียน
           เพื่อให้หน้าจัดสรรแสดงว่า "ยังขาด" ได้ถูกต้อง */
        let registeredOnly = 0;
        (rowsOf(wb, SHEET.registration) || []).slice(1)
            .filter(r => String(r[0] || '').trim())
            .forEach(r => {
                const cls = classById.get(String(r[2] || '').trim());
                const sub = subjectByCode.get(norm(r[4]));
                const teacher = teacherById.get(String(r[0] || '').trim());
                if (!cls || !sub) return;
                const key = cls.id + '|' + sub.id;
                if (allocMap.has(key)) return;
                allocMap.set(key, {
                    id: TT.uid('al'), classId: cls.id, subjectId: sub.id,
                    teacherId: teacher ? teacher.id : '',
                    coTeacherIds: [], periodsPerWeek: Number(hoursByCode.get(norm(r[4]))) || 1,
                    doublePeriod: false, roomId: '', preferDays: [], avoidDays: [],
                    note: 'นำเข้าจากไฟล์ Excel (ยังไม่มีคาบในตาราง)'
                });
                registeredOnly++;
            });

        return {
            periods,
            entries,
            allocations: Array.from(allocMap.values()),
            extras: { teachers: extraTeachers, classes: extraClasses, subjects: extraSubjects },
            subjectShorts: Array.from(shortById.entries()),
            report: {
                totalRows: ttRows.length,
                activityCount: entries.filter(e => e.kind === 'activity').length,
                subjectCount: entries.filter(e => e.kind === 'subject').length,
                registeredOnly,
                noTeacherCount,
                skipped,
                matchedClasses: fileClasses.length - extraClasses.length,
                matchedTeachers: fileTeachers.length - extraTeachers.length,
                matchedSubjects: subjectByCode.size - extraSubjects.length,
                totalClasses: fileClasses.length,
                totalTeachers: fileTeachers.length,
                totalSubjects: subjectByCode.size,
                unmatchedClasses,
                unmatchedTeachers,
                unmatchedSubjects
            }
        };
    };

    /* --------------------------------------------------------------- หน้าจอสรุป */

    const chip = (label, value, tone) =>
        `<div class="rounded-2xl border ${tone} px-4 py-3">
            <div class="text-2xl font-extrabold leading-none">${UI.esc(value)}</div>
            <div class="text-xs font-bold mt-1 opacity-80">${UI.esc(label)}</div>
        </div>`;

    const missingList = function (title, items, note) {
        if (!items.length) return '';
        return `
        <details class="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
            <summary class="cursor-pointer font-bold text-amber-800 text-sm">
                ${UI.esc(title)} ${items.length} รายการ — ${UI.esc(note)}
            </summary>
            <div class="mt-2 text-xs text-amber-900 leading-relaxed">
                ${items.map(x => UI.esc(x)).join(' · ')}
            </div>
        </details>`;
    };

    const showPreview = function (plan, fileName) {
        const r = plan.report;
        const skippedTotal = Object.keys(r.skipped).reduce((s, k) => s + r.skipped[k], 0);
        const reasons = [
            ['subject', 'ไม่มีทั้งรหัสและชื่อวิชา'],
            ['day', 'ชื่อวันไม่ถูกต้อง'],
            ['period', 'คาบเกินจำนวนคาบในไฟล์'],
            ['duplicate', 'ซ้ำช่องเดิม'],
            ['class', 'ไม่พบห้องเรียนของแถวนี้'],
            ['teacher', 'ไม่พบครูของแถวนี้']
        ].filter(([k]) => r.skipped[k] > 0);
        const extraTotal = plan.extras.classes.length + plan.extras.teachers.length + plan.extras.subjects.length;

        const periodNote = plan.periods.length
            ? `ไฟล์กำหนด ${plan.periods.length} คาบ (${plan.periods[0].start}–${plan.periods[plan.periods.length - 1].end})`
            : 'ไม่พบคาบเวลาในไฟล์';

        UI.modal('ตรวจสอบก่อนนำเข้าตารางสอน', `
            <div class="space-y-4">
                <div class="text-sm text-slate-500 font-semibold flex items-center gap-2">
                    <i class="ph ph-microsoft-excel-logo text-lg text-emerald-600"></i>${UI.esc(fileName)}
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    ${chip('คาบเรียนที่นำเข้าได้', r.subjectCount, 'border-emerald-200 bg-emerald-50 text-emerald-700')}
                    ${chip('คาบกิจกรรม', r.activityCount, 'border-sky-200 bg-sky-50 text-sky-700')}
                    ${chip('รายการจัดสรรวิชา', plan.allocations.length, 'border-indigo-200 bg-indigo-50 text-indigo-700')}
                    ${chip('แถวที่ข้าม', skippedTotal, skippedTotal ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-400')}
                </div>

                <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm space-y-1.5">
                    <div class="font-extrabold text-slate-700 mb-1">จับคู่กับข้อมูลในระบบคะแนนได้เท่าไร</div>
                    <div class="flex justify-between"><span class="text-slate-500 font-semibold">ห้องเรียน</span><span class="font-bold text-slate-800">${r.matchedClasses}/${r.totalClasses}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500 font-semibold">ครูผู้สอน</span><span class="font-bold text-slate-800">${r.matchedTeachers}/${r.totalTeachers}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500 font-semibold">รายวิชา</span><span class="font-bold text-slate-800">${r.matchedSubjects}/${r.totalSubjects}</span></div>
                    <div class="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5"><span class="text-slate-500 font-semibold">อ่านจากไฟล์ทั้งหมด</span><span class="font-bold text-slate-800">${r.totalRows} แถว</span></div>
                    ${r.noTeacherCount ? `<div class="flex justify-between"><span class="text-slate-500 font-semibold">คาบที่ไฟล์ไม่ได้ระบุครู</span><span class="font-bold text-amber-700">${r.noTeacherCount} คาบ</span></div>` : ''}
                </div>

                ${reasons.length ? `
                <div class="rounded-2xl border border-slate-200 p-4 text-sm">
                    <div class="font-extrabold text-slate-700 mb-2">เหตุผลที่ข้ามแถว</div>
                    ${reasons.map(([k, label]) =>
            `<div class="flex justify-between py-0.5"><span class="text-slate-500 font-semibold">${UI.esc(label)}</span><span class="font-bold text-amber-700">${r.skipped[k]} แถว</span></div>`
        ).join('')}
                </div>` : ''}

                ${missingList('ห้องเรียนที่ไม่มีในระบบคะแนน', r.unmatchedClasses, 'จะสร้างไว้ในระบบตารางสอน')}
                ${missingList('ครูที่ไม่มีในระบบคะแนน', r.unmatchedTeachers, 'จะสร้างไว้ในระบบตารางสอน')}
                ${missingList('รายวิชาที่ไม่มีในระบบคะแนน', r.unmatchedSubjects, 'จะสร้างไว้ในระบบตารางสอน')}

                <label class="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer">
                    <input type="checkbox" id="imp-periods" checked class="mt-1 w-4 h-4 accent-blue-600 shrink-0">
                    <span class="text-sm">
                        <span class="font-bold text-slate-700">ปรับคาบเวลาให้ตรงกับไฟล์</span>
                        <span class="block text-slate-500 mt-0.5">${UI.esc(periodNote)} — ถ้าไม่ปรับ คาบที่เกินจากที่ตั้งไว้เดิมจะถูกข้าม</span>
                    </span>
                </label>

                ${extraTotal ? `
                <label class="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer">
                    <input type="checkbox" id="imp-create" checked class="mt-1 w-4 h-4 accent-blue-600 shrink-0">
                    <span class="text-sm">
                        <span class="font-bold text-slate-700">
                            สร้างห้องเรียน ครู และรายวิชาที่ยังไม่มี (${extraTotal} รายการ)
                        </span>
                        <span class="block text-slate-500 mt-0.5">
                            สร้างไว้ในระบบตารางสอนเท่านั้น <b>ไม่เพิ่มเข้าระบบคะแนน</b>
                            จึงไม่กระทบการกรอกคะแนน การตัดเกรด หรือเอกสาร ปพ. ใด ๆ
                            ถ้าไม่เลือก คาบที่อ้างถึงรายการเหล่านี้จะไม่ถูกนำเข้า
                        </span>
                    </span>
                </label>` : ''}

                <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-semibold space-y-1.5">
                    <div>
                        <i class="ph ph-warning mr-1"></i>
                        ตารางสอนและการจัดสรรวิชาของภาคเรียนที่ ${UI.esc(plan.targetTerm || TT.state.settings.activeTerm)}
                        ปีการศึกษา ${UI.esc(plan.targetYear || TT.state.settings.activeYear)} จะถูกแทนที่ทั้งหมดด้วยข้อมูลจากไฟล์นี้
                        (กดเลิกทำเพื่อย้อนกลับได้)
                    </div>
                    <div>
                        หากเลือกปรับคาบเวลา คาบเวลาเป็นค่าที่ใช้ร่วมกันทุกปีการศึกษาและทุกภาคเรียน
                        จึงมีผลกับตารางของภาคเรียนอื่นด้วย
                    </div>
                    ${TT.state.plan.status === 'published' ? `<div>
                        ตารางของภาคเรียนนี้ <u>ประกาศใช้แล้ว</u> ครูและผู้ปกครองเห็นตารางนี้อยู่
                        การนำเข้าจะเปลี่ยนตารางที่ประกาศไปทันที
                    </div>` : ''}
                </div>
            </div>`, {
            width: 'max-w-3xl',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">ยกเลิก</button>
                <button id="btn-run-import" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white brand-gradient shadow-lg" ${r.subjectCount ? '' : 'disabled'}>
                    <i class="ph ph-download-simple mr-1"></i> นำเข้าตารางสอน
                </button>`,
            onOpen: () => {
                const btn = UI.$('btn-run-import');
                if (!r.subjectCount) {
                    btn.classList.add('opacity-40', 'cursor-not-allowed');
                    return;
                }
                btn.onclick = () => {
                    /* กันกดซ้ำระหว่างรอบันทึกขึ้นคลาวด์ */
                    btn.disabled = true;
                    btn.classList.add('opacity-60');
                    applyImport(plan, {
                        adoptPeriods: UI.$('imp-periods').checked,
                        createMissing: !!(UI.$('imp-create') && UI.$('imp-create').checked)
                    });
                };
            }
        });
    };

    /* ------------------------------------------------------------- เขียนข้อมูลจริง */

    /* เติมรายการใหม่เข้ารายการเดิมโดยไม่ให้ซ้ำรหัส (นำเข้าไฟล์เดิมซ้ำได้) */
    const mergeExtras = function (key, incoming) {
        const current = Array.isArray(TT.state.settings[key]) ? TT.state.settings[key] : [];
        const byId = new Map(current.map(x => [String(x.id), x]));
        incoming.forEach(x => byId.set(String(x.id), x));
        TT.state.settings[key] = Array.from(byId.values());
    };

    const applyImport = function (plan, opt) {
        const adoptPeriods = opt.adoptPeriods;
        TT.pushUndo('นำเข้าตารางสอนจาก Excel');

        let entries = plan.entries;
        let allocations = plan.allocations;
        let settingsChanged = false;

        if (plan.targetYear && plan.targetTerm) {
            TT.state.settings.activeYear = String(plan.targetYear);
            TT.state.settings.activeTerm = String(plan.targetTerm);
            if (TT.state.plan) {
                TT.state.plan.year = String(plan.targetYear);
                TT.state.plan.term = String(plan.targetTerm);
                TT.state.plan.name = 'ตารางสอนภาคเรียนที่ ' + plan.targetTerm + ' ปีการศึกษา ' + plan.targetYear;
            }
            settingsChanged = true;
        }

        /* ชื่อย่อจากไฟล์ ใช้กับวิชาที่ยังไม่เคยตั้งชื่อย่อไว้เอง
           ช่องในตารางกว้างจำกัด ถ้าไม่มีชื่อย่อจะเห็นชื่อเต็มล้นหรืออ่านยาก */
        (plan.subjectShorts || []).forEach(([subId, short]) => {
            if (!TT.state.settings.subjectMeta) TT.state.settings.subjectMeta = {};
            const meta = TT.state.settings.subjectMeta[subId] || {};
            if (meta.short) return;
            meta.short = short;
            TT.state.settings.subjectMeta[subId] = meta;
            settingsChanged = true;
        });

        if (opt.createMissing) {
            mergeExtras('extraClasses', plan.extras.classes);
            mergeExtras('extraTeachers', plan.extras.teachers);
            mergeExtras('extraSubjects', plan.extras.subjects);
            settingsChanged = true;
        } else {
            /* ไม่สร้างรายการใหม่ : ห้อง/วิชาที่ไม่มีจริงก็เก็บคาบไว้ไม่ได้ ต้องตัดทิ้ง
               ส่วนครูที่ไม่มี ยังเก็บคาบไว้ได้โดยปล่อยช่องครูว่างให้จัดทีหลัง */
            const goneRefs = new Set(plan.extras.classes.concat(plan.extras.subjects).map(x => String(x.id)));
            const goneTeachers = new Set(plan.extras.teachers.map(x => String(x.id)));
            const keep = (o) => !goneRefs.has(String(o.classId)) && !goneRefs.has(String(o.subjectId));
            entries = entries.filter(keep).map(e =>
                goneTeachers.has(String(e.teacherId)) ? Object.assign({}, e, { teacherId: '' }) : e);
            allocations = allocations.filter(keep).map(a =>
                goneTeachers.has(String(a.teacherId)) ? Object.assign({}, a, { teacherId: '' }) : a);
        }

        if (adoptPeriods && plan.periods.length) {
            TT.state.settings.periods = plan.periods;
            settingsChanged = true;
        } else {
            /* ไม่ปรับคาบ ก็ต้องตัดคาบที่ระบบไม่รู้จักออก ไม่งั้นจะกลายเป็นคาบลอย */
            const known = new Set((TT.state.settings.periods || []).map(p => String(p.id)));
            entries = entries.filter(e => known.has(String(e.periodId)));
        }

        TT.state.plan.allocations = allocations;
        TT.state.plan.entries = entries;

        const done = () => {
            TT.log('import_excel',
                'นำเข้าตารางสอน ' + entries.length + ' คาบ · จัดสรร ' + allocations.length + ' รายการ');
            UI.closeModal();
            UI.notify('นำเข้าตารางสอนแล้ว ' + entries.length + ' คาบ');
            TTApp.refresh();
        };

        const saves = [TT.savePlanNow()];
        if (settingsChanged) saves.push(TT.saveSettingsNow());
        Promise.all(saves).then(done).catch(e => {
            console.error(e);
            UI.closeModal();
            UI.notify('บันทึกขึ้นคลาวด์ไม่สำเร็จ ตารางที่นำเข้ายังอยู่บนหน้าจอเท่านั้น กดเลิกทำเพื่อย้อนกลับได้', 'error');
        });
    };

    /* ------------------------------------------------------------- อ่านไฟล์ตารางสอนรายครู (CSV / ข้อความโรงเรียนอนุพงศ์พัชรินทร์) */

    const parseCsvText = function (text) {
        const lines = String(text || '').split(/\r?\n/);
        return lines.map(line => {
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
        }).filter(r => r.some(c => c !== ''));
    };

    const buildTeacherGridImportPlan = function (allRows, fileName) {
        const coreTeachers = TT.teachers();
        const coreClasses = TT.classes();
        const coreSubjects = TT.subjects();

        const cleanTitle = s => norm(s).replace(/^(นางสาว|นาง|นาย|ครู|teacher\s*)/i, '').trim();

        // Matcher for teachers
        const matchTeacher = function (rawName) {
            const n = norm(rawName);
            let t = coreTeachers.find(ct => norm(ct.name) === n);
            if (t) return { ref: t, isNew: false };
            const nWithoutTitle = cleanTitle(rawName);
            t = coreTeachers.find(ct => cleanTitle(ct.name) === nWithoutTitle);
            if (t) return { ref: t, isNew: false };
            const firstName = nWithoutTitle.slice(0, 5);
            if (firstName.length >= 3) {
                const matches = coreTeachers.filter(ct => cleanTitle(ct.name).startsWith(firstName));
                if (matches.length === 1) return { ref: matches[0], isNew: false };
            }
            const made = { id: stableId('tt_t_', rawName), name: rawName.trim(), external: true };
            return { ref: made, isNew: true };
        };

        // Matcher for classes
        const classIndex = new Map();
        coreClasses.forEach(c => {
            const k = classKey(c.name);
            if (k) classIndex.set(k, c);
        });

        const matchClass = function (rawName) {
            const k = classKey(rawName);
            if (k && classIndex.has(k)) return { ref: classIndex.get(k), isNew: false };
            const n = norm(rawName);
            const exact = coreClasses.find(c => norm(c.name) === n);
            if (exact) return { ref: exact, isNew: false };
            const made = { id: stableId('tt_c_', rawName), name: rawName.trim(), external: true };
            return { ref: made, isNew: true };
        };

        // Matcher for subjects
        const subjectIndex = new Map();
        coreSubjects.forEach(s => {
            subjectIndex.set(norm(s.name), s);
            if (s.code) subjectIndex.set(norm(s.code), s);
        });

        const matchSubject = function (code, name) {
            let effCode = code;
            let effName = name;
            if (norm(code) === 'บูรณาการ' || norm(name) === 'สุพัตรา') {
                effCode = 'บูรณาการ';
                effName = 'บูรณาการ';
            }
            const nCode = norm(effCode);
            const nName = norm(effName);
            let s = null;
            if (nCode && subjectIndex.has(nCode)) s = subjectIndex.get(nCode);
            if (!s && nName && subjectIndex.has(nName)) s = subjectIndex.get(nName);
            if (s) {
                return {
                    ref: { id: s.id, name: s.name, code: effCode || s.code || '', short: effName || s.name, external: false },
                    isNew: false
                };
            }
            let fullName = effName;
            if (nName === 'ไทย') fullName = 'ภาษาไทย';
            else if (nName === 'คณิต') fullName = 'คณิตศาสตร์';
            else if (nName === 'วิทย์') fullName = 'วิทยาศาสตร์';
            else if (nName === 'วิทย์คำนวณ' || nCode === 'ว') fullName = 'วิทยาการคำนวณ';
            else if (nName === 'อังกฤษ') fullName = 'ภาษาอังกฤษ';
            else if (nName === 'สังคม') fullName = 'สังคมศึกษา';
            else if (nName === 'จีน') fullName = 'ภาษาจีน';
            else if (nName === 'communication') fullName = 'ภาษาอังกฤษเพื่อการสื่อสาร';
            else if (nName === 'บูรณาการ' || nCode === 'บูรณาการ') fullName = 'บูรณาการ';
            else if (nName === 'การเขียน') fullName = 'การเขียนเชิงสร้างสรรค์';
            else if (nName === 'อ่านคิด') fullName = 'การอ่านและการคิดวิเคราะห์';
            else if (nName === 'ว่ายน้ำ') fullName = 'ว่ายน้ำ';

            if (subjectIndex.has(norm(fullName))) {
                const matched = subjectIndex.get(norm(fullName));
                return {
                    ref: { id: matched.id, name: matched.name, code: effCode || matched.code || '', short: effName || matched.name, external: false },
                    isNew: false
                };
            }

            const subKey = effCode && effCode !== 'บูรณาการ' ? nCode : norm(fullName);
            const made = {
                id: stableId('tt_s_', subKey),
                name: fullName || effCode,
                code: effCode || '',
                short: effName || fullName || effCode,
                external: true
            };
            return { ref: made, isNew: true };
        };

        const daysList = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
        const dayMap = { 'จันทร์': 'mon', 'อังคาร': 'tue', 'พุธ': 'wed', 'พฤหัสบดี': 'thu', 'ศุกร์': 'fri' };

        let currentTeacher = null;
        let detectedTerm = '';
        let detectedYear = '';
        const rawSlots = [];
        const extraTeachers = new Map();
        const extraClasses = new Map();
        const extraSubjects = new Map();
        const shortById = new Map();
        const allParsedTeachers = new Set();
        const allParsedClasses = new Set();
        const allParsedSubjects = new Set();

        let periods = [];

        for (let i = 0; i < allRows.length; i++) {
            const row = allRows[i];
            if (!row || !row.length) continue;
            const rowStr = row.join(' ');

            // ตรวจจับเวลาคาบจากแถวที่ขึ้นต้นด้วย "เวลา"
            if (row[0] === 'เวลา' && periods.length === 0) {
                for (let p = 1; p < row.length; p++) {
                    const timeStr = String(row[p] || '').trim();
                    const m = timeStr.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
                    if (m) {
                        const sH = String(Number(m[1])).padStart(2, '0');
                        const sM = m[2];
                        const eH = String(Number(m[3])).padStart(2, '0');
                        const eM = m[4];
                        periods.push({
                            id: 'p' + p,
                            no: p,
                            label: 'คาบที่ ' + p,
                            start: `${sH}:${sM}`,
                            end: `${eH}:${eM}`,
                            type: 'class'
                        });
                    }
                }
            }

            const tm = rowStr.match(/ตารางสอนของ\s*([^\s,]+(?:\s+[^\s,]+)*?)\s*ภาคเรียนที่\s*(\d+)\s+ปีการศึกษา\s*(\d+)/);
            if (tm) {
                const tName = tm[1].trim();
                currentTeacher = tName.includes('...') ? null : tName;
                if (!detectedTerm) detectedTerm = tm[2];
                if (!detectedYear) detectedYear = tm[3];
                continue;
            }

            if (rowStr.includes('ตารางสอนลูกเสือ') || rowStr.includes('กรณีเอกลักษณ์') || rowStr.includes('ตารางคาบบูรณาการ') || rowStr.includes('ตารางคาบลูกเสือ')) {
                currentTeacher = null;
                continue;
            }

            if (!currentTeacher) continue;

            const firstCol = (row[0] || '').trim();
            if (daysList.includes(firstCol)) {
                const dayId = dayMap[firstCol];
                const codesRow = row;
                const namesRow = allRows[i + 1] || [];
                const classesRow = allRows[i + 2] || [];

                allParsedTeachers.add(currentTeacher);
                const tMatch = matchTeacher(currentTeacher);
                if (tMatch.isNew) extraTeachers.set(tMatch.ref.id, tMatch.ref);

                const maxP = Math.max(codesRow.length, namesRow.length, classesRow.length) - 1;
                const periodLimit = Math.max(maxP, 8);

                for (let p = 1; p <= periodLimit; p++) {
                    let code = (codesRow[p] || '').trim();
                    let name = (namesRow[p] || '').trim();
                    const cls = (classesRow[p] || '').trim();

                    if (!code && !name && !cls) continue;
                    if (name === 'ว่าง' || name === 'พักกลางวัน' || name === 'Lunch') continue;

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
                        const cMatch = matchClass(cls);
                        classObj = cMatch.ref;
                        if (cMatch.isNew) extraClasses.set(classObj.id, classObj);
                    }

                    let subObj = null;
                    if (!isActivity) {
                        const subKey = code || name;
                        allParsedSubjects.add(subKey);
                        const sMatch = matchSubject(code, name);
                        subObj = sMatch.ref;
                        if (sMatch.isNew) extraSubjects.set(subObj.id, subObj);
                        if (subObj.short) shortById.set(subObj.id, subObj.short);
                    }

                    rawSlots.push({
                        teacherId: tMatch.ref.id,
                        teacherName: tMatch.ref.name,
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

        if (periods.length === 0) {
            periods = [
                { id: 'p1', no: 1, label: 'คาบที่ 1', start: '08:30', end: '09:30', type: 'class' },
                { id: 'p2', no: 2, label: 'คาบที่ 2', start: '09:30', end: '10:30', type: 'class' },
                { id: 'p3', no: 3, label: 'คาบที่ 3', start: '10:30', end: '11:20', type: 'class' },
                { id: 'p4', no: 4, label: 'คาบที่ 4', start: '11:20', end: '12:05', type: 'class' },
                { id: 'p5', no: 5, label: 'คาบที่ 5', start: '12:05', end: '12:50', type: 'class' },
                { id: 'p6', no: 6, label: 'คาบที่ 6', start: '12:50', end: '13:40', type: 'class' },
                { id: 'p7', no: 7, label: 'คาบที่ 7', start: '13:40', end: '14:30', type: 'class' },
                { id: 'p8', no: 8, label: 'คาบที่ 8', start: '14:30', end: '15:30', type: 'class' }
            ];
        }

        // ผสานครูผู้สอนร่วมในห้องเรียนเดียวกัน
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

        const entries = Array.from(classSlotMap.values()).concat(dutyEntries);

        // จัดสรรวิชา
        const allocMap = new Map();
        entries.forEach(e => {
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
                    note: 'นำเข้าจากตารางสอนโรงเรียน'
                });
            }
            allocMap.get(key).periodsPerWeek++;
        });

        const subjectCount = entries.filter(e => e.kind === 'subject').length;
        const activityCount = entries.filter(e => e.kind === 'activity').length;

        return {
            targetTerm: detectedTerm,
            targetYear: detectedYear,
            periods,
            entries,
            allocations: Array.from(allocMap.values()),
            extras: {
                teachers: Array.from(extraTeachers.values()),
                classes: Array.from(extraClasses.values()),
                subjects: Array.from(extraSubjects.values())
            },
            subjectShorts: Array.from(shortById.entries()),
            report: {
                totalRows: allRows.length,
                activityCount,
                subjectCount,
                registeredOnly: 0,
                noTeacherCount: 0,
                skipped: {},
                matchedClasses: allParsedClasses.size - extraClasses.size,
                matchedTeachers: allParsedTeachers.size - extraTeachers.size,
                matchedSubjects: allParsedSubjects.size - extraSubjects.size,
                totalClasses: allParsedClasses.size,
                totalTeachers: allParsedTeachers.size,
                totalSubjects: allParsedSubjects.size,
                unmatchedClasses: Array.from(extraClasses.values()).map(c => c.name),
                unmatchedTeachers: Array.from(extraTeachers.values()).map(t => t.name),
                unmatchedSubjects: Array.from(extraSubjects.values()).map(s => s.name)
            }
        };
    };

    /* ------------------------------------------------------------------ ปุ่มเรียก */

    P.importTimetableExcel = function () {
        if (!TT.can('schedule')) { UI.notify('ท่านไม่มีสิทธิ์จัดตารางสอน', 'error'); return; }
        if (!TT.state.plan) { UI.notify('ยังโหลดตารางสอนไม่เสร็จ กรุณารอสักครู่', 'warn'); return; }

        const processRows = (rows, fileName) => {
            try {
                const plan = buildTeacherGridImportPlan(rows, fileName);
                UI.closeModal();
                showPreview(plan, fileName);
            } catch (err) {
                console.error(err);
                UI.notify('อ่านข้อมูลไม่สำเร็จ: ' + err.message, 'error');
            }
        };

        const processWorkbook = (wb, fileName) => {
            try {
                if (wb.Sheets[SHEET.timetable]) {
                    const plan = buildImportPlan(wb);
                    UI.closeModal();
                    showPreview(plan, fileName);
                    return;
                }
                for (const sName of wb.SheetNames) {
                    const ws = wb.Sheets[sName];
                    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
                    const hasTeacherGrid = rows.some(r => (r || []).some(c => String(c).includes('ตารางสอนของ')));
                    if (hasTeacherGrid) {
                        processRows(rows, fileName);
                        return;
                    }
                }
                throw new Error('ไม่พบรูปแบบตารางสอนในไฟล์นี้');
            } catch (err) {
                console.error(err);
                UI.notify('อ่านไฟล์ไม่สำเร็จ: ' + err.message, 'error');
            }
        };

        const processFile = (file) => {
            const ext = (file.name || '').split('.').pop().toLowerCase();
            if (ext === 'csv' || ext === 'txt') {
                const reader = new FileReader();
                reader.onload = () => {
                    const rows = parseCsvText(reader.result);
                    processRows(rows, file.name);
                };
                reader.onerror = () => UI.notify('อ่านไฟล์ไม่สำเร็จ', 'error');
                reader.readAsText(file, 'utf-8');
            } else {
                if (typeof window.XLSX === 'undefined') {
                    UI.notify('ยังโหลดตัวอ่าน Excel ไม่สำเร็จ กรุณารอสักครู่', 'warn');
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
                        processWorkbook(wb, file.name);
                    } catch (e) {
                        console.error(e);
                        UI.notify('อ่านไฟล์ไม่สำเร็จ: ' + e.message, 'error');
                    }
                };
                reader.onerror = () => UI.notify('อ่านไฟล์ไม่สำเร็จ', 'error');
                reader.readAsArrayBuffer(file);
            }
        };

        const modalHtml = `
            <div class="space-y-4">
                <!-- ทางเลือก 1: โหลดตารางเทอม 2 สำเร็จรูปของโรงเรียน -->
                ${TT.TERM2_PLAN_IMPORT ? `
                <div class="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="min-w-0">
                            <div class="font-extrabold text-blue-900 text-sm md:text-base flex items-center gap-1.5">
                                <i class="ph ph-sparkle text-blue-600 text-lg shrink-0"></i>
                                <span>ตารางสอนเทอม 2 ปีการศึกษา 2569 (โรงเรียนอนุพงศ์พัชรินทร์)</span>
                            </div>
                            <div class="text-xs text-slate-600 mt-1 leading-relaxed">
                                โหลดข้อมูลตารางสอนเทอม 2 ครบทั้ง 30 ครู 21 ห้องเรียน 8 คาบ/วัน พร้อมวิชาและกิจกรรม
                            </div>
                        </div>
                        <button id="btn-quick-term2" class="tactile-btn shrink-0 px-4 py-2 rounded-xl font-bold text-white brand-gradient shadow-md text-xs">
                            <i class="ph ph-download-simple mr-1"></i> ดูและนำเข้าข้อมูลชุดนี้
                        </button>
                    </div>
                </div>` : ''}

                <!-- ทางเลือก 2: อัปโหลดไฟล์ -->
                <div class="rounded-2xl border border-slate-200 bg-white p-4">
                    <div class="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                        <i class="ph ph-upload-simple text-blue-600"></i> นำเข้าจากไฟล์ (.csv, .xlsx, .xls, .txt)
                    </div>
                    <div class="text-xs text-slate-500 mb-3">
                        รองรับทั้งไฟล์ตารางสอนรายครู (CSV / ตารางสอนของ...) และไฟล์ Excel จัดตารางสอนเดิม
                    </div>
                    <input type="file" id="inp-import-file" accept=".csv,.xlsx,.xls,.xlsm,.txt" class="hidden">
                    <button id="btn-pick-file" class="tactile-btn w-full py-4 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-600 hover:text-blue-600 font-bold text-sm flex items-center justify-center gap-2">
                        <i class="ph ph-folder-open text-xl"></i> คลิกเพื่อเลือกไฟล์
                    </button>
                </div>

                <!-- ทางเลือก 3: วางข้อความ CSV -->
                <details class="rounded-2xl border border-slate-200 bg-white p-4">
                    <summary class="cursor-pointer font-bold text-slate-700 text-sm flex items-center gap-2">
                        <i class="ph ph-clipboard-text text-blue-600"></i> หรือวางข้อความตารางสอน CSV ที่นี่
                    </summary>
                    <div class="mt-3 space-y-2">
                        <textarea id="inp-paste-csv" rows="6" placeholder="วางข้อความตารางสอนที่นี่ เช่น
ตารางสอนของ นางสาวระเบียบ งามสะอาด  ภาคเรียนที่ 2 ปีการศึกษา 2569
วัน,ชั่วโมงที่,,,,,,,
..." class="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl focus-ring custom-scrollbar"></textarea>
                        <div class="flex justify-end">
                            <button id="btn-parse-paste" class="tactile-btn px-4 py-2 rounded-xl font-bold text-white brand-gradient text-xs shadow">
                                <i class="ph ph-check mr-1"></i> ตรวจสอบข้อความที่วาง
                            </button>
                        </div>
                    </div>
                </details>
            </div>
        `;

        UI.modal('นำเข้าตารางสอน', modalHtml, {
            width: 'max-w-2xl',
            footer: `<button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">ปิด</button>`,
            onOpen: () => {
                const bQuick = UI.$('btn-quick-term2');
                if (bQuick && TT.TERM2_PLAN_IMPORT) {
                    bQuick.onclick = () => {
                        UI.closeModal();
                        showPreview(TT.TERM2_PLAN_IMPORT, 'ตารางสอนเทอม 2 ปีการศึกษา 2569 (โรงเรียนอนุพงศ์พัชรินทร์)');
                    };
                }

                const bPick = UI.$('btn-pick-file');
                const inpFile = UI.$('inp-import-file');
                if (bPick && inpFile) {
                    bPick.onclick = () => inpFile.click();
                    inpFile.onchange = () => {
                        if (inpFile.files && inpFile.files[0]) {
                            processFile(inpFile.files[0]);
                        }
                    };
                }

                const bPaste = UI.$('btn-parse-paste');
                const inpPaste = UI.$('inp-paste-csv');
                if (bPaste && inpPaste) {
                    bPaste.onclick = () => {
                        const val = (inpPaste.value || '').trim();
                        if (!val) {
                            UI.notify('กรุณาวางข้อความตารางสอนก่อน', 'warn');
                            return;
                        }
                        const rows = parseCsvText(val);
                        processRows(rows, 'ข้อความที่วาง');
                    };
                }
            }
        });
    };
})();
