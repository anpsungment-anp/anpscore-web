/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — ส่วนประกอบหน้าจอที่ใช้ร่วมกัน (UI kit)

   รวมกล่องข้อความ ป๊อปอัป ตัวกรอง สถานะว่าง/กำลังโหลด และการพิมพ์/ส่งออก
   ให้ทุกหน้าเรียกใช้ได้เหมือนกัน หน้าตาจึงสม่ำเสมอทั้งระบบ
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT;
    const UI = window.TTUI = {};

    UI.$ = (id) => document.getElementById(id);

    /* กันข้อความจากผู้ใช้ไปทำให้ HTML เพี้ยน */
    UI.esc = function (s) {
        return String(s === undefined || s === null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    /* ------------------------------------------------------------ แจ้งเตือนสั้น */

    UI.notify = function (message, type) {
        const host = UI.$('toast-host');
        if (!host) return;
        const tone = {
            success: 'bg-emerald-600', error: 'bg-rose-600',
            warn: 'bg-amber-500', info: 'bg-slate-800'
        }[type || 'success'] || 'bg-emerald-600';
        const icon = {
            success: 'ph-check-circle', error: 'ph-warning-octagon',
            warn: 'ph-warning', info: 'ph-info'
        }[type || 'success'] || 'ph-check-circle';
        const el = document.createElement('div');
        el.className = `${tone} text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-semibold text-sm animate-fade-in-up max-w-[92vw]`;
        el.innerHTML = `<i class="ph ${icon} text-xl shrink-0"></i><span>${UI.esc(message)}</span>`;
        host.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'opacity .3s, transform .3s';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
            setTimeout(() => el.remove(), 300);
        }, 3200);
    };

    /* ------------------------------------------------------------------ ป๊อปอัป */

    UI.modal = function (title, bodyHtml, options) {
        const opt = options || {};
        const back = UI.$('modal-backdrop');
        UI.$('modal-title').innerHTML = UI.esc(title);
        UI.$('modal-body').innerHTML = bodyHtml;
        UI.$('modal-panel').className =
            'modern-card w-full ' + (opt.width || 'max-w-2xl') +
            ' max-h-[92vh] flex flex-col animate-fade-in-up overflow-hidden';
        const foot = UI.$('modal-footer');
        foot.innerHTML = opt.footer || '';
        foot.classList.toggle('hidden', !opt.footer);
        back.classList.remove('hidden');
        back.classList.add('flex');
        document.body.style.overflow = 'hidden';
        if (opt.onOpen) setTimeout(opt.onOpen, 30);
    };

    UI.closeModal = function () {
        const back = UI.$('modal-backdrop');
        back.classList.add('hidden');
        back.classList.remove('flex');
        document.body.style.overflow = '';
    };

    /* กล่องยืนยัน — ใช้ก่อนลบข้อมูลหรือประกาศใช้ตาราง */
    UI.confirm = function (title, message, tone, onYes, yesLabel) {
        const color = tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' :
            (tone === 'warn' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700');
        const icon = tone === 'danger' ? 'ph-trash' : (tone === 'warn' ? 'ph-warning' : 'ph-question');
        UI.modal(title, `
            <div class="flex gap-4 items-start p-1">
                <div class="w-12 h-12 rounded-2xl grid place-items-center shrink-0 ${tone === 'danger' ? 'bg-rose-50 text-rose-600' : (tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600')}">
                    <i class="ph ${icon} text-2xl"></i>
                </div>
                <div class="text-slate-600 leading-relaxed pt-1">${message}</div>
            </div>`, {
            width: 'max-w-lg',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">ยกเลิก</button>
                <button id="btn-confirm-yes" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white ${color} shadow-lg">${UI.esc(yesLabel || 'ยืนยัน')}</button>`,
            onOpen: () => {
                UI.$('btn-confirm-yes').onclick = () => { UI.closeModal(); onYes(); };
            }
        });
    };

    /* กล่องกรอกเหตุผล (ใช้ตอนปฏิเสธการสอนแทน หรือยืนยันบันทึกทั้งที่มีข้อผิดพลาด) */
    UI.prompt = function (title, label, onSubmit, placeholder) {
        UI.modal(title, `
            <label class="block font-bold text-slate-700 mb-2">${UI.esc(label)}</label>
            <textarea id="prompt-input" rows="3" placeholder="${UI.esc(placeholder || '')}"
                class="w-full border border-slate-200 rounded-xl p-3 focus-ring"></textarea>`, {
            width: 'max-w-lg',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">ยกเลิก</button>
                <button id="btn-prompt-ok" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg">ตกลง</button>`,
            onOpen: () => {
                UI.$('prompt-input').focus();
                UI.$('btn-prompt-ok').onclick = () => {
                    const v = UI.$('prompt-input').value.trim();
                    if (!v) { UI.notify('กรุณากรอกข้อมูลก่อน', 'warn'); return; }
                    UI.closeModal();
                    onSubmit(v);
                };
            }
        });
    };

    /* ------------------------------------------------------- ชิ้นส่วนหน้าจอย่อย */

    UI.pageHeader = function (title, subtitle, actionsHtml) {
        return `
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 no-print">
            <div>
                <h2 class="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">${UI.esc(title)}</h2>
                ${subtitle ? `<p class="text-slate-500 font-medium mt-1">${subtitle}</p>` : ''}
            </div>
            <div class="flex flex-wrap gap-2">${actionsHtml || ''}</div>
        </div>`;
    };

    UI.card = function (inner, extraClass) {
        return `<div class="modern-card p-5 md:p-6 ${extraClass || ''}">${inner}</div>`;
    };

    UI.stat = function (label, value, icon, tone, hint) {
        const tones = {
            blue: 'from-blue-500 to-indigo-500', amber: 'from-amber-400 to-orange-500',
            green: 'from-emerald-500 to-teal-500', rose: 'from-rose-500 to-pink-500',
            slate: 'from-slate-600 to-slate-800', sky: 'from-sky-500 to-cyan-500'
        };
        return `
        <div class="modern-card p-4 md:p-5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br ${tones[tone] || tones.blue} text-white grid place-items-center shadow-lg shrink-0">
                <i class="ph ${icon} text-2xl"></i>
            </div>
            <div class="min-w-0">
                <div class="text-2xl font-extrabold text-slate-800 leading-tight">${UI.esc(value)}</div>
                <div class="text-xs font-bold text-slate-500 truncate">${UI.esc(label)}</div>
                ${hint ? `<div class="text-[11px] text-slate-400 truncate">${UI.esc(hint)}</div>` : ''}
            </div>
        </div>`;
    };

    UI.empty = function (message, icon) {
        return `
        <div class="py-14 text-center text-slate-400">
            <div class="w-20 h-20 rounded-full bg-slate-100 grid place-items-center mx-auto mb-3">
                <i class="ph ${icon || 'ph-tray'} text-4xl text-slate-300"></i>
            </div>
            <div class="font-semibold">${UI.esc(message)}</div>
        </div>`;
    };

    UI.loading = function (message) {
        return `
        <div class="py-16 text-center text-slate-400">
            <div class="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
            <div class="font-semibold">${UI.esc(message || 'กำลังโหลดข้อมูล...')}</div>
        </div>`;
    };

    UI.badge = function (text, cls) {
        return `<span class="inline-block text-[11px] font-bold px-2 py-0.5 rounded-lg border ${cls || 'bg-slate-100 text-slate-600 border-slate-200'}">${UI.esc(text)}</span>`;
    };

    /* แถบสถานะครบ/ขาด/เกิน ตามข้อกำหนดสีของระบบ */
    UI.statusPill = function (status) {
        if (status === 'complete') return UI.badge('จัดครบแล้ว', 'bg-emerald-100 text-emerald-700 border-emerald-200');
        if (status === 'over') return UI.badge('จัดเกิน', 'bg-rose-100 text-rose-700 border-rose-200');
        return UI.badge('ยังขาดคาบ', 'bg-amber-100 text-amber-700 border-amber-200');
    };

    UI.select = function (id, options, value, attrs) {
        const opts = options.map(o =>
            `<option value="${UI.esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${UI.esc(o.label)}</option>`
        ).join('');
        return `<select id="${id}" ${attrs || ''} class="border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 bg-white focus-ring">${opts}</select>`;
    };

    UI.teacherOptions = function (includeBlank) {
        const list = TT.teachers().filter(t => t.status === 'active')
            .map(t => ({ value: t.id, label: t.name }));
        return includeBlank ? [{ value: '', label: '— เลือกครู —' }].concat(list) : list;
    };

    UI.subjectOptions = function (includeBlank) {
        const list = TT.subjects().map(s => ({ value: s.id, label: (s.code ? s.code + ' ' : '') + s.name }));
        return includeBlank ? [{ value: '', label: '— เลือกรายวิชา —' }].concat(list) : list;
    };

    UI.classOptions = function (includeBlank) {
        const list = TT.classes().map(c => ({ value: c.id, label: c.name }));
        return includeBlank ? [{ value: '', label: '— เลือกห้องเรียน —' }].concat(list) : list;
    };

    UI.roomOptions = function (includeBlank, type) {
        const list = TT.rooms().filter(r => !type || r.type === type)
            .map(r => ({ value: r.id, label: r.name }));
        return includeBlank ? [{ value: '', label: '— ไม่ระบุห้อง —' }].concat(list) : list;
    };

    /* ------------------------------------------------------------ พิมพ์/ส่งออก */

    /* หัวกระดาษราชการ พร้อมโลโก้ ปีการศึกษา และภาคเรียน */
    UI.printHeader = function (title, subtitle) {
        const s = TT.state.settings;
        const school = s.school || {};
        const logo = school.logo
            ? `<img src="${UI.esc(school.logo)}" style="height:22mm" alt="">`
            : `<div style="height:22mm;width:22mm"></div>`;
        return `
        <div class="print-head">
            <div class="print-logo">${logo}</div>
            <div class="print-title">
                <div class="ph-school">${UI.esc(school.name || TT.SCHOOL.name)}</div>
                <div class="ph-addr">${UI.esc(school.address || TT.SCHOOL.address)}</div>
                <div class="ph-doc">${UI.esc(title)}</div>
                <div class="ph-sub">${UI.esc(subtitle || ('ภาคเรียนที่ ' + s.activeTerm + ' ปีการศึกษา ' + s.activeYear))}</div>
            </div>
        </div>`;
    };

    /* ช่องลงชื่อสามฝ่ายตามระเบียบของโรงเรียน */
    UI.printSignatures = function () {
        const school = TT.state.settings.school || {};
        const box = (role, name) => `
            <div class="sign-box">
                <div class="sign-line">ลงชื่อ ...................................................</div>
                <div class="sign-name">( ${UI.esc(name || '.....................................')} )</div>
                <div class="sign-role">${UI.esc(role)}</div>
            </div>`;
        return `<div class="sign-row">
            ${box('ผู้จัดตารางสอน', '')}
            ${box('หัวหน้าฝ่ายวิชาการ', school.academicHead || '')}
            ${box('ผู้อำนวยการโรงเรียน', school.director || TT.SCHOOL.director)}
        </div>`;
    };

    /* เปิดมุมมองพิมพ์ : ย้ายเนื้อหาไปไว้ในกล่องกระดาษแล้วสั่งพิมพ์ */
    UI.print = function (innerHtml, orientation, fontScale) {
        const view = UI.$('print-view');
        document.body.classList.toggle('print-landscape', orientation === 'landscape');
        view.style.setProperty('--print-font-scale', String(fontScale || 1));
        view.innerHTML = innerHtml;
        view.classList.remove('hidden');
        window.scrollTo(0, 0);
        setTimeout(() => {
            window.print();
            setTimeout(() => { view.classList.add('hidden'); view.innerHTML = ''; }, 400);
        }, 120);
    };

    /* หน้าตัวอย่างก่อนพิมพ์ พร้อมปรับขนาดตัวอักษรและแนวกระดาษ */
    UI.printPreview = function (title, buildHtml, defaultOrientation) {
        let orientation = defaultOrientation || 'portrait';
        let scale = 1;
        const render = () => {
            const host = UI.$('preview-paper');
            if (!host) return;
            host.style.setProperty('--print-font-scale', String(scale));
            host.className = 'paper ' + (orientation === 'landscape' ? 'paper-landscape' : 'paper-portrait');
            host.innerHTML = buildHtml();
        };
        UI.modal(title, `
            <div class="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-slate-100 no-print">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-600 text-sm">แนวกระดาษ</span>
                    <select id="pv-orient" class="border border-slate-200 rounded-xl px-3 py-2 font-semibold focus-ring">
                        <option value="portrait">A4 แนวตั้ง</option>
                        <option value="landscape">A4 แนวนอน</option>
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-600 text-sm">ขนาดตัวอักษร</span>
                    <input id="pv-scale" type="range" min="0.7" max="1.4" step="0.05" value="1" class="w-32">
                    <span id="pv-scale-label" class="text-sm font-bold text-slate-500 w-10">100%</span>
                </div>
            </div>
            <div class="preview-scroll"><div id="preview-paper" class="paper paper-portrait"></div></div>`, {
            width: 'max-w-5xl',
            footer: `
                <button onclick="TTUI.closeModal()" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">ปิด</button>
                <button id="pv-png" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-amber-100 hover:bg-amber-200"><i class="ph ph-image mr-1"></i> บันทึกรูปภาพ</button>
                <button id="pv-print" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg"><i class="ph ph-printer mr-1"></i> พิมพ์ / บันทึก PDF</button>`,
            onOpen: () => {
                const sel = UI.$('pv-orient');
                sel.value = orientation;
                sel.onchange = () => { orientation = sel.value; render(); };
                const rng = UI.$('pv-scale');
                rng.oninput = () => {
                    scale = Number(rng.value);
                    UI.$('pv-scale-label').innerText = Math.round(scale * 100) + '%';
                    render();
                };
                UI.$('pv-print').onclick = () => UI.print(buildHtml(), orientation, scale);
                UI.$('pv-png').onclick = () => UI.exportPng(UI.$('preview-paper'), title);
                render();
            }
        });
    };

    /* ส่งออกรูปภาพ (ใช้ html2canvas ถ้าโหลดสำเร็จ) */
    UI.exportPng = function (node, filename) {
        if (typeof window.html2canvas !== 'function') {
            UI.notify('ยังโหลดตัวช่วยสร้างรูปภาพไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต', 'warn');
            return;
        }
        UI.notify('กำลังสร้างไฟล์รูปภาพ...', 'info');
        window.html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = (filename || 'ตารางสอน') + '.png';
            a.click();
            UI.notify('บันทึกรูปภาพแล้ว');
        }).catch(e => {
            console.error(e);
            UI.notify('สร้างรูปภาพไม่สำเร็จ', 'error');
        });
    };

    /* ส่งออก Excel — SheetJS รองรับข้อความภาษาไทยเต็มรูปแบบ
       sheets = [{ name, rows:[[...]] }] */
    UI.exportExcel = function (sheets, filename) {
        if (typeof window.XLSX === 'undefined') {
            UI.notify('ยังโหลดตัวช่วยส่งออก Excel ไม่สำเร็จ', 'error');
            return;
        }
        const wb = XLSX.utils.book_new();
        sheets.forEach(sh => {
            const ws = XLSX.utils.aoa_to_sheet(sh.rows);
            /* กว้างพอให้ชื่อไทยไม่ถูกตัด */
            const widths = [];
            sh.rows.forEach(r => r.forEach((c, i) => {
                const len = String(c === null || c === undefined ? '' : c).length;
                widths[i] = Math.max(widths[i] || 8, Math.min(40, len + 4));
            }));
            ws['!cols'] = widths.map(w => ({ wch: w }));
            XLSX.utils.book_append_sheet(wb, ws, (sh.name || 'Sheet').slice(0, 30));
        });
        XLSX.writeFile(wb, (filename || 'รายงาน') + '.xlsx');
        UI.notify('ส่งออกไฟล์ Excel แล้ว');
    };

    /* ------------------------------------------------------------ ตัวช่วยอื่น ๆ */

    /* ตัวกรองข้อความในตาราง : ซ่อนแถวที่ไม่ตรงคำค้น */
    UI.wireSearch = function (inputId, rowSelector) {
        const input = UI.$(inputId);
        if (!input) return;
        input.oninput = () => {
            const q = input.value.trim().toLowerCase();
            document.querySelectorAll(rowSelector).forEach(row => {
                row.style.display = !q || row.innerText.toLowerCase().includes(q) ? '' : 'none';
            });
        };
    };

    /* สีตัวอักษรที่อ่านง่ายบนสีพื้นที่กำหนด */
    UI.textOn = function (hex) {
        const c = String(hex || '#ffffff').replace('#', '');
        if (c.length < 6) return '#1e293b';
        const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1e293b' : '#ffffff';
    };
})();
