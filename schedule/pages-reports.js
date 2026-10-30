/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — แดชบอร์ด ภาระงานครู และรายงาน
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT;
    const UI = window.TTUI;
    const E = window.TTEngine;
    const P = window.TTPages = window.TTPages || {};
    const $ = (id) => document.getElementById(id);

    const today = () => TT.today();
    const todayDayId = () => TT.dayIdOfDate(today());

    /* =====================================================================
       แดชบอร์ด
       ===================================================================== */

    P.dashboard = function (root) {
        if (TT.can('viewAll')) managerDashboard(root);
        else teacherDashboard(root);
    };

    const managerDashboard = function (root) {
        const teachers = TT.teachers().filter(t => t.status === 'active');
        const classes = TT.classes();
        const subjects = TT.subjects();
        const status = E.allocationStatus();
        const required = status.reduce((s, r) => s + r.required, 0);
        const placed = status.reduce((s, r) => s + r.placed, 0);
        const issues = E.validateAll();
        const errors = issues.filter(i => i.level === 'error');
        const q = E.quality();

        const subs = TT.state.ops.substitutes || [];
        const leavesToday = (TT.state.ops.leaves || []).filter(l =>
            l.status !== 'cancelled' && today() >= l.from && today() <= (l.to || l.from));
        const uncovered = TT.activeSubstitutes().filter(s => !s.substituteId);
        const awaiting = subs.filter(s => s.status === 'awaiting');
        const proposed = TT.activeSubstitutes().filter(s => s.status === 'proposed');

        root.innerHTML =
            TTApp.termBar() +
            `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                ${UI.stat('ครูทั้งหมด', teachers.length, 'ph-users-three', 'blue')}
                ${UI.stat('ห้องเรียน', classes.length, 'ph-student', 'sky')}
                ${UI.stat('รายวิชา', subjects.length, 'ph-books', 'green')}
                ${UI.stat('คาบที่จัดแล้ว', placed, 'ph-check-square', 'green', 'จากทั้งหมด ' + required + ' คาบ')}
                ${UI.stat('คาบที่ยังขาด', Math.max(0, required - placed), 'ph-warning-circle', 'amber')}
                ${UI.stat('ปัญหาคาบชน', errors.length, 'ph-x-circle', errors.length ? 'rose' : 'slate')}
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
                <!-- งานเร่งด่วน -->
                <div class="modern-card p-5 lg:col-span-2">
                    <h3 class="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><i class="ph ph-bell-ringing text-amber-500 text-xl"></i> งานเร่งด่วนวันนี้</h3>
                    <div class="space-y-2">
                        ${alertRow(uncovered.length, 'คาบที่ยังไม่มีครูสอนแทน', 'ph-user-x', 'rose', 'substitutes')}
                        ${alertRow(proposed.length, 'ครูเสนอชื่อไว้ รอท่านอนุมัติ', 'ph-user-switch', 'amber', 'substitutes')}
                        ${alertRow(awaiting.length, 'คาบที่รอครูยืนยันรับทราบ', 'ph-hourglass', 'amber', 'substitutes')}
                        ${alertRow(leavesToday.length, 'ครูที่ลาในวันนี้', 'ph-user-minus', 'blue', 'leaves')}
                        ${alertRow(errors.length, 'ข้อผิดพลาดร้ายแรงในตาราง', 'ph-warning-octagon', 'rose', 'editor')}
                        ${alertRow(Math.max(0, required - placed), 'คาบที่ยังจัดไม่ครบตามหลักสูตร', 'ph-list-checks', 'amber', 'editor')}
                    </div>
                </div>

                <!-- คะแนนคุณภาพ -->
                <div class="modern-card p-5">
                    <h3 class="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><i class="ph ph-gauge text-blue-600 text-xl"></i> คุณภาพตารางสอน</h3>
                    <div class="text-center py-2">
                        <div class="w-28 h-28 rounded-full mx-auto grid place-items-center text-white font-extrabold text-4xl shadow-lg ${q.score >= 80 ? 'bg-emerald-500' : (q.score >= 60 ? 'bg-amber-500' : 'bg-rose-500')}">${q.score}</div>
                        <div class="mt-3 font-bold text-slate-600">${q.score >= 80 ? 'ตารางอยู่ในเกณฑ์ดี' : (q.score >= 60 ? 'ควรปรับปรุงบางจุด' : 'ควรปรับปรุงเร่งด่วน')}</div>
                        <div class="text-xs text-slate-400 font-semibold mt-1">${UI.esc(q.advice[0] || '')}</div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-slate-100 text-sm">
                        <div class="flex justify-between py-1"><span class="text-slate-500 font-semibold">สถานะตาราง</span>
                            <span class="font-bold ${TT.state.plan.status === 'published' ? 'text-emerald-600' : 'text-amber-600'}">${TT.state.plan.status === 'published' ? 'ประกาศใช้แล้ว' : 'ฉบับร่าง'}</span></div>
                        <div class="flex justify-between py-1"><span class="text-slate-500 font-semibold">ฉบับที่</span><span class="font-bold text-slate-700">${TT.state.plan.version || 1}</span></div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <!-- ครูที่ลาวันนี้ -->
                <div class="modern-card p-5">
                    <h3 class="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><i class="ph ph-user-minus text-rose-500 text-xl"></i> ครูที่ไม่อยู่วันนี้</h3>
                    ${leavesToday.length ? `<div class="space-y-2">${leavesToday.map(l => {
                const covers = subs.filter(s => String(s.leaveId) === String(l.id) && s.date === today());
                const ok = covers.filter(s => ['accepted', 'done'].includes(s.status)).length;
                return `<div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <div>
                                <div class="font-bold text-slate-800">${UI.esc(TT.teacherName(l.teacherId))}</div>
                                <div class="text-xs text-slate-500 font-semibold">${UI.esc(TT.LEAVE_TYPES[l.type] || '')} · ${l.allDay ? 'ทั้งวัน' : (l.periodIds || []).length + ' คาบ'}</div>
                            </div>
                            <div class="text-xs font-bold ${covers.length && ok === covers.length ? 'text-emerald-600' : 'text-amber-600'}">สอนแทน ${ok}/${covers.length}</div>
                        </div>`;
            }).join('')}</div>` : UI.empty('วันนี้ครูมาครบทุกท่าน', 'ph-smiley')}
                </div>

                <!-- ตารางเรียนประจำวัน -->
                <div class="modern-card p-5">
                    <h3 class="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><i class="ph ph-calendar-check text-blue-600 text-xl"></i> ภาพรวมคาบเรียนวันนี้ (วัน${UI.esc(TT.dayName(todayDayId()))})</h3>
                    ${todayOverview()}
                </div>
            </div>`;
    };

    const alertRow = function (count, label, icon, tone, page) {
        const tones = {
            rose: 'bg-rose-50 text-rose-700 border-rose-100',
            amber: 'bg-amber-50 text-amber-800 border-amber-100',
            blue: 'bg-blue-50 text-blue-700 border-blue-100'
        };
        const dull = 'bg-slate-50 text-slate-400 border-slate-100';
        return `
        <button onclick="TTApp.go('${page}')" class="w-full flex items-center gap-3 p-3 rounded-xl border ${count ? tones[tone] : dull} text-left tactile-btn">
            <i class="ph ${icon} text-xl shrink-0"></i>
            <span class="font-bold flex-1">${UI.esc(label)}</span>
            <span class="font-extrabold text-lg">${count}</span>
            <i class="ph ph-caret-right"></i>
        </button>`;
    };

    const todayOverview = function () {
        const day = todayDayId();
        if (!TT.days().some(d => d.id === day)) return UI.empty('วันนี้ไม่ใช่วันเรียน', 'ph-moon');
        const periods = TT.periods();
        const rows = periods.map(p => {
            const list = TT.entries().filter(e => e.day === day && e.periodId === p.id);
            return `<tr class="border-b border-slate-50">
                <td class="py-2 pr-3 font-bold text-slate-600 whitespace-nowrap">${UI.esc(p.label)}</td>
                <td class="py-2 text-slate-500 text-sm">${UI.esc(p.start)}–${UI.esc(p.end)}</td>
                <td class="py-2 text-right font-extrabold text-blue-700">${list.length} คาบ</td>
            </tr>`;
        }).join('');
        return `<table class="w-full text-sm"><tbody>${rows}</tbody></table>`;
    };

    /* --------------------------------------------------------- แดชบอร์ดของครู */

    const teacherDashboard = function (root) {
        const me = TT.state.user.id;
        const day = todayDayId();
        const w = E.workload(me);
        const mine = TT.entriesOfTeacher(me).filter(e => e.day === day)
            .sort((a, b) => E.periodIndex(a.periodId) - E.periodIndex(b.periodId));

        /* คาบถัดไปของวันนี้ เทียบกับเวลาปัจจุบัน */
        const now = new Date();
        const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
        const next = mine.find(e => {
            const p = TT.period(e.periodId);
            return p && p.end > hhmm;
        });

        const mySubs = (TT.state.ops.substitutes || []).filter(s =>
            String(s.substituteId) === String(me) && ['awaiting', 'accepted'].includes(s.status));
        const waiting = mySubs.filter(s => s.status === 'awaiting');

        root.innerHTML =
            TTApp.termBar() +
            `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                ${UI.stat('คาบสอนวันนี้', mine.filter(TT.isTeachingEntry).length, 'ph-chalkboard-teacher', 'blue')}
                ${UI.stat('คาบสอนทั้งสัปดาห์', w.week, 'ph-calendar', 'sky', w.homeroom ? 'ไม่รวมแนะแนว/โฮมรูม ' + w.homeroom + ' คาบ' : '')}
                ${UI.stat('คาบว่างทั้งสัปดาห์', w.free, 'ph-coffee', 'green')}
                ${UI.stat('งานสอนแทนที่ได้รับ', mySubs.length, 'ph-arrows-left-right', waiting.length ? 'rose' : 'slate', waiting.length ? 'รอยืนยัน ' + waiting.length + ' รายการ' : '')}
            </div>

            <div class="flex flex-wrap gap-2 mb-5 no-print">
                <button onclick="TTPages.openLeaveForm('')" class="tactile-btn px-5 py-3 rounded-2xl font-bold text-white brand-gradient shadow-lg"><i class="ph ph-user-minus mr-1"></i> แจ้งขาด / ลา</button>
                <button onclick="TTApp.go('substitutes')" class="tactile-btn px-5 py-3 rounded-2xl font-bold text-slate-700 bg-white border border-slate-200"><i class="ph ph-check-square mr-1"></i> ยืนยันการสอนแทน${waiting.length ? ' (' + waiting.length + ')' : ''}</button>
                <button onclick="TTPages.printMyTimetable()" class="tactile-btn px-5 py-3 rounded-2xl font-bold text-slate-700 bg-white border border-slate-200"><i class="ph ph-printer mr-1"></i> พิมพ์ตารางสอนของฉัน</button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
                <div class="modern-card p-5 lg:col-span-2">
                    <h3 class="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><i class="ph ph-calendar-check text-blue-600 text-xl"></i> ตารางสอนวันนี้ (วัน${UI.esc(TT.dayName(day) || '—')})</h3>
                    ${mine.length ? `<div class="space-y-2">${mine.map(e => {
                const p = TT.period(e.periodId) || {};
                const sub = TT.subject(e.subjectId) || {};
                const isNext = next && next.id === e.id;
                return `<div class="flex items-center gap-3 p-3 rounded-xl border ${isNext ? 'border-blue-300 bg-blue-50/60' : 'border-slate-100 bg-slate-50/60'}">
                            <div class="w-14 text-center shrink-0">
                                <div class="font-extrabold text-slate-700 text-sm">${UI.esc((p.label || '').replace('คาบที่ ', 'คาบ '))}</div>
                                <div class="text-[11px] text-slate-400 font-semibold">${UI.esc(p.start || '')}</div>
                            </div>
                            <div class="w-1.5 h-10 rounded-full shrink-0" style="background:${UI.esc(sub.color || '#cbd5e1')}"></div>
                            <div class="min-w-0 flex-1">
                                <div class="font-bold text-slate-800 truncate">${UI.esc(e.kind === 'activity' ? e.label : sub.name)}</div>
                                <div class="text-xs text-slate-500 font-semibold">${UI.esc(TT.className(e.classId))}${e.roomId ? ' · ' + UI.esc(TT.roomName(e.roomId)) : ''}</div>
                            </div>
                            ${isNext ? UI.badge('คาบถัดไป', 'bg-blue-100 text-blue-700 border-blue-200') : ''}
                        </div>`;
            }).join('')}</div>` : UI.empty('วันนี้ไม่มีคาบสอน', 'ph-coffee')}
                </div>

                <div class="modern-card p-5">
                    <h3 class="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><i class="ph ph-arrows-left-right text-amber-500 text-xl"></i> งานสอนแทนของฉัน</h3>
                    ${mySubs.length ? `<div class="space-y-2">${mySubs.map(s => `
                        <div class="p-3 rounded-xl border ${s.status === 'awaiting' ? 'border-amber-200 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/50'}">
                            <div class="font-bold text-slate-800 text-sm">${UI.esc(TT.subjectName(s.subjectId))} · ${UI.esc(TT.className(s.classId))}</div>
                            <div class="text-xs text-slate-600 font-semibold">${TT.thaiDate(s.date)} ${UI.esc(TT.periodLabel(s.periodId))}</div>
                            <div class="text-xs text-slate-500">แทนครู${UI.esc(TT.teacherName(s.teacherId))}</div>
                            ${s.status === 'awaiting' ? `<div class="flex gap-1.5 mt-2">
                                <button onclick="TTPages.acknowledgeSub('${s.id}')" class="tactile-btn flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600">รับทราบ</button>
                                <button onclick="TTPages.declineSub('${s.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-rose-200 text-rose-600">ปฏิเสธ</button>
                            </div>` : `<div class="text-[11px] font-bold text-emerald-700 mt-1"><i class="ph ph-check-circle"></i> รับทราบแล้ว</div>`}
                        </div>`).join('')}</div>` : UI.empty('ยังไม่มีงานสอนแทน', 'ph-check-circle')}
                </div>
            </div>

            <div class="modern-card p-5">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-extrabold text-slate-800 flex items-center gap-2"><i class="ph ph-calendar text-blue-600 text-xl"></i> ตารางสอนประจำสัปดาห์</h3>
                    <button onclick="TTApp.go('timetable')" class="text-sm font-bold text-blue-600">ดูแบบเต็ม <i class="ph ph-caret-right"></i></button>
                </div>
                <div class="tt-wrap">${TTPages.buildGrid({ view: 'teacher', targetId: me, editable: false, swap: TT.state.filters.swap })}</div>
            </div>`;
    };

    P.printMyTimetable = function () {
        const me = TT.state.user.id;
        UI.printPreview('ตารางสอนของฉัน', () =>
            '<div class="tt-page"><div class="tt-slot">' +
            UI.printHeader('ตารางสอนรายครู : ' + TT.teacherName(me)) +
            TTPages.paperGrid('teacher', me) +
            UI.printSignatures() +
            '</div></div>', 'landscape');
    };

    /* =====================================================================
       ภาระงานครู
       ===================================================================== */

    let workloadChart = null;

    P.workload = function (root) {
        const canAll = TT.can('viewAll');
        const rows = canAll ? E.workloadAll()
            : [Object.assign({ name: TT.teacherName(TT.state.user.id) }, E.workload(TT.state.user.id))];

        root.innerHTML =
            TTApp.termBar(canAll ? `<button onclick="TTPages.exportWorkload()" class="tactile-btn px-4 py-2 rounded-xl font-bold bg-white border border-slate-200 text-slate-600"><i class="ph ph-file-xls mr-1"></i> ส่งออก Excel</button>` : '') +
            UI.pageHeader('ภาระงานครู', 'จำนวนคาบสอนต่อสัปดาห์ คาบว่าง คาบสอนแทน และการเทียบกับเกณฑ์ที่กำหนด') +
            (canAll ? `<div class="modern-card p-5 mb-5"><canvas id="chart-workload" height="110"></canvas></div>` : '') +
            `<div class="modern-card overflow-hidden">
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left text-sm min-w-[860px]">
                        <thead class="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-extrabold">
                            <tr>
                                <th class="p-3">ครู</th>
                                <th class="p-3">กลุ่มสาระ</th>
                                ${TT.days().map(d => `<th class="p-3 text-center">${UI.esc(d.name)}</th>`).join('')}
                                <th class="p-3 text-center">รวม/สัปดาห์</th>
                                <th class="p-3 text-center">ชั่วโมง</th>
                                <th class="p-3 text-center" title="คาบแนะแนวและโฮมรูม ไม่นับรวมในคาบสอน">แนะแนว/โฮมรูม</th>
                                <th class="p-3 text-center">คาบว่างแทรก</th>
                                <th class="p-3 text-center">สอนแทน</th>
                                <th class="p-3 text-center">เทียบเกณฑ์</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${rows.map(w => `
                            <tr class="hover:bg-blue-50/40 ${w.overMax ? 'bg-rose-50/40' : (w.underMin ? 'bg-amber-50/30' : '')}">
                                <td class="p-3 font-bold text-slate-800">${UI.esc(w.name)}</td>
                                <td class="p-3 text-slate-500">${UI.esc(w.dept || '—')}</td>
                                ${TT.days().map(d => `<td class="p-3 text-center font-semibold text-slate-600">${w.perDay[d.id] || 0}</td>`).join('')}
                                <td class="p-3 text-center font-extrabold text-blue-700">${w.week}</td>
                                <td class="p-3 text-center font-semibold">${w.hours}</td>
                                <td class="p-3 text-center font-semibold text-violet-600">${w.homeroom || 0}</td>
                                <td class="p-3 text-center ${w.gaps > 3 ? 'text-amber-600 font-bold' : 'text-slate-500'}">${w.gaps}</td>
                                <td class="p-3 text-center font-semibold">${w.substitutes}</td>
                                <td class="p-3 text-center">${w.overMax ? UI.badge('เกินเกณฑ์', 'bg-rose-100 text-rose-700 border-rose-200')
                    : (w.underMin ? UI.badge('ต่ำกว่าเกณฑ์', 'bg-amber-100 text-amber-700 border-amber-200')
                        : UI.badge('อยู่ในเกณฑ์', 'bg-emerald-100 text-emerald-700 border-emerald-200'))}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;

        if (canAll && window.Chart) {
            const ctx = $('chart-workload');
            if (workloadChart) { workloadChart.destroy(); workloadChart = null; }
            workloadChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: rows.map(r => r.name),
                    datasets: [{
                        label: 'คาบสอนต่อสัปดาห์',
                        data: rows.map(r => r.week),
                        backgroundColor: rows.map(r => r.overMax ? '#f43f5e' : (r.underMin ? '#f59e0b' : '#3b82f6')),
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (c) => c.parsed.y + ' คาบ/สัปดาห์' } }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { font: { family: 'Sarabun' } } },
                        x: { ticks: { font: { family: 'Sarabun', size: 10 } } }
                    }
                }
            });
        }
    };

    P.exportWorkload = function () {
        const rows = [['ครู', 'กลุ่มสาระ'].concat(TT.days().map(d => d.name))
            .concat(['รวมต่อสัปดาห์', 'ชั่วโมงสอน', 'แนะแนว/โฮมรูม (ไม่นับคาบสอน)', 'คาบว่างแทรก', 'สอนแทน', 'ขั้นต่ำ', 'สูงสุด', 'สถานะ'])];
        E.workloadAll().forEach(w => {
            rows.push([w.name, w.dept].concat(TT.days().map(d => w.perDay[d.id] || 0))
                .concat([w.week, w.hours, w.homeroom || 0, w.gaps, w.substitutes, w.min || '', w.max || '',
                w.overMax ? 'เกินเกณฑ์' : (w.underMin ? 'ต่ำกว่าเกณฑ์' : 'อยู่ในเกณฑ์')]));
        });
        UI.exportExcel([{ name: 'ภาระงานครู', rows }], 'รายงานภาระงานครู');
    };

    /* =====================================================================
       ประวัติและสถิติการลา–การสอนแทน (ย้อนหลังรายวัน/สัปดาห์/เดือน/ปี)
       ===================================================================== */

    const RANGES = {
        day: 'รายวัน',
        week: 'รายสัปดาห์',
        month: 'รายเดือน',
        year: 'รายปี',
        custom: 'กำหนดเอง'
    };

    /* ช่วงวันที่ของตัวเลือกแต่ละแบบ โดยอิงจากวันที่ตั้งต้นที่ผู้ใช้เลือก */
    const rangeOf = function (mode, anchor, from, to) {
        const d = new Date(anchor + 'T00:00:00');
        /* ประกอบวันที่จากค่าตามเวลาท้องถิ่น ห้ามใช้ toISOString เพราะจะแปลงเป็น UTC
           แล้วไทย (UTC+7) จะได้วันที่คลาดไปหนึ่งวันเสมอ */
        const iso = (x) => x.getFullYear() + '-' +
            String(x.getMonth() + 1).padStart(2, '0') + '-' +
            String(x.getDate()).padStart(2, '0');
        if (mode === 'day') return { from: anchor, to: anchor };
        if (mode === 'week') {
            const dow = (d.getDay() + 6) % 7;                 /* ให้วันจันทร์เป็นวันแรก */
            const start = new Date(d); start.setDate(d.getDate() - dow);
            const end = new Date(start); end.setDate(start.getDate() + 6);
            return { from: iso(start), to: iso(end) };
        }
        if (mode === 'month') {
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            return { from: iso(start), to: iso(end) };
        }
        if (mode === 'year') {
            return { from: iso(new Date(d.getFullYear(), 0, 1)), to: iso(new Date(d.getFullYear(), 11, 31)) };
        }
        return { from: from || anchor, to: to || anchor };
    };

    /* วันที่ที่ใบลาหนึ่งใบกินพื้นที่ ตัดเฉพาะส่วนที่อยู่ในช่วงที่ดู */
    const leaveDaysInRange = function (l, from, to) {
        const a = l.from > from ? l.from : from;
        const b = (l.to || l.from) < to ? (l.to || l.from) : to;
        if (a > b) return [];
        return TT.datesBetween(a, b);
    };

    P.stats = function (root) {
        const f = TT.state.filters;
        if (!f.statMode) f.statMode = 'month';
        if (!f.statAnchor) f.statAnchor = today();

        const r = rangeOf(f.statMode, f.statAnchor, f.statFrom, f.statTo);
        const inRange = (date) => date >= r.from && date <= r.to;

        const leaves = TT.activeLeaves().filter(l => !(l.to || l.from) || !(l.from > r.to || (l.to || l.from) < r.from));
        const subs = TT.activeSubstitutes().filter(s => inRange(s.date));
        const covered = subs.filter(s => ['accepted', 'done'].includes(s.status));

        /* สถิติรายครู */
        const stat = {};
        const touch = (id) => (stat[id] = stat[id] || { leaveCount: 0, leaveDays: 0, absentPeriods: 0, coverPeriods: 0 });
        leaves.forEach(l => {
            const st = touch(l.teacherId);
            st.leaveCount++;
            st.leaveDays += leaveDaysInRange(l, r.from, r.to).length;
        });
        subs.forEach(s => { touch(s.teacherId).absentPeriods++; });
        covered.forEach(s => { if (s.substituteId) touch(s.substituteId).coverPeriods++; });

        const rows = Object.keys(stat)
            .map(id => Object.assign({ id, name: TT.teacherName(id) }, stat[id]))
            .sort((a, b) => (b.coverPeriods - a.coverPeriods) || (b.leaveDays - a.leaveDays));

        root.innerHTML =
            TTApp.termBar() +
            UI.pageHeader('ประวัติและสถิติ',
                'ย้อนดูการลาและการสอนแทนที่ผ่านมา พร้อมสรุปเป็นรายครู', `
                <button onclick="TTPages.exportStats()" class="tactile-btn px-4 py-2.5 rounded-xl font-bold bg-white border border-slate-200 text-slate-600"><i class="ph ph-file-xls mr-1"></i> ส่งออก Excel</button>`) +

            `<div class="modern-card p-3 mb-4 flex flex-wrap items-center gap-2 no-print">
                <select id="st-mode" class="border border-slate-200 rounded-xl px-3 py-2 font-bold focus-ring">
                    ${Object.keys(RANGES).map(k => `<option value="${k}" ${f.statMode === k ? 'selected' : ''}>${UI.esc(RANGES[k])}</option>`).join('')}
                </select>
                ${f.statMode === 'custom' ? `
                    <input type="date" id="st-from" value="${UI.esc(r.from)}" class="border border-slate-200 rounded-xl px-3 py-2 font-semibold focus-ring">
                    <span class="text-slate-400 font-bold">ถึง</span>
                    <input type="date" id="st-to" value="${UI.esc(r.to)}" class="border border-slate-200 rounded-xl px-3 py-2 font-semibold focus-ring">`
                : `<input type="date" id="st-anchor" value="${UI.esc(f.statAnchor)}" class="border border-slate-200 rounded-xl px-3 py-2 font-semibold focus-ring">`}
                <div class="flex-1"></div>
                <span class="text-sm font-bold text-slate-500">${TT.thaiDate(r.from)} – ${TT.thaiDate(r.to)}</span>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                ${UI.stat('ใบลาในช่วงนี้', leaves.length, 'ph-user-minus', 'blue')}
                ${UI.stat('รวมวันลา', rows.reduce((s, x) => s + x.leaveDays, 0), 'ph-calendar-x', 'rose')}
                ${UI.stat('คาบที่ต้องสอนแทน', subs.length, 'ph-arrows-left-right', 'amber')}
                ${UI.stat('สอนแทนสำเร็จ', covered.length, 'ph-check-circle', 'green')}
            </div>

            <div class="modern-card overflow-hidden mb-5">
                <div class="px-5 py-4 border-b border-slate-100 bg-slate-50/60 font-extrabold text-slate-800">
                    สถิติรายครู (${rows.length} ท่าน)
                </div>
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left text-sm min-w-[680px]">
                        <thead class="bg-white border-b border-slate-100 text-xs uppercase text-slate-500 font-extrabold">
                            <tr>
                                <th class="p-3">ครู</th>
                                <th class="p-3 text-center">ลา (ครั้ง)</th>
                                <th class="p-3 text-center">รวมวันลา</th>
                                <th class="p-3 text-center">คาบที่ต้องหาคนแทน</th>
                                <th class="p-3 text-center">สอนแทนให้ผู้อื่น</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${rows.map(x => `
                            <tr class="hover:bg-blue-50/40">
                                <td class="p-3 font-bold text-slate-800">${UI.esc(x.name)}</td>
                                <td class="p-3 text-center font-semibold text-slate-600">${x.leaveCount || '—'}</td>
                                <td class="p-3 text-center font-extrabold ${x.leaveDays ? 'text-rose-600' : 'text-slate-300'}">${x.leaveDays || '—'}</td>
                                <td class="p-3 text-center font-semibold text-slate-600">${x.absentPeriods || '—'}</td>
                                <td class="p-3 text-center font-extrabold ${x.coverPeriods ? 'text-emerald-600' : 'text-slate-300'}">${x.coverPeriods || '—'}</td>
                            </tr>`).join('') || `<tr><td colspan="5">${UI.empty('ไม่มีข้อมูลในช่วงเวลาที่เลือก', 'ph-calendar-blank')}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div class="modern-card p-5">
                    <h3 class="font-extrabold text-slate-800 mb-3">รายการลาย้อนหลัง (${leaves.length})</h3>
                    <div class="space-y-2 max-h-[46vh] overflow-y-auto custom-scrollbar pr-1">
                        ${leaves.slice().sort((a, b) => String(b.from).localeCompare(String(a.from))).map(l => `
                        <div class="p-3 rounded-xl border border-slate-200">
                            <div class="font-bold text-slate-800 text-sm">${UI.esc(TT.teacherName(l.teacherId))}
                                ${UI.badge(TT.LEAVE_TYPES[l.type] || l.type, 'bg-blue-50 text-blue-700 border-blue-100')}</div>
                            <div class="text-xs text-slate-500 font-semibold">
                                ${TT.thaiDate(l.from)}${l.to && l.to !== l.from ? ' – ' + TT.thaiDate(l.to) : ''} ·
                                ${l.allDay ? 'ทั้งวัน' : (l.periodIds || []).length + ' คาบ'} ·
                                รวม ${leaveDaysInRange(l, r.from, r.to).length} วันในช่วงนี้
                            </div>
                            ${l.reason ? `<div class="text-xs text-slate-400 mt-0.5">${UI.esc(l.reason)}</div>` : ''}
                        </div>`).join('') || UI.empty('ไม่มีการลาในช่วงนี้', 'ph-smiley')}
                    </div>
                </div>

                <div class="modern-card p-5">
                    <h3 class="font-extrabold text-slate-800 mb-3">การสอนแทนย้อนหลัง (${subs.length})</h3>
                    <div class="space-y-2 max-h-[46vh] overflow-y-auto custom-scrollbar pr-1">
                        ${subs.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map(s => {
                const st = TT.SUB_STATUS[s.status] || TT.SUB_STATUS.pending;
                return `
                        <div class="p-3 rounded-xl border border-slate-200">
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <div class="font-bold text-slate-800 text-sm truncate">
                                        ${UI.esc(TT.subjectName(s.subjectId))} · ${UI.esc(TT.className(s.classId))}
                                    </div>
                                    <div class="text-xs text-slate-500 font-semibold">
                                        ${TT.thaiDate(s.date)} · ${UI.esc(TT.periodLabel(s.periodId))}
                                    </div>
                                    <div class="text-xs text-slate-500">
                                        ${UI.esc(TT.teacherName(s.teacherId))}
                                        ${s.substituteId ? ' → <b>' + UI.esc(TT.teacherName(s.substituteId)) + '</b>' : ' → ยังไม่มีครูสอนแทน'}
                                    </div>
                                </div>
                                <span class="text-[11px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${st.color}">${UI.esc(st.label)}</span>
                            </div>
                        </div>`;
            }).join('') || UI.empty('ไม่มีการสอนแทนในช่วงนี้', 'ph-arrows-left-right')}
                    </div>
                </div>
            </div>`;

        $('st-mode').onchange = () => { f.statMode = $('st-mode').value; TTApp.refresh(); };
        if ($('st-anchor')) $('st-anchor').onchange = () => { f.statAnchor = $('st-anchor').value; TTApp.refresh(); };
        if ($('st-from')) $('st-from').onchange = () => { f.statFrom = $('st-from').value; TTApp.refresh(); };
        if ($('st-to')) $('st-to').onchange = () => { f.statTo = $('st-to').value; TTApp.refresh(); };
    };

    P.exportStats = function () {
        const f = TT.state.filters;
        const r = rangeOf(f.statMode || 'month', f.statAnchor || today(), f.statFrom, f.statTo);
        const inRange = (d) => d >= r.from && d <= r.to;
        const leaves = TT.activeLeaves().filter(l => !(l.from > r.to || (l.to || l.from) < r.from));
        const subs = TT.activeSubstitutes().filter(s => inRange(s.date));

        const stat = {};
        const touch = (id) => (stat[id] = stat[id] || { leaveCount: 0, leaveDays: 0, absentPeriods: 0, coverPeriods: 0 });
        leaves.forEach(l => { const s = touch(l.teacherId); s.leaveCount++; s.leaveDays += leaveDaysInRange(l, r.from, r.to).length; });
        subs.forEach(s => { touch(s.teacherId).absentPeriods++; });
        subs.filter(s => ['accepted', 'done'].includes(s.status) && s.substituteId)
            .forEach(s => { touch(s.substituteId).coverPeriods++; });

        UI.exportExcel([
            {
                name: 'สถิติรายครู',
                rows: [['ครู', 'ลา (ครั้ง)', 'รวมวันลา', 'คาบที่ต้องหาคนแทน', 'สอนแทนให้ผู้อื่น (คาบ)']].concat(
                    Object.keys(stat).map(id => [TT.teacherName(id), stat[id].leaveCount, stat[id].leaveDays,
                    stat[id].absentPeriods, stat[id].coverPeriods]))
            },
            {
                name: 'การลา',
                rows: [['ครู', 'ประเภท', 'ตั้งแต่', 'ถึง', 'ช่วงเวลา', 'วันในช่วงที่ดู', 'เหตุผล']].concat(
                    leaves.map(l => [TT.teacherName(l.teacherId), TT.LEAVE_TYPES[l.type] || l.type, l.from, l.to || l.from,
                    l.allDay ? 'ทั้งวัน' : (l.periodIds || []).map(p => TT.periodLabel(p)).join(' '),
                    leaveDaysInRange(l, r.from, r.to).length, l.reason || '']))
            },
            {
                name: 'การสอนแทน',
                rows: [['วันที่', 'คาบ', 'วิชา', 'ห้องเรียน', 'ครูที่ไม่อยู่', 'ครูสอนแทน', 'สถานะ']].concat(
                    subs.map(s => [s.date, TT.periodLabel(s.periodId), TT.subjectName(s.subjectId), TT.className(s.classId),
                    TT.teacherName(s.teacherId), s.substituteId ? TT.teacherName(s.substituteId) : '-',
                    (TT.SUB_STATUS[s.status] || {}).label || s.status]))
            }
        ], 'ประวัติและสถิติ_' + r.from + '_ถึง_' + r.to);
    };

    /* =====================================================================
       รายงาน
       ===================================================================== */

    const REPORTS = [
        { id: 'class_tt', name: 'ตารางสอนรายห้อง', icon: 'ph-student', desc: 'ตารางเรียนของแต่ละห้อง พร้อมช่องลงชื่อ' },
        { id: 'teacher_tt', name: 'ตารางสอนรายครู', icon: 'ph-user', desc: 'ตารางสอนของครูแต่ละท่าน' },
        { id: 'room_tt', name: 'ตารางการใช้ห้องพิเศษ', icon: 'ph-flask', desc: 'ตารางการใช้ห้องคอมพิวเตอร์ ห้องวิทยาศาสตร์ และอื่น ๆ' },
        { id: 'school_tt', name: 'ตารางสอนรวมทั้งโรงเรียน', icon: 'ph-buildings', desc: 'ทุกห้องเรียนในหน้าเดียว' },
        { id: 'subject_count', name: 'จำนวนคาบแต่ละวิชา', icon: 'ph-list-numbers', desc: 'สรุปคาบต่อสัปดาห์แยกตามวิชาและห้อง' },
        { id: 'missing', name: 'คาบที่ยังจัดไม่ครบ', icon: 'ph-warning-circle', desc: 'รายการวิชาที่จำนวนคาบยังไม่ครบตามหลักสูตร' },
        { id: 'workload', name: 'ภาระงานครู', icon: 'ph-chart-bar', desc: 'คาบสอนต่อสัปดาห์ของครูทุกท่าน' },
        { id: 'workload_out', name: 'ครูที่ภาระงานเกินหรือต่ำกว่าเกณฑ์', icon: 'ph-scales', desc: 'เทียบกับเกณฑ์ขั้นต่ำและสูงสุดที่กำหนด' },
        { id: 'leaves', name: 'การขาด ลา และไปราชการ', icon: 'ph-user-minus', desc: 'สรุปการลาทั้งภาคเรียน' },
        { id: 'subs', name: 'การสอนแทน รายวัน/เดือน/ภาคเรียน', icon: 'ph-arrows-left-right', desc: 'รายการสอนแทนทั้งหมดพร้อมสถานะ' },
        { id: 'sub_count', name: 'จำนวนครั้งที่ครูแต่ละคนสอนแทน', icon: 'ph-hash', desc: 'สรุปจำนวนครั้งแยกรายครู' },
        { id: 'no_teacher', name: 'คาบที่ไม่มีครูสอน', icon: 'ph-user-x', desc: 'คาบที่ยังไม่ได้กำหนดครู หรือยังไม่มีครูสอนแทน' },
        { id: 'history', name: 'ประวัติการแก้ไขตาราง', icon: 'ph-clock-counter-clockwise', desc: 'บันทึกการเปลี่ยนแปลงและฉบับย้อนหลัง' }
    ];

    P.reports = function (root) {
        root.innerHTML =
            TTApp.termBar() +
            UI.pageHeader('รายงาน', 'เลือกรายงานที่ต้องการ ดูตัวอย่างก่อนพิมพ์ ปรับขนาดตัวอักษร แล้วพิมพ์ลงกระดาษ A4 หรือส่งออกไฟล์') +
            `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${REPORTS.map(r => `
                <button onclick="TTPages.openReport('${r.id}')" class="modern-card p-5 text-left tactile-btn hover:border-blue-300 transition-colors">
                    <div class="flex items-start gap-3">
                        <div class="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 grid place-items-center shrink-0"><i class="ph ${r.icon} text-xl"></i></div>
                        <div class="min-w-0">
                            <div class="font-extrabold text-slate-800">${UI.esc(r.name)}</div>
                            <div class="text-xs text-slate-500 font-semibold mt-0.5">${UI.esc(r.desc)}</div>
                        </div>
                    </div>
                </button>`).join('')}
            </div>`;
    };

    /* ตัวกรองของรายงานที่ต้องเลือกเป้าหมาย */
    P.openReport = function (id) {
        const needTarget = { class_tt: 'class', teacher_tt: 'teacher', room_tt: 'room' }[id];
        if (needTarget) {
            const options = needTarget === 'class' ? TT.classes().map(c => ({ value: c.id, label: c.name }))
                : (needTarget === 'teacher' ? TT.teachers().map(t => ({ value: t.id, label: t.name }))
                    : TT.rooms().map(r => ({ value: r.id, label: r.name })));
            UI.modal('เลือกข้อมูลที่ต้องการพิมพ์', `
                <div class="space-y-3">
                    <label class="flex items-center gap-2 font-bold text-slate-700 text-sm">
                        <input type="checkbox" id="rp-all" class="w-4 h-4 accent-blue-600"> พิมพ์ทั้งหมด (แยกหน้า)
                    </label>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">เลือกรายการ</label>
                        ${UI.select('rp-target', options, options[0] ? options[0].value : '', 'class="w-full"')}
                    </div>
                </div>`, {
                width: 'max-w-md',
                footer: `<button id="btn-open-report" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 shadow-lg">ดูตัวอย่าง</button>`,
                onOpen: () => {
                    $('btn-open-report').onclick = () => {
                        const all = $('rp-all').checked;
                        const target = $('rp-target').value;
                        UI.closeModal();
                        showReport(id, { all, target, kind: needTarget });
                    };
                }
            });
            return;
        }
        showReport(id, {});
    };

    const showReport = function (id, opt) {
        const meta = REPORTS.find(r => r.id === id) || { name: 'รายงาน' };
        const landscape = ['class_tt', 'teacher_tt', 'room_tt', 'school_tt'].includes(id);

        if (id === 'history') { historyReport(); return; }

        UI.printPreview(meta.name, () => buildReport(id, opt), landscape ? 'landscape' : 'portrait');

        /* ปุ่มส่งออก Excel เพิ่มในแถบล่างของหน้าตัวอย่าง */
        setTimeout(() => {
            const foot = $('modal-footer');
            if (!foot || $('rp-excel')) return;
            const b = document.createElement('button');
            b.id = 'rp-excel';
            b.className = 'tactile-btn px-5 py-2.5 rounded-xl font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100';
            b.innerHTML = '<i class="ph ph-file-xls mr-1"></i> ส่งออก Excel';
            b.onclick = () => exportReportExcel(id, opt, meta.name);
            foot.insertBefore(b, foot.firstChild);
        }, 60);
    };

    const buildReport = function (id, opt) {
        const s = TT.state.settings;

        /* ---- ตารางแยกหน้า ---- */
        if (['class_tt', 'teacher_tt', 'room_tt'].includes(id)) {
            const kind = opt.kind;
            const list = opt.all
                ? (kind === 'class' ? TT.classes().map(c => c.id)
                    : (kind === 'teacher' ? TT.teachers().map(t => t.id) : TT.rooms().map(r => r.id)))
                : [opt.target];
            const title = kind === 'class' ? 'ตารางเรียนรายห้อง' : (kind === 'teacher' ? 'ตารางสอนรายครู' : 'ตารางการใช้ห้อง');
            const nameOf = (x) => kind === 'class' ? TT.className(x) : (kind === 'teacher' ? TT.teacherName(x) : TT.roomName(x));

            /* ตารางรายครูใส่ได้หน้าละ 2 ท่าน (ตารางเล็กกว่า) ส่วนรายห้อง/รายห้องพิเศษเต็มหน้าละ 1 รายการ
               ช่องที่แบ่งครึ่งหน้าไม่ใส่ช่องลงชื่อ เพราะสองชุดในหน้าเดียวจะรกและเซ็นไม่ได้จริง */
            const perPage = kind === 'teacher' ? 2 : 1;
            const slots = list.map(x =>
                '<div class="tt-slot">' +
                UI.printHeader(title + ' : ' + nameOf(x)) +
                TTPages.paperGrid(kind, x) +
                extraInfo(kind, x) +
                (perPage === 1 ? UI.printSignatures() : '') +
                '</div>');

            const pages = [];
            for (let i = 0; i < slots.length; i += perPage) {
                pages.push('<div class="tt-page">' + slots.slice(i, i + perPage).join('') + '</div>');
            }
            return pages.join('');
        }

        if (id === 'school_tt') {
            const days = TT.days(), periods = TT.periods(), classes = TT.classes();
            return UI.printHeader('ตารางสอนรวมทั้งโรงเรียน') +
                days.map(d => `
                <div style="margin-bottom:4mm">
                    <div style="font-weight:800;margin:2mm 0">วัน${UI.esc(d.name)}</div>
                    <table class="bx tt-grid">
                        <thead><tr><th style="width:18mm">ห้อง</th>${periods.map(p => `<th>${UI.esc(p.label)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${classes.map(c => `<tr>
                                <th>${UI.esc(c.name)}</th>
                                ${periods.map(p => {
                    const e = TT.entryAt(c.id, d.id, p.id);
                    if (!e) return '<td></td>';
                    const sub = TT.subject(e.subjectId) || {};
                    return `<td><div class="cell-sub">${UI.esc(e.kind === 'activity' ? e.label : (sub.short || sub.name))}</div>
                                            <div class="cell-meta">${UI.esc(TT.teacherName(e.teacherId))}</div></td>`;
                }).join('')}
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`).join('') + UI.printSignatures();
        }

        if (id === 'subject_count') {
            const rows = E.allocationStatus();
            return UI.printHeader('รายงานจำนวนคาบแต่ละวิชา') + `
            <table class="bx">
                <thead><tr><th style="width:8mm">ที่</th><th>ห้องเรียน</th><th>รายวิชา</th><th>ครูผู้สอน</th>
                    <th style="width:20mm">คาบ/สัปดาห์</th><th style="width:18mm">จัดแล้ว</th><th style="width:18mm">คงเหลือ</th></tr></thead>
                <tbody>
                    ${rows.map((r, i) => `<tr>
                        <td style="text-align:center">${i + 1}</td>
                        <td>${UI.esc(TT.className(r.classId))}</td>
                        <td>${UI.esc(TT.subjectName(r.subjectId))}</td>
                        <td>${UI.esc(TT.teacherName(r.teacherId))}</td>
                        <td style="text-align:center">${r.required}</td>
                        <td style="text-align:center">${r.placed}</td>
                        <td style="text-align:center">${r.missing === 0 ? '-' : r.missing}</td>
                    </tr>`).join('')}
                </tbody>
            </table>` + UI.printSignatures();
        }

        if (id === 'missing') {
            const rows = E.allocationStatus().filter(r => r.missing !== 0);
            return UI.printHeader('รายงานคาบที่ยังจัดไม่ครบตามหลักสูตร') +
                (rows.length ? `<table class="bx">
                <thead><tr><th style="width:8mm">ที่</th><th>ห้องเรียน</th><th>รายวิชา</th><th>ครูผู้สอน</th><th style="width:22mm">ต้องจัด</th><th style="width:22mm">จัดแล้ว</th><th style="width:22mm">ขาด/เกิน</th></tr></thead>
                <tbody>${rows.map((r, i) => `<tr>
                    <td style="text-align:center">${i + 1}</td>
                    <td>${UI.esc(TT.className(r.classId))}</td>
                    <td>${UI.esc(TT.subjectName(r.subjectId))}</td>
                    <td>${UI.esc(TT.teacherName(r.teacherId))}</td>
                    <td style="text-align:center">${r.required}</td>
                    <td style="text-align:center">${r.placed}</td>
                    <td style="text-align:center">${r.missing > 0 ? 'ขาด ' + r.missing : 'เกิน ' + Math.abs(r.missing)}</td>
                </tr>`).join('')}</tbody></table>`
                    : '<div style="padding:10mm;text-align:center">จัดคาบครบทุกวิชาแล้ว</div>') + UI.printSignatures();
        }

        if (id === 'workload' || id === 'workload_out') {
            let rows = E.workloadAll();
            if (id === 'workload_out') rows = rows.filter(w => w.overMax || w.underMin);
            return UI.printHeader(id === 'workload' ? 'รายงานภาระงานสอนของครู' : 'รายงานครูที่มีภาระงานเกินหรือต่ำกว่าเกณฑ์') +
                (rows.length ? `<table class="bx">
                <thead><tr><th style="width:8mm">ที่</th><th>ชื่อ–สกุล</th><th>กลุ่มสาระ</th>
                    ${TT.days().map(d => `<th style="width:12mm">${UI.esc(d.name)}</th>`).join('')}
                    <th style="width:16mm">รวม</th><th style="width:18mm">แนะแนว/<br>โฮมรูม</th>
                    <th style="width:16mm">สอนแทน</th><th style="width:24mm">เทียบเกณฑ์</th></tr></thead>
                <tbody>${rows.map((w, i) => `<tr>
                    <td style="text-align:center">${i + 1}</td>
                    <td>${UI.esc(w.name)}</td>
                    <td>${UI.esc(w.dept || '-')}</td>
                    ${TT.days().map(d => `<td style="text-align:center">${w.perDay[d.id] || 0}</td>`).join('')}
                    <td style="text-align:center;font-weight:700">${w.week}</td>
                    <td style="text-align:center">${w.homeroom || 0}</td>
                    <td style="text-align:center">${w.substitutes}</td>
                    <td style="text-align:center">${w.overMax ? 'เกินเกณฑ์' : (w.underMin ? 'ต่ำกว่าเกณฑ์' : 'อยู่ในเกณฑ์')}</td>
                </tr>`).join('')}</tbody></table>`
                    : '<div style="padding:10mm;text-align:center">ไม่มีครูที่ภาระงานเกินหรือต่ำกว่าเกณฑ์</div>') + UI.printSignatures();
        }

        if (id === 'leaves') {
            const rows = TT.activeLeaves().slice().sort((a, b) => String(a.from).localeCompare(String(b.from)));
            return UI.printHeader('รายงานการขาด ลา และไปราชการ') + `
            <table class="bx">
                <thead><tr><th style="width:8mm">ที่</th><th>ชื่อ–สกุล</th><th style="width:22mm">ประเภท</th>
                    <th style="width:26mm">วันที่</th><th style="width:22mm">ช่วงเวลา</th><th>เหตุผล</th><th style="width:20mm">คาบสอนแทน</th></tr></thead>
                <tbody>${rows.map((l, i) => {
                const covers = TT.activeSubstitutes().filter(s => String(s.leaveId) === String(l.id)).length;
                return `<tr>
                        <td style="text-align:center">${i + 1}</td>
                        <td>${UI.esc(TT.teacherName(l.teacherId))}</td>
                        <td>${UI.esc(TT.LEAVE_TYPES[l.type] || l.type)}</td>
                        <td>${TT.thaiDate(l.from)}${l.to && l.to !== l.from ? '–' + TT.thaiDate(l.to) : ''}</td>
                        <td>${l.allDay ? 'ทั้งวัน' : (l.periodIds || []).map(p => TT.periodLabel(p)).join(' ')}</td>
                        <td>${UI.esc(l.reason || '')}</td>
                        <td style="text-align:center">${covers}</td>
                    </tr>`;
            }).join('')}</tbody>
            </table>` + UI.printSignatures();
        }

        if (id === 'subs') {
            const rows = TT.activeSubstitutes().slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
            return UI.printHeader('รายงานการสอนแทน') + `
            <table class="bx">
                <thead><tr><th style="width:8mm">ที่</th><th style="width:26mm">วันที่</th><th style="width:18mm">คาบ</th>
                    <th>วิชา / ห้อง</th><th>ครูที่ไม่อยู่</th><th>ครูผู้สอนแทน</th><th style="width:26mm">สถานะ</th></tr></thead>
                <tbody>${rows.map((s, i) => `<tr>
                    <td style="text-align:center">${i + 1}</td>
                    <td>${TT.thaiDate(s.date)}</td>
                    <td style="text-align:center">${UI.esc(TT.periodLabel(s.periodId))}</td>
                    <td>${UI.esc(TT.subjectName(s.subjectId))} / ${UI.esc(TT.className(s.classId))}</td>
                    <td>${UI.esc(TT.teacherName(s.teacherId))}</td>
                    <td>${UI.esc(s.substituteId ? TT.teacherName(s.substituteId) : '-')}</td>
                    <td>${UI.esc((TT.SUB_STATUS[s.status] || {}).label || s.status)}</td>
                </tr>`).join('')}</tbody>
            </table>` + UI.printSignatures();
        }

        if (id === 'sub_count') {
            const rows = TT.teachers().map(t => {
                const c = E.substituteCount(t.id);
                const absent = TT.activeSubstitutes().filter(s => String(s.teacherId) === String(t.id)).length;
                return { name: t.name, dept: t.dept, assigned: c.assigned, month: c.month, absent };
            }).sort((a, b) => b.assigned - a.assigned);
            return UI.printHeader('รายงานจำนวนครั้งที่ครูแต่ละคนสอนแทน') + `
            <table class="bx">
                <thead><tr><th style="width:8mm">ที่</th><th>ชื่อ–สกุล</th><th>กลุ่มสาระ</th>
                    <th style="width:26mm">สอนแทนทั้งภาคเรียน</th><th style="width:22mm">เดือนนี้</th><th style="width:30mm">คาบที่ถูกสอนแทน</th></tr></thead>
                <tbody>${rows.map((r, i) => `<tr>
                    <td style="text-align:center">${i + 1}</td>
                    <td>${UI.esc(r.name)}</td>
                    <td>${UI.esc(r.dept || '-')}</td>
                    <td style="text-align:center">${r.assigned}</td>
                    <td style="text-align:center">${r.month}</td>
                    <td style="text-align:center">${r.absent}</td>
                </tr>`).join('')}</tbody>
            </table>` + UI.printSignatures();
        }

        if (id === 'no_teacher') {
            const noTeacher = TT.entries().filter(e => !e.teacherId && e.kind !== 'activity');
            const uncovered = TT.activeSubstitutes().filter(s => ['pending', 'declined', 'proposed'].includes(s.status));
            return UI.printHeader('รายงานคาบที่ไม่มีครูสอน') + `
            <div style="font-weight:800;margin:3mm 0 1mm">1. คาบในตารางที่ยังไม่ได้กำหนดครูผู้สอน (${noTeacher.length} คาบ)</div>
            ${noTeacher.length ? `<table class="bx"><thead><tr><th style="width:8mm">ที่</th><th>ห้องเรียน</th><th>วิชา</th><th>วัน</th><th>คาบ</th></tr></thead>
            <tbody>${noTeacher.map((e, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${UI.esc(TT.className(e.classId))}</td>
                <td>${UI.esc(TT.subjectName(e.subjectId))}</td><td>${UI.esc(TT.dayName(e.day))}</td><td>${UI.esc(TT.periodLabel(e.periodId))}</td></tr>`).join('')}</tbody></table>`
                    : '<div style="padding:3mm">ทุกคาบมีครูผู้สอนครบแล้ว</div>'}

            <div style="font-weight:800;margin:5mm 0 1mm">2. คาบที่ครูไม่อยู่และยังไม่มีครูสอนแทน (${uncovered.length} คาบ)</div>
            ${uncovered.length ? `<table class="bx"><thead><tr><th style="width:8mm">ที่</th><th>วันที่</th><th>คาบ</th><th>วิชา / ห้อง</th><th>ครูที่ไม่อยู่</th></tr></thead>
            <tbody>${uncovered.map((s, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${TT.thaiDate(s.date)}</td>
                <td>${UI.esc(TT.periodLabel(s.periodId))}</td><td>${UI.esc(TT.subjectName(s.subjectId))} / ${UI.esc(TT.className(s.classId))}</td>
                <td>${UI.esc(TT.teacherName(s.teacherId))}</td></tr>`).join('')}</tbody></table>`
                    : '<div style="padding:3mm">ทุกคาบมีครูสอนแทนครบแล้ว</div>'}
            ` + UI.printSignatures();
        }

        return '<div style="padding:20mm;text-align:center">ยังไม่มีรายงานนี้</div>';
    };

    /* ข้อมูลประกอบใต้ตารางของแต่ละแบบ */
    const extraInfo = function (kind, id) {
        if (kind === 'teacher') {
            const w = E.workload(id);
            const t = TT.teacher(id) || {};
            return `<div style="margin-top:3mm;font-size:.95em">
                <b>สรุปภาระงาน</b> : สอนรวม ${w.week} คาบ/สัปดาห์ (${w.hours} ชั่วโมง) · คาบว่าง ${w.free} คาบ · สอนแทน ${w.substitutes} คาบ
                ${w.homeroom ? ' · แนะแนว/โฮมรูม ' + w.homeroom + ' คาบ (ไม่นับคาบสอน)' : ''}
                ${t.dept ? ' · กลุ่มสาระ' + UI.esc(t.dept) : ''}
            </div>`;
        }
        if (kind === 'class') {
            const sum = E.classSummary(id);
            const c = TT.classById(id) || {};
            return `<div style="margin-top:3mm;font-size:.95em">
                <b>สรุป</b> : จำนวนคาบเรียน ${sum.placed} คาบ/สัปดาห์ · นักเรียน ${c.studentCount} คน
                ${c.homeroomTeachers && c.homeroomTeachers.length ? ' · ครูประจำชั้น ' + UI.esc(c.homeroomTeachers.map(x => TT.teacherName(x)).join(', ')) : ''}
            </div>`;
        }
        return '';
    };

    /* ส่งออกรายงานเป็น Excel — ใช้โครงเดียวกับที่พิมพ์ */
    const exportReportExcel = function (id, opt, name) {
        const days = TT.days(), periods = TT.allPeriods();
        let sheets = [];

        if (['class_tt', 'teacher_tt', 'room_tt'].includes(id)) {
            const kind = opt.kind;
            const list = opt.all
                ? (kind === 'class' ? TT.classes().map(c => c.id) : (kind === 'teacher' ? TT.teachers().map(t => t.id) : TT.rooms().map(r => r.id)))
                : [opt.target];
            sheets = list.map(x => {
                const rows = [['วัน/คาบ'].concat(periods.map(p => p.label))];
                days.forEach(d => {
                    rows.push([d.name].concat(periods.map(p => {
                        if (p.type !== 'class') return p.label;
                        const items = TT.entries().filter(e => {
                            if (e.day !== d.id || e.periodId !== p.id) return false;
                            if (kind === 'teacher') return String(e.teacherId) === String(x);
                            if (kind === 'room') return String(e.roomId) === String(x);
                            return String(e.classId) === String(x);
                        });
                        return items.map(e => (e.kind === 'activity' ? e.label : TT.subjectName(e.subjectId)) + ' / ' +
                            (kind === 'teacher' ? TT.className(e.classId) : TT.teacherName(e.teacherId))).join(' | ');
                    })));
                });
                const label = kind === 'class' ? TT.className(x) : (kind === 'teacher' ? TT.teacherName(x) : TT.roomName(x));
                return { name: String(label).replace(/[\\\/\?\*\[\]]/g, ''), rows };
            });
        } else if (id === 'subject_count' || id === 'missing') {
            let rows = E.allocationStatus();
            if (id === 'missing') rows = rows.filter(r => r.missing !== 0);
            sheets = [{
                name: 'จำนวนคาบ',
                rows: [['ห้องเรียน', 'รายวิชา', 'ครูผู้สอน', 'คาบ/สัปดาห์', 'จัดแล้ว', 'คงเหลือ']].concat(
                    rows.map(r => [TT.className(r.classId), TT.subjectName(r.subjectId), TT.teacherName(r.teacherId), r.required, r.placed, r.missing]))
            }];
        } else if (id === 'workload' || id === 'workload_out') {
            let rows = E.workloadAll();
            if (id === 'workload_out') rows = rows.filter(w => w.overMax || w.underMin);
            sheets = [{
                name: 'ภาระงานครู',
                rows: [['ครู', 'กลุ่มสาระ'].concat(days.map(d => d.name)).concat(['รวม', 'สอนแทน', 'สถานะ'])].concat(
                    rows.map(w => [w.name, w.dept].concat(days.map(d => w.perDay[d.id] || 0))
                        .concat([w.week, w.substitutes, w.overMax ? 'เกินเกณฑ์' : (w.underMin ? 'ต่ำกว่าเกณฑ์' : 'อยู่ในเกณฑ์')])))
            }];
        } else if (id === 'leaves') {
            sheets = [{
                name: 'การลา',
                rows: [['ครู', 'ประเภท', 'ตั้งแต่', 'ถึง', 'ช่วงเวลา', 'เหตุผล']].concat(
                    TT.activeLeaves().map(l => [TT.teacherName(l.teacherId), TT.LEAVE_TYPES[l.type] || l.type,
                    l.from, l.to || l.from, l.allDay ? 'ทั้งวัน' : (l.periodIds || []).map(p => TT.periodLabel(p)).join(' '), l.reason]))
            }];
        } else if (id === 'subs' || id === 'sub_count' || id === 'no_teacher') {
            sheets = [{
                name: 'การสอนแทน',
                rows: [['วันที่', 'คาบ', 'วิชา', 'ห้อง', 'ครูที่ไม่อยู่', 'ครูสอนแทน', 'สถานะ']].concat(
                    TT.activeSubstitutes().map(s => [s.date, TT.periodLabel(s.periodId), TT.subjectName(s.subjectId),
                    TT.className(s.classId), TT.teacherName(s.teacherId), s.substituteId ? TT.teacherName(s.substituteId) : '-',
                    (TT.SUB_STATUS[s.status] || {}).label || s.status]))
            }];
        } else {
            const rows = [['ห้องเรียน'].concat(periods.filter(p => p.type === 'class').map(p => p.label))];
            TT.classes().forEach(c => {
                days.forEach(d => {
                    rows.push([c.name + ' · ' + d.name].concat(periods.filter(p => p.type === 'class').map(p => {
                        const e = TT.entryAt(c.id, d.id, p.id);
                        return e ? (e.kind === 'activity' ? e.label : TT.subjectName(e.subjectId)) : '';
                    })));
                });
            });
            sheets = [{ name: 'ตารางรวม', rows }];
        }

        UI.exportExcel(sheets, name);
    };

    /* ประวัติการแก้ไขตารางและฉบับย้อนหลัง */
    const historyReport = async function () {
        UI.modal('ประวัติการแก้ไขตารางและฉบับย้อนหลัง', UI.loading(), { width: 'max-w-3xl' });
        try {
            const [versions, logs] = await Promise.all([
                window.ttCloud.listVersions(TT.state.settings.activeYear, TT.state.settings.activeTerm),
                window.ttCloud.listByKind('log', 120)
            ]);
            $('modal-body').innerHTML = `
                <div class="mb-5">
                    <h4 class="font-extrabold text-slate-800 mb-2">ตารางฉบับย้อนหลัง (${versions.length})</h4>
                    ${versions.length ? `<div class="space-y-2">${versions.map(v => `
                        <div class="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                            <div>
                                <div class="font-bold text-slate-800 text-sm">${UI.esc(v.note || 'ฉบับสำรอง')}</div>
                                <div class="text-xs text-slate-500 font-semibold">${TT.thaiDateTime(Number(v.sortKey))} · ${UI.esc(v.actor || '')} · ${(v.data && v.data.entries ? v.data.entries.length : 0)} คาบ</div>
                            </div>
                            ${TT.can('schedule') ? `<button onclick="TTPages.restoreVersion('${UI.esc(v._id)}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700">กู้คืนฉบับนี้</button>` : ''}
                        </div>`).join('')}</div>` : UI.empty('ยังไม่มีฉบับย้อนหลัง', 'ph-archive')}
                </div>
                <div>
                    <h4 class="font-extrabold text-slate-800 mb-2">บันทึกการเปลี่ยนแปลง</h4>
                    <div class="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                        ${logs.map(r => {
                const d = r.data || {};
                return `<div class="flex gap-3 text-sm p-2 rounded-lg hover:bg-slate-50">
                                <span class="text-slate-400 whitespace-nowrap font-semibold">${TT.thaiDateTime(d.ts)}</span>
                                <span class="font-bold text-blue-700 whitespace-nowrap">${UI.esc(d.action || '')}</span>
                                <span class="text-slate-600">${UI.esc(d.detail || '')}</span>
                                <span class="text-slate-400 ml-auto whitespace-nowrap">${UI.esc(d.actorName || '')}</span>
                            </div>`;
            }).join('') || UI.empty('ยังไม่มีบันทึก', 'ph-clock-counter-clockwise')}
                    </div>
                </div>`;
        } catch (e) {
            $('modal-body').innerHTML = `<div class="p-4 text-rose-600 font-bold">โหลดข้อมูลไม่สำเร็จ : ${UI.esc(e.message || e)}</div>`;
        }
    };

    P.restoreVersion = function (docId) {
        UI.confirm('กู้คืนตารางฉบับนี้',
            'ตารางปัจจุบันจะถูกแทนที่ด้วยฉบับที่เลือก<br>ระบบจะเก็บตารางปัจจุบันไว้เป็นฉบับย้อนหลังก่อนกู้คืน',
            'warn', async () => {
                try {
                    const data = await window.ttCloud.load(docId);
                    if (!data) { UI.notify('ไม่พบข้อมูลฉบับนี้', 'error'); return; }
                    await window.ttCloud.saveVersion(TT.state.settings.activeYear, TT.state.settings.activeTerm,
                        TT.clone(TT.state.plan), 'ก่อนกู้คืนฉบับย้อนหลัง', (TT.state.user && TT.state.user.name) || '');
                    TT.state.plan = Object.assign(TT.emptyPlan(TT.state.settings.activeYear, TT.state.settings.activeTerm), data, { status: 'draft' });
                    await TT.savePlanNow();
                    TT.log('restore_version', docId);
                    UI.notify('กู้คืนตารางเรียบร้อย (บันทึกเป็นฉบับร่าง)');
                    UI.closeModal();
                    TTApp.refresh();
                } catch (e) {
                    console.error(e);
                    UI.notify('กู้คืนไม่สำเร็จ', 'error');
                }
            }, 'กู้คืน');
    };
})();
