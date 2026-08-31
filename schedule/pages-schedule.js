/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — หน้าจัดสรรวิชา ตารางสอน และหน้าจัดตารางแบบลากวาง
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT;
    const UI = window.TTUI;
    const E = window.TTEngine;
    const P = window.TTPages = window.TTPages || {};
    const $ = (id) => document.getElementById(id);

    /* =====================================================================
       จัดสรรวิชาและคาบเรียน
       ===================================================================== */

    P.allocation = function (root) {
        if (!TT.can('schedule')) {
            root.innerHTML = UI.empty('ท่านไม่มีสิทธิ์จัดสรรวิชา', 'ph-lock');
            return;
        }
        const classes = TT.classes();
        const filter = TT.state.filters.allocClass || (classes[0] ? classes[0].id : '');
        TT.state.filters.allocClass = filter;

        root.innerHTML =
            TTApp.termBar(`
                <button onclick="TTPages.autoFillAllocations()" class="tactile-btn px-4 py-2 rounded-xl font-bold text-blue-700 bg-blue-50 hover:bg-blue-100"><i class="ph ph-magic-wand mr-1"></i> เติมจากรายวิชา</button>
                <button onclick="TTPages.editAllocation('')" class="tactile-btn px-4 py-2 rounded-xl font-bold text-white brand-gradient shadow-lg"><i class="ph ph-plus mr-1"></i> เพิ่มรายการ</button>`) +
            UI.pageHeader('จัดสรรวิชาและคาบเรียน', 'กำหนดว่าห้องใดเรียนวิชาอะไร ครูท่านใดสอน และสัปดาห์ละกี่คาบ ระบบจะนับคาบที่จัดแล้วให้อัตโนมัติ') +
            `<div class="modern-card p-3 mb-4 flex flex-wrap items-center gap-2 no-print">
                <span class="font-bold text-slate-600 text-sm px-2">ห้องเรียน</span>
                <select id="alloc-class" class="border border-slate-200 rounded-xl px-3 py-2 font-bold focus-ring">
                    <option value="__all">ทุกห้องเรียน</option>
                    ${classes.map(c => `<option value="${UI.esc(c.id)}" ${c.id === filter ? 'selected' : ''}>${UI.esc(c.name)}</option>`).join('')}
                </select>
                <div class="flex-1"></div>
                <div id="alloc-summary" class="flex flex-wrap gap-2"></div>
            </div>
            <div id="alloc-body"></div>`;

        $('alloc-class').onchange = () => {
            TT.state.filters.allocClass = $('alloc-class').value;
            renderAllocBody();
        };
        renderAllocBody();
    };

    const renderAllocBody = function () {
        const pick = TT.state.filters.allocClass;
        const classes = pick === '__all' ? TT.classes() : TT.classes().filter(c => String(c.id) === String(pick));
        const host = $('alloc-body');

        /* สรุปด้านบน */
        const all = E.allocationStatus();
        const totalReq = all.reduce((s, r) => s + r.required, 0);
        const totalPlaced = all.reduce((s, r) => s + r.placed, 0);
        $('alloc-summary').innerHTML =
            UI.badge('ต้องจัด ' + totalReq + ' คาบ', 'bg-slate-100 text-slate-600 border-slate-200') +
            ' ' + UI.badge('จัดแล้ว ' + totalPlaced + ' คาบ', 'bg-emerald-100 text-emerald-700 border-emerald-200') +
            ' ' + UI.badge('ยังขาด ' + Math.max(0, totalReq - totalPlaced) + ' คาบ', 'bg-amber-100 text-amber-700 border-amber-200');

        host.innerHTML = classes.map(c => {
            const rows = E.allocationStatus(c.id);
            const sum = E.classSummary(c.id);
            if (!rows.length) {
                return `<div class="modern-card p-5 mb-4">
                    <div class="flex items-center justify-between mb-3">
                        <div class="font-extrabold text-slate-800">${UI.esc(c.name)}</div>
                        ${UI.statusPill('missing')}
                    </div>
                    ${UI.empty('ยังไม่ได้จัดสรรวิชาให้ห้องนี้ กดปุ่ม "เติมจากรายวิชา" เพื่อสร้างอัตโนมัติ', 'ph-list-plus')}
                </div>`;
            }
            return `
            <div class="modern-card overflow-hidden mb-4">
                <div class="px-5 py-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60">
                    <div class="flex items-center gap-3">
                        <span class="w-9 h-9 rounded-xl brand-gradient text-white grid place-items-center font-extrabold text-xs">${UI.esc(c.name.split('/')[0])}</span>
                        <div>
                            <div class="font-extrabold text-slate-800">${UI.esc(c.name)}</div>
                            <div class="text-xs text-slate-500 font-semibold">จัดแล้ว ${sum.placed}/${sum.required} คาบ · ช่องว่างในตาราง ${sum.freeSlots} ช่อง</div>
                        </div>
                    </div>
                    ${UI.statusPill(sum.status)}
                </div>
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left text-sm min-w-[880px]">
                        <thead class="bg-white border-b border-slate-100 text-xs uppercase text-slate-500 font-extrabold">
                            <tr>
                                <th class="p-3">รายวิชา</th>
                                <th class="p-3">ครูผู้สอน</th>
                                <th class="p-3 text-center">คาบ/สัปดาห์</th>
                                <th class="p-3 text-center">จัดแล้ว</th>
                                <th class="p-3 text-center">ขาด</th>
                                <th class="p-3 text-center">รูปแบบ</th>
                                <th class="p-3">ห้อง / หมายเหตุ</th>
                                <th class="p-3 text-center w-24">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${rows.map(r => {
                const a = TT.allocations().find(x => String(x.id) === String(r.allocationId));
                const sub = TT.subject(r.subjectId) || {};
                const tone = r.status === 'complete' ? 'bg-emerald-50/40' : (r.status === 'over' ? 'bg-rose-50/40' : 'bg-amber-50/30');
                return `
                            <tr class="${tone}">
                                <td class="p-3">
                                    <div class="flex items-center gap-2">
                                        <span class="w-6 h-6 rounded-md shrink-0" style="background:${UI.esc(sub.color || '#e2e8f0')}"></span>
                                        <div>
                                            <div class="font-bold text-slate-800">${UI.esc(sub.name || '—')}</div>
                                            <div class="text-[11px] text-slate-400">${UI.esc(sub.code || '')}</div>
                                        </div>
                                    </div>
                                </td>
                                <td class="p-3 font-semibold text-slate-700">${UI.esc(TT.teacherName(r.teacherId))}</td>
                                <td class="p-3 text-center font-extrabold text-slate-700">${r.required}</td>
                                <td class="p-3 text-center font-extrabold text-emerald-600">${r.placed}</td>
                                <td class="p-3 text-center font-extrabold ${r.missing > 0 ? 'text-amber-600' : (r.missing < 0 ? 'text-rose-600' : 'text-slate-300')}">${r.missing === 0 ? '—' : r.missing}</td>
                                <td class="p-3 text-center text-xs">${(a && a.doublePeriod) ? UI.badge('คาบคู่', 'bg-sky-100 text-sky-700 border-sky-200') : '<span class="text-slate-400">คาบเดี่ยว</span>'}</td>
                                <td class="p-3 text-xs text-slate-500">
                                    ${a && a.roomId ? UI.esc(TT.roomName(a.roomId)) : '<span class="text-slate-300">ห้องประจำ</span>'}
                                    ${a && a.note ? '<div class="text-slate-400">' + UI.esc(a.note) + '</div>' : ''}
                                </td>
                                <td class="p-3 text-center whitespace-nowrap">
                                    <button onclick="TTPages.editAllocation('${r.allocationId}')" class="tactile-btn w-8 h-8 rounded-lg bg-blue-50 text-blue-600 grid place-items-center inline-grid"><i class="ph ph-pencil-simple"></i></button>
                                    <button onclick="TTPages.deleteAllocation('${r.allocationId}')" class="tactile-btn w-8 h-8 rounded-lg bg-rose-50 text-rose-500 grid place-items-center inline-grid"><i class="ph ph-trash"></i></button>
                                </td>
                            </tr>`;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        }).join('') || UI.empty('ยังไม่มีห้องเรียน', 'ph-student');
    };

    P.editAllocation = function (id) {
        const a = TT.allocations().find(x => String(x.id) === String(id)) || {
            id: '', classId: TT.state.filters.allocClass !== '__all' ? TT.state.filters.allocClass : '',
            subjectId: '', teacherId: '', coTeacherIds: [], periodsPerWeek: 2,
            doublePeriod: false, roomId: '', preferDays: [], avoidDays: [], note: ''
        };
        const days = TT.days();

        UI.modal(id ? 'แก้ไขการจัดสรรวิชา' : 'เพิ่มการจัดสรรวิชา', `
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ห้องเรียน</label>
                        ${UI.select('af-class', UI.classOptions(true), a.classId, 'class="w-full"')}
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">รายวิชา</label>
                        ${UI.select('af-subject', UI.subjectOptions(true), a.subjectId, 'class="w-full"')}
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ครูผู้สอนหลัก</label>
                        ${UI.select('af-teacher', UI.teacherOptions(true), a.teacherId, 'class="w-full"')}
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">จำนวนคาบต่อสัปดาห์</label>
                        <input id="af-ppw" type="number" min="1" max="20" value="${UI.esc(a.periodsPerWeek)}" class="w-full border border-slate-200 rounded-xl p-2.5 font-bold focus-ring">
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ห้องเรียนที่ใช้</label>
                        ${UI.select('af-room', UI.roomOptions(true), a.roomId, 'class="w-full"')}
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ครูร่วมสอน</label>
                        <select id="af-coteacher" multiple size="3" class="w-full border border-slate-200 rounded-xl p-2 focus-ring font-semibold">
                            ${TT.teachers().map(t => `<option value="${UI.esc(t.id)}" ${(a.coTeacherIds || []).map(String).includes(String(t.id)) ? 'selected' : ''}>${UI.esc(t.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <label class="flex items-center gap-2 font-bold text-slate-700 text-sm">
                    <input type="checkbox" id="af-double" ${a.doublePeriod ? 'checked' : ''} class="w-4 h-4 accent-blue-600"> จัดเป็นคาบคู่ (ต้องอยู่ติดกัน)
                </label>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block font-bold text-slate-700 mb-2 text-sm">วันที่ต้องการให้จัด</label>
                        <div class="flex flex-wrap gap-1.5">
                            ${days.map(d => `<label class="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                                <input type="checkbox" data-prefer="${d.id}" ${(a.preferDays || []).includes(d.id) ? 'checked' : ''} class="w-3.5 h-3.5 accent-emerald-600"> ${UI.esc(d.name)}
                            </label>`).join('')}
                        </div>
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-2 text-sm">วันที่ห้ามจัด</label>
                        <div class="flex flex-wrap gap-1.5">
                            ${days.map(d => `<label class="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-1.5">
                                <input type="checkbox" data-avoid="${d.id}" ${(a.avoidDays || []).includes(d.id) ? 'checked' : ''} class="w-3.5 h-3.5 accent-rose-600"> ${UI.esc(d.name)}
                            </label>`).join('')}
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block font-bold text-slate-700 mb-1.5 text-sm">หมายเหตุ</label>
                    <input id="af-note" value="${UI.esc(a.note || '')}" class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring">
                </div>
            </div>`, {
            width: 'max-w-2xl',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ยกเลิก</button>
                <button id="btn-save-alloc" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">บันทึก</button>`,
            onOpen: () => {
                /* เลือกวิชาแล้วเติมจำนวนคาบตามที่ตั้งไว้ในรายวิชาให้อัตโนมัติ */
                $('af-subject').onchange = () => {
                    const sub = TT.subject($('af-subject').value);
                    const cls = TT.classById($('af-class').value);
                    if (sub && cls && sub.periodsPerWeek[cls.grade]) $('af-ppw').value = sub.periodsPerWeek[cls.grade];
                    if (sub && sub.roomId) $('af-room').value = sub.roomId;
                    if (sub && sub.doublePeriod) $('af-double').checked = true;
                };

                $('btn-save-alloc').onclick = () => {
                    const classId = $('af-class').value, subjectId = $('af-subject').value;
                    if (!classId || !subjectId) { UI.notify('กรุณาเลือกห้องเรียนและรายวิชา', 'warn'); return; }
                    const dup = TT.allocations().find(x => String(x.classId) === classId && String(x.subjectId) === subjectId && String(x.id) !== String(id));
                    if (dup) { UI.notify('ห้องนี้มีการจัดสรรวิชานี้อยู่แล้ว', 'warn'); return; }

                    const payload = {
                        id: id || TT.uid('al'),
                        classId, subjectId,
                        teacherId: $('af-teacher').value,
                        coTeacherIds: Array.from($('af-coteacher').selectedOptions).map(o => o.value),
                        periodsPerWeek: Number($('af-ppw').value || 0),
                        doublePeriod: $('af-double').checked,
                        roomId: $('af-room').value,
                        preferDays: Array.from(document.querySelectorAll('[data-prefer]:checked')).map(c => c.dataset.prefer),
                        avoidDays: Array.from(document.querySelectorAll('[data-avoid]:checked')).map(c => c.dataset.avoid),
                        note: $('af-note').value.trim()
                    };
                    const list = TT.state.plan.allocations;
                    const i = list.findIndex(x => String(x.id) === String(id));
                    if (i >= 0) list[i] = payload; else list.push(payload);

                    /* ถ้าเปลี่ยนครูผู้สอน ให้คาบที่จัดไว้แล้วเปลี่ยนตามด้วย */
                    TT.state.plan.entries.forEach(e => {
                        if (String(e.classId) === classId && String(e.subjectId) === subjectId) {
                            e.teacherId = payload.teacherId;
                            e.coTeacherIds = payload.coTeacherIds;
                            if (payload.roomId) e.roomId = payload.roomId;
                        }
                    });

                    TT.savePlanNow().then(() => {
                        TT.log('save_allocation', TT.className(classId) + ' · ' + TT.subjectName(subjectId));
                        UI.notify('บันทึกการจัดสรรแล้ว');
                        UI.closeModal();
                        TTApp.refresh();
                    });
                };
            }
        });
    };

    P.deleteAllocation = function (id) {
        const a = TT.allocations().find(x => String(x.id) === String(id));
        if (!a) return;
        const placed = TT.entries().filter(e => String(e.classId) === String(a.classId) && String(e.subjectId) === String(a.subjectId)).length;
        UI.confirm('ลบการจัดสรรวิชา',
            `ต้องการลบวิชา <b>${UI.esc(TT.subjectName(a.subjectId))}</b> ของห้อง <b>${UI.esc(TT.className(a.classId))}</b> หรือไม่?` +
            (placed ? `<br><span class="text-rose-600 font-bold">คาบที่จัดไว้แล้ว ${placed} คาบจะถูกลบออกจากตารางด้วย</span>` : ''),
            'danger', () => {
                TT.pushUndo('ลบการจัดสรร');
                TT.state.plan.allocations = TT.state.plan.allocations.filter(x => String(x.id) !== String(id));
                TT.state.plan.entries = TT.state.plan.entries.filter(e =>
                    !(String(e.classId) === String(a.classId) && String(e.subjectId) === String(a.subjectId)));
                TT.savePlanNow().then(() => {
                    TT.log('delete_allocation', TT.className(a.classId) + ' · ' + TT.subjectName(a.subjectId));
                    UI.notify('ลบการจัดสรรแล้ว');
                    TTApp.refresh();
                });
            }, 'ลบรายการ');
    };

    /* สร้างการจัดสรรอัตโนมัติจากจำนวนคาบที่ตั้งไว้ในหน้ารายวิชา */
    P.autoFillAllocations = function () {
        const pick = TT.state.filters.allocClass;
        const classes = pick === '__all' ? TT.classes() : TT.classes().filter(c => String(c.id) === String(pick));
        const subjects = TT.subjects();
        let added = 0;

        UI.confirm('เติมการจัดสรรจากรายวิชา',
            'ระบบจะสร้างรายการจัดสรรให้ทุกวิชาที่กำหนด "จำนวนคาบต่อสัปดาห์" ไว้ในหน้ารายวิชา สำหรับ ' +
            (pick === '__all' ? 'ทุกห้องเรียน' : 'ห้อง ' + TT.className(pick)) +
            '<br>รายการที่มีอยู่แล้วจะไม่ถูกเขียนทับ', 'info', () => {
                classes.forEach(c => {
                    subjects.forEach(s => {
                        const need = Number(s.periodsPerWeek[c.grade] || 0);
                        if (!need) return;
                        if (TT.allocations().some(a => String(a.classId) === String(c.id) && String(a.subjectId) === String(s.id))) return;

                        /* เดาครูผู้สอนจากงานที่มอบหมายไว้ในระบบคะแนน */
                        let teacherId = '';
                        TT.teachers().some(t => {
                            const asg = t.assignments || {};
                            const term = TT.state.settings.activeTerm;
                            const map = (asg[term] !== undefined || asg['1'] !== undefined || asg['2'] !== undefined) ? (asg[term] || {}) : asg;
                            if (map && Array.isArray(map[s.id]) && map[s.id].map(String).includes(String(c.id))) {
                                teacherId = t.id;
                                return true;
                            }
                            return false;
                        });

                        TT.state.plan.allocations.push({
                            id: TT.uid('al'),
                            classId: c.id, subjectId: s.id, teacherId,
                            coTeacherIds: [], periodsPerWeek: need,
                            doublePeriod: !!s.doublePeriod, roomId: s.roomId || '',
                            preferDays: [], avoidDays: [], note: ''
                        });
                        added++;
                    });
                });
                if (!added) { UI.notify('ไม่มีรายการใหม่ให้เพิ่ม (ตรวจสอบการตั้งค่าคาบต่อสัปดาห์ในหน้ารายวิชา)', 'warn'); return; }
                TT.savePlanNow().then(() => {
                    TT.log('autofill_allocation', 'เพิ่ม ' + added + ' รายการ');
                    UI.notify('เพิ่มการจัดสรร ' + added + ' รายการแล้ว');
                    TTApp.refresh();
                });
            }, 'เริ่มเติมข้อมูล');
    };

    /* =====================================================================
       ตัวช่วยวาดตารางสอน (ใช้ร่วมกันทั้งหน้าดูและหน้าจัด)
       ===================================================================== */

    /* เนื้อหาของคาบหนึ่งช่อง — ปรับตามมุมมอง (ห้อง/ครู/ห้องพิเศษ) */
    const entryCard = function (e, view, extraClass) {
        const sub = TT.subject(e.subjectId) || {};
        const color = e.kind === 'activity' ? '#fef3c7' : (sub.color || '#e2e8f0');
        const ink = UI.textOn(color);
        const problems = E.checkEntry(e, e.id);
        const bad = E.hasError(problems);
        const line2 = view === 'teacher' ? TT.className(e.classId)
            : (view === 'room' ? TT.className(e.classId) + ' · ' + TT.teacherName(e.teacherId)
                : TT.teacherName(e.teacherId));
        const roomTxt = TT.roomName(e.roomId);
        return `
        <div class="tt-item ${bad ? 'conflict' : ''} ${e.locked ? 'locked' : ''} ${extraClass || ''}"
            style="background:${UI.esc(color)};color:${ink}"
            title="${UI.esc((e.kind === 'activity' ? e.label : sub.name) + ' · ' + line2 + (roomTxt ? ' · ' + roomTxt : '') + (problems.length ? '\n⚠ ' + problems.map(p => p.message).join('\n') : ''))}">
            <div class="s-name">${UI.esc(e.kind === 'activity' ? (e.label || 'กิจกรรม') : (sub.short || sub.name || '—'))}</div>
            <div class="s-meta">${UI.esc(line2)}</div>
            ${roomTxt ? `<div class="s-meta">${UI.esc(roomTxt)}</div>` : ''}
            ${e.locked ? '<i class="ph ph-lock-simple absolute top-1 right-1 text-[11px] opacity-70"></i>' : ''}
            ${bad ? '<i class="ph ph-warning absolute top-1 right-1 text-[11px] text-rose-600"></i>' : ''}
        </div>`;
    };

    /* วาดตารางหนึ่งตาราง
       opts = { view:'class'|'teacher'|'room', targetId, editable, swap } */
    const buildGrid = function (opts) {
        const days = TT.days();
        const periods = TT.allPeriods();
        const swap = !!opts.swap;

        const entriesFor = (day, periodId) => {
            const all = TT.entries().filter(e => e.day === day && e.periodId === periodId);
            if (opts.view === 'teacher') {
                return all.filter(e => [e.teacherId].concat(e.coTeacherIds || []).map(String).includes(String(opts.targetId)));
            }
            if (opts.view === 'room') return all.filter(e => String(e.roomId) === String(opts.targetId));
            return all.filter(e => String(e.classId) === String(opts.targetId));
        };

        const cellHtml = (day, period) => {
            if (period.type !== 'class') {
                return `<td class="tt-cell is-break text-center align-middle">
                    <div class="text-[11px] font-bold text-slate-400 leading-tight py-3">${UI.esc(period.label)}</div>
                </td>`;
            }
            const list = entriesFor(day, period.id);
            const dropAttrs = opts.editable
                ? `ondragover="TTPages.onDragOver(event,'${day}','${period.id}')" ondragleave="TTPages.onDragLeave(event)" ondrop="TTPages.onDrop(event,'${day}','${period.id}')"`
                : '';
            const inner = list.map(e => {
                if (!opts.editable) return entryCard(e, opts.view);
                return `<div draggable="true" ondragstart="TTPages.onDragStart(event,'entry','${e.id}')"
                             onclick="TTPages.openEntryMenu('${e.id}')" class="h-full">${entryCard(e, opts.view)}</div>`;
            }).join('');
            return `<td class="tt-cell" data-cell="${day}|${period.id}" ${dropAttrs}>${inner}</td>`;
        };

        if (!swap) {
            /* แถว = วัน, คอลัมน์ = คาบ */
            return `
            <table class="tt-table">
                <thead>
                    <tr>
                        <th style="min-width:110px">วัน / คาบ</th>
                        ${periods.map(p => `<th>
                            <div>${UI.esc(p.label)}</div>
                            <div class="font-semibold text-[11px] text-slate-400">${UI.esc(p.start)}–${UI.esc(p.end)}</div>
                        </th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${days.map(d => `<tr><th>${UI.esc('วัน' + d.name)}</th>${periods.map(p => cellHtml(d.id, p)).join('')}</tr>`).join('')}
                </tbody>
            </table>`;
        }
        /* แถว = คาบ, คอลัมน์ = วัน */
        return `
        <table class="tt-table">
            <thead>
                <tr><th style="min-width:120px">คาบ / วัน</th>${days.map(d => `<th>วัน${UI.esc(d.name)}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${periods.map(p => `<tr>
                    <th><div>${UI.esc(p.label)}</div><div class="font-semibold text-[11px] text-slate-400">${UI.esc(p.start)}–${UI.esc(p.end)}</div></th>
                    ${days.map(d => cellHtml(d.id, p)).join('')}
                </tr>`).join('')}
            </tbody>
        </table>`;
    };
    P.buildGrid = buildGrid;

    /* =====================================================================
       หน้าดูตารางสอน
       ===================================================================== */

    P.timetable = function (root) {
        const isTeacher = !TT.can('viewAll');
        const f = TT.state.filters;
        if (!f.viewMode) f.viewMode = isTeacher ? 'teacher' : 'class';
        if (isTeacher) f.viewMode = f.viewMode === 'class' ? 'class' : 'teacher';
        if (!f.viewTarget) {
            f.viewTarget = f.viewMode === 'teacher'
                ? (TT.state.user.role === 'teacher' ? TT.state.user.id : (TT.teachers()[0] || {}).id)
                : (TT.classes()[0] || {}).id;
        }

        const targets = f.viewMode === 'teacher' ? TT.teachers().map(t => ({ value: t.id, label: t.name }))
            : (f.viewMode === 'room' ? TT.rooms().map(r => ({ value: r.id, label: r.name }))
                : TT.classes().map(c => ({ value: c.id, label: c.name })));
        if (!targets.some(t => String(t.value) === String(f.viewTarget))) f.viewTarget = targets[0] ? targets[0].value : '';

        root.innerHTML =
            TTApp.termBar() +
            UI.pageHeader('ตารางสอน',
                TT.state.plan.status === 'published' ? 'ตารางฉบับประกาศใช้' : 'ตารางฉบับร่าง (ยังไม่ประกาศใช้)', `
                <button onclick="TTPages.printTimetable()" class="tactile-btn px-4 py-2.5 rounded-xl font-bold text-white brand-gradient shadow-lg"><i class="ph ph-printer mr-1"></i> พิมพ์ / PDF</button>
                <button onclick="TTPages.exportTimetableExcel()" class="tactile-btn px-4 py-2.5 rounded-xl font-bold bg-white border border-slate-200 text-slate-600"><i class="ph ph-file-xls mr-1"></i> Excel</button>`) +
            `<div class="modern-card p-3 mb-4 flex flex-wrap items-center gap-2 no-print">
                <div class="flex bg-slate-100 rounded-xl p-1">
                    ${[['class', 'รายห้อง', 'ph-student'], ['teacher', 'รายครู', 'ph-user'], ['room', 'ห้องพิเศษ', 'ph-door']]
                .filter(m => !isTeacher || m[0] !== 'room')
                .map(m => `<button onclick="TTPages.setViewMode('${m[0]}')" class="px-3 py-1.5 rounded-lg text-sm font-bold ${f.viewMode === m[0] ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}"><i class="ph ${m[1 + 1]}"></i> ${m[1]}</button>`).join('')}
                </div>
                <select id="view-target" class="border border-slate-200 rounded-xl px-3 py-2 font-bold focus-ring">
                    ${targets.map(t => `<option value="${UI.esc(t.value)}" ${String(t.value) === String(f.viewTarget) ? 'selected' : ''}>${UI.esc(t.label)}</option>`).join('')}
                </select>
                <button onclick="TTPages.toggleSwap()" class="tactile-btn px-3 py-2 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 text-sm"><i class="ph ph-arrows-clockwise mr-1"></i> สลับแนวตาราง</button>
                <div class="flex-1"></div>
                <div id="view-summary" class="text-sm font-bold text-slate-500"></div>
            </div>
            <div class="tt-wrap" id="view-grid"></div>
            <div id="view-extra" class="mt-5"></div>`;

        $('view-target').onchange = () => { f.viewTarget = $('view-target').value; P.timetable(root); };
        renderViewGrid();
    };

    P.setViewMode = function (mode) {
        TT.state.filters.viewMode = mode;
        TT.state.filters.viewTarget = '';
        TTApp.refresh();
    };

    P.toggleSwap = function () {
        TT.state.filters.swap = !TT.state.filters.swap;
        TTApp.refresh();
    };

    const renderViewGrid = function () {
        const f = TT.state.filters;
        $('view-grid').innerHTML = buildGrid({ view: f.viewMode, targetId: f.viewTarget, editable: false, swap: f.swap });

        const sumHost = $('view-summary');
        if (f.viewMode === 'class') {
            const s = E.classSummary(f.viewTarget);
            sumHost.innerHTML = `จัดแล้ว ${s.placed}/${s.required} คาบ ` + UI.statusPill(s.status);
        } else if (f.viewMode === 'teacher') {
            const w = E.workload(f.viewTarget);
            sumHost.innerHTML = `สอน ${w.week} คาบ/สัปดาห์ · ว่าง ${w.free} คาบ`;
            $('view-extra').innerHTML = teacherWorkloadStrip(f.viewTarget);
        } else {
            const used = TT.entries().filter(e => String(e.roomId) === String(f.viewTarget)).length;
            sumHost.innerHTML = `ใช้งาน ${used} คาบ/สัปดาห์`;
        }
    };

    const teacherWorkloadStrip = function (teacherId) {
        const w = E.workload(teacherId);
        return `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${UI.stat('คาบสอนต่อสัปดาห์', w.week, 'ph-chalkboard-teacher', 'blue')}
            ${UI.stat('ชั่วโมงสอนรวม', w.hours, 'ph-clock', 'sky')}
            ${UI.stat('คาบว่าง', w.free, 'ph-coffee', 'green')}
            ${UI.stat('สอนแทนทั้งภาคเรียน', w.substitutes, 'ph-arrows-left-right', 'amber')}
        </div>`;
    };

    /* ------------------------------------------------------------- พิมพ์ตาราง */

    /* ตารางสำหรับกระดาษ A4 */
    P.paperGrid = function (view, targetId) {
        const days = TT.days();
        const periods = TT.allPeriods();
        const list = (day, pid) => TT.entries().filter(e => {
            if (e.day !== day || e.periodId !== pid) return false;
            if (view === 'teacher') return [e.teacherId].concat(e.coTeacherIds || []).map(String).includes(String(targetId));
            if (view === 'room') return String(e.roomId) === String(targetId);
            return String(e.classId) === String(targetId);
        });

        return `<table class="bx">
            <thead>
                <tr>
                    <th style="width:16mm">วัน/คาบ</th>
                    ${periods.map(p => `<th>${UI.esc(p.label)}<br><span style="font-weight:400;font-size:.85em">${UI.esc(p.start)}-${UI.esc(p.end)}</span></th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${days.map(d => `<tr>
                    <th>${UI.esc(d.name)}</th>
                    ${periods.map(p => {
            if (p.type !== 'class') return `<td style="text-align:center;background:#f8fafc">${UI.esc(p.label)}</td>`;
            const items = list(d.id, p.id);
            if (!items.length) return `<td></td>`;
            return `<td>` + items.map(e => {
                const sub = TT.subject(e.subjectId) || {};
                const l2 = view === 'teacher' ? TT.className(e.classId) : TT.teacherName(e.teacherId);
                const room = TT.roomName(e.roomId);
                return `<div class="cell-sub">${UI.esc(e.kind === 'activity' ? (e.label || 'กิจกรรม') : (sub.short || sub.name))}</div>
                                        <div class="cell-meta">${UI.esc(l2)}</div>
                                        ${room ? `<div class="cell-meta">${UI.esc(room)}</div>` : ''}`;
            }).join('<hr>') + `</td>`;
        }).join('')}
                </tr>`).join('')}
            </tbody>
        </table>`;
    };

    P.printTimetable = function () {
        const f = TT.state.filters;
        const name = f.viewMode === 'teacher' ? TT.teacherName(f.viewTarget)
            : (f.viewMode === 'room' ? TT.roomName(f.viewTarget) : TT.className(f.viewTarget));
        const title = f.viewMode === 'teacher' ? 'ตารางสอนรายครู' : (f.viewMode === 'room' ? 'ตารางการใช้ห้อง' : 'ตารางเรียนรายห้อง');

        UI.printPreview('ตัวอย่างก่อนพิมพ์ — ' + title, () =>
            UI.printHeader(title + ' : ' + name) +
            P.paperGrid(f.viewMode, f.viewTarget) +
            UI.printSignatures(), 'landscape');
    };

    P.exportTimetableExcel = function () {
        const f = TT.state.filters;
        const days = TT.days(), periods = TT.allPeriods();
        const rows = [['วัน/คาบ'].concat(periods.map(p => p.label + ' (' + p.start + '-' + p.end + ')'))];
        days.forEach(d => {
            const row = [d.name];
            periods.forEach(p => {
                if (p.type !== 'class') { row.push(p.label); return; }
                const items = TT.entries().filter(e => {
                    if (e.day !== d.id || e.periodId !== p.id) return false;
                    if (f.viewMode === 'teacher') return String(e.teacherId) === String(f.viewTarget);
                    if (f.viewMode === 'room') return String(e.roomId) === String(f.viewTarget);
                    return String(e.classId) === String(f.viewTarget);
                });
                row.push(items.map(e => {
                    const sub = TT.subject(e.subjectId) || {};
                    const l2 = f.viewMode === 'teacher' ? TT.className(e.classId) : TT.teacherName(e.teacherId);
                    return (e.kind === 'activity' ? e.label : sub.name) + ' / ' + l2;
                }).join(' | '));
            });
            rows.push(row);
        });
        const name = f.viewMode === 'teacher' ? TT.teacherName(f.viewTarget)
            : (f.viewMode === 'room' ? TT.roomName(f.viewTarget) : TT.className(f.viewTarget));
        UI.exportExcel([{ name: 'ตารางสอน', rows }], 'ตารางสอน-' + name);
    };

    /* =====================================================================
       หน้าจัดตารางสอน (ลากและวาง)
       ===================================================================== */

    P.editor = function (root) {
        if (!TT.can('schedule')) {
            root.innerHTML = UI.empty('ท่านไม่มีสิทธิ์จัดตารางสอน', 'ph-lock');
            return;
        }
        const classes = TT.classes();
        if (!classes.length) {
            root.innerHTML = UI.empty('ยังไม่มีห้องเรียน กรุณาเพิ่มห้องเรียนในระบบคะแนนก่อน', 'ph-student');
            return;
        }
        const f = TT.state.filters;
        if (!f.editClass || !classes.some(c => String(c.id) === String(f.editClass))) f.editClass = classes[0].id;

        root.innerHTML =
            TTApp.termBar(`
                <button onclick="TTPages.openAutoGenerate()" class="tactile-btn px-4 py-2 rounded-xl font-bold text-white accent-gradient shadow-lg"><i class="ph ph-magic-wand mr-1"></i> สร้างตารางอัตโนมัติ</button>
                <button onclick="TTPages.validateNow()" class="tactile-btn px-4 py-2 rounded-xl font-bold text-slate-700 bg-white border border-slate-200"><i class="ph ph-shield-check mr-1"></i> ตรวจสอบ</button>
                <button onclick="TTPages.publishPlan()" class="tactile-btn px-4 py-2 rounded-xl font-bold text-white brand-gradient shadow-lg"><i class="ph ph-megaphone mr-1"></i> ประกาศใช้</button>`) +
            `<div class="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">

                <!-- แผงวิชาที่ยังไม่ได้จัด -->
                <div class="modern-card p-4 lg:sticky lg:top-24 lg:self-start no-print">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="font-extrabold text-slate-800">วิชาที่ยังไม่ได้จัด</h3>
                        <button onclick="TTPages.openActivityAdd()" class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg"><i class="ph ph-plus"></i> กิจกรรม</button>
                    </div>
                    <div id="pool-list" class="space-y-2 max-h-[52vh] overflow-y-auto custom-scrollbar pr-1"></div>
                    <div class="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold leading-relaxed">
                        <i class="ph ph-hand-pointing mr-1"></i> ลากวิชาไปวางในช่องตาราง หรือคลิกที่คาบเพื่อจัดการ
                    </div>
                </div>

                <!-- ตาราง -->
                <div>
                    <div class="modern-card p-3 mb-3 flex flex-wrap items-center gap-2 no-print">
                        <select id="edit-class" class="border border-slate-200 rounded-xl px-3 py-2 font-bold focus-ring">
                            ${classes.map(c => `<option value="${UI.esc(c.id)}" ${String(c.id) === String(f.editClass) ? 'selected' : ''}>${UI.esc(c.name)}</option>`).join('')}
                        </select>
                        <button onclick="TTPages.toggleSwap()" class="tactile-btn px-3 py-2 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 text-sm"><i class="ph ph-arrows-clockwise"></i></button>
                        <button onclick="TTPages.doUndo()" class="tactile-btn px-3 py-2 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 text-sm"><i class="ph ph-arrow-counter-clockwise mr-1"></i> ย้อนกลับ</button>
                        <button onclick="TTPages.doRedo()" class="tactile-btn px-3 py-2 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 text-sm"><i class="ph ph-arrow-clockwise mr-1"></i> ทำซ้ำ</button>
                        <button onclick="TTPages.clearClass()" class="tactile-btn px-3 py-2 rounded-xl font-bold bg-rose-50 border border-rose-100 text-rose-600 text-sm"><i class="ph ph-eraser mr-1"></i> ล้างห้องนี้</button>
                        <div class="flex-1"></div>
                        <div id="edit-summary" class="text-sm font-bold"></div>
                    </div>
                    <div class="tt-wrap" id="edit-grid"></div>
                    <div id="edit-issues" class="mt-4"></div>
                </div>
            </div>`;

        $('edit-class').onchange = () => {
            TT.state.filters.editClass = $('edit-class').value;
            renderEditor();
        };
        renderEditor();
    };

    const renderEditor = function () {
        const f = TT.state.filters;
        $('edit-grid').innerHTML = buildGrid({ view: 'class', targetId: f.editClass, editable: true, swap: f.swap });
        renderPool();

        const s = E.classSummary(f.editClass);
        $('edit-summary').innerHTML = `<span class="text-slate-500">จัดแล้ว ${s.placed}/${s.required} คาบ</span> ` + UI.statusPill(s.status);

        /* ปัญหาเฉพาะห้องนี้ */
        const issues = E.validateAll().filter(i => !i.classId || String(i.classId) === String(f.editClass));
        $('edit-issues').innerHTML = issues.length ? `
            <div class="modern-card p-4">
                <h3 class="font-extrabold text-slate-800 mb-3 flex items-center gap-2"><i class="ph ph-warning-circle text-amber-500 text-xl"></i> สิ่งที่ต้องตรวจสอบ (${issues.length})</h3>
                <div class="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                    ${issues.map(i => `<div class="flex items-start gap-2 text-sm p-2 rounded-lg ${i.level === 'error' ? 'bg-rose-50 text-rose-700' : (i.level === 'warn' ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600')}">
                        <i class="ph ${i.level === 'error' ? 'ph-x-circle' : 'ph-warning'} mt-0.5"></i>
                        <span class="font-semibold">${UI.esc(i.message)}</span>
                    </div>`).join('')}
                </div>
            </div>` : `<div class="modern-card p-4 flex items-center gap-2 text-emerald-700 font-bold"><i class="ph ph-check-circle text-xl"></i> ไม่พบปัญหาในห้องนี้</div>`;
    };

    const renderPool = function () {
        const classId = TT.state.filters.editClass;
        const rows = E.allocationStatus(classId).filter(r => r.missing > 0);
        const host = $('pool-list');
        if (!rows.length) {
            host.innerHTML = `<div class="text-center py-6 text-emerald-600 font-bold text-sm"><i class="ph ph-check-circle text-2xl block mb-1"></i>จัดครบทุกวิชาแล้ว</div>`;
            return;
        }
        host.innerHTML = rows.map(r => {
            const sub = TT.subject(r.subjectId) || {};
            const a = TT.allocations().find(x => String(x.id) === String(r.allocationId));
            return `
            <div class="tt-chip" draggable="true" ondragstart="TTPages.onDragStart(event,'alloc','${r.allocationId}')"
                style="background:${UI.esc(sub.color || '#e2e8f0')};color:${UI.textOn(sub.color || '#e2e8f0')}">
                <div class="min-w-0">
                    <div class="truncate">${UI.esc(sub.name || '—')}</div>
                    <div class="text-[11px] font-semibold opacity-80 truncate">${UI.esc(TT.teacherName(r.teacherId))}${a && a.doublePeriod ? ' · คาบคู่' : ''}</div>
                </div>
                <span class="shrink-0 bg-white/70 text-slate-800 rounded-lg px-2 py-0.5 text-[11px]">ขาด ${r.missing}</span>
            </div>`;
        }).join('');
    };

    /* ------------------------------------------------------------- ลากและวาง */

    let dragPayload = null;

    P.onDragStart = function (ev, type, id) {
        dragPayload = { type, id };
        ev.dataTransfer.effectAllowed = 'move';
        try { ev.dataTransfer.setData('text/plain', type + ':' + id); } catch (e) { }
    };

    P.onDragOver = function (ev, day, periodId) {
        if (!dragPayload) return;
        ev.preventDefault();
        const cand = candidateFromDrag(day, periodId);
        if (!cand) return;
        const problems = E.checkEntry(cand, dragPayload.type === 'entry' ? dragPayload.id : null);
        ev.currentTarget.classList.remove('drop-ok', 'drop-bad');
        ev.currentTarget.classList.add(E.hasError(problems) ? 'drop-bad' : 'drop-ok');
    };

    P.onDragLeave = function (ev) {
        ev.currentTarget.classList.remove('drop-ok', 'drop-bad');
    };

    const candidateFromDrag = function (day, periodId) {
        if (!dragPayload) return null;
        if (dragPayload.type === 'alloc') {
            const a = TT.allocations().find(x => String(x.id) === String(dragPayload.id));
            if (!a) return null;
            return {
                id: '', classId: a.classId, subjectId: a.subjectId, teacherId: a.teacherId,
                coTeacherIds: a.coTeacherIds || [], roomId: a.roomId || (TT.subject(a.subjectId) || {}).roomId || '',
                day, periodId, kind: 'subject'
            };
        }
        const e = TT.entries().find(x => String(x.id) === String(dragPayload.id));
        if (!e) return null;
        return Object.assign({}, e, { day, periodId });
    };

    P.onDrop = function (ev, day, periodId) {
        ev.preventDefault();
        ev.currentTarget.classList.remove('drop-ok', 'drop-bad');
        const cand = candidateFromDrag(day, periodId);
        if (!cand) return;

        const problems = E.checkEntry(cand, dragPayload.type === 'entry' ? dragPayload.id : null);
        const errors = problems.filter(p => p.level === 'error');
        if (errors.length) {
            UI.notify(errors[0].message, 'error');
            dragPayload = null;
            return;
        }
        problems.filter(p => p.level === 'warn').forEach(p => UI.notify(p.message, 'warn'));

        TT.pushUndo('ย้าย/วางคาบ');
        if (dragPayload.type === 'entry') {
            const e = TT.state.plan.entries.find(x => String(x.id) === String(dragPayload.id));
            if (e) { e.day = day; e.periodId = periodId; }
        } else {
            TT.state.plan.entries.push(Object.assign({}, cand, { id: TT.uid('en'), locked: false }));
        }
        dragPayload = null;
        TT.savePlan(500);
        renderEditor();
    };

    /* ------------------------------------------------------- จัดการคาบทีละช่อง */

    P.openEntryMenu = function (entryId) {
        const e = TT.entries().find(x => String(x.id) === String(entryId));
        if (!e) return;
        const sub = TT.subject(e.subjectId) || {};
        const problems = E.checkEntry(e, e.id);

        UI.modal('จัดการคาบเรียน', `
            <div class="space-y-4">
                <div class="p-4 rounded-2xl" style="background:${UI.esc(sub.color || '#f1f5f9')}">
                    <div class="font-extrabold text-lg" style="color:${UI.textOn(sub.color || '#f1f5f9')}">${UI.esc(e.kind === 'activity' ? e.label : sub.name)}</div>
                    <div class="text-sm font-semibold" style="color:${UI.textOn(sub.color || '#f1f5f9')}">
                        ${UI.esc(TT.className(e.classId))} · วัน${UI.esc(TT.dayName(e.day))} ${UI.esc(TT.periodLabel(e.periodId))}
                    </div>
                </div>

                ${problems.length ? `<div class="space-y-1.5">${problems.map(p => `
                    <div class="text-sm font-semibold p-2 rounded-lg ${p.level === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}">
                        <i class="ph ph-warning mr-1"></i>${UI.esc(p.message)}
                    </div>`).join('')}</div>` : ''}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ครูผู้สอน</label>
                        ${UI.select('en-teacher', UI.teacherOptions(true), e.teacherId, 'class="w-full"')}
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ห้องเรียน</label>
                        ${UI.select('en-room', UI.roomOptions(true), e.roomId, 'class="w-full"')}
                    </div>
                </div>

                <label class="flex items-center gap-2 font-bold text-slate-700 text-sm">
                    <input type="checkbox" id="en-lock" ${e.locked ? 'checked' : ''} class="w-4 h-4 accent-amber-500">
                    ล็อกคาบนี้ ไม่ให้ระบบจัดตารางอัตโนมัติเปลี่ยน
                </label>
            </div>`, {
            width: 'max-w-xl',
            footer: `
                <button id="btn-entry-del" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 mr-auto"><i class="ph ph-trash mr-1"></i> ลบคาบนี้</button>
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ปิด</button>
                <button id="btn-entry-save" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">บันทึก</button>`,
            onOpen: () => {
                $('btn-entry-save').onclick = () => {
                    TT.pushUndo('แก้ไขคาบ');
                    const target = TT.state.plan.entries.find(x => String(x.id) === String(entryId));
                    target.teacherId = $('en-teacher').value;
                    target.roomId = $('en-room').value;
                    target.locked = $('en-lock').checked;
                    TT.savePlan(300);
                    UI.closeModal();
                    renderEditor();
                    UI.notify('บันทึกคาบเรียนแล้ว');
                };
                $('btn-entry-del').onclick = () => {
                    TT.pushUndo('ลบคาบ');
                    TT.state.plan.entries = TT.state.plan.entries.filter(x => String(x.id) !== String(entryId));
                    TT.savePlan(300);
                    UI.closeModal();
                    renderEditor();
                    UI.notify('ลบคาบแล้ว');
                };
            }
        });
    };

    /* เพิ่มคาบกิจกรรม เช่น ลูกเสือ ชุมนุม แนะแนว */
    P.openActivityAdd = function () {
        const days = TT.days(), periods = TT.periods();
        UI.modal('เพิ่มคาบกิจกรรม', `
            <div class="space-y-4">
                <div>
                    <label class="block font-bold text-slate-700 mb-1.5 text-sm">ชื่อกิจกรรม</label>
                    <input id="ac-label" placeholder="เช่น ลูกเสือ–เนตรนารี, ชุมนุม, แนะแนว" class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring font-semibold">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">วัน</label>
                        <select id="ac-day" class="w-full border border-slate-200 rounded-xl p-2.5 font-semibold focus-ring">
                            ${days.map(d => `<option value="${d.id}">วัน${UI.esc(d.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">คาบ</label>
                        <select id="ac-period" class="w-full border border-slate-200 rounded-xl p-2.5 font-semibold focus-ring">
                            ${periods.map(p => `<option value="${p.id}">${UI.esc(p.label)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block font-bold text-slate-700 mb-1.5 text-sm">ครูผู้ดูแล</label>
                    ${UI.select('ac-teacher', UI.teacherOptions(true), '', 'class="w-full"')}
                </div>
                <div>
                    <label class="block font-bold text-slate-700 mb-2 text-sm">ห้องเรียนที่เข้าร่วม</label>
                    <div class="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-xl border border-slate-200">
                        ${TT.classes().map(c => `<label class="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                            <input type="checkbox" data-accls="${UI.esc(c.id)}" ${String(c.id) === String(TT.state.filters.editClass) ? 'checked' : ''} class="w-4 h-4 accent-blue-600"> ${UI.esc(c.name)}
                        </label>`).join('')}
                    </div>
                </div>
            </div>`, {
            width: 'max-w-xl',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ยกเลิก</button>
                <button id="btn-add-activity" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">เพิ่มกิจกรรม</button>`,
            onOpen: () => {
                $('btn-add-activity').onclick = () => {
                    const label = $('ac-label').value.trim();
                    if (!label) { UI.notify('กรุณากรอกชื่อกิจกรรม', 'warn'); return; }
                    const day = $('ac-day').value, periodId = $('ac-period').value;
                    const teacherId = $('ac-teacher').value;
                    const classIds = Array.from(document.querySelectorAll('[data-accls]:checked')).map(c => c.dataset.accls);
                    if (!classIds.length) { UI.notify('เลือกห้องเรียนอย่างน้อยหนึ่งห้อง', 'warn'); return; }

                    TT.pushUndo('เพิ่มกิจกรรม');
                    let skipped = 0;
                    classIds.forEach(classId => {
                        if (TT.entryAt(classId, day, periodId)) { skipped++; return; }
                        TT.state.plan.entries.push({
                            id: TT.uid('en'), classId, subjectId: '', teacherId, coTeacherIds: [],
                            roomId: '', day, periodId, locked: true, kind: 'activity', label
                        });
                    });
                    TT.savePlanNow().then(() => {
                        TT.log('add_activity', label);
                        UI.notify('เพิ่มกิจกรรมแล้ว' + (skipped ? ' (ข้าม ' + skipped + ' ห้องที่คาบไม่ว่าง)' : ''));
                        UI.closeModal();
                        renderEditor();
                    });
                };
            }
        });
    };

    P.doUndo = function () {
        if (TT.undo()) { UI.notify('ย้อนกลับแล้ว', 'info'); renderEditor(); }
        else UI.notify('ไม่มีรายการให้ย้อนกลับ', 'warn');
    };

    P.doRedo = function () {
        if (TT.redo()) { UI.notify('ทำซ้ำแล้ว', 'info'); renderEditor(); }
        else UI.notify('ไม่มีรายการให้ทำซ้ำ', 'warn');
    };

    P.clearClass = function () {
        const classId = TT.state.filters.editClass;
        const count = TT.entries().filter(e => String(e.classId) === String(classId) && !e.locked).length;
        UI.confirm('ล้างตารางของห้องนี้',
            `จะลบคาบที่ไม่ได้ล็อกไว้ทั้งหมด ${count} คาบ ของห้อง <b>${UI.esc(TT.className(classId))}</b>`,
            'danger', () => {
                TT.pushUndo('ล้างตารางห้อง');
                TT.state.plan.entries = TT.state.plan.entries.filter(e => String(e.classId) !== String(classId) || e.locked);
                TT.savePlanNow().then(() => {
                    TT.log('clear_class', TT.className(classId));
                    UI.notify('ล้างตารางแล้ว');
                    renderEditor();
                });
            }, 'ล้างตาราง');
    };

    /* --------------------------------------------------------- จัดตารางอัตโนมัติ */

    P.openAutoGenerate = function () {
        const classes = TT.classes();
        UI.modal('สร้างตารางอัตโนมัติ', `
            <div class="space-y-4">
                <p class="text-slate-600 text-sm leading-relaxed">
                    ระบบจะจัดคาบที่ยังขาดให้ครบ โดยยึด <b>เงื่อนไขบังคับ</b> ทั้งหมด (ครูไม่ชนกัน ห้องไม่ซ้ำ ไม่เกินเพดานคาบ ไม่จัดในเวลาที่ครูไม่สะดวก)
                    แล้วเลือกผลลัพธ์ที่ได้ <b>คะแนนคุณภาพ</b> สูงที่สุด · คาบที่ล็อกไว้จะไม่ถูกเปลี่ยน
                </p>
                <div>
                    <label class="block font-bold text-slate-700 mb-2 text-sm">ขอบเขตการจัด</label>
                    <div class="flex gap-2 mb-3">
                        <button type="button" onclick="document.querySelectorAll('[data-gencls]').forEach(c=>c.checked=true)" class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">เลือกทั้งหมด</button>
                        <button type="button" onclick="document.querySelectorAll('[data-gencls]').forEach(c=>c.checked=false)" class="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">ไม่เลือกเลย</button>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-xl border border-slate-200">
                        ${classes.map(c => `<label class="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                            <input type="checkbox" data-gencls="${UI.esc(c.id)}" ${String(c.id) === String(TT.state.filters.editClass) ? 'checked' : ''} class="w-4 h-4 accent-blue-600"> ${UI.esc(c.name)}
                        </label>`).join('')}
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-bold text-slate-700 text-sm">จำนวนรอบการคำนวณ</span>
                    <input id="gen-attempts" type="range" min="1" max="20" value="8" class="flex-1 accent-blue-600">
                    <span id="gen-attempts-val" class="font-extrabold text-slate-700 w-6">8</span>
                </div>
                <label class="flex items-center gap-2 font-bold text-slate-700 text-sm">
                    <input type="checkbox" id="gen-keep-locked" checked class="w-4 h-4 accent-blue-600"> คงคาบที่ล็อกไว้
                </label>
                <div id="gen-result"></div>
            </div>`, {
            width: 'max-w-2xl',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ปิด</button>
                <button id="btn-run-gen" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white accent-gradient shadow-lg"><i class="ph ph-magic-wand mr-1"></i> เริ่มจัดตาราง</button>`,
            onOpen: () => {
                const rng = $('gen-attempts');
                rng.oninput = () => { $('gen-attempts-val').innerText = rng.value; };
                $('btn-run-gen').onclick = () => {
                    const classIds = Array.from(document.querySelectorAll('[data-gencls]:checked')).map(c => c.dataset.gencls);
                    if (!classIds.length) { UI.notify('เลือกห้องเรียนอย่างน้อยหนึ่งห้อง', 'warn'); return; }
                    $('gen-result').innerHTML = UI.loading('กำลังคำนวณตาราง...');

                    setTimeout(() => {
                        const result = E.autoGenerate({
                            classIds,
                            keepLocked: $('gen-keep-locked').checked,
                            attempts: Number(rng.value)
                        });
                        const q = result.quality;
                        $('gen-result').innerHTML = `
                            <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                                <div class="flex items-center gap-4 mb-3">
                                    <div class="w-16 h-16 rounded-2xl grid place-items-center text-white font-extrabold text-xl ${q.score >= 80 ? 'bg-emerald-500' : (q.score >= 60 ? 'bg-amber-500' : 'bg-rose-500')}">${q.score}</div>
                                    <div>
                                        <div class="font-extrabold text-slate-800">คะแนนคุณภาพตาราง</div>
                                        <div class="text-sm text-slate-500 font-semibold">จัดเพิ่มได้ ${result.placed} คาบ · จัดไม่ได้ ${result.unplaced.length} รายการ</div>
                                    </div>
                                </div>
                                ${q.issues.length ? `<div class="mb-2"><div class="font-bold text-slate-700 text-sm mb-1">ปัญหาที่พบ</div>
                                    <ul class="list-disc list-inside text-sm text-slate-600 space-y-0.5">${q.issues.slice(0, 8).map(i => `<li>${UI.esc(i)}</li>`).join('')}</ul></div>` : ''}
                                ${result.unplaced.length ? `<div class="mb-2"><div class="font-bold text-rose-700 text-sm mb-1">จัดไม่สำเร็จ</div>
                                    <ul class="list-disc list-inside text-sm text-rose-600 space-y-0.5">${result.unplaced.slice(0, 8).map(u => `<li>${UI.esc(TT.className(u.classId) + ' · ' + TT.subjectName(u.subjectId) + ' (' + u.size + ' คาบ)')}</li>`).join('')}</ul></div>` : ''}
                                <div class="font-bold text-slate-700 text-sm mb-1">ข้อเสนอแนะ</div>
                                <ul class="list-disc list-inside text-sm text-slate-600 space-y-0.5">${q.advice.map(a => `<li>${UI.esc(a)}</li>`).join('')}</ul>
                                <button id="btn-apply-gen" class="tactile-btn w-full mt-4 py-2.5 rounded-xl font-extrabold text-white brand-gradient shadow-lg">นำผลลัพธ์นี้ไปใช้</button>
                            </div>`;
                        $('btn-apply-gen').onclick = () => {
                            TT.pushUndo('จัดตารางอัตโนมัติ');
                            TT.state.plan.entries = result.entries;
                            TT.savePlanNow().then(() => {
                                TT.log('auto_generate', 'จัด ' + result.placed + ' คาบ คะแนน ' + q.score);
                                UI.notify('นำตารางที่จัดอัตโนมัติไปใช้แล้ว');
                                UI.closeModal();
                                TTApp.refresh();
                            });
                        };
                    }, 60);
                };
            }
        });
    };

    /* ------------------------------------------------------- ตรวจสอบและประกาศใช้ */

    P.validateNow = function () {
        const issues = E.validateAll();
        const q = E.quality();
        const errors = issues.filter(i => i.level === 'error');

        UI.modal('ผลการตรวจสอบตารางสอน', `
            <div class="flex items-center gap-4 mb-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div class="w-16 h-16 rounded-2xl grid place-items-center text-white font-extrabold text-xl ${q.score >= 80 ? 'bg-emerald-500' : (q.score >= 60 ? 'bg-amber-500' : 'bg-rose-500')}">${q.score}</div>
                <div>
                    <div class="font-extrabold text-slate-800">คะแนนคุณภาพตาราง</div>
                    <div class="text-sm font-semibold ${errors.length ? 'text-rose-600' : 'text-emerald-600'}">
                        ${errors.length ? 'พบข้อผิดพลาดร้ายแรง ' + errors.length + ' รายการ' : 'ไม่พบข้อผิดพลาดร้ายแรง'}
                    </div>
                </div>
            </div>
            ${issues.length ? `<div class="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                ${issues.map(i => `<div class="flex items-start gap-2 text-sm p-2.5 rounded-lg ${i.level === 'error' ? 'bg-rose-50 text-rose-700' : (i.level === 'warn' ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600')}">
                    <i class="ph ${i.level === 'error' ? 'ph-x-circle' : 'ph-warning'} mt-0.5 shrink-0"></i>
                    <span class="font-semibold">${UI.esc(i.message)}</span>
                </div>`).join('')}
            </div>` : `<div class="text-center py-6 text-emerald-600 font-bold"><i class="ph ph-check-circle text-4xl block mb-2"></i>ตารางสอนถูกต้องครบถ้วน</div>`}
            <div class="mt-4 pt-4 border-t border-slate-100">
                <div class="font-bold text-slate-700 text-sm mb-1">ข้อเสนอแนะ</div>
                <ul class="list-disc list-inside text-sm text-slate-600 space-y-0.5">${q.advice.map(a => `<li>${UI.esc(a)}</li>`).join('')}</ul>
            </div>`, { width: 'max-w-2xl' });
    };

    P.publishPlan = function () {
        const issues = E.validateAll();
        const errors = issues.filter(i => i.level === 'error');
        const q = E.quality();

        const doPublish = (reason) => {
            /* เก็บฉบับเดิมไว้ก่อนประกาศใช้ฉบับใหม่ เพื่อให้ย้อนดูและกู้คืนได้ */
            window.ttCloud.saveVersion(
                TT.state.settings.activeYear, TT.state.settings.activeTerm,
                TT.clone(TT.state.plan),
                'ก่อนประกาศใช้ฉบับที่ ' + ((TT.state.plan.version || 1) + 1),
                (TT.state.user && TT.state.user.name) || ''
            ).catch(e => console.warn('เก็บฉบับย้อนหลังไม่สำเร็จ', e));

            TT.state.plan.status = 'published';
            TT.state.plan.publishedAt = Date.now();
            TT.state.plan.version = (TT.state.plan.version || 1) + 1;
            if (reason) TT.state.plan.publishNote = reason;

            TT.savePlanNow().then(() => {
                TT.log('publish', 'ประกาศใช้ตารางฉบับที่ ' + TT.state.plan.version + (reason ? ' (' + reason + ')' : ''));
                TT.notifyUsers(
                    TT.teachers().map(t => t.id),
                    'ประกาศใช้ตารางสอนฉบับใหม่',
                    'ตารางสอนภาคเรียนที่ ' + TT.state.settings.activeTerm + ' ปีการศึกษา ' + TT.state.settings.activeYear + ' ฉบับที่ ' + TT.state.plan.version + ' ประกาศใช้แล้ว',
                    'timetable'
                );
                UI.notify('ประกาศใช้ตารางสอนแล้ว');
                TTApp.updateContext();
                TTApp.refresh();
            });
        };

        if (errors.length) {
            if (!TT.can('admin')) {
                UI.modal('ประกาศใช้ไม่ได้', `
                    <div class="text-rose-700 font-bold mb-3"><i class="ph ph-x-circle mr-1"></i> พบข้อผิดพลาดร้ายแรง ${errors.length} รายการ ต้องแก้ไขก่อนประกาศใช้</div>
                    <div class="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                        ${errors.map(i => `<div class="text-sm p-2 rounded-lg bg-rose-50 text-rose-700 font-semibold">${UI.esc(i.message)}</div>`).join('')}
                    </div>
                    <div class="mt-3 text-xs text-slate-500 font-semibold">เฉพาะผู้ดูแลระบบเท่านั้นที่ยืนยันประกาศใช้ทั้งที่มีข้อผิดพลาดได้</div>`,
                    { width: 'max-w-xl' });
                return;
            }
            UI.prompt('ยืนยันประกาศใช้ทั้งที่มีข้อผิดพลาด',
                'พบข้อผิดพลาดร้ายแรง ' + errors.length + ' รายการ กรุณาระบุเหตุผลในการยืนยัน',
                (reason) => doPublish(reason), 'เช่น จะแก้ไขภายหลังตามมติที่ประชุม');
            return;
        }

        UI.confirm('ประกาศใช้ตารางสอน',
            `คะแนนคุณภาพตาราง <b>${q.score}</b> คะแนน<br>ระบบจะเก็บตารางฉบับเดิมไว้ย้อนดู และแจ้งเตือนครูทุกท่าน`,
            'info', () => doPublish(''), 'ประกาศใช้');
    };
})();
