/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — เครื่องมือคำนวณ (Scheduling engine)

   รวมงานคำนวณทั้งหมดไว้ที่เดียว แยกจากหน้าจอ เพื่อให้ทดสอบและแก้ไขง่าย
     1) ตรวจคาบชนกัน (hard constraints)
     2) นับคาบและภาระงานครู
     3) ค้นหาคาบว่างของครู ห้องเรียน และห้องพิเศษ
     4) จัดตารางอัตโนมัติพร้อมคะแนนคุณภาพ
     5) ค้นหาและจัดอันดับครูสอนแทน
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT;
    const E = window.TTEngine = {};

    /* ------------------------------------------------------------------ ตัวช่วย */

    const sameId = (a, b) => String(a || '') === String(b || '');

    /* ลำดับของคาบเรียนในหนึ่งวัน (ใช้ดูว่าคาบไหนติดกัน) */
    E.periodOrder = function () {
        return TT.periods().map(p => p.id);
    };

    E.periodIndex = function (periodId) {
        return E.periodOrder().indexOf(periodId);
    };

    /* คาบถัดไป/ก่อนหน้าที่เป็นคาบเรียนจริง */
    E.nextPeriod = function (periodId) {
        const order = E.periodOrder();
        const i = order.indexOf(periodId);
        return (i >= 0 && i < order.length - 1) ? order[i + 1] : null;
    };

    E.prevPeriod = function (periodId) {
        const order = E.periodOrder();
        const i = order.indexOf(periodId);
        return i > 0 ? order[i - 1] : null;
    };

    /* ครูระบุว่าไม่สะดวกช่วงนี้หรือไม่ */
    E.teacherUnavailable = function (teacherId, day, periodId) {
        const t = TT.teacher(teacherId);
        if (!t) return false;
        return (t.unavailable || []).some(u =>
            u.day === day && (u.periodId === 'all' || !u.periodId || u.periodId === periodId));
    };

    /* ----------------------------------------------------------- ตรวจคาบชนกัน */

    /* คืนรายการปัญหาของการวางคาบหนึ่ง ๆ ถ้าไม่มีปัญหาจะได้อาร์เรย์ว่าง
       candidate = { classId, day, periodId, subjectId, teacherId, coTeacherIds, roomId, id } */
    E.checkEntry = function (candidate, ignoreEntryId) {
        const problems = [];
        const entries = TT.entries().filter(e => !sameId(e.id, ignoreEntryId || candidate.id));
        const period = TT.period(candidate.periodId);

        if (!period) {
            problems.push({ code: 'period', level: 'error', message: 'ไม่พบคาบที่เลือก' });
            return problems;
        }
        if (period.type !== 'class') {
            problems.push({ code: 'period_type', level: 'error', message: 'คาบนี้เป็น' + (TT.PERIOD_TYPES[period.type] || 'คาบพิเศษ') + ' จัดวิชาลงไม่ได้' });
        }
        const day = TT.days().find(d => d.id === candidate.day);
        if (!day) {
            problems.push({ code: 'day', level: 'error', message: 'วันนี้ไม่ใช่วันเรียนของโรงเรียน' });
        }

        /* ห้องเรียนต้องไม่มีวิชาอื่นในคาบเดียวกัน */
        const clash = entries.find(e => sameId(e.classId, candidate.classId) && e.day === candidate.day && e.periodId === candidate.periodId);
        if (clash) {
            problems.push({
                code: 'class_busy', level: 'error',
                message: 'ห้อง ' + TT.className(candidate.classId) + ' มีวิชา ' + TT.subjectName(clash.subjectId) + ' อยู่แล้วในคาบนี้'
            });
        }

        /* ครูคนเดียวสอนได้ห้องเดียวต่อคาบ (รวมครูร่วมสอน) */
        const myTeachers = [candidate.teacherId].concat(candidate.coTeacherIds || []).filter(Boolean).map(String);
        entries.forEach(e => {
            if (e.day !== candidate.day || e.periodId !== candidate.periodId) return;
            const theirs = [e.teacherId].concat(e.coTeacherIds || []).filter(Boolean).map(String);
            const shared = myTeachers.filter(id => theirs.includes(id));
            if (shared.length) {
                problems.push({
                    code: 'teacher_busy', level: 'error',
                    message: 'ครู' + TT.teacherName(shared[0]) + ' มีสอนห้อง ' + TT.className(e.classId) + ' แล้วในคาบนี้'
                });
            }
        });

        /* ห้องพิเศษห้ามถูกใช้ซ้ำ */
        if (candidate.roomId) {
            const roomClash = entries.find(e => sameId(e.roomId, candidate.roomId) && e.day === candidate.day && e.periodId === candidate.periodId);
            if (roomClash) {
                problems.push({
                    code: 'room_busy', level: 'error',
                    message: TT.roomName(candidate.roomId) + ' ถูกใช้โดยห้อง ' + TT.className(roomClash.classId) + ' แล้ว'
                });
            }
        }

        /* ครูระบุว่าไม่สะดวก */
        myTeachers.forEach(id => {
            if (E.teacherUnavailable(id, candidate.day, candidate.periodId)) {
                problems.push({
                    code: 'teacher_unavailable', level: 'warn',
                    message: 'ครู' + TT.teacherName(id) + ' ระบุว่าไม่สะดวกสอนในช่วงเวลานี้'
                });
            }
        });

        /* จำนวนคาบของวิชาต้องไม่เกินที่จัดสรรไว้ */
        const alloc = TT.allocations().find(a => sameId(a.classId, candidate.classId) && sameId(a.subjectId, candidate.subjectId));
        if (alloc) {
            const placed = entries.filter(e => sameId(e.classId, candidate.classId) && sameId(e.subjectId, candidate.subjectId)).length;
            if (placed + 1 > Number(alloc.periodsPerWeek || 0)) {
                problems.push({
                    code: 'over_quota', level: 'error',
                    message: 'จำนวนคาบวิชา ' + TT.subjectName(candidate.subjectId) + ' เกินที่กำหนดไว้ (' + alloc.periodsPerWeek + ' คาบ/สัปดาห์)'
                });
            }
            if (Array.isArray(alloc.avoidDays) && alloc.avoidDays.includes(candidate.day)) {
                problems.push({ code: 'avoid_day', level: 'warn', message: 'วันนี้ถูกกำหนดว่าห้ามจัดวิชานี้' });
            }
        }

        /* เพดานคาบต่อวันของครูและของนักเรียน */
        const rules = TT.state.settings.rules || {};
        if (candidate.teacherId) {
            const perDay = entries.filter(e => e.day === candidate.day &&
                [e.teacherId].concat(e.coTeacherIds || []).map(String).includes(String(candidate.teacherId))).length;
            if (perDay + 1 > Number(rules.maxPerDayTeacher || 99)) {
                problems.push({
                    code: 'teacher_day_max', level: 'warn',
                    message: 'ครู' + TT.teacherName(candidate.teacherId) + ' จะสอนเกิน ' + rules.maxPerDayTeacher + ' คาบในวันนี้'
                });
            }
        }
        const classPerDay = entries.filter(e => sameId(e.classId, candidate.classId) && e.day === candidate.day).length;
        if (classPerDay + 1 > Number(rules.maxPerDayClass || 99)) {
            problems.push({
                code: 'class_day_max', level: 'warn',
                message: 'นักเรียนห้องนี้จะมีคาบเรียนเกิน ' + rules.maxPerDayClass + ' คาบในวันเดียว'
            });
        }

        return problems;
    };

    E.hasError = function (problems) {
        return (problems || []).some(p => p.level === 'error');
    };

    /* ตรวจทั้งตาราง — ใช้ก่อนบันทึกหรือประกาศใช้ */
    E.validateAll = function () {
        const issues = [];
        const entries = TT.entries();

        entries.forEach(e => {
            E.checkEntry(e, e.id).forEach(p => {
                issues.push(Object.assign({ entryId: e.id, classId: e.classId, day: e.day, periodId: e.periodId }, p));
            });
        });

        /* คาบคู่ต้องอยู่ติดกัน */
        TT.allocations().forEach(a => {
            const sub = TT.subject(a.subjectId);
            const wantDouble = a.doublePeriod !== undefined ? a.doublePeriod : (sub && sub.doublePeriod);
            if (!wantDouble) return;
            const mine = entries.filter(e => sameId(e.classId, a.classId) && sameId(e.subjectId, a.subjectId));
            const byDay = {};
            mine.forEach(e => { (byDay[e.day] = byDay[e.day] || []).push(e); });
            Object.keys(byDay).forEach(day => {
                const idxs = byDay[day].map(e => E.periodIndex(e.periodId)).sort((x, y) => x - y);
                if (idxs.length === 1) {
                    issues.push({
                        code: 'double_split', level: 'warn', classId: a.classId, day,
                        message: 'วิชา ' + TT.subjectName(a.subjectId) + ' ห้อง ' + TT.className(a.classId) + ' กำหนดเป็นคาบคู่ แต่วัน' + TT.dayName(day) + 'มีคาบเดียว'
                    });
                }
                for (let i = 1; i < idxs.length; i++) {
                    if (idxs[i] - idxs[i - 1] !== 1) {
                        issues.push({
                            code: 'double_split', level: 'warn', classId: a.classId, day,
                            message: 'คาบคู่ของวิชา ' + TT.subjectName(a.subjectId) + ' ห้อง ' + TT.className(a.classId) + ' วัน' + TT.dayName(day) + ' ไม่ต่อเนื่องกัน'
                        });
                        break;
                    }
                }
            });
        });

        /* จำนวนคาบยังไม่ครบตามหลักสูตร */
        E.allocationStatus().forEach(row => {
            if (row.missing > 0) {
                issues.push({
                    code: 'missing_period', level: 'warn', classId: row.classId,
                    message: 'ห้อง ' + TT.className(row.classId) + ' วิชา ' + TT.subjectName(row.subjectId) + ' ยังขาด ' + row.missing + ' คาบ'
                });
            }
            if (row.missing < 0) {
                issues.push({
                    code: 'extra_period', level: 'error', classId: row.classId,
                    message: 'ห้อง ' + TT.className(row.classId) + ' วิชา ' + TT.subjectName(row.subjectId) + ' จัดเกิน ' + Math.abs(row.missing) + ' คาบ'
                });
            }
        });

        /* ภาระงานครูเทียบเกณฑ์ */
        TT.teachers().forEach(t => {
            if (t.status !== 'active') return;
            const w = E.workload(t.id);
            if (t.maxPeriods && w.week > t.maxPeriods) {
                issues.push({ code: 'teacher_over', level: 'warn', message: 'ครู' + t.name + ' สอน ' + w.week + ' คาบ เกินเกณฑ์สูงสุด ' + t.maxPeriods + ' คาบ' });
            }
            if (t.minPeriods && w.week < t.minPeriods) {
                issues.push({ code: 'teacher_under', level: 'info', message: 'ครู' + t.name + ' สอน ' + w.week + ' คาบ ต่ำกว่าเกณฑ์ขั้นต่ำ ' + t.minPeriods + ' คาบ' });
            }
        });

        return issues;
    };

    /* -------------------------------------------------- สถานะการจัดสรรคาบเรียน */

    /* ต่อหนึ่งการจัดสรร : ต้องมีกี่คาบ จัดแล้วกี่คาบ ขาดอีกกี่คาบ */
    E.allocationStatus = function (classId) {
        const entries = TT.entries();
        return TT.allocations()
            .filter(a => !classId || sameId(a.classId, classId))
            .map(a => {
                const placed = entries.filter(e => sameId(e.classId, a.classId) && sameId(e.subjectId, a.subjectId)).length;
                const need = Number(a.periodsPerWeek || 0);
                return {
                    allocationId: a.id,
                    classId: a.classId,
                    subjectId: a.subjectId,
                    teacherId: a.teacherId,
                    required: need,
                    placed,
                    missing: need - placed,
                    status: placed === need ? 'complete' : (placed < need ? 'missing' : 'over')
                };
            });
    };

    /* สรุปของทั้งห้อง : ครบ / ขาด / เกิน */
    E.classSummary = function (classId) {
        const rows = E.allocationStatus(classId);
        const required = rows.reduce((s, r) => s + r.required, 0);
        const placed = rows.reduce((s, r) => s + r.placed, 0);
        const slots = TT.days().length * TT.periods().length;
        return {
            required, placed,
            missing: Math.max(0, required - placed),
            over: Math.max(0, placed - required),
            capacity: slots,
            freeSlots: slots - TT.entries().filter(e => sameId(e.classId, classId)).length,
            status: placed === required ? 'complete' : (placed < required ? 'missing' : 'over')
        };
    };

    /* ------------------------------------------------------------- ภาระงานครู */

    E.workload = function (teacherId) {
        const mine = TT.entriesOfTeacher(teacherId);
        const days = TT.days();
        const periods = TT.periods();
        const perDay = {};
        days.forEach(d => { perDay[d.id] = mine.filter(e => e.day === d.id).length; });

        /* คาบว่างแทรก = ช่องว่างที่อยู่ระหว่างคาบสอนคาบแรกกับคาบสุดท้ายของวัน */
        let gaps = 0, longestRun = 0;
        days.forEach(d => {
            const idxs = mine.filter(e => e.day === d.id).map(e => E.periodIndex(e.periodId)).sort((a, b) => a - b);
            if (idxs.length > 1) {
                gaps += (idxs[idxs.length - 1] - idxs[0] + 1) - idxs.length;
            }
            let run = 0;
            for (let i = 0; i < periods.length; i++) {
                run = idxs.includes(i) ? run + 1 : 0;
                if (run > longestRun) longestRun = run;
            }
        });

        const week = mine.length;
        const subs = E.substituteCount(teacherId);
        const t = TT.teacher(teacherId) || {};
        return {
            teacherId,
            week,
            perDay,
            hours: week,                       // 1 คาบ = 1 ชั่วโมงสอนตามโครงสร้างเวลาเรียน
            free: days.length * periods.length - week,
            gaps,
            longestRun,
            classes: Array.from(new Set(mine.map(e => e.classId))).length,
            subjects: Array.from(new Set(mine.map(e => e.subjectId))).length,
            activities: mine.filter(e => e.kind === 'activity').length,
            substitutes: subs.assigned,
            min: Number(t.minPeriods || 0),
            max: Number(t.maxPeriods || 0),
            overMax: t.maxPeriods ? week > t.maxPeriods : false,
            underMin: t.minPeriods ? week < t.minPeriods : false
        };
    };

    E.workloadAll = function () {
        return TT.teachers()
            .filter(t => t.status === 'active')
            .map(t => Object.assign({ name: t.name, dept: t.dept }, E.workload(t.id)))
            .sort((a, b) => b.week - a.week);
    };

    /* จำนวนครั้งที่ครูถูกจัดสอนแทน (ทั้งภาคเรียน / เดือนนี้ / สัปดาห์นี้) */
    E.substituteCount = function (teacherId) {
        const list = (TT.state.ops && TT.state.ops.substitutes) || [];
        const now = new Date();
        const monthKey = now.toISOString().slice(0, 7);
        const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
        const mine = list.filter(s => sameId(s.substituteId, teacherId) && ['awaiting', 'accepted', 'done'].includes(s.status));
        return {
            assigned: mine.length,
            month: mine.filter(s => String(s.date || '').slice(0, 7) === monthKey).length,
            week: mine.filter(s => String(s.date || '') >= weekAgo).length,
            recent: mine.slice(-5)
        };
    };

    /* ------------------------------------------------------------- ค้นหาคาบว่าง */

    /* ครูว่างจริงหรือไม่ในวัน–คาบนั้น (ตารางประจำ + งานสอนแทน + การลา) */
    E.isTeacherFree = function (teacherId, day, periodId, options) {
        const opt = options || {};
        const busy = TT.entriesOfTeacher(teacherId).some(e =>
            e.day === day && e.periodId === periodId && !sameId(e.id, opt.ignoreEntryId));
        if (busy) return false;
        if (E.teacherUnavailable(teacherId, day, periodId)) return false;

        if (opt.date) {
            if (E.isOnLeave(teacherId, opt.date, periodId)) return false;
            const already = ((TT.state.ops && TT.state.ops.substitutes) || []).some(s =>
                sameId(s.substituteId, teacherId) && s.date === opt.date && s.periodId === periodId &&
                ['awaiting', 'accepted', 'done'].includes(s.status) && !sameId(s.id, opt.ignoreRequestId));
            if (already) return false;
        }
        return true;
    };

    E.isOnLeave = function (teacherId, date, periodId) {
        const leaves = (TT.state.ops && TT.state.ops.leaves) || [];
        return leaves.some(l => {
            if (!sameId(l.teacherId, teacherId)) return false;
            if (l.status === 'cancelled') return false;
            const from = l.from, to = l.to || l.from;
            if (!(date >= from && date <= to)) return false;
            if (l.allDay) return true;
            return !periodId || (Array.isArray(l.periodIds) && l.periodIds.includes(periodId));
        });
    };

    E.freeTeachers = function (day, periodId, options) {
        return TT.teachers()
            .filter(t => t.status === 'active')
            .filter(t => E.isTeacherFree(t.id, day, periodId, options));
    };

    E.freeRooms = function (day, periodId, type) {
        const used = TT.entries().filter(e => e.day === day && e.periodId === periodId).map(e => String(e.roomId || ''));
        return TT.rooms()
            .filter(r => !type || r.type === type)
            .filter(r => !used.includes(String(r.id)));
    };

    E.freeClasses = function (day, periodId) {
        const used = TT.entries().filter(e => e.day === day && e.periodId === periodId).map(e => String(e.classId));
        return TT.classes().filter(c => !used.includes(String(c.id)));
    };

    /* หาช่วงเวลาที่ครูหลายคนว่างพร้อมกัน — ใช้จัดประชุม */
    E.commonFreeSlots = function (teacherIds, options) {
        const out = [];
        TT.days().forEach(d => {
            TT.periods().forEach(p => {
                const busy = teacherIds.filter(id => !E.isTeacherFree(id, d.id, p.id, options));
                if (!busy.length) out.push({ day: d.id, periodId: p.id, dayName: d.name, periodLabel: p.label, start: p.start, end: p.end });
            });
        });
        return out;
    };

    /* ------------------------------------------------------ คะแนนคุณภาพของตาราง */

    /* ให้คะแนนเต็ม 100 แล้วหักตามปัญหาที่พบ พร้อมคืนข้อเสนอแนะ */
    E.quality = function () {
        const rules = TT.state.settings.rules || {};
        const w = rules.weights || {};
        const entries = TT.entries();
        const issues = [];
        let penalty = 0;

        /* วิชาเดียวกันซ้ำหลายคาบในวันเดียว (ยกเว้นที่ตั้งใจให้เป็นคาบคู่) */
        const seen = {};
        entries.forEach(e => {
            const key = e.classId + '|' + e.subjectId + '|' + e.day;
            seen[key] = (seen[key] || 0) + 1;
        });
        Object.keys(seen).forEach(key => {
            if (seen[key] <= 1) return;
            const [classId, subjectId, day] = key.split('|');
            const alloc = TT.allocations().find(a => sameId(a.classId, classId) && sameId(a.subjectId, subjectId));
            const sub = TT.subject(subjectId);
            const allowed = (alloc && alloc.doublePeriod) || (sub && sub.doublePeriod);
            if (allowed && seen[key] === 2) return;
            penalty += (w.sameDayRepeat || 8) * (seen[key] - 1);
            issues.push('วิชา ' + TT.subjectName(subjectId) + ' ห้อง ' + TT.className(classId) + ' มี ' + seen[key] + ' คาบในวัน' + TT.dayName(day));
        });

        /* การกระจายคาบตลอดสัปดาห์ : วิชาที่มีหลายคาบไม่ควรกระจุกอยู่ไม่กี่วัน */
        TT.allocations().forEach(a => {
            const mine = entries.filter(e => sameId(e.classId, a.classId) && sameId(e.subjectId, a.subjectId));
            if (mine.length < 2) return;
            const daysUsed = new Set(mine.map(e => e.day)).size;
            const ideal = Math.min(TT.days().length, a.doublePeriod ? Math.ceil(mine.length / 2) : mine.length);
            if (daysUsed < ideal) penalty += (w.spread || 5) * (ideal - daysUsed);
        });

        /* วิชาหลักควรอยู่ช่วงเช้า */
        if (rules.coreMorning) {
            const order = E.periodOrder();
            const half = Math.ceil(order.length / 2);
            entries.forEach(e => {
                const sub = TT.subject(e.subjectId);
                if (!sub || !sub.isCore) return;
                if (E.periodIndex(e.periodId) >= half) penalty += (w.coreMorning || 4);
            });
        }

        /* คาบว่างแทรกและการสอนติดกันเกินกำหนดของครู */
        let totalGaps = 0, overRuns = 0;
        const loads = [];
        TT.teachers().filter(t => t.status === 'active').forEach(t => {
            const wl = E.workload(t.id);
            totalGaps += wl.gaps;
            if (wl.longestRun > Number(rules.maxConsecutive || 99)) overRuns += (wl.longestRun - rules.maxConsecutive);
            if (wl.week > 0) loads.push(wl.week);
        });
        penalty += totalGaps * (w.teacherGap || 6) / 2;
        penalty += overRuns * (w.consecutive || 5);
        if (totalGaps) issues.push('ครูมีคาบว่างแทรกระหว่างคาบสอนรวม ' + totalGaps + ' คาบ');
        if (overRuns) issues.push('มีครูสอนติดต่อกันเกิน ' + rules.maxConsecutive + ' คาบ');

        /* ความสมดุลของภาระงาน : ใช้ส่วนเบี่ยงเบนมาตรฐาน */
        if (loads.length > 1) {
            const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
            const sd = Math.sqrt(loads.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / loads.length);
            penalty += sd * (w.balance || 5);
            if (sd > 4) issues.push('ภาระงานครูต่างกันมาก (ส่วนเบี่ยงเบน ' + sd.toFixed(1) + ' คาบ)');
        }

        /* การเดินข้ามอาคารติดกัน */
        let moves = 0;
        TT.teachers().forEach(t => {
            TT.days().forEach(d => {
                const mine = TT.entriesOfTeacher(t.id).filter(e => e.day === d.id)
                    .sort((a, b) => E.periodIndex(a.periodId) - E.periodIndex(b.periodId));
                for (let i = 1; i < mine.length; i++) {
                    if (E.periodIndex(mine[i].periodId) - E.periodIndex(mine[i - 1].periodId) !== 1) continue;
                    const r1 = TT.room(mine[i - 1].roomId), r2 = TT.room(mine[i].roomId);
                    if (r1 && r2 && r1.building && r2.building && r1.building !== r2.building) moves++;
                }
            });
        });
        penalty += moves * (w.buildingMove || 3);
        if (moves) issues.push('มีการย้ายอาคารต่อเนื่อง ' + moves + ' ครั้ง');

        /* คาบที่ยังจัดไม่ครบ ถือเป็นปัญหาหลัก */
        const summary = E.allocationStatus();
        const missing = summary.reduce((s, r) => s + Math.max(0, r.missing), 0);
        penalty += missing * 12;
        if (missing) issues.push('ยังจัดคาบไม่ครบอีก ' + missing + ' คาบ');

        const total = entries.length || 1;
        const score = Math.max(0, Math.min(100, Math.round(100 - (penalty / total) * 4)));

        const advice = [];
        if (missing) advice.push('เพิ่มคาบที่ยังขาดโดยใช้ปุ่มสร้างตารางอัตโนมัติ หรือจัดด้วยมือในช่องว่างที่เหลือ');
        if (totalGaps > 5) advice.push('ย้ายคาบของครูที่มีช่องว่างแทรกให้ชิดกัน จะช่วยลดเวลารอของครู');
        if (overRuns) advice.push('กระจายคาบของครูที่สอนติดกันหลายคาบไปวันอื่น');
        if (!issues.length) advice.push('ตารางอยู่ในเกณฑ์ดี ไม่พบปัญหาที่ต้องแก้ไข');

        return { score, penalty: Math.round(penalty), issues, advice, missing };
    };

    /* -------------------------------------------------------- จัดตารางอัตโนมัติ */

    /* สร้างรายการงานที่ต้องจัด จากการจัดสรรวิชาที่ยังขาดคาบ
       คาบคู่จะถูกรวมเป็นหนึ่งงานที่ต้องวางสองคาบติดกัน */
    const buildTasks = function (onlyClassIds) {
        const tasks = [];
        E.allocationStatus().forEach(row => {
            if (onlyClassIds && onlyClassIds.length && !onlyClassIds.map(String).includes(String(row.classId))) return;
            let missing = row.missing;
            if (missing <= 0) return;
            const alloc = TT.allocations().find(a => sameId(a.id, row.allocationId));
            const sub = TT.subject(row.subjectId);
            const wantDouble = alloc && alloc.doublePeriod !== undefined ? alloc.doublePeriod : (sub && sub.doublePeriod);
            let doubles = wantDouble ? Math.floor(missing / 2) : 0;
            while (doubles-- > 0) {
                tasks.push({ alloc, size: 2 });
                missing -= 2;
            }
            while (missing-- > 0) tasks.push({ alloc, size: 1 });
        });
        return tasks;
    };

    /* ตรวจว่าวางงานนี้ที่วัน–คาบนี้ได้หรือไม่ (เงื่อนไขบังคับเท่านั้น) */
    const canPlace = function (task, day, periodId, working) {
        const a = task.alloc;
        const order = E.periodOrder();
        const start = order.indexOf(periodId);
        if (start < 0) return false;
        if (start + task.size > order.length) return false;

        for (let k = 0; k < task.size; k++) {
            const pid = order[start + k];
            if (working.some(e => sameId(e.classId, a.classId) && e.day === day && e.periodId === pid)) return false;
            const teachers = [a.teacherId].concat(a.coTeacherIds || []).filter(Boolean).map(String);
            const teacherBusy = working.some(e => e.day === day && e.periodId === pid &&
                [e.teacherId].concat(e.coTeacherIds || []).filter(Boolean).map(String).some(id => teachers.includes(id)));
            if (teacherBusy) return false;
            if (teachers.some(id => E.teacherUnavailable(id, day, pid))) return false;
            const roomId = a.roomId || (TT.subject(a.subjectId) || {}).roomId;
            if (roomId && working.some(e => sameId(e.roomId, roomId) && e.day === day && e.periodId === pid)) return false;
            if (Array.isArray(a.avoidDays) && a.avoidDays.includes(day)) return false;
            if (Array.isArray(a.avoidPeriods) && a.avoidPeriods.includes(pid)) return false;

            const rules = TT.state.settings.rules || {};
            const classCount = working.filter(e => sameId(e.classId, a.classId) && e.day === day).length;
            if (classCount + task.size > Number(rules.maxPerDayClass || 99)) return false;
            const teacherCount = working.filter(e => e.day === day &&
                [e.teacherId].concat(e.coTeacherIds || []).map(String).includes(String(a.teacherId))).length;
            if (teacherCount + task.size > Number(rules.maxPerDayTeacher || 99)) return false;
        }
        return true;
    };

    /* คะแนนของช่องที่จะวาง ยิ่งมากยิ่งดี — ใช้เงื่อนไขเพื่อคุณภาพตาราง */
    const slotScore = function (task, day, periodId, working) {
        const a = task.alloc;
        const rules = TT.state.settings.rules || {};
        const w = rules.weights || {};
        const order = E.periodOrder();
        const idx = order.indexOf(periodId);
        let score = 0;

        /* เลี่ยงวิชาเดิมซ้ำวัน */
        const sameDay = working.filter(e => sameId(e.classId, a.classId) && sameId(e.subjectId, a.subjectId) && e.day === day).length;
        score -= sameDay * (w.sameDayRepeat || 8) * 2;

        /* วันที่ผู้จัดตารางอยากให้จัด */
        if (Array.isArray(a.preferDays) && a.preferDays.includes(day)) score += 15;
        if (Array.isArray(a.preferPeriods) && a.preferPeriods.includes(periodId)) score += 10;

        /* วิชาหลักช่วงเช้า */
        const sub = TT.subject(a.subjectId);
        if (rules.coreMorning && sub && sub.isCore) {
            score += (order.length - idx) * (w.coreMorning || 4) / 2;
        }

        /* ลดคาบว่างแทรกของครู : ให้คะแนนถ้าติดกับคาบสอนเดิมของครูในวันนั้น */
        const tIdxs = working.filter(e => e.day === day &&
            [e.teacherId].concat(e.coTeacherIds || []).map(String).includes(String(a.teacherId)))
            .map(e => order.indexOf(e.periodId));
        if (tIdxs.length) {
            const nearest = Math.min.apply(null, tIdxs.map(i => Math.abs(i - idx)));
            score += (w.teacherGap || 6) * (nearest === 1 ? 2 : (nearest === 2 ? 0 : -1));
            /* แต่ต้องไม่สอนติดกันยาวเกินกำหนด */
            let run = 1;
            for (let k = idx - 1; k >= 0 && tIdxs.includes(k); k--) run++;
            for (let k = idx + task.size; k < order.length && tIdxs.includes(k); k++) run++;
            if (run > Number(rules.maxConsecutive || 99)) score -= (w.consecutive || 5) * 4;
        }

        /* กระจายภาระงานของครูให้สมดุลรายวัน */
        const teacherDay = tIdxs.length;
        score -= teacherDay * 1.5;

        /* ลดการย้ายอาคาร */
        const roomId = a.roomId || (sub || {}).roomId;
        if (roomId) {
            const r = TT.room(roomId);
            const adj = working.filter(e => e.day === day &&
                Math.abs(order.indexOf(e.periodId) - idx) === 1 &&
                [e.teacherId].concat(e.coTeacherIds || []).map(String).includes(String(a.teacherId)));
            adj.forEach(e => {
                const r2 = TT.room(e.roomId);
                if (r && r2 && r.building && r2.building && r.building !== r2.building) score -= (w.buildingMove || 3) * 2;
            });
        }

        /* กระจายให้เต็มสัปดาห์ : วันที่ห้องนี้ยังว่างมากได้เปรียบ */
        const dayLoad = working.filter(e => sameId(e.classId, a.classId) && e.day === day).length;
        score -= dayLoad * (w.spread || 5) / 2;

        return score;
    };

    /* เดินจัดหนึ่งรอบ คืนผลลัพธ์ที่ได้ */
    const runOnce = function (tasks, keepEntries, shuffle) {
        const working = keepEntries.slice();
        const unplaced = [];
        const days = TT.days().map(d => d.id);
        const order = E.periodOrder();

        /* จัดงานที่ทางเลือกน้อยก่อน (most constrained first) */
        const withOptions = tasks.map(t => {
            let count = 0;
            days.forEach(d => order.forEach(p => { if (canPlace(t, d, p, working)) count++; }));
            return { task: t, options: count };
        }).sort((a, b) => a.options - b.options);

        withOptions.forEach(item => {
            const t = item.task;
            const candidates = [];
            days.forEach(d => order.forEach(p => {
                if (!canPlace(t, d, p, working)) return;
                candidates.push({ day: d, periodId: p, score: slotScore(t, d, p, working) + (shuffle ? Math.random() * 6 : 0) });
            }));
            if (!candidates.length) { unplaced.push(t); return; }
            candidates.sort((a, b) => b.score - a.score);
            const best = candidates[0];
            const startIdx = order.indexOf(best.periodId);
            for (let k = 0; k < t.size; k++) {
                const a = t.alloc;
                working.push({
                    id: TT.uid('en'),
                    classId: a.classId,
                    subjectId: a.subjectId,
                    teacherId: a.teacherId,
                    coTeacherIds: a.coTeacherIds || [],
                    roomId: a.roomId || (TT.subject(a.subjectId) || {}).roomId || '',
                    day: best.day,
                    periodId: order[startIdx + k],
                    locked: false,
                    kind: 'subject',
                    auto: true
                });
            }
        });

        return { entries: working, unplaced };
    };

    /* จัดตารางอัตโนมัติ
       options = { classIds:[], keepLocked:true, attempts:8 } */
    E.autoGenerate = function (options) {
        const opt = Object.assign({ keepLocked: true, attempts: 8 }, options || {});
        const scope = (opt.classIds || []).map(String);
        const inScope = (e) => !scope.length || scope.includes(String(e.classId));

        /* คาบที่ล็อกไว้และคาบของห้องที่ไม่อยู่ในขอบเขต จะไม่ถูกแตะต้อง */
        const keep = TT.entries().filter(e => !inScope(e) || (opt.keepLocked && e.locked) || e.kind === 'activity');
        const tasksBase = (function () {
            const backup = TT.state.plan.entries;
            TT.state.plan.entries = keep;
            const t = buildTasks(scope);
            TT.state.plan.entries = backup;
            return t;
        })();

        let best = null;
        for (let i = 0; i < opt.attempts; i++) {
            const result = runOnce(tasksBase, keep, i > 0);
            const backup = TT.state.plan.entries;
            TT.state.plan.entries = result.entries;
            const q = E.quality();
            TT.state.plan.entries = backup;
            const fitness = q.score - result.unplaced.length * 10;
            if (!best || fitness > best.fitness) {
                best = { fitness, entries: result.entries, unplaced: result.unplaced, quality: q };
            }
            if (result.unplaced.length === 0 && q.score >= 95) break;
        }

        return {
            entries: best.entries,
            placed: best.entries.length - keep.length,
            unplaced: best.unplaced.map(t => ({
                classId: t.alloc.classId,
                subjectId: t.alloc.subjectId,
                size: t.size,
                reason: 'ไม่พบช่องที่ผ่านเงื่อนไขบังคับทั้งหมด'
            })),
            quality: best.quality
        };
    };

    /* ------------------------------------------------------ ค้นหาครูสอนแทน */

    /* สร้างรายการคาบที่ต้องหาครูสอนแทน จากใบลาหนึ่งใบ */
    E.periodsNeedingCover = function (leave) {
        const out = [];
        const dates = TT.datesBetween(leave.from, leave.to || leave.from);
        dates.forEach(date => {
            const dayId = TT.dayIdOfDate(date);
            if (!TT.days().some(d => d.id === dayId)) return;      // วันหยุดของโรงเรียน
            TT.entriesOfTeacher(leave.teacherId)
                .filter(e => e.day === dayId)
                .filter(e => leave.allDay || (Array.isArray(leave.periodIds) && leave.periodIds.includes(e.periodId)))
                .forEach(e => {
                    out.push({
                        date, day: dayId, periodId: e.periodId,
                        classId: e.classId, subjectId: e.subjectId,
                        roomId: e.roomId || '', entryId: e.id
                    });
                });
        });
        return out;
    };

    /* จัดอันดับครูที่เหมาะจะสอนแทน พร้อมเหตุผลประกอบการตัดสินใจ
       request = { date, day, periodId, classId, subjectId, teacherId(ครูที่ขาด) } */
    E.rankSubstitutes = function (request) {
        const rules = TT.state.settings.rules || {};
        const absent = String(request.teacherId || '');
        const subject = TT.subject(request.subjectId);
        const cls = TT.classById(request.classId);
        const grade = cls ? cls.grade : '';

        const free = TT.teachers()
            .filter(t => t.status === 'active')
            .filter(t => !sameId(t.id, absent))
            .filter(t => E.isTeacherFree(t.id, request.day, request.periodId, {
                date: request.date, ignoreRequestId: request.id
            }));

        return free.map(t => {
            const wl = E.workload(t.id);
            const subs = E.substituteCount(t.id);
            let score = 50;
            const reasons = [];

            /* 1. ครูที่สอนวิชาเดียวกัน */
            const teachesSame = TT.entries().some(e => sameId(e.teacherId, t.id) && sameId(e.subjectId, request.subjectId)) ||
                (t.canTeachSubjects || []).map(String).includes(String(request.subjectId));
            if (teachesSame) { score += 30; reasons.push('สอนวิชา' + TT.subjectName(request.subjectId) + 'อยู่แล้ว'); }

            /* 2. กลุ่มสาระเดียวกัน */
            if (subject && subject.dept && t.dept && subject.dept === t.dept) {
                score += 18; reasons.push('อยู่กลุ่มสาระ' + t.dept + 'เดียวกัน');
            }
            if (subject && t.major && subject.name.includes(t.major)) {
                score += 8; reasons.push('วิชาเอก' + t.major);
            }

            /* 3. เคยสอนระดับชั้นนี้ */
            const taughtGrade = TT.entries().some(e => sameId(e.teacherId, t.id) && (TT.classById(e.classId) || {}).grade === grade) ||
                (t.canTeachGrades || []).includes(grade);
            if (taughtGrade) { score += 12; reasons.push('เคยสอนระดับชั้น ' + grade); }

            /* 4. ครูประจำชั้นหรือครูที่รู้จักนักเรียนห้องนี้ */
            if (TT.homeroomOf(t.id).map(String).includes(String(request.classId))) {
                score += 22; reasons.push('เป็นครูประจำชั้นห้องนี้');
            } else if (TT.entries().some(e => sameId(e.teacherId, t.id) && sameId(e.classId, request.classId))) {
                score += 10; reasons.push('สอนห้องนี้ในวิชาอื่น');
            }

            /* 5. ถูกจัดสอนแทนน้อยที่สุด */
            score -= subs.month * 4;
            if (subs.month === 0) { score += 8; reasons.push('เดือนนี้ยังไม่เคยสอนแทน'); }
            else reasons.push('เดือนนี้สอนแทนแล้ว ' + subs.month + ' ครั้ง');

            /* 6. ภาระงานรวมต่ำกว่า */
            score += Math.max(-15, (20 - wl.week) * 0.8);
            if (t.maxPeriods && wl.week + subs.week >= t.maxPeriods) {
                score -= 25; reasons.push('ภาระงานใกล้เกินเกณฑ์');
            }
            if (rules.substituteMaxPerWeek && subs.week >= rules.substituteMaxPerWeek) {
                score -= 30; reasons.push('สัปดาห์นี้สอนแทนครบเพดานแล้ว');
            }

            /* 7. ไม่มีคาบสอนติดกันก่อนและหลังมากเกินไป */
            const prev = E.prevPeriod(request.periodId), next = E.nextPeriod(request.periodId);
            const around = [prev, next].filter(Boolean)
                .filter(pid => TT.entriesOfTeacher(t.id).some(e => e.day === request.day && e.periodId === pid)).length;
            score -= around * 6;
            if (around === 2) reasons.push('มีคาบสอนติดกันทั้งก่อนและหลัง');
            else if (around === 0) { score += 5; reasons.push('คาบก่อนและหลังว่าง'); }

            /* 8. อยู่อาคารใกล้เคียง */
            const room = TT.room(cls && cls.roomId) || TT.room(request.roomId);
            if (room && room.building && t.building && room.building === t.building) {
                score += 6; reasons.push('อยู่' + t.building + 'เดียวกับห้องเรียน');
            }

            /* 9. ไม่ถูกมอบหมายติดต่อกันหลายวัน */
            const yesterday = new Date(new Date(request.date).getTime() - 86400000).toISOString().slice(0, 10);
            const consecutiveDays = ((TT.state.ops && TT.state.ops.substitutes) || [])
                .some(s => sameId(s.substituteId, t.id) && s.date === yesterday && ['awaiting', 'accepted', 'done'].includes(s.status));
            if (consecutiveDays) { score -= 10; reasons.push('เพิ่งสอนแทนเมื่อวาน'); }

            const dayCount = TT.entriesOfTeacher(t.id).filter(e => e.day === request.day).length;

            return {
                teacherId: t.id,
                name: t.name,
                dept: t.dept,
                major: t.major,
                canTeach: (t.canTeachSubjects || []).map(id => TT.subjectName(id)).filter(Boolean),
                prevPeriod: prev ? describeSlot(t.id, request.day, prev) : '—',
                nextPeriod: next ? describeSlot(t.id, request.day, next) : '—',
                dayPeriods: dayCount,
                weekPeriods: wl.week,
                monthSubs: subs.month,
                score: Math.round(Math.max(0, Math.min(100, score))),
                reasons
            };
        }).sort((a, b) => b.score - a.score);
    };

    const describeSlot = function (teacherId, day, periodId) {
        const e = TT.entriesOfTeacher(teacherId).find(x => x.day === day && x.periodId === periodId);
        if (!e) return 'ว่าง';
        return TT.subjectName(e.subjectId) + ' (' + TT.className(e.classId) + ')';
    };

    /* เลือกครูที่เหมาะที่สุดโดยอัตโนมัติ */
    E.bestSubstitute = function (request) {
        const list = E.rankSubstitutes(request);
        return list.length ? list[0] : null;
    };
})();
