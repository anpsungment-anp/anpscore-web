/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — งานประจำวัน

   ครูขาดและการลา · จัดครูสอนแทน · ค้นหาคาบว่าง
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT;
    const UI = window.TTUI;
    const E = window.TTEngine;
    const P = window.TTPages = window.TTPages || {};
    const $ = (id) => document.getElementById(id);

    const today = () => TT.today();
    const manages = () => TT.can('substitute');

    /* =====================================================================
       ครูขาดและการลา
       ===================================================================== */

    P.leaves = function (root) {
        const mine = TT.state.user.role === 'teacher' ? TT.state.user.id : '';
        const f = TT.state.filters;
        /* ข้อมูลเก่าที่เคยใช้วิธี "ยกเลิกแล้วเก็บไว้" ยังตกค้างได้ จึงยังต้องกรองและมีปุ่มล้างทิ้ง */
        const cancelledCount = ((TT.state.ops.leaves || []).length) - TT.activeLeaves().length;
        const legacyCancelled = cancelledCount ||
            ((TT.state.ops.substitutes || []).length - TT.activeSubstitutes().length);
        const source = f.showCancelledLeaves ? (TT.state.ops.leaves || []) : TT.activeLeaves();

        /* ใบลาที่ผ่านวันไปแล้วถือว่าจบงาน ไม่ต้องแสดงในหน้าทำงานประจำวัน
           ยังดูย้อนหลังได้ที่หน้า "ประวัติและสถิติ" หรือกดปุ่มแสดงด้านล่าง */
        const isPast = (l) => String(l.to || l.from) < today();
        const pastCount = source.filter(isPast).length;
        const visible = f.showPastLeaves ? source : source.filter(l => !isPast(l));
        const all = visible.slice().sort((a, b) => String(b.from).localeCompare(String(a.from)));
        const list = manages() ? all : all.filter(l => String(l.teacherId) === String(mine));
        const activeSubs = TT.activeSubstitutes();

        root.innerHTML =
            TTApp.termBar() +
            UI.pageHeader('ครูขาดและการลา',
                manages() ? 'รายการลาทั้งหมด ระบบจะสร้างรายการคาบที่ต้องหาครูสอนแทนให้อัตโนมัติ' : 'รายการแจ้งลาของท่าน', `
                <button onclick="TTPages.openLeaveForm('')" class="tactile-btn px-4 py-2.5 rounded-xl font-bold text-white brand-gradient shadow-lg"><i class="ph ph-plus mr-1"></i> แจ้งขาด / ลา</button>
                ${manages() ? `<button onclick="TTPages.exportLeaves()" class="tactile-btn px-4 py-2.5 rounded-xl font-bold bg-white border border-slate-200 text-slate-600"><i class="ph ph-file-xls mr-1"></i> ส่งออก</button>` : ''}`) +
            `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                ${UI.stat('ลาทั้งหมดในภาคเรียนนี้', list.filter(l => l.status !== 'cancelled').length, 'ph-user-minus', 'blue')}
                ${UI.stat('ลาวันนี้', list.filter(l => today() >= l.from && today() <= (l.to || l.from) && l.status !== 'cancelled').length, 'ph-calendar-x', 'rose')}
                ${UI.stat('คาบที่ต้องสอนแทน', activeSubs.length, 'ph-arrows-left-right', 'amber')}
                ${UI.stat('ยังไม่มีครูสอนแทน', activeSubs.filter(s => !s.substituteId).length, 'ph-warning', 'slate')}
            </div>
            <div class="flex flex-wrap justify-end gap-2 mb-3 no-print">
                ${pastCount ? `<button onclick="TTPages.togglePastLeaves()" class="tactile-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-500">
                    <i class="ph ${f.showPastLeaves ? 'ph-eye-slash' : 'ph-clock-counter-clockwise'} mr-1"></i>
                    ${f.showPastLeaves ? 'ซ่อนรายการที่ผ่านมาแล้ว' : 'แสดงรายการที่ผ่านมาแล้ว (' + pastCount + ')'}
                </button>` : ''}
                <button onclick="TTApp.go('stats')" class="tactile-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-500">
                    <i class="ph ph-chart-bar mr-1"></i> ดูประวัติและสถิติ
                </button>
            </div>
            ${legacyCancelled ? `<div class="flex justify-end gap-2 mb-3 no-print">
                <button onclick="TTPages.toggleCancelledLeaves()" class="tactile-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-500">
                    <i class="ph ${f.showCancelledLeaves ? 'ph-eye-slash' : 'ph-eye'} mr-1"></i>
                    ${f.showCancelledLeaves ? 'ซ่อนรายการที่ยกเลิกแล้ว' : 'แสดงรายการที่ยกเลิกแล้ว (' + cancelledCount + ')'}
                </button>
                ${manages() ? `<button onclick="TTPages.purgeCancelledLeaves()" class="tactile-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                    <i class="ph ph-trash mr-1"></i> ลบรายการที่ยกเลิกแล้วทิ้ง
                </button>` : ''}
            </div>` : ''}
            <div class="space-y-3">${list.map(leaveCard).join('') || UI.empty('ยังไม่มีรายการลา', 'ph-user-minus')}</div>`;
    };

    P.toggleCancelledLeaves = function () {
        TT.state.filters.showCancelledLeaves = !TT.state.filters.showCancelledLeaves;
        TTApp.refresh();
    };

    P.togglePastLeaves = function () {
        TT.state.filters.showPastLeaves = !TT.state.filters.showPastLeaves;
        TTApp.refresh();
    };

    const leaveCard = function (l) {
        const covers = TT.activeSubstitutes().filter(s => String(s.leaveId) === String(l.id));
        const done = covers.filter(s => ['accepted', 'done'].includes(s.status)).length;
        const cancelled = l.status === 'cancelled';
        return `
        <div class="modern-card p-4 ${cancelled ? 'opacity-60' : ''}">
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex gap-3 min-w-0">
                    <div class="w-11 h-11 rounded-2xl ${cancelled ? 'bg-slate-100 text-slate-400' : 'bg-rose-50 text-rose-600'} grid place-items-center shrink-0">
                        <i class="ph ph-user-minus text-xl"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="font-extrabold text-slate-800">${UI.esc(TT.teacherName(l.teacherId))}
                            ${UI.badge(TT.LEAVE_TYPES[l.type] || l.type, 'bg-blue-50 text-blue-700 border-blue-100')}
                            ${cancelled ? UI.badge('ยกเลิกแล้ว', 'bg-slate-100 text-slate-500 border-slate-200') : ''}
                        </div>
                        <div class="text-sm text-slate-600 font-semibold">
                            ${TT.thaiDate(l.from)}${l.to && l.to !== l.from ? ' – ' + TT.thaiDate(l.to) : ''} ·
                            ${(function () {
                    const ses = leaveSession(l);
                    if (ses === 'all') return 'ทั้งวัน';
                    if (ses === 'custom') return (l.periodIds || []).map(p => TT.periodLabel(p)).join(', ');
                    return UI.esc(TT.LEAVE_SESSIONS[ses]).replace('ลา', '');
                })()}
                        </div>
                        <div class="text-sm text-slate-500 mt-1">${UI.esc(l.reason || '')}</div>
                        ${l.attachment ? `<a href="${UI.esc(l.attachment)}" target="_blank" class="text-xs font-bold text-blue-600"><i class="ph ph-paperclip"></i> เอกสารแนบ</a>` : ''}
                        ${l.deputy ? `<div class="text-xs text-slate-500 font-semibold mt-1">ผู้รับผิดชอบงานแทน : ${UI.esc(TT.teacherName(l.deputy))}</div>` : ''}
                    </div>
                </div>
                <div class="flex flex-col items-end gap-2 shrink-0">
                    <div class="text-xs font-bold ${covers.length && done === covers.length ? 'text-emerald-600' : 'text-amber-600'}">
                        จัดครูสอนแทนแล้ว ${done}/${covers.length} คาบ
                    </div>
                    <div class="flex flex-wrap gap-1.5 justify-end">
                        ${covers.length ? `<button onclick="TTPages.openProposeSubs('${l.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-50 text-violet-700"><i class="ph ph-user-switch mr-1"></i> ${manages() ? 'ดู/เสนอครูสอนแทน' : 'เสนอครูสอนแทน'}</button>` : ''}
                        ${manages() || String(l.teacherId) === String(TT.state.user.id)
                    ? `<button onclick="TTPages.openLeaveForm('${l.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700"><i class="ph ph-pencil-simple mr-1"></i> แก้ไข</button>` : ''}
                        ${manages() && !cancelled ? `<button onclick="TTPages.go2Substitutes('${l.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700"><i class="ph ph-arrows-left-right mr-1"></i> จัดครูสอนแทน</button>` : ''}
                        <button onclick="TTPages.deleteLeave('${l.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600"><i class="ph ph-trash mr-1"></i> ลบ</button>
                    </div>
                </div>
            </div>
        </div>`;
    };

    P.go2Substitutes = function (leaveId) {
        TT.state.filters.subLeave = leaveId;
        TTApp.go('substitutes');
    };

    /* ==================================================================
       ครูเจ้าของใบลาเสนอชื่อครูสอนแทนเอง แล้วผู้จัดครูสอนแทนเป็นผู้อนุมัติ
       ================================================================== */

    /* ผู้ที่มีสิทธิ์อนุมัติการสอนแทน ใช้ส่งการแจ้งเตือนเมื่อมีการเสนอชื่อ */
    const coordinatorIds = function () {
        return TT.teachers()
            .filter(t => { const p = TT.permOf(t.id); return p.canSubstitute || p.canSchedule; })
            .map(t => t.id);
    };

    /* สถานะที่ยังเปลี่ยนตัวครูสอนแทนได้ */
    const OPEN_STATUS = ['pending', 'declined', 'proposed', 'changing'];

    P.openProposeSubs = function (leaveId) {
        const l = (TT.state.ops.leaves || []).find(x => String(x.id) === String(leaveId));
        if (!l) return;
        const mine = TT.activeSubstitutes()
            .filter(s => String(s.leaveId) === String(leaveId))
            .sort((a, b) => String(a.date + a.periodId).localeCompare(String(b.date + b.periodId)));

        if (!mine.length) {
            UI.notify('ใบลานี้ยังไม่มีคาบที่ต้องหาครูสอนแทน', 'warn');
            return;
        }

        const canEdit = manages() || String(l.teacherId) === String(TT.state.user.id);

        const row = function (s) {
            const locked = !OPEN_STATUS.includes(s.status);
            const free = E.rankSubstitutes(s);
            const chosen = s.requestedId || '';
            const st = TT.SUB_STATUS[s.status] || TT.SUB_STATUS.pending;
            return `
            <div class="p-3 rounded-2xl border border-slate-200 mb-2">
                <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div class="min-w-0">
                        <div class="font-extrabold text-slate-800 text-sm">
                            ${UI.esc(TT.subjectName(s.subjectId))} · ${UI.esc(TT.className(s.classId))}
                        </div>
                        <div class="text-xs text-slate-500 font-semibold">
                            ${TT.thaiDate(s.date)} · ${UI.esc(TT.periodLabel(s.periodId))}
                        </div>
                    </div>
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-lg border ${st.color}">${UI.esc(st.label)}</span>
                </div>
                ${locked
                    ? `<div class="text-sm font-bold text-slate-600">ครูสอนแทน : ${UI.esc(TT.teacherName(s.substituteId))}</div>`
                    : `<select data-prop="${s.id}" ${canEdit ? '' : 'disabled'}
                        class="w-full border border-slate-200 rounded-xl p-2 font-semibold text-sm focus-ring">
                        <option value="">— ยังไม่เสนอชื่อ —</option>
                        ${free.map(r => `<option value="${UI.esc(r.teacherId)}" ${String(chosen) === String(r.teacherId) ? 'selected' : ''}>
                            ${UI.esc(r.name)} · ว่างจริง (${r.score} คะแนน)</option>`).join('')}
                        ${chosen && !free.some(r => String(r.teacherId) === String(chosen))
                        ? `<option value="${UI.esc(chosen)}" selected>${UI.esc(TT.teacherName(chosen))} · (คาบนี้ไม่ว่างแล้ว)</option>` : ''}
                    </select>
                    ${free.length ? '' : '<div class="text-xs text-rose-600 font-semibold mt-1">ไม่มีครูว่างในคาบนี้ ต้องให้ผู้จัดตารางช่วยพิจารณา</div>'}`}
            </div>`;
        };

        UI.modal('เสนอครูสอนแทน — ' + TT.teacherName(l.teacherId), `
            <div class="p-3 rounded-2xl bg-violet-50 border border-violet-100 text-sm text-violet-800 font-semibold mb-3">
                <i class="ph ph-info mr-1"></i>
                เลือกครูที่ต้องการให้สอนแทนในแต่ละคาบ รายชื่อที่แสดงคือครูที่ว่างจริงในคาบนั้น
                เมื่อบันทึกแล้ว <b>ผู้จัดครูสอนแทนจะเป็นผู้อนุมัติอีกครั้ง</b> จึงจะถือว่าเรียบร้อย
            </div>
            <div class="max-h-[52vh] overflow-y-auto custom-scrollbar pr-1">${mine.map(row).join('')}</div>`, {
            width: 'max-w-2xl',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ปิด</button>
                ${canEdit ? `<button id="btn-save-prop" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-lg">
                    <i class="ph ph-paper-plane-tilt mr-1"></i> ส่งให้ผู้จัดอนุมัติ</button>` : ''}`,
            onOpen: () => {
                const btn = $('btn-save-prop');
                if (!btn) return;
                btn.onclick = () => {
                    let changed = 0;
                    document.querySelectorAll('[data-prop]').forEach(sel => {
                        const s = (TT.state.ops.substitutes || []).find(x => String(x.id) === String(sel.dataset.prop));
                        if (!s || !OPEN_STATUS.includes(s.status)) return;
                        const val = sel.value || '';
                        if (String(s.requestedId || '') === String(val)) return;
                        s.requestedId = val;
                        s.requestedBy = TT.state.user.id;
                        s.requestedAt = Date.now();
                        s.status = val ? 'proposed' : 'pending';
                        s.history = (s.history || []).concat([{
                            at: Date.now(), by: TT.state.user.name || '',
                            action: val ? 'เสนอชื่อ ' + TT.teacherName(val) + ' ให้สอนแทน' : 'ยกเลิกการเสนอชื่อ'
                        }]);
                        changed++;
                    });
                    if (!changed) { UI.notify('ยังไม่มีการเปลี่ยนแปลง', 'warn'); return; }

                    TT.notifyUsers(coordinatorIds(), 'มีการเสนอชื่อครูสอนแทน',
                        TT.teacherName(l.teacherId) + ' เสนอชื่อครูสอนแทน ' + changed + ' คาบ รอการอนุมัติ', 'substitutes');

                    TT.saveOpsNow().then(() => {
                        TT.log('propose_substitute', TT.teacherName(l.teacherId) + ' ' + changed + ' คาบ');
                        UI.notify('ส่งให้ผู้จัดอนุมัติแล้ว ' + changed + ' คาบ');
                        UI.closeModal();
                        TTApp.refresh();
                    });
                };
            }
        });
    };

    /* ผู้จัดครูสอนแทนอนุมัติชื่อที่ครูเสนอมา */
    P.approveProposed = function (id) {
        const s = (TT.state.ops.substitutes || []).find(x => String(x.id) === String(id));
        if (!s || !s.requestedId) return;
        if (!manages()) { UI.notify('ท่านไม่มีสิทธิ์อนุมัติการสอนแทน', 'error'); return; }

        const name = TT.teacherName(s.requestedId);
        const free = E.isTeacherFree(s.requestedId, s.day, s.periodId, { date: s.date, ignoreRequestId: s.id });

        UI.confirm('อนุมัติครูสอนแทน',
            `อนุมัติให้ <b>${UI.esc(name)}</b> สอนแทน ${TT.thaiDate(s.date)} ${UI.esc(TT.periodLabel(s.periodId))}` +
            ` วิชา${UI.esc(TT.subjectName(s.subjectId))} ห้อง${UI.esc(TT.className(s.classId))} หรือไม่?` +
            (free ? '' : '<br><span class="text-rose-600 font-bold">ครูท่านนี้ติดคาบอื่นในเวลานี้แล้ว</span>'),
            free ? 'info' : 'warn', () => {
                s.substituteId = s.requestedId;
                s.status = 'awaiting';
                s.assignedAt = Date.now();
                s.assignedBy = TT.state.user.id;
                s.history = (s.history || []).concat([{
                    at: Date.now(), by: TT.state.user.name || '', action: 'อนุมัติชื่อที่ครูเสนอ : ' + name
                }]);
                TT.notifyUsers(s.substituteId, 'ได้รับมอบหมายให้สอนแทน',
                    TT.thaiDate(s.date) + ' ' + TT.periodLabel(s.periodId) + ' วิชา' + TT.subjectName(s.subjectId) +
                    ' ห้อง' + TT.className(s.classId), 'substitutes');
                TT.notifyUsers(s.teacherId, 'อนุมัติครูสอนแทนแล้ว',
                    'คาบ ' + TT.periodLabel(s.periodId) + ' วันที่ ' + TT.thaiDate(s.date) + ' ได้ ' + name + ' สอนแทน', 'substitutes');
                TT.saveOpsNow().then(() => {
                    TT.log('approve_proposed', name);
                    UI.notify('อนุมัติแล้ว รอครูรับทราบ');
                    TTApp.refresh();
                });
            }, 'อนุมัติ');
    };

    /* ไม่อนุมัติชื่อที่เสนอ ส่งกลับไปรอจัดใหม่ */
    P.rejectProposed = function (id) {
        const s = (TT.state.ops.substitutes || []).find(x => String(x.id) === String(id));
        if (!s) return;
        if (!manages()) { UI.notify('ท่านไม่มีสิทธิ์อนุมัติการสอนแทน', 'error'); return; }
        UI.prompt('ไม่อนุมัติชื่อที่เสนอ', 'เหตุผล (แจ้งให้ครูผู้เสนอทราบ)', (reason) => {
            const name = TT.teacherName(s.requestedId);
            s.status = 'pending';
            s.requestedId = '';
            s.history = (s.history || []).concat([{
                at: Date.now(), by: TT.state.user.name || '', action: 'ไม่อนุมัติชื่อที่เสนอ (' + name + ') : ' + reason
            }]);
            TT.notifyUsers(s.requestedBy || s.teacherId, 'ไม่อนุมัติครูสอนแทนที่เสนอ',
                TT.thaiDate(s.date) + ' ' + TT.periodLabel(s.periodId) + ' : ' + reason, 'substitutes');
            TT.saveOpsNow().then(() => {
                UI.notify('ส่งกลับไปรอจัดครูสอนแทนใหม่');
                TTApp.refresh();
            });
        }, 'เช่น ครูท่านนี้ติดภารกิจอื่น');
    };

    /* ช่วงเวลาที่ลาของใบลาหนึ่งใบ ข้อมูลเก่ามีแต่ allDay/periodIds จึงต้องเดาย้อนหลังให้ */
    const leaveSession = function (l) {
        if (l.session && TT.LEAVE_SESSIONS[l.session]) return l.session;
        if (l.allDay) return 'all';
        const picked = (l.periodIds || []).slice().sort().join(',');
        if (picked && picked === TT.periodsOfSession('morning').slice().sort().join(',')) return 'morning';
        if (picked && picked === TT.periodsOfSession('afternoon').slice().sort().join(',')) return 'afternoon';
        return 'custom';
    };

    P.openLeaveForm = function (id) {
        const isTeacher = TT.state.user.role === 'teacher';
        const periods = TT.periods();
        const l = (TT.state.ops.leaves || []).find(x => String(x.id) === String(id)) || {
            id: '', teacherId: isTeacher ? TT.state.user.id : '', type: 'sick',
            from: today(), to: today(), allDay: true, periodIds: [], reason: '', attachment: '', note: '', deputy: ''
        };

        UI.modal(id ? 'แก้ไขการแจ้งลา' : 'แจ้งขาด ลา หรือไปราชการ', `
            <div class="space-y-4">
                ${manages() ? `<div>
                    <label class="block font-bold text-slate-700 mb-1.5 text-sm">ครูผู้แจ้ง</label>
                    ${UI.select('lv-teacher', UI.teacherOptions(true), l.teacherId, 'class="w-full"')}
                </div>` : `<input type="hidden" id="lv-teacher" value="${UI.esc(l.teacherId)}">`}

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ประเภท</label>
                        <select id="lv-type" class="w-full border border-slate-200 rounded-xl p-2.5 font-semibold focus-ring">
                            ${Object.keys(TT.LEAVE_TYPES).map(k => `<option value="${k}" ${l.type === k ? 'selected' : ''}>${UI.esc(TT.LEAVE_TYPES[k])}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ตั้งแต่วันที่</label>
                        <input type="date" id="lv-from" value="${UI.esc(l.from)}" class="w-full border border-slate-200 rounded-xl p-2.5 font-semibold focus-ring">
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ถึงวันที่</label>
                        <input type="date" id="lv-to" value="${UI.esc(l.to || l.from)}" class="w-full border border-slate-200 rounded-xl p-2.5 font-semibold focus-ring">
                    </div>
                </div>

                <div>
                    <div class="text-sm font-bold text-slate-700 mb-1.5">ช่วงเวลาที่ลา</div>
                    <div class="flex flex-wrap gap-1.5 mb-2">
                        ${Object.keys(TT.LEAVE_SESSIONS).map(k => `
                        <label class="px-3 py-2 rounded-xl border font-bold text-sm cursor-pointer flex items-center gap-2
                            ${leaveSession(l) === k ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}">
                            <input type="radio" name="lv-session" value="${k}" ${leaveSession(l) === k ? 'checked' : ''} class="w-3.5 h-3.5 accent-blue-600">
                            ${UI.esc(TT.LEAVE_SESSIONS[k])}
                        </label>`).join('')}
                    </div>
                    <div id="lv-periods-box" class="${leaveSession(l) === 'custom' ? '' : 'hidden'}">
                        <div class="text-sm font-bold text-slate-600 mb-1.5">เลือกเฉพาะบางคาบ</div>
                        <div class="flex flex-wrap gap-1.5">
                            ${periods.map(p => `<label class="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-1.5">
                                <input type="checkbox" data-lvp="${p.id}" ${(l.periodIds || []).includes(p.id) ? 'checked' : ''} class="w-3.5 h-3.5 accent-blue-600"> ${UI.esc(p.label)}
                            </label>`).join('')}
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block font-bold text-slate-700 mb-1.5 text-sm">เหตุผล</label>
                    <textarea id="lv-reason" rows="2" class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring">${UI.esc(l.reason)}</textarea>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ลิงก์เอกสารแนบ (ถ้ามี)</label>
                        <input id="lv-attach" value="${UI.esc(l.attachment)}" placeholder="วางลิงก์ไฟล์" class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring">
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ผู้รับผิดชอบงานแทน (ถ้ามี)</label>
                        ${UI.select('lv-deputy', UI.teacherOptions(true), l.deputy, 'class="w-full"')}
                    </div>
                </div>

                <div>
                    <label class="block font-bold text-slate-700 mb-1.5 text-sm">หมายเหตุ</label>
                    <input id="lv-note" value="${UI.esc(l.note)}" class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring">
                </div>

                <div id="lv-preview" class="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-sm text-blue-800 font-semibold"></div>
            </div>`, {
            width: 'max-w-2xl',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ยกเลิก</button>
                <button id="btn-save-leave" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">บันทึกการแจ้งลา</button>`,
            onOpen: () => {
                const refresh = () => {
                    const session = (document.querySelector('[name="lv-session"]:checked') || {}).value || 'all';
                    $('lv-periods-box').classList.toggle('hidden', session !== 'custom');
                    const draft = collectLeave(id);
                    const covers = draft.teacherId ? E.periodsNeedingCover(draft) : [];
                    $('lv-preview').innerHTML = draft.teacherId
                        ? `<i class="ph ph-info mr-1"></i> ช่วงเวลาที่แจ้งลานี้มีคาบสอน <b>${covers.length}</b> คาบที่ต้องหาครูสอนแทน` +
                        (covers.length ? '<div class="mt-1 text-xs">' + covers.slice(0, 8).map(c =>
                            TT.thaiDate(c.date) + ' ' + TT.periodLabel(c.periodId) + ' · ' + TT.className(c.classId) + ' ' + TT.subjectName(c.subjectId)).join('<br>') +
                            (covers.length > 8 ? '<br>…' : '') + '</div>' : '')
                        : 'กรุณาเลือกครูผู้แจ้ง';
                };
                ['lv-teacher', 'lv-from', 'lv-to'].forEach(x => {
                    const el = $(x);
                    if (el) el.onchange = refresh;
                });
                document.querySelectorAll('[name="lv-session"]').forEach(r => { r.onchange = refresh; });
                document.querySelectorAll('[data-lvp]').forEach(c => { c.onchange = refresh; });
                refresh();

                $('btn-save-leave').onclick = () => {
                    const payload = collectLeave(id);
                    if (!payload.teacherId) { UI.notify('กรุณาเลือกครูผู้แจ้ง', 'warn'); return; }
                    if (!payload.from) { UI.notify('กรุณาระบุวันที่', 'warn'); return; }
                    if (payload.to < payload.from) { UI.notify('วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น', 'warn'); return; }
                    if (!payload.allDay && !payload.periodIds.length) {
                        UI.notify(payload.session === 'custom'
                            ? 'เลือกคาบที่ลาอย่างน้อยหนึ่งคาบ'
                            : 'ช่วงเวลาที่เลือกไม่มีคาบเรียน กรุณาตรวจการตั้งค่าคาบเรียน', 'warn');
                        return;
                    }
                    saveLeave(id, payload);
                };
            }
        });
    };

    const collectLeave = function (id) {
        const session = (document.querySelector('[name="lv-session"]:checked') || {}).value || 'all';
        /* ครึ่งเช้า/ครึ่งบ่าย แปลงเป็นรายการคาบทันที เพื่อให้ส่วนอื่นของระบบใช้ต่อได้เหมือนเดิม */
        const periodIds = session === 'custom'
            ? Array.from(document.querySelectorAll('[data-lvp]:checked')).map(c => c.dataset.lvp)
            : TT.periodsOfSession(session);
        return {
            id: id || TT.uid('lv'),
            teacherId: $('lv-teacher') ? $('lv-teacher').value : '',
            type: $('lv-type').value,
            from: $('lv-from').value,
            to: $('lv-to').value || $('lv-from').value,
            session,
            allDay: session === 'all',
            periodIds,
            reason: $('lv-reason').value.trim(),
            attachment: $('lv-attach').value.trim(),
            deputy: $('lv-deputy').value,
            note: $('lv-note').value.trim(),
            status: 'active',
            createdAt: Date.now(),
            createdBy: (TT.state.user && TT.state.user.id) || ''
        };
    };

    /* บันทึกใบลา แล้วสร้างรายการคาบที่ต้องหาครูสอนแทนโดยอัตโนมัติ */
    const saveLeave = function (id, payload) {
        const list = TT.state.ops.leaves;
        const i = list.findIndex(x => String(x.id) === String(id));
        if (i >= 0) list[i] = Object.assign(list[i], payload); else list.push(payload);

        /* ลบรายการสอนแทนเดิมของใบลานี้ที่ยังไม่มีใครรับ แล้วสร้างใหม่ตามคาบที่ตรงกัน
           แต่ต้องจำ "ชื่อที่ครูเสนอไว้" ของแต่ละคาบ เพื่อนำกลับมาใส่ให้ ไม่ให้ที่เสนอไว้หายเมื่อแก้ใบลา */
        const slotKey = (x) => x.date + '|' + x.periodId + '|' + x.classId;
        const keptProposals = new Map();
        (TT.state.ops.substitutes || []).forEach(s => {
            if (String(s.leaveId) === String(payload.id) && s.requestedId) {
                keptProposals.set(slotKey(s), { id: s.requestedId, by: s.requestedBy || '', at: s.requestedAt || 0 });
            }
        });
        const covers = E.periodsNeedingCover(payload);
        const stillNeeded = new Set(covers.map(slotKey));

        /* คาบที่ไม่อยู่ในช่วงลาแล้ว (เช่น แก้จากลาทั้งวันเหลือครึ่งเช้า) ต้องตัดทิ้งทุกสถานะ
           ถ้ามอบหมายครูไว้แล้วต้องแจ้งให้ท่านนั้นทราบด้วย ไม่งั้นจะมาสอนแทนเก้อ */
        let dropped = 0;
        (TT.state.ops.substitutes || []).forEach(s => {
            if (String(s.leaveId) !== String(payload.id)) return;
            if (stillNeeded.has(slotKey(s))) return;
            dropped++;
            if (s.substituteId) {
                TT.notifyUsers(s.substituteId, 'ยกเลิกการสอนแทน',
                    'ครูผู้ลาแก้ช่วงเวลาที่ลา คาบ ' + TT.periodLabel(s.periodId) + ' วันที่ ' + TT.thaiDate(s.date) +
                    ' จึงไม่ต้องสอนแทนแล้ว', 'substitutes');
            }
        });

        TT.state.ops.substitutes = (TT.state.ops.substitutes || []).filter(s =>
            String(s.leaveId) !== String(payload.id) ||
            (stillNeeded.has(slotKey(s)) && ['accepted', 'done'].includes(s.status)));

        let created = 0;
        covers.forEach(c => {
            const exists = (TT.state.ops.substitutes || []).some(s =>
                String(s.leaveId) === String(payload.id) && s.date === c.date && s.periodId === c.periodId && String(s.classId) === String(c.classId));
            if (exists) return;
            const kept = keptProposals.get(slotKey(c));
            TT.state.ops.substitutes.push({
                id: TT.uid('sb'),
                leaveId: payload.id,
                teacherId: payload.teacherId,
                date: c.date, day: c.day, periodId: c.periodId,
                classId: c.classId, subjectId: c.subjectId, roomId: c.roomId,
                substituteId: '', status: kept ? 'proposed' : 'pending',
                requestedId: kept ? kept.id : '', requestedBy: kept ? kept.by : '', requestedAt: kept ? kept.at : 0,
                assignedAt: 0, assignedBy: '', acknowledgedAt: 0, declineReason: '',
                history: [{ at: Date.now(), by: (TT.state.user && TT.state.user.name) || '', action: 'สร้างรายการจากการแจ้งลา' }]
            });
            created++;
        });

        TT.saveOpsNow().then(() => {
            TT.log('save_leave', TT.teacherName(payload.teacherId) + ' ' + (TT.LEAVE_TYPES[payload.type] || '') + ' ' + payload.from);
            /* แจ้งผู้จัดตารางและผู้จัดครูสอนแทนให้ทราบ */
            const managers = TT.teachers().filter(t => {
                const p = TT.permOf(t.id);
                return p.canSchedule || p.canSubstitute;
            }).map(t => t.id).concat(['admin']);
            TT.notifyUsers(managers, 'มีครูแจ้งลา',
                TT.teacherName(payload.teacherId) + ' แจ้ง' + (TT.LEAVE_TYPES[payload.type] || 'ลา') + ' วันที่ ' + TT.thaiDate(payload.from) +
                ' มีคาบที่ต้องหาครูสอนแทน ' + created + ' คาบ', 'substitutes');
            UI.notify('บันทึกการแจ้งลาแล้ว พบคาบที่ต้องสอนแทน ' + created + ' คาบ' +
                (dropped ? ' · ตัดคาบที่ไม่อยู่ในช่วงลาแล้ว ' + dropped + ' คาบ' : ''));
            UI.closeModal();
            TTApp.refresh();
        }).catch(() => UI.notify('บันทึกไม่สำเร็จ', 'error'));
    };

    /* ลบใบลาทิ้งถาวร พร้อมคาบสอนแทนทั้งหมดที่เกิดจากใบลานี้
       ครูที่ถูกมอบหมายให้สอนแทนไว้แล้วจะได้รับแจ้งก่อนลบ */
    P.deleteLeave = function (id) {
        const l = (TT.state.ops.leaves || []).find(x => String(x.id) === String(id));
        if (!l) return;
        const covers = (TT.state.ops.substitutes || []).filter(s => String(s.leaveId) === String(id));
        const assigned = covers.filter(s => s.substituteId).length;

        UI.confirm('ลบการแจ้งลา',
            `ต้องการลบการลาของ <b>${UI.esc(TT.teacherName(l.teacherId))}</b> วันที่ ${TT.thaiDate(l.from)} หรือไม่?` +
            (covers.length ? `<br>คาบสอนแทนที่เกิดจากใบลานี้ ${covers.length} คาบจะถูกลบไปด้วย` +
                (assigned ? ` (แจ้งครูที่ถูกมอบหมายไว้แล้ว ${assigned} คาบ)` : '') : '') +
            `<br><span class="text-rose-600 font-bold">ลบแล้วกู้คืนไม่ได้</span>`,
            'danger', () => {
                covers.forEach(s => {
                    if (!s.substituteId) return;
                    TT.notifyUsers(s.substituteId, 'ยกเลิกการสอนแทน',
                        'การสอนแทนวันที่ ' + TT.thaiDate(s.date) + ' ' + TT.periodLabel(s.periodId) + ' ถูกยกเลิก', 'substitutes');
                });
                TT.state.ops.substitutes = (TT.state.ops.substitutes || [])
                    .filter(s => String(s.leaveId) !== String(id));
                TT.state.ops.leaves = (TT.state.ops.leaves || [])
                    .filter(x => String(x.id) !== String(id));

                TT.saveOpsNow().then(() => {
                    TT.log('delete_leave', TT.teacherName(l.teacherId) + ' ' + l.from);
                    UI.notify('ลบการลาแล้ว' + (covers.length ? ' พร้อมคาบสอนแทน ' + covers.length + ' คาบ' : ''));
                    TTApp.refresh();
                });
            }, 'ลบถาวร');
    };

    /* ล้างใบลาที่เคย "ยกเลิก" ไว้ในระบบเดิม ให้หายไปจริง ๆ */
    P.purgeCancelledLeaves = function () {
        const ids = new Set((TT.state.ops.leaves || [])
            .filter(l => l.status === 'cancelled').map(l => String(l.id)));
        const subs = (TT.state.ops.substitutes || [])
            .filter(s => ids.has(String(s.leaveId)) || s.status === 'cancelled').length;
        if (!ids.size && !subs) return;

        UI.confirm('ลบรายการที่ยกเลิกแล้วทั้งหมด',
            `จะลบใบลาที่ยกเลิกแล้ว ${ids.size} รายการ` +
            (subs ? ` และคาบสอนแทนที่ยกเลิกแล้ว ${subs} คาบ` : '') +
            `<br><span class="text-rose-600 font-bold">ลบแล้วกู้คืนไม่ได้</span>`,
            'danger', () => {
                TT.state.ops.substitutes = (TT.state.ops.substitutes || [])
                    .filter(s => !ids.has(String(s.leaveId)) && s.status !== 'cancelled');
                TT.state.ops.leaves = (TT.state.ops.leaves || [])
                    .filter(l => l.status !== 'cancelled');
                TT.state.filters.showCancelledLeaves = false;
                TT.saveOpsNow().then(() => {
                    TT.log('purge_cancelled_leaves', ids.size + ' รายการ');
                    UI.notify('ลบรายการที่ยกเลิกแล้วเรียบร้อย');
                    TTApp.refresh();
                });
            }, 'ลบถาวร');
    };

    P.exportLeaves = function () {
        const rows = [['ครู', 'ประเภท', 'ตั้งแต่', 'ถึง', 'ช่วงเวลา', 'เหตุผล', 'คาบที่ต้องสอนแทน', 'สถานะ']];
        (TT.state.ops.leaves || []).forEach(l => {
            const covers = (TT.state.ops.substitutes || []).filter(s => String(s.leaveId) === String(l.id)).length;
            rows.push([TT.teacherName(l.teacherId), TT.LEAVE_TYPES[l.type] || l.type, l.from, l.to || l.from,
            l.allDay ? 'ทั้งวัน' : (l.periodIds || []).map(p => TT.periodLabel(p)).join(' '),
            l.reason, covers, l.status === 'cancelled' ? 'ยกเลิก' : 'ปกติ']);
        });
        UI.exportExcel([{ name: 'การลา', rows }], 'รายงานการลา');
    };

    /* =====================================================================
       จัดครูสอนแทน
       ===================================================================== */

    P.substitutes = function (root) {
        const isManager = manages();
        const myId = TT.state.user.role === 'teacher' ? TT.state.user.id : '';
        const f = TT.state.filters;
        if (!f.subStatus) f.subStatus = 'all';

        /* งานที่จบแล้วไม่ต้องรกหน้าทำงาน : ที่ยกเลิก และที่สอนแทนเรียบร้อยแล้ว จะถูกซ่อน
           ดูย้อนหลังได้ที่หน้า "ประวัติและสถิติ" หรือเลือกสถานะนั้นจากตัวกรองโดยตรง */
        const base = f.subStatus === 'cancelled' ? (TT.state.ops.substitutes || [])
            : TT.activeSubstitutes().filter(s => f.subStatus === 'done' || s.status !== 'done');
        let list = base.slice()
            .sort((a, b) => String(a.date + a.periodId).localeCompare(String(b.date + b.periodId)));
        if (!isManager) list = list.filter(s => String(s.substituteId) === String(myId) || String(s.teacherId) === String(myId));
        if (f.subLeave) list = list.filter(s => String(s.leaveId) === String(f.subLeave));
        if (f.subStatus !== 'all') list = list.filter(s => s.status === f.subStatus);
        if (f.subDate) list = list.filter(s => s.date === f.subDate);

        const counts = {};
        TT.activeSubstitutes().forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });

        root.innerHTML =
            TTApp.termBar() +
            UI.pageHeader('จัดครูสอนแทน',
                isManager ? 'ค้นหาครูที่ว่างจริงในคาบนั้น พร้อมคะแนนความเหมาะสมและเหตุผลประกอบ' : 'รายการที่ท่านได้รับมอบหมายให้สอนแทน',
                isManager ? `
                <button onclick="TTPages.autoAssignAll()" class="tactile-btn px-4 py-2.5 rounded-xl font-bold text-white accent-gradient shadow-lg"><i class="ph ph-magic-wand mr-1"></i> จัดครูอัตโนมัติทั้งหมด</button>
                <button onclick="TTPages.printSubSlips()" class="tactile-btn px-4 py-2.5 rounded-xl font-bold bg-white border border-slate-200 text-slate-600"><i class="ph ph-printer mr-1"></i> ใบมอบหมาย</button>` : '') +
            `<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                ${UI.stat('รอจัดครูสอนแทน', counts.pending || 0, 'ph-warning', 'rose')}
                ${UI.stat('ครูเสนอชื่อ รออนุมัติ', counts.proposed || 0, 'ph-user-switch', 'violet')}
                ${UI.stat('รอครูยืนยัน', counts.awaiting || 0, 'ph-hourglass', 'amber')}
                ${UI.stat('ครูรับทราบแล้ว', counts.accepted || 0, 'ph-check-circle', 'green')}
                ${UI.stat('สอนแทนเรียบร้อย', counts.done || 0, 'ph-flag-checkered', 'slate')}
            </div>

            <div class="modern-card p-3 mb-4 flex flex-wrap items-center gap-2 no-print">
                <select id="sub-status" class="border border-slate-200 rounded-xl px-3 py-2 font-bold focus-ring">
                    <option value="all">ทุกสถานะ</option>
                    ${Object.keys(TT.SUB_STATUS).map(k => `<option value="${k}" ${f.subStatus === k ? 'selected' : ''}>${UI.esc(TT.SUB_STATUS[k].label)}</option>`).join('')}
                </select>
                <input type="date" id="sub-date" value="${UI.esc(f.subDate || '')}" class="border border-slate-200 rounded-xl px-3 py-2 font-semibold focus-ring">
                ${f.subLeave ? `<button onclick="TTPages.clearSubFilter()" class="tactile-btn px-3 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-600"><i class="ph ph-x mr-1"></i> ล้างตัวกรองใบลา</button>` : ''}
                <div class="flex-1"></div>
                <span class="text-sm font-bold text-slate-500">${list.length} รายการ</span>
            </div>

            <div class="space-y-3">${list.map(subCard).join('') || UI.empty('ไม่มีรายการสอนแทนตามเงื่อนไขที่เลือก', 'ph-arrows-left-right')}</div>`;

        $('sub-status').onchange = () => { f.subStatus = $('sub-status').value; TTApp.refresh(); };
        $('sub-date').onchange = () => { f.subDate = $('sub-date').value; TTApp.refresh(); };
    };

    P.clearSubFilter = function () {
        TT.state.filters.subLeave = '';
        TTApp.refresh();
    };

    const subCard = function (s) {
        const st = TT.SUB_STATUS[s.status] || TT.SUB_STATUS.pending;
        const isManager = manages();
        const myId = TT.state.user.role === 'teacher' ? TT.state.user.id : '';
        const isMine = String(s.substituteId) === String(myId);
        const sub = TT.subject(s.subjectId) || {};

        return `
        <div class="modern-card p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex gap-3 min-w-0">
                    <div class="w-12 h-12 rounded-2xl grid place-items-center shrink-0 font-extrabold text-xs text-center leading-tight"
                        style="background:${UI.esc(sub.color || '#e0e7ff')};color:${UI.textOn(sub.color || '#e0e7ff')}">
                        ${UI.esc(TT.periodLabel(s.periodId).replace('คาบที่ ', 'ค.'))}
                    </div>
                    <div class="min-w-0">
                        <div class="font-extrabold text-slate-800">
                            ${UI.esc(TT.subjectName(s.subjectId))} · ${UI.esc(TT.className(s.classId))}
                        </div>
                        <div class="text-sm text-slate-600 font-semibold">
                            ${TT.thaiDate(s.date)} (วัน${UI.esc(TT.dayName(s.day))}) · ${UI.esc(TT.periodLabel(s.periodId))}
                            ${s.roomId ? ' · ' + UI.esc(TT.roomName(s.roomId)) : ''}
                        </div>
                        <div class="text-sm text-slate-500 mt-0.5">
                            ครูที่ไม่อยู่ : <span class="font-bold text-slate-700">${UI.esc(TT.teacherName(s.teacherId))}</span>
                            ${s.substituteId ? ` → ครูสอนแทน : <span class="font-bold text-blue-700">${UI.esc(TT.teacherName(s.substituteId))}</span>` : ''}
                        </div>
                        ${s.status === 'proposed' && s.requestedId ? `<div class="text-xs text-violet-700 font-bold mt-1">
                            <i class="ph ph-user-switch"></i> ครูเสนอชื่อ : ${UI.esc(TT.teacherName(s.requestedId))}
                            ${s.requestedBy ? ' (โดย ' + UI.esc(TT.teacherName(s.requestedBy)) + ')' : ''}
                        </div>` : ''}
                        ${s.declineReason ? `<div class="text-xs text-rose-600 font-semibold mt-1"><i class="ph ph-x-circle"></i> เหตุผลที่ปฏิเสธ : ${UI.esc(s.declineReason)}</div>` : ''}
                    </div>
                </div>

                <div class="flex flex-col items-end gap-2 shrink-0">
                    <span class="text-[11px] font-bold px-2.5 py-1 rounded-lg border ${st.color}">${UI.esc(st.label)}</span>
                    <div class="flex flex-wrap gap-1.5 justify-end">
                        ${isManager && s.status === 'proposed' && s.requestedId
                ? `<button onclick="TTPages.approveProposed('${s.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-violet-600"><i class="ph ph-seal-check mr-1"></i> อนุมัติชื่อที่เสนอ</button>
                       <button onclick="TTPages.rejectProposed('${s.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600">ไม่อนุมัติ</button>` : ''}
                        ${isManager && ['pending', 'declined', 'changing', 'proposed'].includes(s.status)
                ? `<button onclick="TTPages.openFindSubstitute('${s.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold text-white brand-gradient"><i class="ph ph-magnifying-glass mr-1"></i> ค้นหาครูสอนแทน</button>` : ''}
                        ${isManager && ['awaiting', 'accepted'].includes(s.status)
                ? `<button onclick="TTPages.openFindSubstitute('${s.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700"><i class="ph ph-swap mr-1"></i> เปลี่ยนครู</button>` : ''}
                        ${isMine && s.status === 'awaiting'
                ? `<button onclick="TTPages.acknowledgeSub('${s.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600"><i class="ph ph-check mr-1"></i> รับทราบ</button>
                       <button onclick="TTPages.declineSub('${s.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600">ขอปฏิเสธ</button>` : ''}
                        ${isManager && s.status === 'accepted'
                ? `<button onclick="TTPages.markSubDone('${s.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700"><i class="ph ph-flag-checkered mr-1"></i> สอนแทนเสร็จ</button>` : ''}
                        ${TT.can('approve') && ['awaiting', 'accepted'].includes(s.status) && !s.approvedAt
                ? `<button onclick="TTPages.approveSub('${s.id}')" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700"><i class="ph ph-seal-check mr-1"></i> รับทราบ (ผู้บริหาร)</button>` : ''}
                        <button onclick="TTPages.subHistory('${s.id}')" class="tactile-btn px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 text-slate-500"><i class="ph ph-clock-counter-clockwise"></i></button>
                    </div>
                    ${s.approvedAt ? `<span class="text-[11px] text-emerald-600 font-bold"><i class="ph ph-seal-check"></i> ผู้บริหารรับทราบแล้ว</span>` : ''}
                </div>
            </div>
        </div>`;
    };

    /* ------------------------------------------------------- ค้นหาครูสอนแทน */

    P.openFindSubstitute = function (requestId) {
        const s = (TT.state.ops.substitutes || []).find(x => String(x.id) === String(requestId));
        if (!s) return;
        const ranked = E.rankSubstitutes(s);

        UI.modal('ค้นหาครูสอนแทน', `
            <div class="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 mb-4">
                <div class="font-extrabold text-slate-800">${UI.esc(TT.subjectName(s.subjectId))} · ${UI.esc(TT.className(s.classId))}</div>
                <div class="text-sm text-slate-600 font-semibold">
                    ${TT.thaiDate(s.date)} (วัน${UI.esc(TT.dayName(s.day))}) · ${UI.esc(TT.periodLabel(s.periodId))}
                    ${s.roomId ? ' · ' + UI.esc(TT.roomName(s.roomId)) : ''}
                </div>
                <div class="text-sm text-slate-500">แทนครู ${UI.esc(TT.teacherName(s.teacherId))}</div>
            </div>

            ${ranked.length ? `
            <div class="flex items-center justify-between mb-2">
                <div class="font-bold text-slate-700 text-sm">ครูที่ว่างจริงในคาบนี้ ${ranked.length} ท่าน</div>
                <button id="btn-best-sub" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold text-white accent-gradient"><i class="ph ph-star mr-1"></i> เลือกครูที่เหมาะสมที่สุด</button>
            </div>
            <div class="space-y-2 max-h-[52vh] overflow-y-auto custom-scrollbar pr-1">
                ${ranked.map((r, i) => `
                <div class="p-3 rounded-2xl border ${i === 0 ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="font-extrabold text-slate-800 flex items-center gap-2">
                                ${i === 0 ? '<i class="ph ph-star-fill text-amber-500"></i>' : ''}${UI.esc(r.name)}
                                <span class="text-[11px] font-bold px-2 py-0.5 rounded-lg ${r.score >= 70 ? 'bg-emerald-100 text-emerald-700' : (r.score >= 45 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}">${r.score} คะแนน</span>
                            </div>
                            <div class="text-xs text-slate-500 font-semibold">${UI.esc(r.dept || '—')}${r.major ? ' · วิชาเอก' + UI.esc(r.major) : ''}</div>
                            <div class="text-xs text-slate-500 mt-1">
                                คาบก่อนหน้า : ${UI.esc(r.prevPeriod)} · คาบถัดไป : ${UI.esc(r.nextPeriod)}
                            </div>
                            <div class="text-xs text-slate-500">
                                วันนี้สอน ${r.dayPeriods} คาบ · สัปดาห์นี้ ${r.weekPeriods} คาบ · เดือนนี้สอนแทน ${r.monthSubs} ครั้ง
                            </div>
                            <div class="flex flex-wrap gap-1 mt-1.5">
                                ${r.reasons.slice(0, 4).map(x => `<span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">${UI.esc(x)}</span>`).join('')}
                            </div>
                        </div>
                        <button onclick="TTPages.assignSubstitute('${s.id}','${r.teacherId}')" class="tactile-btn px-3 py-2 rounded-xl text-xs font-bold text-white brand-gradient shrink-0">มอบหมาย</button>
                    </div>
                </div>`).join('')}
            </div>` : `
            <div class="text-center py-8">
                <i class="ph ph-user-x text-5xl text-slate-300 block mb-2"></i>
                <div class="font-bold text-slate-600">ไม่มีครูว่างในคาบนี้</div>
                <div class="text-sm text-slate-400 mt-1">ครูทุกท่านมีคาบสอน ลา หรือถูกมอบหมายสอนแทนอยู่แล้ว</div>
            </div>`}`, {
            width: 'max-w-3xl',
            onOpen: () => {
                const b = $('btn-best-sub');
                if (b) b.onclick = () => P.assignSubstitute(s.id, ranked[0].teacherId);
            }
        });
    };

    P.assignSubstitute = function (requestId, teacherId) {
        const s = (TT.state.ops.substitutes || []).find(x => String(x.id) === String(requestId));
        if (!s) return;

        /* กันไม่ให้ครูคนเดียวถูกมอบหมายซ้ำในเวลาเดียวกัน */
        const clash = (TT.state.ops.substitutes || []).find(x =>
            String(x.id) !== String(requestId) &&
            String(x.substituteId) === String(teacherId) &&
            x.date === s.date && x.periodId === s.periodId &&
            ['awaiting', 'accepted', 'done'].includes(x.status));
        if (clash) {
            UI.notify('ครูท่านนี้ถูกมอบหมายให้สอนแทนห้อง ' + TT.className(clash.classId) + ' ในคาบเดียวกันแล้ว', 'error');
            return;
        }
        if (!E.isTeacherFree(teacherId, s.day, s.periodId, { date: s.date, ignoreRequestId: s.id })) {
            UI.notify('ครูท่านนี้ไม่ว่างในคาบนี้', 'error');
            return;
        }

        const previous = s.substituteId;
        s.substituteId = teacherId;
        s.status = 'awaiting';
        s.assignedAt = Date.now();
        s.assignedBy = (TT.state.user && TT.state.user.name) || '';
        s.declineReason = '';
        s.history = (s.history || []).concat([{
            at: Date.now(),
            by: s.assignedBy,
            action: (previous ? 'เปลี่ยนครูสอนแทนจาก ' + TT.teacherName(previous) + ' เป็น ' : 'มอบหมายให้ ') + TT.teacherName(teacherId)
        }]);

        TT.saveOpsNow().then(() => {
            TT.log('assign_substitute', TT.teacherName(teacherId) + ' สอนแทน ' + TT.className(s.classId) + ' ' + s.date);
            TT.notifyUsers(teacherId, 'ท่านได้รับมอบหมายให้สอนแทน',
                TT.thaiDate(s.date) + ' ' + TT.periodLabel(s.periodId) + ' · ' + TT.subjectName(s.subjectId) + ' ห้อง ' + TT.className(s.classId) +
                ' (แทนครู' + TT.teacherName(s.teacherId) + ') กรุณากดยืนยันรับทราบ', 'substitutes');
            if (previous && String(previous) !== String(teacherId)) {
                TT.notifyUsers(previous, 'ยกเลิกการมอบหมายสอนแทน',
                    'การสอนแทนวันที่ ' + TT.thaiDate(s.date) + ' ' + TT.periodLabel(s.periodId) + ' ถูกเปลี่ยนเป็นครูท่านอื่น', 'substitutes');
            }
            UI.notify('มอบหมายครู' + TT.teacherName(teacherId) + 'แล้ว');
            UI.closeModal();
            TTApp.refresh();
        });
    };

    /* จัดครูอัตโนมัติให้ทุกคาบที่ยังไม่มีคนสอนแทน */
    P.autoAssignAll = function () {
        const pending = (TT.state.ops.substitutes || []).filter(s => ['pending', 'declined'].includes(s.status));
        if (!pending.length) { UI.notify('ไม่มีคาบที่รอจัดครูสอนแทน', 'info'); return; }

        UI.confirm('จัดครูสอนแทนอัตโนมัติ',
            `ระบบจะเลือกครูที่เหมาะสมที่สุดให้ ${pending.length} คาบ โดยดูจากวิชา กลุ่มสาระ ภาระงาน และจำนวนครั้งที่เคยสอนแทน`,
            'info', () => {
                let ok = 0, fail = 0;
                pending.forEach(s => {
                    const best = E.bestSubstitute(s);
                    if (!best) { fail++; return; }
                    const clash = (TT.state.ops.substitutes || []).some(x =>
                        String(x.id) !== String(s.id) && String(x.substituteId) === String(best.teacherId) &&
                        x.date === s.date && x.periodId === s.periodId && ['awaiting', 'accepted', 'done'].includes(x.status));
                    if (clash) { fail++; return; }

                    s.substituteId = best.teacherId;
                    s.status = 'awaiting';
                    s.assignedAt = Date.now();
                    s.assignedBy = (TT.state.user && TT.state.user.name) || 'ระบบ';
                    s.history = (s.history || []).concat([{ at: Date.now(), by: s.assignedBy, action: 'ระบบเลือกครูที่เหมาะสมที่สุด : ' + best.name }]);
                    TT.notifyUsers(best.teacherId, 'ท่านได้รับมอบหมายให้สอนแทน',
                        TT.thaiDate(s.date) + ' ' + TT.periodLabel(s.periodId) + ' · ' + TT.subjectName(s.subjectId) + ' ห้อง ' + TT.className(s.classId), 'substitutes');
                    ok++;
                });
                TT.saveOpsNow().then(() => {
                    TT.log('auto_assign_substitute', 'จัดได้ ' + ok + ' คาบ จัดไม่ได้ ' + fail + ' คาบ');
                    UI.notify('จัดครูสอนแทนได้ ' + ok + ' คาบ' + (fail ? ' · ไม่พบครูว่าง ' + fail + ' คาบ' : ''), fail ? 'warn' : 'success');
                    TTApp.refresh();
                });
            }, 'เริ่มจัดอัตโนมัติ');
    };

    P.acknowledgeSub = function (id) {
        const s = (TT.state.ops.substitutes || []).find(x => String(x.id) === String(id));
        if (!s) return;
        s.status = 'accepted';
        s.acknowledgedAt = Date.now();
        s.history = (s.history || []).concat([{ at: Date.now(), by: TT.state.user.name || '', action: 'ครูกดยืนยันรับทราบ' }]);
        TT.saveOpsNow().then(() => {
            TT.log('ack_substitute', TT.className(s.classId) + ' ' + s.date);
            const managers = TT.teachers().filter(t => { const p = TT.permOf(t.id); return p.canSchedule || p.canSubstitute; }).map(t => t.id).concat(['admin']);
            TT.notifyUsers(managers, 'ครูยืนยันรับทราบการสอนแทน',
                TT.teacherName(s.substituteId) + ' รับทราบการสอนแทนวันที่ ' + TT.thaiDate(s.date) + ' ' + TT.periodLabel(s.periodId), 'substitutes');
            UI.notify('ยืนยันรับทราบเรียบร้อย ขอบคุณครับ/ค่ะ');
            TTApp.refresh();
        });
    };

    P.declineSub = function (id) {
        UI.prompt('ขอปฏิเสธการสอนแทน', 'กรุณาระบุเหตุผล', (reason) => {
            const s = (TT.state.ops.substitutes || []).find(x => String(x.id) === String(id));
            if (!s) return;
            const who = s.substituteId;
            s.status = 'declined';
            s.declineReason = reason;
            s.history = (s.history || []).concat([{ at: Date.now(), by: TT.state.user.name || '', action: 'ปฏิเสธ : ' + reason }]);
            TT.saveOpsNow().then(() => {
                TT.log('decline_substitute', TT.teacherName(who) + ' : ' + reason);
                const managers = TT.teachers().filter(t => { const p = TT.permOf(t.id); return p.canSchedule || p.canSubstitute; }).map(t => t.id).concat(['admin']);
                TT.notifyUsers(managers, 'ครูขอปฏิเสธการสอนแทน',
                    TT.teacherName(who) + ' ขอปฏิเสธการสอนแทนวันที่ ' + TT.thaiDate(s.date) + ' ' + TT.periodLabel(s.periodId) + ' เหตุผล : ' + reason, 'substitutes');
                UI.notify('ส่งคำขอปฏิเสธแล้ว ผู้จัดตารางจะจัดครูท่านอื่นให้');
                TTApp.refresh();
            });
        }, 'เช่น ติดประชุมนอกโรงเรียน');
    };

    P.markSubDone = function (id) {
        const s = (TT.state.ops.substitutes || []).find(x => String(x.id) === String(id));
        if (!s) return;
        s.status = 'done';
        s.history = (s.history || []).concat([{ at: Date.now(), by: TT.state.user.name || '', action: 'บันทึกว่าสอนแทนเรียบร้อย' }]);
        TT.saveOpsNow().then(() => {
            TT.log('done_substitute', TT.className(s.classId) + ' ' + s.date);
            UI.notify('บันทึกว่าสอนแทนเรียบร้อยแล้ว');
            TTApp.refresh();
        });
    };

    P.approveSub = function (id) {
        const s = (TT.state.ops.substitutes || []).find(x => String(x.id) === String(id));
        if (!s) return;
        s.approvedAt = Date.now();
        s.approvedBy = TT.state.user.name || 'ผู้บริหาร';
        s.history = (s.history || []).concat([{ at: Date.now(), by: s.approvedBy, action: 'ผู้บริหารรับทราบ/อนุมัติ' }]);
        TT.saveOpsNow().then(() => {
            TT.log('approve_substitute', TT.className(s.classId) + ' ' + s.date);
            UI.notify('บันทึกการรับทราบของผู้บริหารแล้ว');
            TTApp.refresh();
        });
    };

    P.subHistory = function (id) {
        const s = (TT.state.ops.substitutes || []).find(x => String(x.id) === String(id));
        if (!s) return;
        UI.modal('ประวัติการเปลี่ยนแปลง', `
            <div class="space-y-2">
                ${(s.history || []).map(h => `
                    <div class="flex gap-3 text-sm">
                        <div class="text-slate-400 whitespace-nowrap font-semibold">${TT.thaiDateTime(h.at)}</div>
                        <div class="text-slate-700 font-semibold">${UI.esc(h.action)}${h.by ? ' — ' + UI.esc(h.by) : ''}</div>
                    </div>`).join('') || UI.empty('ยังไม่มีประวัติ', 'ph-clock-counter-clockwise')}
            </div>`, { width: 'max-w-xl' });
    };

    /* ใบมอบหมายงานสอนแทนสำหรับพิมพ์ */
    P.printSubSlips = function () {
        const list = (TT.state.ops.substitutes || []).filter(s => ['awaiting', 'accepted', 'done'].includes(s.status));
        if (!list.length) { UI.notify('ยังไม่มีรายการที่มอบหมายแล้ว', 'warn'); return; }

        UI.printPreview('ใบมอบหมายงานสอนแทน', () =>
            UI.printHeader('บันทึกข้อความ มอบหมายงานสอนแทน') + `
            <table class="bx" style="margin-top:4mm">
                <thead>
                    <tr>
                        <th style="width:8mm">ที่</th>
                        <th style="width:26mm">วันที่</th>
                        <th style="width:20mm">คาบ</th>
                        <th>วิชา / ห้อง</th>
                        <th>ครูที่ไม่อยู่</th>
                        <th>ครูผู้สอนแทน</th>
                        <th style="width:22mm">ลงชื่อรับทราบ</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map((s, i) => `<tr>
                        <td style="text-align:center">${i + 1}</td>
                        <td>${TT.thaiDate(s.date)}</td>
                        <td style="text-align:center">${UI.esc(TT.periodLabel(s.periodId))}</td>
                        <td>${UI.esc(TT.subjectName(s.subjectId))} / ${UI.esc(TT.className(s.classId))}</td>
                        <td>${UI.esc(TT.teacherName(s.teacherId))}</td>
                        <td>${UI.esc(TT.teacherName(s.substituteId))}</td>
                        <td></td>
                    </tr>`).join('')}
                </tbody>
            </table>` + UI.printSignatures(), 'portrait');
    };

    /* =====================================================================
       ค้นหาคาบว่าง
       ===================================================================== */

    P.freeslots = function (root) {
        const f = TT.state.filters;
        if (!f.freeMode) f.freeMode = 'teacher';
        const days = TT.days(), periods = TT.periods();

        root.innerHTML =
            TTApp.termBar() +
            UI.pageHeader('ค้นหาคาบว่าง', 'ค้นหาครูที่ว่าง ห้องเรียนที่ว่าง หรือช่วงเวลาที่ทุกคนว่างตรงกันสำหรับนัดประชุม') +
            `<div class="modern-card p-4 mb-5 no-print">
                <div class="flex flex-wrap gap-2 mb-4">
                    ${[['teacher', 'ครูที่ว่างตามวัน–คาบ', 'ph-user'],
                ['common', 'เวลาที่ครูหลายคนว่างตรงกัน', 'ph-users-three'],
                ['room', 'ห้องเรียน/ห้องพิเศษที่ว่าง', 'ph-door'],
                ['class', 'ห้องเรียนที่ไม่มีคาบสอน', 'ph-student']]
                .map(m => `<button onclick="TTPages.setFreeMode('${m[0]}')" class="tactile-btn px-4 py-2 rounded-xl text-sm font-bold ${f.freeMode === m[0] ? 'text-white brand-gradient shadow-lg' : 'bg-slate-100 text-slate-600'}"><i class="ph ${m[2]} mr-1"></i> ${m[1]}</button>`).join('')}
                </div>
                <div id="free-controls" class="flex flex-wrap items-end gap-3"></div>
            </div>
            <div id="free-result"></div>`;

        renderFreeControls();
    };

    P.setFreeMode = function (mode) {
        TT.state.filters.freeMode = mode;
        TTApp.refresh();
    };

    const renderFreeControls = function () {
        const f = TT.state.filters;
        const days = TT.days(), periods = TT.periods();
        const host = $('free-controls');

        const dayPeriodPicker = `
            <div>
                <label class="block font-bold text-slate-700 mb-1.5 text-sm">วัน</label>
                <select id="fs-day" class="border border-slate-200 rounded-xl px-3 py-2 font-semibold focus-ring">
                    ${days.map(d => `<option value="${d.id}">วัน${UI.esc(d.name)}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block font-bold text-slate-700 mb-1.5 text-sm">คาบ</label>
                <select id="fs-period" class="border border-slate-200 rounded-xl px-3 py-2 font-semibold focus-ring">
                    ${periods.map(p => `<option value="${p.id}">${UI.esc(p.label)} (${UI.esc(p.start)}–${UI.esc(p.end)})</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block font-bold text-slate-700 mb-1.5 text-sm">วันที่ (เพื่อตรวจการลา)</label>
                <input type="date" id="fs-date" value="${today()}" class="border border-slate-200 rounded-xl px-3 py-2 font-semibold focus-ring">
            </div>`;

        if (f.freeMode === 'common') {
            host.innerHTML = `
                <div class="w-full">
                    <label class="block font-bold text-slate-700 mb-2 text-sm">เลือกครูที่ต้องการให้ว่างตรงกัน</label>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-xl border border-slate-200">
                        ${TT.teachers().filter(t => t.status === 'active').map(t => `
                            <label class="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                                <input type="checkbox" data-fst="${UI.esc(t.id)}" class="w-4 h-4 accent-blue-600"> ${UI.esc(t.name)}
                            </label>`).join('')}
                    </div>
                </div>
                <button onclick="TTPages.runFreeSearch()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white brand-gradient shadow-lg"><i class="ph ph-magnifying-glass mr-1"></i> ค้นหา</button>`;
        } else if (f.freeMode === 'room') {
            host.innerHTML = dayPeriodPicker + `
                <div>
                    <label class="block font-bold text-slate-700 mb-1.5 text-sm">ประเภทห้อง</label>
                    <select id="fs-roomtype" class="border border-slate-200 rounded-xl px-3 py-2 font-semibold focus-ring">
                        <option value="">ทุกประเภท</option>
                        <option value="special">ห้องพิเศษ</option>
                        <option value="normal">ห้องเรียนทั่วไป</option>
                    </select>
                </div>
                <button onclick="TTPages.runFreeSearch()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white brand-gradient shadow-lg"><i class="ph ph-magnifying-glass mr-1"></i> ค้นหา</button>`;
        } else {
            host.innerHTML = dayPeriodPicker + `
                <button onclick="TTPages.runFreeSearch()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white brand-gradient shadow-lg"><i class="ph ph-magnifying-glass mr-1"></i> ค้นหา</button>`;
        }
        P.runFreeSearch();
    };

    P.runFreeSearch = function () {
        const f = TT.state.filters;
        const host = $('free-result');
        if (!host) return;

        if (f.freeMode === 'common') {
            const ids = Array.from(document.querySelectorAll('[data-fst]:checked')).map(c => c.dataset.fst);
            if (!ids.length) { host.innerHTML = UI.empty('เลือกครูอย่างน้อยหนึ่งท่าน', 'ph-users-three'); return; }
            const slots = E.commonFreeSlots(ids);
            const days = TT.days(), periods = TT.periods();
            host.innerHTML = `
                <div class="modern-card p-4 mb-4">
                    <div class="font-extrabold text-slate-800 mb-1">พบช่วงเวลาที่ครูทั้ง ${ids.length} ท่านว่างตรงกัน ${slots.length} ช่วง</div>
                    <div class="text-sm text-slate-500 font-semibold">${ids.map(i => UI.esc(TT.teacherName(i))).join(' · ')}</div>
                </div>
                <div class="tt-wrap mb-4">
                    <table class="tt-table">
                        <thead><tr><th>วัน/คาบ</th>${periods.map(p => `<th>${UI.esc(p.label)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${days.map(d => `<tr><th>วัน${UI.esc(d.name)}</th>
                                ${periods.map(p => {
                const ok = slots.some(s => s.day === d.id && s.periodId === p.id);
                return `<td class="tt-cell text-center align-middle ${ok ? 'bg-emerald-50' : ''}">
                                        <div class="text-xs font-bold ${ok ? 'text-emerald-600' : 'text-slate-300'} py-4">${ok ? 'ว่างทุกท่าน' : '—'}</div>
                                    </td>`;
            }).join('')}
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <button onclick="TTPages.exportFreeResult()" class="tactile-btn px-4 py-2.5 rounded-xl font-bold bg-white border border-slate-200 text-slate-600"><i class="ph ph-file-xls mr-1"></i> ส่งออกผลการค้นหา</button>`;
            TT.state.filters.freeResult = slots.map(s => [s.dayName, s.periodLabel, s.start + '-' + s.end, ids.map(i => TT.teacherName(i)).join(', ')]);
            TT.state.filters.freeHeader = ['วัน', 'คาบ', 'เวลา', 'ครูที่ว่างตรงกัน'];
            return;
        }

        const day = $('fs-day') ? $('fs-day').value : '';
        const periodId = $('fs-period') ? $('fs-period').value : '';
        const date = $('fs-date') ? $('fs-date').value : '';

        if (f.freeMode === 'teacher') {
            const free = E.freeTeachers(day, periodId, { date });
            host.innerHTML = resultCard('ครูที่ว่างจริงในคาบนี้', free.length,
                free.map(t => {
                    const w = E.workload(t.id);
                    const subs = E.substituteCount(t.id);
                    return `<tr class="hover:bg-blue-50/40">
                        <td class="p-3 font-bold text-slate-800">${UI.esc(t.name)}</td>
                        <td class="p-3 text-slate-600">${UI.esc(t.dept || '—')}</td>
                        <td class="p-3 text-center font-bold">${w.week}</td>
                        <td class="p-3 text-center">${TT.entriesOfTeacher(t.id).filter(e => e.day === day).length}</td>
                        <td class="p-3 text-center">${subs.month}</td>
                    </tr>`;
                }).join(''),
                ['ครู', 'กลุ่มสาระ', 'คาบ/สัปดาห์', 'คาบวันนี้', 'สอนแทนเดือนนี้']);
            TT.state.filters.freeHeader = ['ครู', 'กลุ่มสาระ', 'คาบต่อสัปดาห์'];
            TT.state.filters.freeResult = free.map(t => [t.name, t.dept, E.workload(t.id).week]);
        } else if (f.freeMode === 'room') {
            const type = $('fs-roomtype') ? $('fs-roomtype').value : '';
            const free = E.freeRooms(day, periodId, type);
            host.innerHTML = resultCard('ห้องที่ว่างในคาบนี้', free.length,
                free.map(r => `<tr class="hover:bg-blue-50/40">
                    <td class="p-3 font-bold text-slate-800">${UI.esc(r.name)}</td>
                    <td class="p-3 text-slate-600">${r.type === 'special' ? 'ห้องพิเศษ' : 'ห้องเรียนทั่วไป'}</td>
                    <td class="p-3 text-slate-600">${UI.esc(r.building || '—')}</td>
                    <td class="p-3 text-center">${r.capacity || '—'}</td>
                </tr>`).join(''),
                ['ห้อง', 'ประเภท', 'อาคาร', 'ความจุ']);
            TT.state.filters.freeHeader = ['ห้อง', 'ประเภท', 'อาคาร', 'ความจุ'];
            TT.state.filters.freeResult = free.map(r => [r.name, r.type === 'special' ? 'ห้องพิเศษ' : 'ทั่วไป', r.building, r.capacity]);
        } else {
            const free = E.freeClasses(day, periodId);
            host.innerHTML = resultCard('ห้องเรียนที่ไม่มีคาบสอนในช่วงนี้', free.length,
                free.map(c => `<tr class="hover:bg-blue-50/40">
                    <td class="p-3 font-bold text-slate-800">${UI.esc(c.name)}</td>
                    <td class="p-3 text-slate-600">${UI.esc(c.grade)}</td>
                    <td class="p-3 text-center">${c.studentCount}</td>
                    <td class="p-3 text-slate-600">${UI.esc(c.homeroomTeachers.map(i => TT.teacherName(i)).join(', ') || '—')}</td>
                </tr>`).join(''),
                ['ห้องเรียน', 'ระดับชั้น', 'นักเรียน', 'ครูประจำชั้น']);
            TT.state.filters.freeHeader = ['ห้องเรียน', 'ระดับชั้น', 'นักเรียน'];
            TT.state.filters.freeResult = free.map(c => [c.name, c.grade, c.studentCount]);
        }
    };

    const resultCard = function (title, count, bodyRows, headers) {
        return `
        <div class="modern-card overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div class="font-extrabold text-slate-800">${UI.esc(title)}</div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-blue-700">${count} รายการ</span>
                    <button onclick="TTPages.exportFreeResult()" class="tactile-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600"><i class="ph ph-file-xls mr-1"></i> ส่งออก</button>
                </div>
            </div>
            ${count ? `<div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left text-sm">
                    <thead class="bg-white border-b border-slate-100 text-xs uppercase text-slate-500 font-extrabold">
                        <tr>${headers.map((h, i) => `<th class="p-3 ${i >= 2 ? 'text-center' : ''}">${UI.esc(h)}</th>`).join('')}</tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${bodyRows}</tbody>
                </table>
            </div>` : UI.empty('ไม่พบรายการที่ว่างในช่วงเวลานี้', 'ph-magnifying-glass')}
        </div>`;
    };

    P.exportFreeResult = function () {
        const f = TT.state.filters;
        if (!f.freeResult || !f.freeResult.length) { UI.notify('ยังไม่มีผลการค้นหา', 'warn'); return; }
        UI.exportExcel([{ name: 'ผลการค้นหา', rows: [f.freeHeader].concat(f.freeResult) }], 'ผลการค้นหาคาบว่าง');
    };
})();
