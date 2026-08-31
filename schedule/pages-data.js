/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — หน้าจัดการข้อมูลพื้นฐาน

   ข้อมูลครู · ระดับชั้นและห้องเรียน · รายวิชา · ห้องเรียนและห้องพิเศษ
   ผู้ใช้งานและสิทธิ์ · ตั้งค่าระบบ (ปีการศึกษา วัน คาบ กติกา สำรองข้อมูล)

   หมายเหตุ : บัญชีครู ห้องเรียน และรายวิชา ใช้ข้อมูลชุดเดียวกับระบบคะแนน
   ANPSCORE หน้าเหล่านี้จึงเพิ่ม "ข้อมูลเสริมสำหรับการจัดตาราง" ทับลงไป
   โดยไม่แก้ไขข้อมูลต้นทาง เพื่อไม่ให้ระบบคะแนนได้รับผลกระทบ
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT;
    const UI = window.TTUI;
    const E = window.TTEngine;
    const P = window.TTPages = window.TTPages || {};
    const $ = (id) => document.getElementById(id);
    const canEdit = () => TT.can('baseData');

    /* =====================================================================
       ข้อมูลครู
       ===================================================================== */

    P.teachers = function (root) {
        const rows = TT.teachers();
        root.innerHTML =
            UI.pageHeader('ข้อมูลครู', 'ข้อมูลประกอบการจัดตาราง เช่น กลุ่มสาระ วิชาที่สอนได้ เพดานคาบ และช่วงเวลาที่ไม่สะดวก', `
                <input id="q-teacher" placeholder="ค้นหาชื่อครู / กลุ่มสาระ" class="border border-slate-200 rounded-xl px-4 py-2.5 font-semibold focus-ring w-full md:w-72">
                ${canEdit() ? `<button onclick="TTPages.exportTeachers()" class="tactile-btn px-4 py-2.5 rounded-xl font-bold bg-white border border-slate-200 text-slate-600"><i class="ph ph-file-xls mr-1"></i> ส่งออก</button>` : ''}`) +
            `<div class="modern-card overflow-hidden">
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left min-w-[900px]">
                        <thead class="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-extrabold">
                            <tr>
                                <th class="p-4">ครู</th>
                                <th class="p-4">กลุ่มสาระ / วิชาเอก</th>
                                <th class="p-4 text-center">คาบ/สัปดาห์</th>
                                <th class="p-4 text-center">เกณฑ์ ต่ำสุด–สูงสุด</th>
                                <th class="p-4 text-center">ไม่สะดวก</th>
                                <th class="p-4 text-center">สถานะ</th>
                                <th class="p-4 text-center w-24">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody id="tb-teachers" class="divide-y divide-slate-100"></tbody>
                    </table>
                </div>
            </div>`;

        const tb = $('tb-teachers');
        if (!rows.length) {
            tb.innerHTML = `<tr><td colspan="7">${UI.empty('ยังไม่มีข้อมูลครู กรุณาเพิ่มครูในระบบคะแนน ANPSCORE ก่อน', 'ph-users-three')}</td></tr>`;
            return;
        }
        tb.innerHTML = rows.map(t => {
            const w = E.workload(t.id);
            const warn = w.overMax ? 'text-rose-600' : (w.underMin ? 'text-amber-600' : 'text-slate-700');
            return `
            <tr class="tr-teacher hover:bg-blue-50/40">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        ${t.picUrl ? `<img src="${UI.esc(t.picUrl)}" class="w-10 h-10 rounded-xl object-cover shrink-0" alt="">`
                    : `<div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center shrink-0"><i class="ph ph-user"></i></div>`}
                        <div class="min-w-0">
                            <div class="font-bold text-slate-800">${UI.esc(t.name)}</div>
                            <div class="text-xs text-slate-400">${UI.esc(t.code || '—')} · ${UI.esc(t.position || 'ครู')}</div>
                        </div>
                    </div>
                </td>
                <td class="p-4">
                    <div class="font-semibold text-slate-700 text-sm">${UI.esc(t.dept || '—')}</div>
                    <div class="text-xs text-slate-400">${UI.esc(t.major || '')}</div>
                </td>
                <td class="p-4 text-center font-extrabold ${warn}">${w.week}</td>
                <td class="p-4 text-center text-sm text-slate-500 font-semibold">${t.minPeriods || '—'} – ${t.maxPeriods || '—'}</td>
                <td class="p-4 text-center text-sm">${t.unavailable.length ? UI.badge(t.unavailable.length + ' ช่วง', 'bg-amber-100 text-amber-700 border-amber-200') : '<span class="text-slate-300">—</span>'}</td>
                <td class="p-4 text-center">${t.status === 'active' ? UI.badge('ปฏิบัติงาน', 'bg-emerald-100 text-emerald-700 border-emerald-200') : UI.badge('ระงับ', 'bg-slate-100 text-slate-500 border-slate-200')}</td>
                <td class="p-4 text-center">
                    <button onclick="TTPages.editTeacher('${t.id}')" class="tactile-btn w-9 h-9 rounded-xl ${canEdit() ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-slate-50 text-slate-500'} grid place-items-center mx-auto">
                        <i class="ph ${canEdit() ? 'ph-pencil-simple' : 'ph-eye'}"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        UI.wireSearch('q-teacher', '.tr-teacher');
    };

    P.editTeacher = function (id) {
        const t = TT.teacher(id);
        if (!t) return;
        const readonly = !canEdit();
        const subjects = TT.subjects();
        const grades = TT.grades();
        const days = TT.days();
        const periods = TT.periods();

        const unavailableCell = (day, pid) => {
            const on = t.unavailable.some(u => u.day === day && (u.periodId === pid || u.periodId === 'all'));
            return `<td class="p-1 text-center">
                <input type="checkbox" data-un="${day}|${pid}" ${on ? 'checked' : ''} ${readonly ? 'disabled' : ''} class="w-4 h-4 accent-amber-500">
            </td>`;
        };

        UI.modal('ข้อมูลครูสำหรับการจัดตาราง — ' + t.name, `
            <div class="space-y-5">
                <div class="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-800 font-semibold">
                    <i class="ph ph-info mr-1"></i> ชื่อ–นามสกุล รหัสผ่าน และห้องที่สอน แก้ไขได้ที่ระบบคะแนน ANPSCORE หน้านี้ใช้กำหนดข้อมูลสำหรับการจัดตารางเท่านั้น
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${field('รหัสครู', 'tf-code', t.code, readonly)}
                    ${field('ตำแหน่ง', 'tf-position', t.position, readonly)}
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">กลุ่มสาระการเรียนรู้</label>
                        <select id="tf-dept" ${readonly ? 'disabled' : ''} class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring font-semibold">
                            <option value="">— ไม่ระบุ —</option>
                            ${TT.DEPARTMENTS.map(d => `<option ${d === t.dept ? 'selected' : ''}>${UI.esc(d)}</option>`).join('')}
                        </select>
                    </div>
                    ${field('วิชาเอก', 'tf-major', t.major, readonly)}
                    ${field('อาคาร/พื้นที่ประจำ', 'tf-building', t.building, readonly)}
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ห้องประจำ</label>
                        <select id="tf-homeroom" ${readonly ? 'disabled' : ''} class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring font-semibold">
                            <option value="">— ไม่ระบุ —</option>
                            ${TT.rooms().map(r => `<option value="${UI.esc(r.id)}" ${r.id === t.homeRoom ? 'selected' : ''}>${UI.esc(r.name)}</option>`).join('')}
                        </select>
                    </div>
                    ${field('คาบขั้นต่ำ/สัปดาห์', 'tf-min', t.minPeriods || '', readonly, 'number')}
                    ${field('คาบสูงสุด/สัปดาห์', 'tf-max', t.maxPeriods || '', readonly, 'number')}
                    ${field('เบอร์โทรศัพท์', 'tf-phone', t.phone, readonly)}
                    ${field('อีเมล', 'tf-email', t.email, readonly, 'email')}
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">สถานะการทำงาน</label>
                        <select id="tf-status" ${readonly ? 'disabled' : ''} class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring font-semibold">
                            <option value="active" ${t.status === 'active' ? 'selected' : ''}>ปฏิบัติงาน</option>
                            <option value="inactive" ${t.status !== 'active' ? 'selected' : ''}>ระงับการใช้งาน</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block font-bold text-slate-700 mb-2 text-sm">วิชาที่สามารถสอนได้ (ใช้จัดอันดับครูสอนแทน)</label>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-xl border border-slate-200">
                        ${subjects.map(s => `
                            <label class="flex items-center gap-2 text-sm font-semibold text-slate-600 p-1 rounded-lg hover:bg-white">
                                <input type="checkbox" data-subj="${UI.esc(s.id)}" ${t.canTeachSubjects.map(String).includes(String(s.id)) ? 'checked' : ''} ${readonly ? 'disabled' : ''} class="w-4 h-4 accent-blue-600">
                                <span class="truncate">${UI.esc(s.name)}</span>
                            </label>`).join('') || '<div class="text-slate-400 text-sm p-2">ยังไม่มีรายวิชา</div>'}
                    </div>
                </div>

                <div>
                    <label class="block font-bold text-slate-700 mb-2 text-sm">ระดับชั้นที่สอนได้</label>
                    <div class="flex flex-wrap gap-2">
                        ${grades.map(g => `
                            <label class="flex items-center gap-2 text-sm font-bold text-slate-600 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                                <input type="checkbox" data-grade="${UI.esc(g)}" ${t.canTeachGrades.includes(g) ? 'checked' : ''} ${readonly ? 'disabled' : ''} class="w-4 h-4 accent-blue-600"> ${UI.esc(g)}
                            </label>`).join('') || '<div class="text-slate-400 text-sm">ยังไม่มีระดับชั้น</div>'}
                    </div>
                </div>

                <div>
                    <label class="block font-bold text-slate-700 mb-2 text-sm">ช่วงเวลาที่ไม่สะดวกสอน</label>
                    <div class="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                        <table class="w-full text-xs">
                            <thead class="bg-slate-50">
                                <tr><th class="p-2 text-left font-extrabold text-slate-500">วัน</th>
                                ${periods.map(p => `<th class="p-2 font-extrabold text-slate-500">${UI.esc(p.label.replace('คาบที่ ', ''))}</th>`).join('')}</tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${days.map(d => `<tr>
                                    <td class="p-2 font-bold text-slate-600 whitespace-nowrap">${UI.esc(d.name)}</td>
                                    ${periods.map(p => unavailableCell(d.id, p.id)).join('')}
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`, {
            width: 'max-w-3xl',
            footer: readonly ? `<button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ปิด</button>` : `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">ยกเลิก</button>
                <button id="btn-save-teacher" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">บันทึก</button>`,
            onOpen: () => {
                const btn = $('btn-save-teacher');
                if (!btn) return;
                btn.onclick = () => {
                    const meta = TT.state.settings.teacherMeta;
                    const unavailable = [];
                    document.querySelectorAll('[data-un]:checked').forEach(cb => {
                        const [day, periodId] = cb.dataset.un.split('|');
                        unavailable.push({ day, periodId });
                    });
                    meta[id] = {
                        code: $('tf-code').value.trim(),
                        position: $('tf-position').value.trim(),
                        dept: $('tf-dept').value,
                        major: $('tf-major').value.trim(),
                        building: $('tf-building').value.trim(),
                        homeRoom: $('tf-homeroom').value,
                        minPeriods: Number($('tf-min').value || 0),
                        maxPeriods: Number($('tf-max').value || 0),
                        phone: $('tf-phone').value.trim(),
                        email: $('tf-email').value.trim(),
                        status: $('tf-status').value,
                        canTeachSubjects: Array.from(document.querySelectorAll('[data-subj]:checked')).map(c => c.dataset.subj),
                        canTeachGrades: Array.from(document.querySelectorAll('[data-grade]:checked')).map(c => c.dataset.grade),
                        unavailable
                    };
                    TT.saveSettingsNow().then(() => {
                        TT.log('edit_teacher_meta', 'แก้ไขข้อมูลครู ' + t.name);
                        UI.notify('บันทึกข้อมูลครูแล้ว');
                        UI.closeModal();
                        TTApp.refresh();
                    }).catch(() => UI.notify('บันทึกไม่สำเร็จ', 'error'));
                };
            }
        });
    };

    const field = function (label, id, value, readonly, type) {
        return `<div>
            <label class="block font-bold text-slate-700 mb-1.5 text-sm">${UI.esc(label)}</label>
            <input id="${id}" type="${type || 'text'}" value="${UI.esc(value === undefined ? '' : value)}" ${readonly ? 'disabled' : ''}
                class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring font-semibold ${readonly ? 'bg-slate-50 text-slate-500' : ''}">
        </div>`;
    };

    P.exportTeachers = function () {
        const rows = [['รหัสครู', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'กลุ่มสาระ', 'วิชาเอก', 'คาบ/สัปดาห์', 'ขั้นต่ำ', 'สูงสุด', 'โทรศัพท์', 'อีเมล', 'สถานะ']];
        TT.teachers().forEach(t => {
            const w = E.workload(t.id);
            rows.push([t.code, t.name, t.position, t.dept, t.major, w.week, t.minPeriods, t.maxPeriods, t.phone, t.email,
            t.status === 'active' ? 'ปฏิบัติงาน' : 'ระงับ']);
        });
        UI.exportExcel([{ name: 'ข้อมูลครู', rows }], 'ข้อมูลครู');
    };

    /* =====================================================================
       ระดับชั้นและห้องเรียน
       ===================================================================== */

    P.classes = function (root) {
        const list = TT.classes();
        const grades = TT.grades();

        root.innerHTML =
            UI.pageHeader('ระดับชั้นและห้องเรียน', 'ห้องเรียนทั้งหมดในระบบ พร้อมครูประจำชั้น จำนวนนักเรียน และสีที่ใช้แสดงในตาราง',
                `<input id="q-class" placeholder="ค้นหาห้องเรียน" class="border border-slate-200 rounded-xl px-4 py-2.5 font-semibold focus-ring w-full md:w-64">`) +
            `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                ${UI.stat('ระดับชั้นทั้งหมด', grades.length, 'ph-stack', 'blue')}
                ${UI.stat('ห้องเรียนทั้งหมด', list.length, 'ph-door', 'sky')}
                ${UI.stat('นักเรียนรวม', list.reduce((s, c) => s + c.studentCount, 0), 'ph-student', 'green')}
                ${UI.stat('ห้องที่จัดตารางครบ', E.completedClassCount ? E.completedClassCount() : list.filter(c => E.classSummary(c.id).status === 'complete').length, 'ph-check-circle', 'amber')}
            </div>` +
            grades.map(g => {
                const inGrade = list.filter(c => c.grade === g);
                return `
                <div class="modern-card p-5 mb-4">
                    <div class="flex items-center gap-2 mb-4">
                        <div class="w-9 h-9 rounded-xl brand-gradient text-white grid place-items-center font-extrabold text-sm">${UI.esc(g)}</div>
                        <div class="font-extrabold text-slate-800">ระดับชั้น ${UI.esc(g)}</div>
                        <span class="text-slate-400 text-sm font-semibold">${inGrade.length} ห้อง</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        ${inGrade.map(c => {
                    const sum = E.classSummary(c.id);
                    const tone = sum.status === 'complete' ? 'border-emerald-200 bg-emerald-50/40'
                        : (sum.status === 'over' ? 'border-rose-200 bg-rose-50/40' : 'border-amber-200 bg-amber-50/40');
                    const teachers = c.homeroomTeachers.map(id => TT.teacherName(id)).join(', ');
                    return `
                            <div class="tr-class p-4 rounded-2xl border ${tone}">
                                <div class="flex items-start justify-between gap-2 mb-2">
                                    <div>
                                        <div class="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                                            <span class="w-3 h-3 rounded-full" style="background:${UI.esc(c.color || '#93c5fd')}"></span>
                                            ${UI.esc(c.name)}
                                        </div>
                                        <div class="text-xs text-slate-500 font-semibold">${c.studentCount} คน · ครูประจำชั้น ${UI.esc(teachers || '—')}</div>
                                    </div>
                                    <button onclick="TTPages.editClass('${c.id}')" class="tactile-btn w-8 h-8 rounded-lg bg-white border border-slate-200 grid place-items-center shrink-0"><i class="ph ph-pencil-simple text-slate-500"></i></button>
                                </div>
                                <div class="flex items-center justify-between text-xs font-bold">
                                    <span class="text-slate-500">จัดแล้ว ${sum.placed}/${sum.required} คาบ</span>
                                    ${UI.statusPill(sum.status)}
                                </div>
                                <div class="h-1.5 bg-white rounded-full mt-2 overflow-hidden border border-slate-200">
                                    <div class="h-full ${sum.status === 'complete' ? 'bg-emerald-500' : (sum.status === 'over' ? 'bg-rose-500' : 'bg-amber-400')}"
                                        style="width:${sum.required ? Math.min(100, Math.round(sum.placed / sum.required * 100)) : 0}%"></div>
                                </div>
                            </div>`;
                }).join('')}
                    </div>
                </div>`;
            }).join('') || UI.empty('ยังไม่มีห้องเรียน กรุณาเพิ่มห้องเรียนในระบบคะแนน ANPSCORE', 'ph-student');

        UI.wireSearch('q-class', '.tr-class');
    };

    P.editClass = function (id) {
        const c = TT.classById(id);
        if (!c) return;
        const readonly = !canEdit();
        UI.modal('ข้อมูลห้องเรียน ' + c.name, `
            <div class="space-y-4">
                <div class="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-800 font-semibold">
                    <i class="ph ph-info mr-1"></i> รายชื่อนักเรียนและครูประจำชั้นดึงมาจากระบบคะแนน ANPSCORE
                </div>
                <div class="grid grid-cols-2 gap-4">
                    ${field('ชื่อห้อง', 'cf-name', c.name, true)}
                    ${field('จำนวนนักเรียน', 'cf-count', c.studentCount, true)}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ห้องเรียนประจำ</label>
                        <select id="cf-room" ${readonly ? 'disabled' : ''} class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring font-semibold">
                            <option value="">— ไม่ระบุ —</option>
                            ${TT.rooms().map(r => `<option value="${UI.esc(r.id)}" ${r.id === c.roomId ? 'selected' : ''}>${UI.esc(r.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">สีที่ใช้แสดงในตาราง</label>
                        <div class="flex flex-wrap gap-1.5" id="cf-colors">
                            ${TT.COLORS.map(col => `
                                <button type="button" data-color="${col}" class="w-8 h-8 rounded-lg border-2 ${c.color === col ? 'border-blue-600' : 'border-transparent'}" style="background:${col}"></button>`).join('')}
                        </div>
                    </div>
                </div>
                <label class="flex items-center gap-2 font-bold text-slate-700 text-sm">
                    <input type="checkbox" id="cf-active" ${c.active ? 'checked' : ''} ${readonly ? 'disabled' : ''} class="w-4 h-4 accent-blue-600"> เปิดใช้งานห้องเรียนนี้ในตารางสอน
                </label>
            </div>`, {
            width: 'max-w-xl',
            footer: readonly ? '' : `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ยกเลิก</button>
                <button id="btn-save-class" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">บันทึก</button>`,
            onOpen: () => {
                let picked = c.color || '';
                document.querySelectorAll('#cf-colors [data-color]').forEach(b => {
                    b.onclick = () => {
                        picked = b.dataset.color;
                        document.querySelectorAll('#cf-colors [data-color]').forEach(x => x.className = x.className.replace('border-blue-600', 'border-transparent'));
                        b.className = b.className.replace('border-transparent', 'border-blue-600');
                    };
                });
                const btn = $('btn-save-class');
                if (btn) btn.onclick = () => {
                    TT.state.settings.classMeta[id] = {
                        roomId: $('cf-room').value,
                        color: picked,
                        active: $('cf-active').checked
                    };
                    TT.saveSettingsNow().then(() => {
                        UI.notify('บันทึกข้อมูลห้องเรียนแล้ว');
                        UI.closeModal();
                        TTApp.refresh();
                    });
                };
            }
        });
    };

    /* =====================================================================
       รายวิชา
       ===================================================================== */

    P.subjects = function (root) {
        const list = TT.subjects();
        const grades = TT.grades();

        root.innerHTML =
            UI.pageHeader('รายวิชา', 'กำหนดชื่อย่อ สี กลุ่มสาระ จำนวนคาบต่อสัปดาห์ของแต่ละระดับชั้น และห้องเรียนเฉพาะ',
                `<input id="q-subject" placeholder="ค้นหารายวิชา" class="border border-slate-200 rounded-xl px-4 py-2.5 font-semibold focus-ring w-full md:w-64">`) +
            `<div class="modern-card overflow-hidden">
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left min-w-[860px]">
                        <thead class="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-extrabold">
                            <tr>
                                <th class="p-4">รายวิชา</th>
                                <th class="p-4">กลุ่มสาระ</th>
                                <th class="p-4 text-center">คาบ/สัปดาห์</th>
                                <th class="p-4 text-center">รูปแบบคาบ</th>
                                <th class="p-4">ห้องเฉพาะ</th>
                                <th class="p-4 text-center w-24">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody id="tb-subjects" class="divide-y divide-slate-100"></tbody>
                    </table>
                </div>
            </div>`;

        const tb = $('tb-subjects');
        if (!list.length) {
            tb.innerHTML = `<tr><td colspan="6">${UI.empty('ยังไม่มีรายวิชา กรุณาเพิ่มรายวิชาในระบบคะแนน ANPSCORE', 'ph-books')}</td></tr>`;
            return;
        }
        tb.innerHTML = list.map(s => {
            const perWeek = grades.map(g => s.periodsPerWeek[g] ? g + ' : ' + s.periodsPerWeek[g] : null).filter(Boolean).join(' · ');
            return `
            <tr class="tr-subject hover:bg-blue-50/40">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <span class="w-8 h-8 rounded-lg shrink-0 grid place-items-center font-extrabold text-[11px]" style="background:${UI.esc(s.color)};color:${UI.textOn(s.color)}">${UI.esc(s.short.slice(0, 3))}</span>
                        <div>
                            <div class="font-bold text-slate-800">${UI.esc(s.name)}</div>
                            <div class="text-xs text-slate-400">${UI.esc(s.code || '—')}${s.isCore ? ' · วิชาหลัก' : ''}</div>
                        </div>
                    </div>
                </td>
                <td class="p-4 text-sm font-semibold text-slate-600">${UI.esc(s.dept || '—')}</td>
                <td class="p-4 text-center text-xs font-semibold text-slate-500">${UI.esc(perWeek || '—')}</td>
                <td class="p-4 text-center text-xs">
                    ${s.doublePeriod ? UI.badge('คาบคู่', 'bg-sky-100 text-sky-700 border-sky-200') : ''}
                    ${s.noAdjacent ? UI.badge('ห้ามติดกัน', 'bg-rose-100 text-rose-700 border-rose-200') : ''}
                    ${!s.doublePeriod && !s.noAdjacent ? '<span class="text-slate-300">คาบเดี่ยว</span>' : ''}
                </td>
                <td class="p-4 text-sm font-semibold text-slate-600">${UI.esc(TT.roomName(s.roomId) || '—')}</td>
                <td class="p-4 text-center">
                    <button onclick="TTPages.editSubject('${s.id}')" class="tactile-btn w-9 h-9 rounded-xl ${canEdit() ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-slate-50 text-slate-500'} grid place-items-center mx-auto">
                        <i class="ph ${canEdit() ? 'ph-pencil-simple' : 'ph-eye'}"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        UI.wireSearch('q-subject', '.tr-subject');
    };

    P.editSubject = function (id) {
        const s = TT.subject(id);
        if (!s) return;
        const readonly = !canEdit();
        const grades = TT.grades();

        UI.modal('ตั้งค่ารายวิชา — ' + s.name, `
            <div class="space-y-5">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${field('รหัสวิชา', 'sf-code', s.code, true)}
                    ${field('ชื่อย่อ (แสดงในตาราง)', 'sf-short', s.short, readonly)}
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">กลุ่มสาระการเรียนรู้</label>
                        <select id="sf-dept" ${readonly ? 'disabled' : ''} class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring font-semibold">
                            <option value="">— ไม่ระบุ —</option>
                            ${TT.DEPARTMENTS.map(d => `<option ${d === s.dept ? 'selected' : ''}>${UI.esc(d)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block font-bold text-slate-700 mb-1.5 text-sm">ห้องเรียนเฉพาะ</label>
                        <select id="sf-room" ${readonly ? 'disabled' : ''} class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring font-semibold">
                            <option value="">— ใช้ห้องเรียนประจำ —</option>
                            ${TT.rooms().map(r => `<option value="${UI.esc(r.id)}" ${r.id === s.roomId ? 'selected' : ''}>${UI.esc(r.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block font-bold text-slate-700 mb-2 text-sm">สีประจำวิชา</label>
                    <div class="flex flex-wrap gap-1.5" id="sf-colors">
                        ${TT.COLORS.map(col => `<button type="button" data-color="${col}" class="w-9 h-9 rounded-lg border-2 ${s.color === col ? 'border-blue-600' : 'border-transparent'}" style="background:${col}"></button>`).join('')}
                    </div>
                </div>

                <div>
                    <label class="block font-bold text-slate-700 mb-2 text-sm">จำนวนคาบต่อสัปดาห์ แยกตามระดับชั้น</label>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                        ${grades.map(g => `
                            <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                <span class="font-bold text-slate-600 text-sm w-10">${UI.esc(g)}</span>
                                <input type="number" min="0" max="20" data-ppw="${UI.esc(g)}" value="${UI.esc(s.periodsPerWeek[g] || '')}" ${readonly ? 'disabled' : ''}
                                    class="w-full border border-slate-200 rounded-lg p-1.5 text-center font-bold focus-ring">
                            </div>`).join('') || '<div class="text-slate-400 text-sm">ยังไม่มีระดับชั้น</div>'}
                    </div>
                </div>

                <div class="space-y-2">
                    <label class="flex items-center gap-2 font-bold text-slate-700 text-sm">
                        <input type="checkbox" id="sf-double" ${s.doublePeriod ? 'checked' : ''} ${readonly ? 'disabled' : ''} class="w-4 h-4 accent-blue-600"> ต้องเรียนคาบติดกัน (คาบคู่)
                    </label>
                    <label class="flex items-center gap-2 font-bold text-slate-700 text-sm">
                        <input type="checkbox" id="sf-noadj" ${s.noAdjacent ? 'checked' : ''} ${readonly ? 'disabled' : ''} class="w-4 h-4 accent-blue-600"> ห้ามเรียนติดกัน
                    </label>
                    <label class="flex items-center gap-2 font-bold text-slate-700 text-sm">
                        <input type="checkbox" id="sf-core" ${s.isCore ? 'checked' : ''} ${readonly ? 'disabled' : ''} class="w-4 h-4 accent-blue-600"> เป็นวิชาหลัก (ควรจัดช่วงเช้า)
                    </label>
                </div>
            </div>`, {
            width: 'max-w-2xl',
            footer: readonly ? '' : `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ยกเลิก</button>
                <button id="btn-save-subject" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">บันทึก</button>`,
            onOpen: () => {
                let picked = s.color;
                document.querySelectorAll('#sf-colors [data-color]').forEach(b => {
                    b.onclick = () => {
                        picked = b.dataset.color;
                        document.querySelectorAll('#sf-colors [data-color]').forEach(x => x.className = x.className.replace('border-blue-600', 'border-transparent'));
                        b.className = b.className.replace('border-transparent', 'border-blue-600');
                    };
                });
                const btn = $('btn-save-subject');
                if (btn) btn.onclick = () => {
                    const ppw = {};
                    document.querySelectorAll('[data-ppw]').forEach(inp => {
                        const v = Number(inp.value || 0);
                        if (v > 0) ppw[inp.dataset.ppw] = v;
                    });
                    TT.state.settings.subjectMeta[id] = {
                        short: $('sf-short').value.trim(),
                        dept: $('sf-dept').value,
                        color: picked,
                        roomId: $('sf-room').value,
                        periodsPerWeek: ppw,
                        doublePeriod: $('sf-double').checked,
                        noAdjacent: $('sf-noadj').checked,
                        isCore: $('sf-core').checked
                    };
                    TT.saveSettingsNow().then(() => {
                        TT.log('edit_subject_meta', 'ตั้งค่ารายวิชา ' + s.name);
                        UI.notify('บันทึกรายวิชาแล้ว');
                        UI.closeModal();
                        TTApp.refresh();
                    });
                };
            }
        });
    };

    /* =====================================================================
       ห้องเรียนและห้องพิเศษ
       ===================================================================== */

    P.rooms = function (root) {
        const rooms = TT.rooms();
        root.innerHTML =
            UI.pageHeader('ห้องเรียนและห้องพิเศษ', 'ห้องที่ใช้ในตารางสอน ระบบจะกันไม่ให้ห้องเดียวกันถูกใช้ซ้ำในคาบเดียวกัน',
                canEdit() ? `<button onclick="TTPages.editRoom('')" class="tactile-btn px-4 py-2.5 rounded-xl font-bold text-white brand-gradient shadow-lg"><i class="ph ph-plus mr-1"></i> เพิ่มห้อง</button>` : '') +
            `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${rooms.map(r => {
                const used = TT.entries().filter(e => String(e.roomId) === String(r.id)).length;
                return `
                    <div class="modern-card p-4">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-11 h-11 rounded-2xl ${r.type === 'special' ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'} grid place-items-center shrink-0">
                                    <i class="ph ${r.type === 'special' ? 'ph-flask' : 'ph-door'} text-xl"></i>
                                </div>
                                <div class="min-w-0">
                                    <div class="font-extrabold text-slate-800 truncate">${UI.esc(r.name)}</div>
                                    <div class="text-xs text-slate-500 font-semibold">${UI.esc(r.code || '')} · ${UI.esc(r.building || 'ไม่ระบุอาคาร')} · ${r.capacity || '-'} ที่นั่ง</div>
                                </div>
                            </div>
                            ${canEdit() ? `<div class="flex gap-1 shrink-0">
                                <button onclick="TTPages.editRoom('${r.id}')" class="tactile-btn w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center"><i class="ph ph-pencil-simple text-slate-500"></i></button>
                                <button onclick="TTPages.deleteRoom('${r.id}')" class="tactile-btn w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 grid place-items-center"><i class="ph ph-trash text-rose-500"></i></button>
                            </div>` : ''}
                        </div>
                        <div class="mt-3 flex items-center justify-between text-xs font-bold">
                            ${UI.badge(r.type === 'special' ? 'ห้องพิเศษ' : 'ห้องเรียนทั่วไป', r.type === 'special' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-100')}
                            <span class="text-slate-500">ใช้งาน ${used} คาบ/สัปดาห์</span>
                        </div>
                    </div>`;
            }).join('') || UI.empty('ยังไม่มีห้องเรียนในระบบ', 'ph-door-open')}
            </div>`;
    };

    P.editRoom = function (id) {
        const r = TT.room(id) || { id: '', code: '', name: '', type: 'special', building: '', capacity: 40 };
        UI.modal(id ? 'แก้ไขห้อง' : 'เพิ่มห้องใหม่', `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${field('ชื่อห้อง', 'rf-name', r.name)}
                ${field('รหัสห้อง', 'rf-code', r.code)}
                <div>
                    <label class="block font-bold text-slate-700 mb-1.5 text-sm">ประเภทห้อง</label>
                    <select id="rf-type" class="w-full border border-slate-200 rounded-xl p-2.5 focus-ring font-semibold">
                        <option value="special" ${r.type === 'special' ? 'selected' : ''}>ห้องพิเศษ</option>
                        <option value="normal" ${r.type === 'normal' ? 'selected' : ''}>ห้องเรียนทั่วไป</option>
                    </select>
                </div>
                ${field('อาคาร/พื้นที่', 'rf-building', r.building)}
                ${field('ความจุ (คน)', 'rf-capacity', r.capacity, false, 'number')}
            </div>`, {
            width: 'max-w-xl',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ยกเลิก</button>
                <button id="btn-save-room" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">บันทึก</button>`,
            onOpen: () => {
                $('btn-save-room').onclick = () => {
                    const name = $('rf-name').value.trim();
                    if (!name) { UI.notify('กรุณากรอกชื่อห้อง', 'warn'); return; }
                    const payload = {
                        id: id || TT.uid('rm'),
                        name,
                        code: $('rf-code').value.trim(),
                        type: $('rf-type').value,
                        building: $('rf-building').value.trim(),
                        capacity: Number($('rf-capacity').value || 0)
                    };
                    const rooms = TT.state.settings.rooms;
                    const i = rooms.findIndex(x => String(x.id) === String(id));
                    if (i >= 0) rooms[i] = payload; else rooms.push(payload);
                    TT.saveSettingsNow().then(() => {
                        TT.log('save_room', payload.name);
                        UI.notify('บันทึกห้องแล้ว');
                        UI.closeModal();
                        TTApp.refresh();
                    });
                };
            }
        });
    };

    P.deleteRoom = function (id) {
        const r = TT.room(id);
        if (!r) return;
        const used = TT.entries().filter(e => String(e.roomId) === String(id)).length;
        UI.confirm('ลบห้อง', `ต้องการลบ <b>${UI.esc(r.name)}</b> หรือไม่?` +
            (used ? `<br><span class="text-rose-600 font-bold">ห้องนี้ถูกใช้อยู่ ${used} คาบ การลบจะทำให้คาบเหล่านั้นไม่มีห้อง</span>` : ''),
            'danger', () => {
                TT.state.settings.rooms = TT.state.settings.rooms.filter(x => String(x.id) !== String(id));
                TT.saveSettingsNow().then(() => {
                    TT.log('delete_room', r.name);
                    UI.notify('ลบห้องแล้ว');
                    TTApp.refresh();
                });
            }, 'ลบห้อง');
    };

    /* =====================================================================
       ผู้ใช้งานและสิทธิ์ (เฉพาะผู้ดูแลระบบ)
       ===================================================================== */

    P.users = function (root) {
        if (!TT.can('manageUsers')) {
            root.innerHTML = UI.empty('เฉพาะผู้ดูแลระบบเท่านั้นที่เข้าถึงหน้านี้ได้', 'ph-lock');
            return;
        }
        const teachers = TT.teachers();

        root.innerHTML =
            UI.pageHeader('ผู้ใช้งานและสิทธิ์', 'กำหนดว่าใครเป็นผู้จัดตารางสอน ใครจัดครูสอนแทนได้ และใครเป็นผู้บริหาร ครูท่านอื่นจะดูตารางได้อย่างเดียว',
                `<input id="q-user" placeholder="ค้นหาชื่อครู" class="border border-slate-200 rounded-xl px-4 py-2.5 font-semibold focus-ring w-full md:w-64">`) +
            `<div class="modern-card p-4 md:p-5 mb-5 bg-amber-50/60 border-amber-200">
                <div class="flex items-start gap-3">
                    <i class="ph ph-info text-amber-600 text-2xl shrink-0"></i>
                    <div class="text-sm text-amber-900 font-semibold leading-relaxed">
                        <div class="font-extrabold mb-1">คำอธิบายสิทธิ์</div>
                        <div><b>ผู้จัดตารางสอน</b> — จัดการข้อมูลพื้นฐาน จัดสรรวิชา สร้างและประกาศตารางสอน จัดครูสอนแทน</div>
                        <div><b>ผู้จัดครูสอนแทน</b> — ดูแลการลาและจัดครูสอนแทน แต่แก้ไขตารางสอนหลักไม่ได้</div>
                        <div><b>ผู้บริหาร</b> — ดูตารางและรายงานทั้งโรงเรียน อนุมัติหรือรับทราบการจัดครูสอนแทน</div>
                        <div><b>ครูผู้สอน</b> — ค่าเริ่มต้นของทุกคน ดูตารางของตนเอง แจ้งลา และยืนยันการสอนแทน</div>
                    </div>
                </div>
            </div>

            <div class="modern-card overflow-hidden">
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left min-w-[760px]">
                        <thead class="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-extrabold">
                            <tr>
                                <th class="p-4">ครู</th>
                                <th class="p-4 text-center">ผู้จัดตารางสอน</th>
                                <th class="p-4 text-center">ผู้จัดครูสอนแทน</th>
                                <th class="p-4 text-center">ผู้บริหาร</th>
                                <th class="p-4">บทบาทที่ได้รับ</th>
                            </tr>
                        </thead>
                        <tbody id="tb-users" class="divide-y divide-slate-100">
                            ${teachers.map(t => {
                const p = TT.permOf(t.id);
                const label = [p.canSchedule ? 'ผู้จัดตารางสอน' : '', p.canSubstitute ? 'ผู้จัดครูสอนแทน' : '', p.isExecutive ? 'ผู้บริหาร' : '']
                    .filter(Boolean).join(' · ') || 'ครูผู้สอน (ดูอย่างเดียว)';
                return `
                            <tr class="tr-user hover:bg-blue-50/40">
                                <td class="p-4">
                                    <div class="font-bold text-slate-800">${UI.esc(t.name)}</div>
                                    <div class="text-xs text-slate-400">${UI.esc(t.dept || '—')}</div>
                                </td>
                                <td class="p-4 text-center"><input type="checkbox" data-perm="${t.id}|canSchedule" ${p.canSchedule ? 'checked' : ''} class="w-5 h-5 accent-blue-600"></td>
                                <td class="p-4 text-center"><input type="checkbox" data-perm="${t.id}|canSubstitute" ${p.canSubstitute ? 'checked' : ''} class="w-5 h-5 accent-blue-600"></td>
                                <td class="p-4 text-center"><input type="checkbox" data-perm="${t.id}|isExecutive" ${p.isExecutive ? 'checked' : ''} class="w-5 h-5 accent-blue-600"></td>
                                <td class="p-4 text-sm font-semibold text-slate-600" id="role-${t.id}">${UI.esc(label)}</td>
                            </tr>`;
            }).join('') || `<tr><td colspan="5">${UI.empty('ยังไม่มีครูในระบบ', 'ph-users-three')}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>`;

        UI.wireSearch('q-user', '.tr-user');

        document.querySelectorAll('[data-perm]').forEach(cb => {
            cb.onchange = () => {
                const [tid, key] = cb.dataset.perm.split('|');
                const perms = TT.state.settings.permissions;
                perms[tid] = Object.assign({ canSchedule: false, canSubstitute: false, isExecutive: false }, perms[tid] || {});
                perms[tid][key] = cb.checked;
                const p = perms[tid];
                const label = [p.canSchedule ? 'ผู้จัดตารางสอน' : '', p.canSubstitute ? 'ผู้จัดครูสอนแทน' : '', p.isExecutive ? 'ผู้บริหาร' : '']
                    .filter(Boolean).join(' · ') || 'ครูผู้สอน (ดูอย่างเดียว)';
                const cell = $('role-' + tid);
                if (cell) cell.innerText = label;
                TT.saveSettings(500);
                TT.log('set_permission', TT.teacherName(tid) + ' → ' + label);
                TT.notifyUsers(tid, 'สิทธิ์การใช้งานเปลี่ยนแปลง', 'ผู้ดูแลระบบปรับสิทธิ์ของท่านเป็น : ' + label, 'dashboard');
                UI.notify('บันทึกสิทธิ์ของ ' + TT.teacherName(tid) + ' แล้ว');
            };
        });
    };

    /* =====================================================================
       ตั้งค่าระบบ
       ===================================================================== */

    P.settings = function (root) {
        if (!TT.can('settings')) {
            root.innerHTML = UI.empty('ท่านไม่มีสิทธิ์เข้าถึงหน้าตั้งค่าระบบ', 'ph-lock');
            return;
        }
        const s = TT.state.settings;
        const isAdmin = TT.can('admin');

        root.innerHTML =
            UI.pageHeader('ตั้งค่าระบบ', 'ปีการศึกษา วันเรียน คาบเรียน กติกาการจัดตาราง และการสำรองข้อมูล') +
            `<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

                <!-- ปีการศึกษาและภาคเรียน -->
                <div class="modern-card p-5">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-extrabold text-slate-800 flex items-center gap-2"><i class="ph ph-calendar text-blue-600 text-xl"></i> ปีการศึกษาและภาคเรียน</h3>
                        <button onclick="TTPages.addYear()" class="tactile-btn text-sm font-bold text-blue-600 px-3 py-1.5 rounded-lg bg-blue-50"><i class="ph ph-plus"></i> เพิ่มปี</button>
                    </div>
                    <div class="space-y-3">
                        ${(s.years || []).map(y => `
                            <div class="p-3 rounded-xl border ${y.year === s.activeYear ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200'}">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="font-extrabold text-slate-800">ปีการศึกษา ${UI.esc(y.year)}</div>
                                    ${y.year === s.activeYear ? UI.badge('กำลังใช้งาน', 'bg-blue-100 text-blue-700 border-blue-200')
                    : `<button onclick="TTPages.useYear('${UI.esc(y.year)}')" class="text-xs font-bold text-blue-600">เลือกใช้</button>`}
                                </div>
                                ${['1', '2'].map(term => {
                        const t = (y.terms && y.terms[term]) || {};
                        return `
                                    <div class="flex flex-wrap items-center gap-2 text-sm mb-1.5">
                                        <span class="font-bold text-slate-600 w-20">ภาคเรียนที่ ${term}</span>
                                        <input type="date" value="${UI.esc(t.start || '')}" data-term="${UI.esc(y.year)}|${term}|start" class="border border-slate-200 rounded-lg px-2 py-1 text-xs focus-ring">
                                        <span class="text-slate-400">ถึง</span>
                                        <input type="date" value="${UI.esc(t.end || '')}" data-term="${UI.esc(y.year)}|${term}|end" class="border border-slate-200 rounded-lg px-2 py-1 text-xs focus-ring">
                                    </div>`;
                    }).join('')}
                            </div>`).join('')}
                    </div>
                    <button onclick="TTPages.openCopyTerm()" class="tactile-btn w-full mt-4 py-2.5 rounded-xl font-bold text-blue-700 bg-blue-50 hover:bg-blue-100">
                        <i class="ph ph-copy mr-1"></i> คัดลอกข้อมูลจากภาคเรียนก่อนหน้า
                    </button>
                </div>

                <!-- วันเรียน -->
                <div class="modern-card p-5">
                    <h3 class="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><i class="ph ph-calendar-blank text-blue-600 text-xl"></i> วันเรียนของโรงเรียน</h3>
                    <div class="space-y-2">
                        ${Object.keys(TT.DAY_NAMES).map(d => {
                        const day = (s.days || []).find(x => x.id === d);
                        return `
                            <label class="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50">
                                <input type="checkbox" data-day="${d}" ${day && day.active !== false ? 'checked' : ''} class="w-5 h-5 accent-blue-600">
                                <span class="font-bold text-slate-700">วัน${UI.esc(TT.DAY_NAMES[d])}</span>
                            </label>`;
                    }).join('')}
                    </div>
                </div>

                <!-- คาบเรียน -->
                <div class="modern-card p-5 lg:col-span-2">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-extrabold text-slate-800 flex items-center gap-2"><i class="ph ph-clock text-blue-600 text-xl"></i> คาบเรียนและช่วงเวลา</h3>
                        <button onclick="TTPages.addPeriod()" class="tactile-btn text-sm font-bold text-blue-600 px-3 py-1.5 rounded-lg bg-blue-50"><i class="ph ph-plus"></i> เพิ่มคาบ</button>
                    </div>
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-sm min-w-[620px]">
                            <thead class="bg-slate-50 text-xs uppercase text-slate-500 font-extrabold">
                                <tr><th class="p-3 text-left">ชื่อคาบ</th><th class="p-3">เริ่ม</th><th class="p-3">สิ้นสุด</th><th class="p-3">ประเภท</th><th class="p-3 w-16"></th></tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${(s.periods || []).map((p, i) => `
                                <tr>
                                    <td class="p-2"><input value="${UI.esc(p.label)}" data-period="${i}|label" class="w-full border border-slate-200 rounded-lg px-2 py-1.5 font-semibold focus-ring"></td>
                                    <td class="p-2"><input type="time" value="${UI.esc(p.start)}" data-period="${i}|start" class="border border-slate-200 rounded-lg px-2 py-1.5 focus-ring"></td>
                                    <td class="p-2"><input type="time" value="${UI.esc(p.end)}" data-period="${i}|end" class="border border-slate-200 rounded-lg px-2 py-1.5 focus-ring"></td>
                                    <td class="p-2">
                                        <select data-period="${i}|type" class="border border-slate-200 rounded-lg px-2 py-1.5 font-semibold focus-ring">
                                            ${Object.keys(TT.PERIOD_TYPES).map(k => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${UI.esc(TT.PERIOD_TYPES[k])}</option>`).join('')}
                                        </select>
                                    </td>
                                    <td class="p-2 text-center"><button onclick="TTPages.deletePeriod(${i})" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 grid place-items-center"><i class="ph ph-trash"></i></button></td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                    <p class="text-xs text-slate-400 mt-3 font-semibold">* คาบประเภท "พัก" และ "คาบกิจกรรม" จะไม่ถูกนำไปจัดวิชาเรียน แต่ยังแสดงในตารางสอนที่พิมพ์ออกมา</p>
                </div>

                <!-- กติกาการจัดตาราง -->
                <div class="modern-card p-5">
                    <h3 class="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><i class="ph ph-sliders text-blue-600 text-xl"></i> กติกาการจัดตาราง</h3>
                    <div class="space-y-3">
                        ${ruleNum('คาบสอนสูงสุดของครูต่อวัน', 'maxPerDayTeacher', s.rules.maxPerDayTeacher)}
                        ${ruleNum('สอนติดต่อกันได้ไม่เกิน (คาบ)', 'maxConsecutive', s.rules.maxConsecutive)}
                        ${ruleNum('คาบเรียนสูงสุดของนักเรียนต่อวัน', 'maxPerDayClass', s.rules.maxPerDayClass)}
                        ${ruleNum('เพดานการสอนแทนต่อสัปดาห์', 'substituteMaxPerWeek', s.rules.substituteMaxPerWeek)}
                        <label class="flex items-center gap-2 font-bold text-slate-700 text-sm pt-1">
                            <input type="checkbox" id="rule-coreMorning" ${s.rules.coreMorning ? 'checked' : ''} class="w-4 h-4 accent-blue-600"> จัดวิชาหลักไว้ช่วงเช้า
                        </label>
                    </div>
                    <div class="mt-4 pt-4 border-t border-slate-100">
                        <div class="font-bold text-slate-700 text-sm mb-2">ลำดับความสำคัญของเงื่อนไขคุณภาพ (0–10)</div>
                        ${Object.keys(s.rules.weights).map(k => `
                            <div class="flex items-center gap-3 mb-2">
                                <span class="text-xs font-bold text-slate-500 w-40 shrink-0">${UI.esc(weightLabel(k))}</span>
                                <input type="range" min="0" max="10" value="${s.rules.weights[k]}" data-weight="${k}" class="flex-1 accent-blue-600">
                                <span class="text-xs font-extrabold text-slate-700 w-6 text-right" id="wv-${k}">${s.rules.weights[k]}</span>
                            </div>`).join('')}
                    </div>
                </div>

                <!-- ข้อมูลโรงเรียนและการสำรองข้อมูล -->
                <div class="modern-card p-5">
                    <h3 class="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><i class="ph ph-buildings text-blue-600 text-xl"></i> ข้อมูลโรงเรียนและระบบ</h3>
                    <div class="space-y-3">
                        ${field('ชื่อโรงเรียน', 'set-school', s.school.name)}
                        ${field('ที่อยู่', 'set-address', s.school.address)}
                        ${field('ผู้อำนวยการโรงเรียน', 'set-director', s.school.director)}
                        ${field('หัวหน้าฝ่ายวิชาการ', 'set-academic', s.school.academicHead)}
                        ${field('ลิงก์โลโก้โรงเรียน', 'set-logo', s.school.logo || '')}
                        ${field('ออกจากระบบอัตโนมัติเมื่อไม่ใช้งาน (นาที)', 'set-timeout', s.sessionTimeoutMin, false, 'number')}
                    </div>
                    <div class="grid grid-cols-2 gap-2 mt-5">
                        <button onclick="TTPages.backupData()" class="tactile-btn py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"><i class="ph ph-download-simple mr-1"></i> สำรองข้อมูล</button>
                        <button onclick="TTPages.restoreData()" class="tactile-btn py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"><i class="ph ph-upload-simple mr-1"></i> กู้คืนข้อมูล</button>
                        ${isAdmin ? `<button onclick="TTPages.openLogs()" class="tactile-btn py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200"><i class="ph ph-clock-counter-clockwise mr-1"></i> ประวัติการใช้งาน</button>` : ''}
                        ${isAdmin ? `<button onclick="TTSeed.open()" class="tactile-btn py-2.5 rounded-xl font-bold text-amber-800 bg-amber-100 hover:bg-amber-200"><i class="ph ph-flask mr-1"></i> ข้อมูลตัวอย่าง</button>` : ''}
                    </div>
                </div>
            </div>

            <div class="mt-6 flex justify-end no-print">
                <button onclick="TTPages.saveSettingsPage()" class="tactile-btn px-8 py-3 rounded-2xl font-extrabold text-white brand-gradient shadow-xl">
                    <i class="ph ph-floppy-disk mr-1"></i> บันทึกการตั้งค่าทั้งหมด
                </button>
            </div>`;

        document.querySelectorAll('[data-weight]').forEach(r => {
            r.oninput = () => { $('wv-' + r.dataset.weight).innerText = r.value; };
        });
    };

    const weightLabel = function (key) {
        return {
            spread: 'กระจายคาบตลอดสัปดาห์',
            sameDayRepeat: 'ไม่ซ้ำวิชาในวันเดียว',
            coreMorning: 'วิชาหลักช่วงเช้า',
            teacherGap: 'ลดคาบว่างแทรกของครู',
            consecutive: 'ไม่สอนติดกันเกินกำหนด',
            balance: 'สมดุลภาระงานครู',
            buildingMove: 'ลดการย้ายอาคาร'
        }[key] || key;
    };

    const ruleNum = function (label, key, value) {
        return `<div class="flex items-center gap-3">
            <span class="text-sm font-bold text-slate-600 flex-1">${UI.esc(label)}</span>
            <input type="number" min="0" max="20" id="rule-${key}" value="${UI.esc(value)}" class="w-20 border border-slate-200 rounded-xl p-2 text-center font-bold focus-ring">
        </div>`;
    };

    P.saveSettingsPage = function () {
        const s = TT.state.settings;

        /* วันเรียน */
        s.days = Object.keys(TT.DAY_NAMES).map((d, i) => {
            const cb = document.querySelector(`[data-day="${d}"]`);
            return { id: d, name: TT.DAY_NAMES[d], no: i + 1, active: cb ? cb.checked : false };
        }).filter(d => d.active);
        if (!s.days.length) { UI.notify('ต้องเลือกวันเรียนอย่างน้อย 1 วัน', 'warn'); return; }

        /* คาบเรียน */
        document.querySelectorAll('[data-period]').forEach(inp => {
            const [i, key] = inp.dataset.period.split('|');
            if (s.periods[i]) s.periods[i][key] = inp.value;
        });
        /* ตั้งเลขคาบเรียนใหม่ตามลำดับ เพื่อให้รายงานอ่านง่าย */
        let no = 0;
        s.periods.forEach(p => { p.no = p.type === 'class' ? ++no : 0; });

        /* วันเปิด–ปิดภาคเรียน */
        document.querySelectorAll('[data-term]').forEach(inp => {
            const [year, term, key] = inp.dataset.term.split('|');
            const y = s.years.find(x => String(x.year) === year);
            if (!y) return;
            y.terms = y.terms || {};
            y.terms[term] = y.terms[term] || {};
            y.terms[term][key] = inp.value;
        });

        /* กติกา */
        ['maxPerDayTeacher', 'maxConsecutive', 'maxPerDayClass', 'substituteMaxPerWeek'].forEach(k => {
            const el = $('rule-' + k);
            if (el) s.rules[k] = Number(el.value || 0);
        });
        s.rules.coreMorning = $('rule-coreMorning').checked;
        document.querySelectorAll('[data-weight]').forEach(r => { s.rules.weights[r.dataset.weight] = Number(r.value); });

        /* ข้อมูลโรงเรียน */
        s.school.name = $('set-school').value.trim();
        s.school.address = $('set-address').value.trim();
        s.school.director = $('set-director').value.trim();
        s.school.academicHead = $('set-academic').value.trim();
        s.school.logo = $('set-logo').value.trim();
        s.sessionTimeoutMin = Number($('set-timeout').value || 60);

        TT.saveSettingsNow().then(() => {
            TT.log('save_settings', 'บันทึกการตั้งค่าระบบ');
            UI.notify('บันทึกการตั้งค่าเรียบร้อย');
            TTApp.refresh();
        }).catch(() => UI.notify('บันทึกไม่สำเร็จ', 'error'));
    };

    P.addYear = function () {
        UI.prompt('เพิ่มปีการศึกษา', 'ระบุปีการศึกษา (พ.ศ.)', (v) => {
            const year = v.replace(/\D/g, '');
            if (!year) { UI.notify('กรุณากรอกเป็นตัวเลข', 'warn'); return; }
            if (TT.state.settings.years.some(y => String(y.year) === year)) {
                UI.notify('มีปีการศึกษานี้อยู่แล้ว', 'warn');
                return;
            }
            TT.state.settings.years.push({
                year,
                terms: { '1': { start: '', end: '', status: 'open' }, '2': { start: '', end: '', status: 'open' } }
            });
            TT.state.settings.years.sort((a, b) => String(b.year).localeCompare(String(a.year)));
            TT.saveSettingsNow().then(() => {
                TT.log('add_year', 'เพิ่มปีการศึกษา ' + year);
                UI.notify('เพิ่มปีการศึกษา ' + year + ' แล้ว');
                TTApp.refresh();
            });
        }, 'เช่น 2569');
    };

    P.useYear = async function (year) {
        TT.state.settings.activeYear = String(year);
        await TT.saveSettingsNow();
        await TT.loadTermData();
        TTApp.updateContext();
        UI.notify('เปลี่ยนเป็นปีการศึกษา ' + year + ' แล้ว');
        TTApp.refresh();
    };

    P.addPeriod = function () {
        TT.state.settings.periods.push({
            id: TT.uid('p'), no: 0, label: 'คาบใหม่', start: '16:00', end: '17:00', type: 'class'
        });
        TT.saveSettingsNow().then(() => TTApp.refresh());
    };

    P.deletePeriod = function (index) {
        const p = TT.state.settings.periods[index];
        if (!p) return;
        const used = TT.entries().filter(e => e.periodId === p.id).length;
        UI.confirm('ลบคาบ', `ต้องการลบ <b>${UI.esc(p.label)}</b> หรือไม่?` +
            (used ? `<br><span class="text-rose-600 font-bold">มี ${used} คาบเรียนอยู่ในช่วงเวลานี้ ข้อมูลจะถูกลบไปด้วย</span>` : ''),
            'danger', () => {
                TT.state.settings.periods.splice(index, 1);
                if (used && TT.state.plan) {
                    TT.state.plan.entries = TT.state.plan.entries.filter(e => e.periodId !== p.id);
                    TT.savePlanNow();
                }
                TT.saveSettingsNow().then(() => {
                    TT.log('delete_period', p.label);
                    UI.notify('ลบคาบแล้ว');
                    TTApp.refresh();
                });
            }, 'ลบคาบ');
    };

    P.openCopyTerm = function () {
        const s = TT.state.settings;
        const years = s.years.map(y => y.year);
        UI.modal('คัดลอกข้อมูลจากภาคเรียนก่อนหน้า', `
            <p class="text-slate-600 mb-4">ระบบจะคัดลอก <b>การจัดสรรวิชาและครูผู้สอน</b> มายังภาคเรียนปัจจุบัน (ปีการศึกษา ${UI.esc(s.activeYear)} ภาคเรียนที่ ${UI.esc(s.activeTerm)}) โดยไม่ลบข้อมูลของภาคเรียนต้นทาง</p>
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div>
                    <label class="block font-bold text-slate-700 mb-1.5 text-sm">จากปีการศึกษา</label>
                    <select id="cp-year" class="w-full border border-slate-200 rounded-xl p-2.5 font-semibold focus-ring">
                        ${years.map(y => `<option value="${UI.esc(y)}">${UI.esc(y)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block font-bold text-slate-700 mb-1.5 text-sm">ภาคเรียนที่</label>
                    <select id="cp-term" class="w-full border border-slate-200 rounded-xl p-2.5 font-semibold focus-ring">
                        <option value="1">1</option><option value="2">2</option>
                    </select>
                </div>
            </div>
            <label class="flex items-center gap-2 font-bold text-slate-700 text-sm">
                <input type="checkbox" id="cp-entries" class="w-4 h-4 accent-blue-600"> คัดลอกคาบที่จัดไว้แล้วมาด้วย
            </label>
            <div class="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold">
                <i class="ph ph-warning mr-1"></i> การคัดลอกจะเขียนทับการจัดสรรวิชาของภาคเรียนปัจจุบัน
            </div>`, {
            width: 'max-w-lg',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100">ยกเลิก</button>
                <button id="btn-copy-term" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">คัดลอกข้อมูล</button>`,
            onOpen: () => {
                $('btn-copy-term').onclick = async () => {
                    const res = await TT.copyFromTerm($('cp-year').value, $('cp-term').value, $('cp-entries').checked);
                    UI.notify(res.message, res.ok ? 'success' : 'error');
                    if (res.ok) { UI.closeModal(); TTApp.refresh(); }
                };
            }
        });
    };

    P.backupData = async function () {
        UI.notify('กำลังรวบรวมข้อมูล...', 'info');
        try {
            const all = await window.ttCloud.loadAll();
            const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), timetable: all }, null, 2)],
                { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'สำรองข้อมูลตารางสอน-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            TT.log('backup', 'สำรองข้อมูลระบบตารางสอน');
            UI.notify('สำรองข้อมูลเรียบร้อย');
        } catch (e) {
            console.error(e);
            UI.notify('สำรองข้อมูลไม่สำเร็จ', 'error');
        }
    };

    P.restoreData = function () {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = () => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                let payload;
                try { payload = JSON.parse(reader.result); } catch (e) { UI.notify('ไฟล์ไม่ถูกต้อง', 'error'); return; }
                const docs = payload.timetable || payload;
                const ids = Object.keys(docs || {});
                if (!ids.length) { UI.notify('ไม่พบข้อมูลในไฟล์', 'error'); return; }
                UI.confirm('กู้คืนข้อมูล', `พบข้อมูล ${ids.length} รายการ<br><span class="text-rose-600 font-bold">ข้อมูลปัจจุบันที่มีรหัสเดียวกันจะถูกเขียนทับ</span>`, 'danger', async () => {
                    UI.notify('กำลังกู้คืน...', 'info');
                    for (const id of ids) {
                        if (!docs[id]) continue;
                        await window.ttCloud.save(id, docs[id], { kind: id.split('__')[0] });
                    }
                    TT.log('restore', 'กู้คืนข้อมูล ' + ids.length + ' รายการ');
                    UI.notify('กู้คืนข้อมูลเรียบร้อย กำลังโหลดใหม่');
                    setTimeout(() => location.reload(), 900);
                }, 'กู้คืนทับข้อมูลเดิม');
            };
            reader.readAsText(file);
        };
        input.click();
    };

    P.openLogs = async function () {
        UI.modal('ประวัติการใช้งานและการแก้ไขข้อมูล', UI.loading(), { width: 'max-w-3xl' });
        try {
            const rows = await window.ttCloud.listByKind('log', 200);
            const body = rows.length ? `
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-sm min-w-[620px]">
                        <thead class="bg-slate-50 text-xs uppercase text-slate-500 font-extrabold">
                            <tr><th class="p-3 text-left">เวลา</th><th class="p-3 text-left">ผู้ใช้</th><th class="p-3 text-left">การกระทำ</th><th class="p-3 text-left">รายละเอียด</th></tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${rows.map(r => {
                const d = r.data || {};
                return `<tr>
                                    <td class="p-3 whitespace-nowrap text-slate-500">${TT.thaiDateTime(d.ts)}</td>
                                    <td class="p-3 font-semibold text-slate-700">${UI.esc(d.actorName || d.actorId || '—')}</td>
                                    <td class="p-3 font-bold text-blue-700">${UI.esc(d.action || '')}</td>
                                    <td class="p-3 text-slate-600">${UI.esc(d.detail || '')}</td>
                                </tr>`;
            }).join('')}
                        </tbody>
                    </table>
                </div>` : UI.empty('ยังไม่มีประวัติการใช้งาน', 'ph-clock-counter-clockwise');
            $('modal-body').innerHTML = body;
        } catch (e) {
            $('modal-body').innerHTML = `<div class="text-rose-600 font-bold p-4">โหลดประวัติไม่สำเร็จ: ${UI.esc(e.message || e)}</div>`;
        }
    };
})();
