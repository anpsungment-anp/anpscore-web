/* ANPSCORE — จัดการบุคลากร ห้องเรียน รายวิชา และตั้งค่าระบบ
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

window.showLoginHistory = function(teacherId) {
    const t = DB.teachers.find(x => x.id === teacherId);
    if(!t) return;
    
    let histHtml = '';
    if(t.loginHistory && t.loginHistory.length > 0) {
        histHtml = `<ul class="space-y-3">`;
        t.loginHistory.forEach((h, i) => {
            histHtml += `<li class="text-sm p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center shadow-sm font-medium text-slate-600"><i class="ph ph-sign-in mr-3 text-indigo-500 text-xl bg-white p-1.5 rounded-lg shadow-sm border border-slate-100"></i>เข้าสู่ระบบเมื่อ: <span class="ml-2 text-slate-800 font-bold">${new Date(h.time).toLocaleString('th-TH')}</span></li>`;
        });
        histHtml += `</ul>`;
    } else {
        histHtml = `<div class="text-slate-400 text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 font-medium"><i class="ph ph-clock text-4xl mb-3 opacity-50"></i><br>ไม่มีประวัติการเข้าระบบ</div>`;
    }

    let tAvatarHtml = t.picUrl 
        ? `<img src="${window.formatImgUrl(t.picUrl)}" class="w-12 h-12 rounded-xl object-cover shadow-inner shrink-0" onerror="this.onerror=null; this.outerHTML='<div class=\\'w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-inner shrink-0\\'>${t.name.charAt(0)}</div>'">`
        : `<div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold shadow-inner shrink-0">${t.name.charAt(0)}</div>`;

    window.showModal(`
        <div class="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
            <div class="flex items-center gap-3">
                ${tAvatarHtml}
                <div>
                    <h3 class="text-xl font-extrabold text-slate-800 leading-tight">ประวัติการใช้งาน</h3>
                    <p class="text-sm font-medium text-slate-500">ครู${t.name}</p>
                </div>
            </div>
            <button onclick="window.hideModal()" class="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-10 h-10 flex items-center justify-center transition-colors"><i class="ph ph-x text-lg"></i></button>
        </div>
        <div class="max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            ${histHtml}
        </div>
        <div class="mt-6 pt-4 border-t border-slate-100 flex justify-end">
            <button onclick="window.hideModal()" class="tactile-btn bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold transition-colors">ปิดหน้าต่าง</button>
        </div>
    `, 'max-w-md');
}

window.otherTermOf = function(term) {
    return String(term) === '2' ? '1' : '2';
}

const hasTermAssignments = (asg) => Object.values(asg || {}).some(classIds => Array.isArray(classIds) && classIds.length > 0);

// Teachers with nothing assigned in `term` (no teaching load and no homeroom) who do have
// something in the other term. A new term starts with every teacher's assignments empty, and
// a teacher with no assignments sees no class to enter scores for.
window.teachersMissingTermAssignments = function(term) {
    const fromTerm = window.otherTermOf(term);
    return (DB.teachers || []).filter(t => {
        const hasTarget = hasTermAssignments(window.getTeacherAssignments(t, term)) || window.getTeacherHomeroomClasses(t, term).length > 0;
        const hasSource = hasTermAssignments(window.getTeacherAssignments(t, fromTerm)) || window.getTeacherHomeroomClasses(t, fromTerm).length > 0;
        return !hasTarget && hasSource;
    });
}

// Copies teaching load and homeroom classes from the other term, only into a term that is
// still empty for that teacher - an assignment the admin already set for this term is never
// overwritten. Scores are not touched: they are stored per term and stay where they are.
window.copyTeacherAssignmentsToTerm = function(toTerm) {
    const fromTerm = window.otherTermOf(toTerm);
    const targets = window.teachersMissingTermAssignments(toTerm);
    targets.forEach(t => {
        if(!t.assignments || (t.assignments["1"] === undefined && t.assignments["2"] === undefined)) {
            const legacy = JSON.parse(JSON.stringify(t.assignments || {}));
            t.assignments = { "1": legacy, "2": JSON.parse(JSON.stringify(legacy)) };
        }
        if(!hasTermAssignments(t.assignments[toTerm])) {
            t.assignments[toTerm] = JSON.parse(JSON.stringify(t.assignments[fromTerm] || {}));
        }
        if(!t.homeroomClasses || Array.isArray(t.homeroomClasses)) {
            const legacy = Array.isArray(t.homeroomClasses) ? t.homeroomClasses.slice() : [];
            t.homeroomClasses = { "1": legacy, "2": legacy.slice() };
        }
        if(!Array.isArray(t.homeroomClasses[toTerm]) || t.homeroomClasses[toTerm].length === 0) {
            t.homeroomClasses[toTerm] = (t.homeroomClasses[fromTerm] || []).slice();
        }
    });
    return targets.length;
}

window.promptCopyTermAssignments = function(term = state.term) {
    const toTerm = String(term);
    const fromTerm = window.otherTermOf(toTerm);
    const targets = window.teachersMissingTermAssignments(toTerm);
    if(targets.length === 0) {
        window.notify(`ครูทุกคนมีภาระงานสอนของเทอม ${toTerm} แล้ว ไม่มีรายการที่ต้องคัดลอก`);
        return;
    }
    if(!confirm(`คัดลอกภาระงานสอนและห้องประจำชั้นจากเทอม ${fromTerm} ไปเทอม ${toTerm} ให้ครู ${targets.length} คน ที่ยังไม่มีภาระงานในเทอม ${toTerm}?\n\nครูที่กำหนดภาระงานเทอม ${toTerm} ไว้แล้วจะไม่ถูกแก้ไข\nคะแนนของทั้งสองเทอมไม่ถูกแตะต้อง`)) return;
    const copied = window.copyTeacherAssignmentsToTerm(toTerm);
    window.saveDB();
    window.notify(`คัดลอกภาระงานสอนไปเทอม ${toTerm} ให้ครู ${copied} คนแล้ว`);
    if(state.activePage) window.navigate(state.activePage);
}

window.renderAdminTeachers = function(container) {
    $('page-title').innerText = 'จัดการครูผู้สอน';
    let html = `
        <div class="modern-card p-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-indigo-50 to-purple-50 border-none relative overflow-hidden animate-fade-in-up">
            <div class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4"><i class="ph ph-users-three text-9xl"></i></div>
            <div class="relative z-10">
                <h3 class="text-2xl font-extrabold text-indigo-900 mb-1">จัดการบัญชีบุคลากร</h3>
                <p class="text-base font-medium text-indigo-700/80">เพิ่มบัญชีใหม่และกำหนดภาระงานสอนสำหรับเทอมปัจจุบัน</p>
            </div>
            <div class="flex flex-col sm:flex-row gap-3 mt-6 md:mt-0 relative z-10">
                <button onclick="window.promptCopyTermAssignments()" class="tactile-btn bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-6 py-3.5 rounded-2xl font-bold shadow-sm flex items-center text-base">
                    <i class="ph ph-copy mr-2 text-xl"></i> คัดลอกภาระงานจากเทอม ${window.otherTermOf(state.term)}
                </button>
                <button onclick="window.editTeacher()" class="tactile-btn bg-primary-gradient text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-indigo-200 flex items-center text-lg">
                    <i class="ph ph-user-plus mr-2 text-2xl"></i> เพิ่มบุคลากรใหม่
                </button>
            </div>
        </div>
        <div class="modern-card overflow-hidden animate-fade-in-up stagger-1">
            <div class="overflow-x-auto custom-scrollbar relative">
                <table class="w-full text-left min-w-[900px]">
                    <thead class="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th class="p-5 font-extrabold text-slate-600 uppercase text-xs tracking-wider w-1/4">ข้อมูลผู้สอน</th>
                            <th class="p-5 font-extrabold text-slate-600 uppercase text-xs tracking-wider w-1/6">สถานะบัญชี</th>
                            <th class="p-5 font-extrabold text-slate-600 uppercase text-xs tracking-wider w-auto">วิชาที่รับผิดชอบ (เทอม ${state.term})</th>
                            <th class="p-5 font-extrabold text-slate-600 uppercase text-xs tracking-wider text-center w-36 sticky right-0 bg-slate-50 z-10 shadow-[-4px_0_15px_rgba(0,0,0,0.03)] border-l border-slate-200">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="tb-teachers" class="divide-y divide-slate-100"></tbody>
                </table>
            </div>
        </div>
    `;
    container.innerHTML = html;
    window.updateTeacherTable();
}

window.updateTeacherTable = function() {
    const tb = $('tb-teachers');
    if(!tb) return;
    tb.innerHTML = '';
    if(DB.teachers.length === 0) {
        tb.innerHTML = `<tr><td colspan="4" class="p-12 text-center text-slate-400 bg-slate-50/50 italic font-medium">ยังไม่มีข้อมูลบุคลากรในระบบ</td></tr>`;
        return;
    }
    DB.teachers.forEach(t => {
        let currentTermAsg = window.getTeacherAssignments(t, state.term);
        const homeroomNames = window.getTeacherHomeroomClasses(t, state.term)
            .map(cId => DB.classes[cId] ? DB.classes[cId].name : '')
            .filter(Boolean);
        
        let assigned = Object.keys(currentTermAsg || {}).map(subId => {
            let sName = DB.subjects.find(x => x.id === subId)?.name || 'ไม่ทราบวิชา';
            let cNames = window.sortClassIds(currentTermAsg[subId] || []).map(cid => DB.classes[cid]?.name || '?').join(',');
            return `<span class="inline-flex items-center bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-md border border-indigo-100 font-bold shadow-sm whitespace-nowrap mb-1.5 mr-1.5"><i class="ph ph-book-bookmark mr-1 opacity-70"></i> ${sName} (${cNames})</span>`;
        }).join('');
        if(!assigned) assigned = '<span class="text-slate-400 text-sm italic font-medium flex items-center"><i class="ph ph-warning-circle mr-1"></i>ไม่มีภาระงานในเทอมนี้</span>';

        let avatarHtml = t.picUrl 
            ? `<img src="${window.formatImgUrl(t.picUrl)}" class="w-10 h-10 rounded-full object-cover shadow-inner border border-slate-200 shrink-0" onerror="this.onerror=null; this.outerHTML='<div class=\\'w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold shadow-inner group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors shrink-0\\'>${t.name.charAt(0)}</div>'">`
            : `<div class="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold shadow-inner group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors shrink-0">${t.name.charAt(0)}</div>`;

        tb.innerHTML += `
            <tr class="hover:bg-slate-50/80 transition-colors group">
                <td class="p-5">
                    <div class="flex items-center gap-3">
                        ${avatarHtml}
                        <div>
                            <span class="font-extrabold text-slate-800 text-base">${t.name}</span>
                            ${homeroomNames.length
                                ? `<div class="mt-1 text-xs font-bold text-emerald-700 flex items-center gap-1"><i class="ph ph-house-line"></i> ครูประจำชั้น ${homeroomNames.map(window.escapeHtml).join(', ')}</div>`
                                : `<div class="mt-1 text-xs font-medium text-slate-400">ยังไม่ได้มอบหมายห้องประจำชั้น</div>`}
                        </div>
                    </div>
                </td>
                <td class="p-5 text-sm bg-slate-50/50 rounded-lg">
                    ${t.authUid
                        ? `<div class="px-3 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded inline-flex items-center shadow-sm font-bold"><i class="ph ph-shield-check mr-2"></i>สร้างบัญชีแล้ว</div>`
                        : `<div class="px-3 py-1.5 border border-amber-200 bg-amber-50 text-amber-700 rounded inline-flex items-center shadow-sm font-bold"><i class="ph ph-warning mr-2"></i>ยังไม่มีบัญชี</div>`}
                </td>
                <td class="p-5">
                    <div class="flex flex-wrap gap-1">
                        ${assigned}
                    </div>
                </td>
                <td class="p-4 text-center sticky right-0 bg-white group-hover:bg-slate-50/80 z-10 shadow-[-4px_0_15px_rgba(0,0,0,0.03)] border-l border-slate-100 transition-colors">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="window.showLoginHistory('${t.id}')" class="tactile-btn bg-slate-100 text-slate-600 hover:bg-slate-700 hover:text-white w-9 h-9 rounded-lg flex items-center justify-center transition-all shadow-sm border border-slate-200" title="ประวัติการล็อกอิน"><i class="ph ph-clock-counter-clockwise text-lg"></i></button>
                        <button onclick="window.editTeacher('${t.id}')" class="tactile-btn bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white w-9 h-9 rounded-lg flex items-center justify-center transition-all shadow-sm border border-blue-200" title="แก้ไขข้อมูล"><i class="ph ph-pencil-simple text-lg"></i></button>
                        <button onclick="window.deleteTeacher('${t.id}')" class="tactile-btn bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white w-9 h-9 rounded-lg flex items-center justify-center transition-all shadow-sm border border-rose-200" title="ลบ"><i class="ph ph-trash text-lg"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
}

window.editTeacher = function(id = null) {
    let t = id ? DB.teachers.find(x => x.id === id) : { name: '', authUid: '', picUrl: '', assignments: {}, homeroomClasses: { "1": [], "2": [] } };
    let currentTermAsg = window.getTeacherAssignments(t, state.term);
    const currentHomeroomClasses = window.getTeacherHomeroomClasses(t, state.term);
    
    let globalAssignments = {};
    let globalHomerooms = {};
    DB.teachers.forEach(teacher => {
        if (id && teacher.id === id) return; 
        let termAsg = window.getTeacherAssignments(teacher, state.term);
        if (termAsg) {
            Object.keys(termAsg).forEach(sId => {
                termAsg[sId].forEach(cId => {
                    globalAssignments[`${sId}|${cId}`] = teacher.name;
                });
            });
        }
        window.getTeacherHomeroomClasses(teacher, state.term).forEach(cId => {
            globalHomerooms[cId] = teacher.name;
        });
    });

    let homeroomHtml = `
        <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-200 mb-2">
            <p class="text-sm text-emerald-900 font-extrabold flex items-center">
                <i class="ph ph-house-line mr-2 text-lg text-emerald-600"></i> มอบหมายห้องประจำชั้น
                <span class="bg-emerald-600 text-white px-2 py-0.5 rounded text-xs ml-2 shadow-sm">เทอม ${state.term}</span>
            </p>
            <p class="text-xs text-emerald-700 font-medium mt-1">ใช้กำหนดสิทธิ์ดูรายงานแจ้งผู้ปกครอง ครูจะเห็นเฉพาะห้องที่เลือกไว้ที่นี่</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-4 bg-slate-50 shadow-inner">
            <div class="flex flex-wrap gap-2.5">`;
    if(Object.keys(DB.classes || {}).length === 0) {
        homeroomHtml += '<div class="text-sm text-slate-400 font-medium">ยังไม่มีห้องเรียนในระบบ</div>';
    } else {
        window.getSortedClassEntries().forEach(([cId, cls]) => {
            const checked = currentHomeroomClasses.includes(cId);
            const assignedToOther = globalHomerooms[cId];
            const disabled = assignedToOther ? 'disabled' : '';
            homeroomHtml += `
                <label class="flex items-center text-sm ${assignedToOther ? 'cursor-not-allowed opacity-60 bg-slate-100' : 'cursor-pointer bg-white hover:border-emerald-300'} border border-slate-200 px-3 py-2 rounded-lg transition-colors">
                    <input type="checkbox" name="homeroomClass" value="${window.escapeHtml(cId)}" ${checked ? 'checked' : ''} ${disabled} class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 mr-2 disabled:opacity-50">
                    <span class="font-bold text-slate-700">ห้อง ${window.escapeHtml(cls.name)}</span>
                    ${assignedToOther ? `<span class="ml-2 text-[10px] text-rose-600 font-bold"><i class="ph ph-lock"></i> ครู${window.escapeHtml(assignedToOther)}</span>` : ''}
                </label>`;
        });
    }
    homeroomHtml += '</div></div>';

    let assignHtml = `<div class="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-2 flex items-center justify-between"><p class="text-sm text-indigo-900 font-extrabold flex items-center"><i class="ph ph-briefcase mr-2 text-lg text-indigo-600"></i> มอบหมายงานสอน <span class="bg-indigo-600 text-white px-2 py-0.5 rounded text-xs ml-2 shadow-sm">เทอม ${state.term}</span></p></div><div class="max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-4 bg-slate-50 custom-scrollbar shadow-inner">`;
    if(DB.subjects.length === 0 || Object.keys(DB.classes).length === 0) {
        assignHtml += '<div class="text-center py-6 text-rose-500 font-medium border border-rose-200 border-dashed rounded-xl bg-rose-50/50"><i class="ph ph-warning text-3xl mb-2"></i><br>กรุณาสร้างวิชาและห้องเรียนก่อนทำการมอบหมาย</div>';
    } else {
        DB.subjects.forEach(sub => {
            assignHtml += `<div class="mb-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors"><strong class="text-slate-800 text-base flex items-center mb-3 pb-2 border-b border-slate-100"><i class="ph ph-book-open text-indigo-500 mr-2 text-lg"></i> ${sub.name}</strong><div class="flex flex-wrap gap-2.5">`;
            window.getSortedClassEntries().forEach(([cId, cls]) => {
                let isChk = currentTermAsg[sub.id] && currentTermAsg[sub.id].includes(cId);
                let assignedToOther = globalAssignments[`${sub.id}|${cId}`];
                
                let labelClass = "";
                let onChg = "";
                let inpAttrs = "";
                let spanClass = "";
                let extra = "";

                if (assignedToOther) {
                    labelClass = "flex items-center text-sm cursor-not-allowed bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg opacity-60 grayscale";
                    inpAttrs = "disabled";
                    spanClass = "font-bold text-slate-500";
                    extra = `<span class="ml-1.5 text-[10px] text-rose-600 font-bold leading-none bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 flex items-center shadow-sm"><i class="ph ph-lock mr-0.5"></i>ครู${assignedToOther}</span>`;
                } else {
                    labelClass = isChk 
                        ? "flex items-center text-sm cursor-pointer bg-indigo-50/50 border border-indigo-300 ring-1 ring-indigo-200 px-3 py-2 rounded-lg transition-all select-none"
                        : "flex items-center text-sm cursor-pointer bg-slate-50 border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-lg transition-all select-none";
                    inpAttrs = isChk ? "checked" : "";
                    spanClass = isChk ? "font-bold text-indigo-800" : "font-bold text-slate-600";
                    onChg = `onchange="this.parentElement.className = this.checked ? 'flex items-center text-sm cursor-pointer bg-indigo-50/50 border border-indigo-300 ring-1 ring-indigo-200 px-3 py-2 rounded-lg transition-all select-none' : 'flex items-center text-sm cursor-pointer bg-slate-50 border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-lg transition-all select-none'; this.nextElementSibling.className = this.checked ? 'font-bold text-indigo-800' : 'font-bold text-slate-600';"`;
                }

                assignHtml += `
                <label class="${labelClass}">
                    <input type="checkbox" name="ta" value="${sub.id}|${cId}" ${inpAttrs} class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mr-2 disabled:opacity-50" ${onChg}>
                    <span class="${spanClass}">ห้อง ${cls.name}</span>
                    ${extra}
                </label>`;
            });
            assignHtml += `</div></div>`;
        });
    }
    assignHtml += '</div>';

    window.showModal(`
        <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h3 class="text-2xl font-extrabold text-slate-800 flex items-center"><div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mr-3 shadow-inner"><i class="ph ${id ? 'ph-pencil-simple' : 'ph-user-plus'} text-xl"></i></div> ${id ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากรใหม่'}</h3>
            <button onclick="window.hideModal()" class="text-slate-400 hover:text-rose-500 bg-slate-100 hover:bg-rose-50 rounded-full w-10 h-10 flex items-center justify-center transition-all"><i class="ph ph-x text-xl"></i></button>
        </div>
        <form id="form-teacher" onsubmit="event.preventDefault(); window.saveTeacher('${id || ''}')" class="space-y-5">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label class="block text-sm font-extrabold text-slate-700 mb-1.5 ml-1">ชื่อ-สกุล</label>
                    <div class="relative">
                        <i class="ph ph-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                        <input type="text" id="mt-name" value="${t.name}" class="w-full border border-slate-200 rounded-xl p-3.5 pl-11 focus-ring font-bold text-slate-800 bg-slate-50 focus:bg-white transition-colors" placeholder="เช่น น.ส. สมหญิง ใจดี" required>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-extrabold text-slate-700 mb-1.5 ml-1">${id ? 'บัญชีเข้าใช้งาน' : 'รหัสผ่านเริ่มต้น'}</label>
                    ${id ? `
                    <div class="flex items-start gap-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50 text-sm font-medium text-slate-600">
                        <i class="ph ${t.authUid ? 'ph-shield-check text-emerald-600' : 'ph-warning text-amber-500'} text-lg shrink-0"></i>
                        <span>${t.authUid
                            ? 'สร้างบัญชีแล้ว ครูเปลี่ยนรหัสผ่านเองได้ที่หน้าตั้งค่าโปรไฟล์'
                            : 'ยังไม่มีบัญชี ให้ไปที่ ตั้งค่าและสำรองข้อมูล แล้วกดสร้างบัญชีให้ครู'}</span>
                    </div>` : `
                    <div class="relative">
                        <i class="ph ph-lock-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                        <input type="password" id="mt-pwd" value="" autocomplete="new-password" minlength="6" class="w-full border border-slate-200 rounded-xl p-3.5 pl-11 focus-ring font-mono font-bold text-slate-800 bg-slate-50 focus:bg-white transition-colors" placeholder="อย่างน้อย 6 ตัวอักษร" required>
                    </div>
                    <p class="mt-1.5 ml-1 text-xs text-slate-500">ระบบจะสร้างบัญชีให้อัตโนมัติ แจ้งรหัสนี้ให้ครูแล้วให้เปลี่ยนเองภายหลัง</p>`}
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-extrabold text-slate-700 mb-1.5 ml-1">ลิงก์รูปประจำตัว (Google Drive หรือ URL)</label>
                    <div class="relative">
                        <i class="ph ph-image absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                        <input type="text" id="mt-pic" value="${t.picUrl || ''}" class="w-full border border-slate-200 rounded-xl p-3.5 pl-11 focus-ring font-medium text-slate-800 bg-slate-50 focus:bg-white transition-colors" placeholder="วางลิงก์รูปภาพที่นี่ (สามารถเว้นว่างได้)">
                    </div>
                </div>
            </div>
            
            <div class="pt-2">
                ${homeroomHtml}
            </div>

            <div class="pt-2">
                ${assignHtml}
            </div>
            
            <div class="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onclick="window.hideModal()" class="tactile-btn px-6 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">ยกเลิก</button>
                <button type="submit" class="tactile-btn px-8 py-3.5 rounded-xl font-bold text-white bg-primary-gradient shadow-lg shadow-indigo-200 flex items-center"><i class="ph ph-floppy-disk mr-2 text-xl"></i> บันทึกข้อมูล</button>
            </div>
        </form>
    `, 'max-w-3xl');
}

window.saveTeacher = async function(id) {
    const name = $('mt-name').value.trim();
    const pwdEl = $('mt-pwd');
    const pwd = pwdEl ? pwdEl.value.trim() : '';
    const pic = $('mt-pic').value.trim();
    const asgForTerm = {};
    document.querySelectorAll('input[name="ta"]:checked').forEach(cb => {
        let [s, c] = cb.value.split('|');
        if(!asgForTerm[s]) asgForTerm[s] = [];
        asgForTerm[s].push(c);
    });
    const homeroomForTerm = window.sortClassIds(
        Array.from(document.querySelectorAll('input[name="homeroomClass"]:checked')).map(cb => cb.value)
    );

    if(id) {
        let t = DB.teachers.find(x => x.id === id);
        // ผู้ดูแลระบบเปลี่ยนรหัสผ่านของครูจากหน้าเว็บไม่ได้แล้ว
        // ครูเปลี่ยนเองที่หน้าโปรไฟล์ หรือใช้ tools/anpscore-admin.mjs
        t.name = name; t.picUrl = pic;
        
        if (!t.assignments) t.assignments = {};
        if (t.assignments["1"] === undefined && t.assignments["2"] === undefined) {
            let oldAsg = JSON.parse(JSON.stringify(t.assignments));
            t.assignments = { "1": oldAsg, "2": oldAsg }; 
        }
        
        t.assignments[state.term] = asgForTerm;
        if(!t.homeroomClasses || Array.isArray(t.homeroomClasses)) {
            const oldClasses = Array.isArray(t.homeroomClasses) ? t.homeroomClasses.slice() : [];
            t.homeroomClasses = { "1": oldClasses, "2": oldClasses };
        }
        t.homeroomClasses[state.term] = homeroomForTerm;
        window.notify('อัปเดตข้อมูลครูแล้ว');
    } else {
        let newAsg = { "1": {}, "2": {} };
        newAsg[state.term] = asgForTerm;
        let newHomeroomClasses = { "1": [], "2": [] };
        newHomeroomClasses[state.term] = homeroomForTerm;
        const minLen = (window.anpAuth && window.anpAuth.MIN_PASSWORD_LENGTH) || 6;
        if(!window.anpAuth) return window.notify('ระบบยังเชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', true);
        if(pwd.length < minLen) return window.notify(`รหัสผ่านต้องยาวอย่างน้อย ${minLen} ตัวอักษร`, true);

        // สร้างบัญชี Firebase Auth ก่อน ถ้าไม่สำเร็จก็ไม่เพิ่มครูเข้าฐานข้อมูล
        // จะได้ไม่มีครูที่มีชื่อในระบบแต่ล็อกอินไม่ได้
        const newId = generateId();
        let authUid = '';
        try {
            authUid = await window.anpAuth.createAccount(window.anpAuth.teacherEmail(newId), pwd);
            await window.anpAuth.writeRole(authUid, { role: 'teacher', teacherId: newId, displayName: name });
        } catch(err) {
            return window.notify('สร้างบัญชีเข้าใช้งานไม่สำเร็จ: ' + window.anpAuth.describeAuthError(err), true);
        }

        DB.teachers.push({ id: newId, name, authUid, picUrl: pic, assignments: newAsg, homeroomClasses: newHomeroomClasses, lastActive: 0, loginHistory: [] });
        window.notify('เพิ่มครูใหม่และสร้างบัญชีเข้าใช้งานแล้ว');
    }
    window.saveDB();
    window.syncPublicDirectory();
    window.hideModal();
    window.updateTeacherTable();
}

// ย้ายครูที่ยังไม่มีบัญชี ไปเป็นบัญชี Firebase Auth ทีละคน
// กดซ้ำได้ ครูที่สำเร็จแล้วจะถูกข้าม จึงแก้เฉพาะคนที่ยังค้างได้
window.provisionTeacherAccounts = async function() {
    if(!state.user || state.user.role !== 'admin') return;
    if(!window.anpAuth) return window.notify('ระบบยังเชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', true);

    const pending = DB.teachers.filter(t => !t.authUid);
    const box = $('provision-result');
    if(!pending.length) {
        if(box) box.innerHTML = `<div class="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 font-bold flex items-center gap-2"><i class="ph ph-check-circle text-xl"></i> ครูทุกคนมีบัญชีเข้าใช้งานแล้ว</div>`;
        return;
    }

    const btn = $('provision-btn');
    if(btn) { btn.disabled = true; btn.classList.add('opacity-60', 'cursor-not-allowed'); }

    const results = [];
    for(let i = 0; i < pending.length; i++) {
        const t = pending[i];
        if(box) box.innerHTML = `<div class="bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-slate-700 flex items-center gap-2"><i class="ph ph-spinner-gap animate-spin text-xl"></i> กำลังสร้างบัญชี ${i + 1} / ${pending.length} — ${window.escapeHtml(t.name)}</div>`;

        const email = window.anpAuth.teacherEmail(t.id);
        const legacy = String(t.password || '');
        // รหัสผ่านเดิมที่สั้นกว่าที่ Firebase ยอมรับ ต้องสุ่มให้ใหม่
        const useGenerated = legacy.length < window.anpAuth.MIN_PASSWORD_LENGTH;
        const pwd = useGenerated ? window.anpAuth.generatePassword() : legacy;

        try {
            let uid;
            try {
                uid = await window.anpAuth.createAccount(email, pwd);
            } catch(err) {
                // เคยสร้างค้างไว้จากรอบก่อน ให้หา uid เดิมมาใช้ต่อ
                if(err && err.code === 'auth/email-already-in-use') uid = await window.anpAuth.lookupAccountUid(email, pwd);
                else throw err;
            }
            await window.anpAuth.writeRole(uid, { role: 'teacher', teacherId: t.id, displayName: t.name });
            t.authUid = uid;
            delete t.password;
            results.push({ name: t.name, ok: true, password: useGenerated ? pwd : '' });
        } catch(err) {
            results.push({ name: t.name, ok: false, message: window.anpAuth.describeAuthError(err) });
        }
    }

    window.saveDB();
    window.syncPublicDirectory();

    const ok = results.filter(r => r.ok);
    const failed = results.filter(r => !r.ok);
    const changed = ok.filter(r => r.password);

    let html = `<div class="rounded-xl border ${failed.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'} p-4">
        <div class="font-extrabold ${failed.length ? 'text-amber-800' : 'text-emerald-800'} flex items-center gap-2 mb-2">
            <i class="ph ${failed.length ? 'ph-warning' : 'ph-check-circle'} text-xl"></i>
            สร้างบัญชีสำเร็จ ${ok.length} คน${failed.length ? ` ไม่สำเร็จ ${failed.length} คน` : ''}
        </div>`;

    if(changed.length) {
        html += `<div class="mt-3 bg-white border border-amber-300 rounded-lg p-4">
            <div class="font-extrabold text-amber-800 mb-1 flex items-center gap-2"><i class="ph ph-key text-lg"></i> รหัสผ่านใหม่ที่ต้องแจ้งครู</div>
            <p class="text-xs text-slate-600 font-medium mb-3">รหัสผ่านเดิมสั้นเกินกว่าที่ระบบยอมรับ จึงตั้งให้ใหม่ หน้านี้จะแสดงรหัสเพียงครั้งเดียว กรุณาจดไว้ก่อนปิด</p>
            <div class="space-y-1.5">${changed.map(r => `<div class="flex items-center justify-between gap-3 bg-slate-50 rounded px-3 py-2 text-sm"><span class="font-bold text-slate-700">${window.escapeHtml(r.name)}</span><code class="font-mono font-extrabold text-slate-900 tracking-wider">${window.escapeHtml(r.password)}</code></div>`).join('')}</div>
        </div>`;
    }

    if(failed.length) {
        html += `<div class="mt-3 space-y-1.5">${failed.map(r => `<div class="bg-white border border-rose-200 rounded px-3 py-2 text-sm"><span class="font-bold text-rose-700">${window.escapeHtml(r.name)}</span> <span class="text-slate-600">— ${window.escapeHtml(r.message || '')}</span></div>`).join('')}</div>`;
    }

    html += `</div>`;
    if(box) box.innerHTML = html;

    if(btn) { btn.disabled = false; btn.classList.remove('opacity-60', 'cursor-not-allowed'); }
    window.notify(failed.length ? `สร้างบัญชีสำเร็จ ${ok.length} คน ไม่สำเร็จ ${failed.length} คน` : `สร้างบัญชีให้ครู ${ok.length} คนเรียบร้อย`, failed.length > 0);
}

// รายชื่อครูสำหรับหน้าล็อกอิน ต้องตามข้อมูลจริงเสมอ
// กฎของ Firestore ยอมให้ผู้ดูแลระบบเท่านั้นที่เขียนได้
window.syncPublicDirectory = function() {
    if(!window.anpAuth || !state.user || state.user.role !== 'admin') return;
    window.anpAuth.writePublicDirectory(DB.teachers)
        .catch(err => console.warn('อัปเดตรายชื่อครูสำหรับหน้าล็อกอินไม่สำเร็จ', err));
}

window.deleteTeacher = function(id) {
    window.showCustomConfirm('ยืนยันการลบ', 'ยืนยันการลบครูท่านนี้หรือไม่?', 'danger', () => {
        const removed = DB.teachers.find(x => x.id === id);
        DB.teachers = DB.teachers.filter(x => x.id !== id);
        // ลบบัญชี Firebase Auth จากเบราว์เซอร์ไม่ได้ จึงปิดสิทธิ์ไว้แทน
        // บัญชีจะล็อกอินได้แต่เข้าถึงข้อมูลไม่ได้เลย
        if(removed && removed.authUid && window.anpAuth) {
            window.anpAuth.setRoleActive(removed.authUid, false)
                .catch(err => console.warn('ปิดสิทธิ์บัญชีไม่สำเร็จ', err));
        }
        window.saveDB();
        window.syncPublicDirectory();
        window.updateTeacherTable();
        window.notify('ลบครูสำเร็จ');
    });
}

window.cloneData = function(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

window.inferStudentGenderRank = function(student) {
    const name = String((student && student.name) || '').replace(/\s+/g, '');
    if(/^(เด็กชาย|ด\.ช\.|นาย|Mr\.?)/i.test(name)) return 0;
    if(/^(เด็กหญิง|ด\.ญ\.|นางสาว|น\.ส\.|นาง|Miss|Ms\.?|Mrs\.?)/i.test(name)) return 1;
    return 2;
}

window.compareStudentIds = function(a, b) {
    const aId = String((a && a.studentId) || '').trim();
    const bId = String((b && b.studentId) || '').trim();
    const aNum = /^\d+$/.test(aId) ? Number(aId) : null;
    const bNum = /^\d+$/.test(bId) ? Number(bId) : null;
    if(aNum !== null && bNum !== null && aNum !== bNum) return aNum - bNum;
    return aId.localeCompare(bId, 'th', { numeric: true, sensitivity: 'base' });
}

window.compareStudentsForRoomNumber = function(a, b) {
    const genderDiff = window.inferStudentGenderRank(a) - window.inferStudentGenderRank(b);
    if(genderDiff !== 0) return genderDiff;
    const idDiff = window.compareStudentIds(a, b);
    if(idDiff !== 0) return idDiff;
    return String((a && a.name) || '').localeCompare(String((b && b.name) || ''), 'th', { sensitivity: 'base' });
}

window.sortClassStudents = function(cId) {
    const cls = DB.classes[cId];
    if(!cls || !Array.isArray(cls.students)) return;
    cls.students.sort(window.compareStudentsForRoomNumber);
}

window.parseClassSortParts = function(name) {
    const raw = String(name || '').replace(/^ห้อง\s*/i, '').trim();
    const clean = raw.replace(/\s+/g, '');
    const fallback = { levelRank: 99, grade: 999, room: 999, raw };
    const patterns = [
        { rank: 0, rx: /^(อ\.?|อนุบาล)(\d+)(?:\/(\d+))?/i },
        { rank: 1, rx: /^(ป\.?|ประถม(?:ศึกษา)?)(\d+)(?:\/(\d+))?/i },
        { rank: 2, rx: /^(ม\.?|มัธยม(?:ศึกษา)?)(\d+)(?:\/(\d+))?/i }
    ];
    for(const item of patterns) {
        const match = clean.match(item.rx);
        if(match) {
            return {
                levelRank: item.rank,
                grade: Number(match[2] || 999),
                room: Number(match[3] || 999),
                raw
            };
        }
    }
    const numeric = clean.match(/^(\d+)(?:\/(\d+))?/);
    if(numeric) {
        return {
            levelRank: 50,
            grade: Number(numeric[1] || 999),
            room: Number(numeric[2] || 999),
            raw
        };
    }
    return fallback;
}

window.compareClassEntries = function(a, b) {
    const aParts = window.parseClassSortParts((a[1] && a[1].name) || '');
    const bParts = window.parseClassSortParts((b[1] && b[1].name) || '');
    if(aParts.levelRank !== bParts.levelRank) return aParts.levelRank - bParts.levelRank;
    if(aParts.grade !== bParts.grade) return aParts.grade - bParts.grade;
    if(aParts.room !== bParts.room) return aParts.room - bParts.room;
    const nameDiff = aParts.raw.localeCompare(bParts.raw, 'th', { numeric: true, sensitivity: 'base' });
    if(nameDiff !== 0) return nameDiff;
    return String(a[0]).localeCompare(String(b[0]), 'th', { numeric: true, sensitivity: 'base' });
}

window.getSortedClassEntries = function(classIds = null) {
    let entries = Object.entries(DB.classes || {});
    if(Array.isArray(classIds)) {
        const allowed = new Set(classIds.map(id => String(id)));
        entries = entries.filter(([cId]) => allowed.has(String(cId)));
    }
    return entries.sort(window.compareClassEntries);
}

window.sortClassIds = function(classIds = []) {
    if(!Array.isArray(classIds)) return [];
    const order = new Map(window.getSortedClassEntries(classIds).map(([cId], idx) => [String(cId), idx]));
    return classIds.slice().sort((a, b) => {
        const aRank = order.has(String(a)) ? order.get(String(a)) : 999999;
        const bRank = order.has(String(b)) ? order.get(String(b)) : 999999;
        if(aRank !== bRank) return aRank - bRank;
        return String(a).localeCompare(String(b), 'th', { numeric: true, sensitivity: 'base' });
    });
}

window.countClassStudentId = function(cId, studentId) {
    const cls = DB.classes[cId];
    if(!cls || !Array.isArray(cls.students)) return 0;
    const id = String(studentId || '').trim();
    return cls.students.filter(stu => String((stu && stu.studentId) || '').trim() === id).length;
}

window.countAllScoreRecords = function(subjectData = window.DB_SubjectData) {
    let count = 0;
    Object.values(subjectData || {}).forEach(sd => {
        if(!sd || !sd.scores || typeof sd.scores !== 'object') return;
        Object.values(sd.scores).forEach(classScores => {
            if(classScores && typeof classScores === 'object') count += Object.keys(classScores).length;
        });
    });
    return count;
}

window.getStudentMoveSummary = function(fromCId, toCId, studentId) {
    const summary = {
        movedSubjectIds: [],
        targetScoreConflicts: [],
        scoreBackup: {},
        scoreRecordCount: window.countAllScoreRecords()
    };
    const id = String(studentId || '').trim();
    Object.entries(window.DB_SubjectData || {}).forEach(([subId, sd]) => {
        if(!sd || !sd.scores || typeof sd.scores !== 'object') return;
        const sourceScores = sd.scores[fromCId];
        const targetScores = sd.scores[toCId];
        if(sourceScores && Object.prototype.hasOwnProperty.call(sourceScores, id)) {
            summary.movedSubjectIds.push(subId);
            summary.scoreBackup[subId] = window.cloneData(sourceScores[id]);
            if(targetScores && Object.prototype.hasOwnProperty.call(targetScores, id)) {
                summary.targetScoreConflicts.push(subId);
            }
        }
    });
    return summary;
}

window.recordStudentMoveBackup = function(payload) {
    try {
        const key = 'anpscore_student_move_backups';
        let backups = [];
        try { backups = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { backups = []; }
        backups.unshift(payload);
        localStorage.setItem(key, JSON.stringify(backups.slice(0, 20)));
    } catch(e) {
        console.warn('Could not write student move backup:', e);
    }
}

window.showMoveStudentModal = function(fromCId, studentId) {
    const sourceClass = DB.classes[fromCId];
    if(!sourceClass) { window.notify('ไม่พบห้องต้นทาง', true); return; }
    const id = String(studentId || '').trim();
    const student = (sourceClass.students || []).find(stu => String((stu && stu.studentId) || '').trim() === id);
    if(!student) { window.notify('ไม่พบนักเรียนในห้องต้นทาง', true); return; }

    const duplicateSourceCount = window.countClassStudentId(fromCId, id);
    const targetOptions = window.getSortedClassEntries()
        .filter(([cId]) => cId !== fromCId);

    if(targetOptions.length === 0) {
        window.notify('ยังไม่มีห้องปลายทางให้ย้าย', true);
        return;
    }
    window.currentStudentMoveContext = { fromCId, studentId: id };

    const html = `
        <div class="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                    <i class="ph ph-arrows-left-right text-2xl"></i>
                </div>
                <div>
                    <h3 class="text-2xl font-extrabold text-slate-800">ย้ายห้องนักเรียน</h3>
                    <p class="text-sm text-slate-500 font-medium">ย้ายรายชื่อพร้อมคะแนนของนักเรียนคนนี้เท่านั้น</p>
                </div>
            </div>
            <button onclick="window.hideModal()" class="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-10 h-10 flex items-center justify-center transition-colors"><i class="ph ph-x text-xl"></i></button>
        </div>

        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
            <div class="text-xs font-black text-slate-400 uppercase tracking-wide mb-2">นักเรียนที่เลือก</div>
            <div class="font-extrabold text-slate-800 text-lg">${window.escapeHtml(student.name)}</div>
            <div class="text-sm text-slate-500 font-bold mt-1">รหัส ${window.escapeHtml(id)} • ห้องเดิม ${window.escapeHtml(sourceClass.name || '')}</div>
            ${duplicateSourceCount > 1 ? '<div class="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 font-bold">พบรหัสนักเรียนซ้ำในห้องเดิม ระบบจะไม่ให้ย้ายเพื่อป้องกันคะแนนสับสน</div>' : ''}
        </div>

        <label class="block text-sm font-extrabold text-slate-700 mb-2">เลือกห้องปลายทาง</label>
        <select id="move-student-target" onchange="window.updateMoveStudentPreview()" class="w-full border border-slate-200 rounded-xl p-3.5 bg-white font-bold text-slate-800 focus-ring mb-4">
            ${targetOptions.map(([cId, cls]) => `<option value="${window.escapeHtml(cId)}">${window.escapeHtml(cls.name || '')}</option>`).join('')}
        </select>

        <div id="move-student-preview" class="mb-5"></div>

        <div class="flex gap-3 justify-end pt-4 border-t border-slate-100">
            <button type="button" onclick="window.hideModal()" class="tactile-btn px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">ยกเลิก</button>
            <button type="button" onclick="window.confirmMoveStudent()" class="tactile-btn px-6 py-3 rounded-xl font-black text-white bg-primary-gradient shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed" ${duplicateSourceCount > 1 ? 'disabled' : ''}>
                <i class="ph ph-arrow-square-out mr-2"></i> ย้ายห้อง
            </button>
        </div>
    `;
    window.showModal(html, 'max-w-xl');
    setTimeout(() => window.updateMoveStudentPreview(fromCId, id), 50);
}

window.showMoveStudentModalFromButton = function(button) {
    if(!button || !button.dataset) return;
    window.showMoveStudentModal(button.dataset.classId || '', button.dataset.studentId || '');
}

window.updateMoveStudentPreview = function(fromCId = null, studentId = null) {
    if(!fromCId && window.currentStudentMoveContext) fromCId = window.currentStudentMoveContext.fromCId;
    if(!studentId && window.currentStudentMoveContext) studentId = window.currentStudentMoveContext.studentId;
    const el = document.getElementById('move-student-preview');
    const targetEl = document.getElementById('move-student-target');
    if(!el || !targetEl) return;
    const toCId = targetEl.value;
    const targetClass = DB.classes[toCId];
    const summary = window.getStudentMoveSummary(fromCId, toCId, studentId);
    const targetDuplicateCount = window.countClassStudentId(toCId, studentId);
    const hasProblem = targetDuplicateCount > 0 || summary.targetScoreConflicts.length > 0;
    const subjectNames = summary.movedSubjectIds
        .map(subId => (DB.subjects.find(sub => sub.id === subId) || {}).name || subId)
        .slice(0, 5)
        .map(name => window.escapeHtml(name));
    const subjectText = summary.movedSubjectIds.length
        ? `${summary.movedSubjectIds.length} วิชา${subjectNames.length ? `: ${subjectNames.join(', ')}${summary.movedSubjectIds.length > 5 ? '...' : ''}` : ''}`
        : 'ไม่พบคะแนนเดิม ระบบจะย้ายเฉพาะรายชื่อ';

    el.innerHTML = `
        <div class="${hasProblem ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'} border rounded-2xl p-4">
            <div class="font-extrabold flex items-center gap-2 mb-1">
                <i class="ph ${hasProblem ? 'ph-warning-circle' : 'ph-shield-check'} text-xl"></i>
                ${hasProblem ? 'ยังย้ายไม่ได้ เพื่อป้องกันข้อมูลทับ' : 'ตรวจสอบแล้ว ย้ายได้อย่างปลอดภัย'}
            </div>
            <div class="text-sm font-bold leading-relaxed">
                ห้องปลายทาง: ${window.escapeHtml((targetClass && targetClass.name) || '')}<br>
                คะแนนที่จะย้ายตามไป: ${subjectText}
            </div>
            ${targetDuplicateCount > 0 ? '<div class="mt-2 text-sm font-bold">มีรหัสนักเรียนนี้อยู่ในห้องปลายทางแล้ว</div>' : ''}
            ${summary.targetScoreConflicts.length > 0 ? '<div class="mt-2 text-sm font-bold">พบคะแนนรหัสนี้ในห้องปลายทางแล้ว ระบบหยุดเพื่อกันคะแนนถูกเขียนทับ</div>' : ''}
        </div>
    `;
}

window.confirmMoveStudent = function(fromCId = null, studentId = null) {
    if(!fromCId && window.currentStudentMoveContext) fromCId = window.currentStudentMoveContext.fromCId;
    if(!studentId && window.currentStudentMoveContext) studentId = window.currentStudentMoveContext.studentId;
    const targetEl = document.getElementById('move-student-target');
    if(!targetEl) return;
    const toCId = targetEl.value;
    const sourceClass = DB.classes[fromCId];
    const targetClass = DB.classes[toCId];
    if(!sourceClass || !targetClass || fromCId === toCId) { window.notify('ข้อมูลห้องไม่ถูกต้อง', true); return; }
    if(window.countClassStudentId(fromCId, studentId) !== 1) { window.notify('พบรหัสนักเรียนซ้ำในห้องเดิม กรุณาแก้รายชื่อก่อนย้าย', true); return; }
    if(window.countClassStudentId(toCId, studentId) > 0) { window.notify('ห้องปลายทางมีรหัสนักเรียนนี้อยู่แล้ว', true); return; }
    const summary = window.getStudentMoveSummary(fromCId, toCId, studentId);
    if(summary.targetScoreConflicts.length > 0) {
        window.notify('พบคะแนนของรหัสนี้ในห้องปลายทาง ระบบหยุดเพื่อป้องกันข้อมูลทับ', true);
        return;
    }
    const student = (sourceClass.students || []).find(stu => String((stu && stu.studentId) || '').trim() === String(studentId || '').trim());
    const message = `ยืนยันย้าย ${window.escapeHtml(student ? student.name : studentId)}\nจากห้อง ${window.escapeHtml(sourceClass.name || '')} ไปห้อง ${window.escapeHtml(targetClass.name || '')}\n\nคะแนนที่จะย้ายตามไป ${summary.movedSubjectIds.length} วิชา และจะเรียงเลขที่ใหม่อัตโนมัติตามรหัสนักเรียน แยกชาย/หญิง`;
    window.showCustomConfirm('ยืนยันการย้ายห้อง', message, 'warning', () => {
        window.moveStudentWithScores(fromCId, toCId, studentId);
    });
}

window.moveStudentWithScores = function(fromCId, toCId, studentId) {
    const dbBefore = window.cloneData(window.DB);
    const subjectBefore = window.cloneData(window.DB_SubjectData);
    const scoreCountBefore = window.countAllScoreRecords(subjectBefore);
    const id = String(studentId || '').trim();

    try {
        const sourceClass = DB.classes[fromCId];
        const targetClass = DB.classes[toCId];
        if(!sourceClass || !targetClass || fromCId === toCId) throw new Error('invalid class');
        const sourceIndex = (sourceClass.students || []).findIndex(stu => String((stu && stu.studentId) || '').trim() === id);
        if(sourceIndex < 0) throw new Error('student not found');
        if(window.countClassStudentId(fromCId, id) !== 1) throw new Error('duplicate source id');
        if(window.countClassStudentId(toCId, id) > 0) throw new Error('duplicate target id');

        const summary = window.getStudentMoveSummary(fromCId, toCId, id);
        if(summary.targetScoreConflicts.length > 0) throw new Error('target score conflict');

        const student = window.cloneData(sourceClass.students[sourceIndex]);
        window.recordStudentMoveBackup({
            time: Date.now(),
            student,
            fromCId,
            fromClassName: sourceClass.name || '',
            toCId,
            toClassName: targetClass.name || '',
            movedSubjectIds: summary.movedSubjectIds,
            scoreBackup: summary.scoreBackup
        });

        sourceClass.students.splice(sourceIndex, 1);
        targetClass.students.push(student);

        summary.movedSubjectIds.forEach(subId => {
            const sd = window.DB_SubjectData[subId];
            if(!sd.scores[toCId]) sd.scores[toCId] = {};
            sd.scores[toCId][id] = window.cloneData(sd.scores[fromCId][id]);
            delete sd.scores[fromCId][id];
        });

        window.sortClassStudents(fromCId);
        window.sortClassStudents(toCId);

        const scoreCountAfter = window.countAllScoreRecords(window.DB_SubjectData);
        const movedStudentInTarget = window.countClassStudentId(toCId, id) === 1;
        const movedStudentRemovedFromSource = window.countClassStudentId(fromCId, id) === 0;
        const copiedScoresOk = summary.movedSubjectIds.every(subId => {
            const sd = window.DB_SubjectData[subId];
            return sd && sd.scores && sd.scores[toCId] && JSON.stringify(sd.scores[toCId][id]) === JSON.stringify(summary.scoreBackup[subId])
                && (!sd.scores[fromCId] || !Object.prototype.hasOwnProperty.call(sd.scores[fromCId], id));
        });

        if(scoreCountBefore !== scoreCountAfter || !movedStudentInTarget || !movedStudentRemovedFromSource || !copiedScoresOk) {
            window.DB = dbBefore;
            DB = window.DB;
            window.DB_SubjectData = subjectBefore;
            DB_SubjectData = window.DB_SubjectData;
            throw new Error('move validation failed');
        }

        window.saveLocalDB();
        summary.movedSubjectIds.forEach(subId => window.markSubjectDirty(subId));
        // Class lists go up with the core data save
        if(typeof window.firebaseSaveFn === 'function') window.firebaseSaveFn();

        // The moved scores used to be deleted from the old class in the cloud straight away,
        // while nothing ever uploaded them under the new class - the subject was only marked
        // dirty, which writes structure, not score documents. The scores then existed only in
        // this admin's browser and were gone on every other device. Upload the new copy first
        // and remove the old one only once the cloud has confirmed it.
        const movedTargets = summary.movedSubjectIds.map(subId => ({ subId, clsId: toCId, stuId: id }));
        if(movedTargets.length > 0) {
            Promise.resolve(typeof window.firebaseBatchWriteScoreNodes === 'function'
                ? window.firebaseBatchWriteScoreNodes(movedTargets)
                : { attempted: false, failed: movedTargets.length })
                .then(result => {
                    if(!result || !result.attempted || result.failed > 0) throw new Error('moved scores were not confirmed by the cloud');
                    if(typeof window.firebaseDeleteScoreEntry !== 'function') return;
                    return Promise.all(summary.movedSubjectIds.map(subId =>
                        window.firebaseDeleteScoreEntry(subId, fromCId, id).catch(err => console.warn('Old moved score cleanup failed:', err))));
                })
                .catch(err => {
                    console.warn('Moved score upload failed, queued for retry:', err);
                    // The old cloud copy is left in place, so nothing is lost while this retries
                    summary.movedSubjectIds.forEach(subId => window.markScoreClassBundleDirty(subId, toCId));
                    if(typeof window.requestDirtyCloudFlush === 'function') window.requestDirtyCloudFlush(15000);
                    window.notify('ย้ายห้องแล้ว แต่คะแนนของนักเรียนคนนี้ยังขึ้นคลาวด์ไม่ครบ ระบบจะลองส่งใหม่อัตโนมัติ กรุณาอย่าปิดหน้านี้สักครู่', true);
                });
        }
        if(typeof window.classToggleState === 'undefined') window.classToggleState = {};
        window.classToggleState[fromCId] = true;
        window.classToggleState[toCId] = true;
        window.updateClassesList();
        window.notify(`ย้ายห้องสำเร็จ และย้ายคะแนนตามไป ${summary.movedSubjectIds.length} วิชา`);
    } catch(err) {
        console.error(err);
        window.DB = dbBefore;
        DB = window.DB;
        window.DB_SubjectData = subjectBefore;
        DB_SubjectData = window.DB_SubjectData;
        window.saveLocalDB();
        if(typeof window.updateClassesList === 'function') window.updateClassesList();
        window.notify('ย้ายไม่สำเร็จ ระบบคืนข้อมูลเดิมแล้วเพื่อป้องกันข้อมูลหาย', true);
    }
}

window.renderAdminClasses = function(container) {
    $('page-title').innerText = 'จัดการห้องเรียนและนักเรียน';
    let html = `
        <div class="modern-card p-8 mb-8 bg-gradient-to-br from-emerald-500 to-teal-500 text-white border-none relative overflow-hidden animate-fade-in-up shadow-xl shadow-emerald-200/50">
            <div class="absolute -right-10 -bottom-10 opacity-20 transform scale-150"><i class="ph ph-chalkboard-teacher text-[15rem]"></i></div>
            <div class="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div class="w-full md:w-auto">
                    <h3 class="text-2xl font-extrabold mb-1 drop-shadow-sm">สร้างห้องเรียนใหม่</h3>
                    <p class="text-emerald-50 font-medium mb-4 text-sm">เพิ่มห้องเรียนเพื่อเริ่มจัดการข้อมูลนักเรียน</p>
                    <form onsubmit="event.preventDefault(); window.addClass();" class="flex flex-col sm:flex-row gap-3 w-full">
                        <div class="relative flex-1">
                            <i class="ph ph-door absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg z-10"></i>
                            <input type="text" id="inp-class-name" placeholder="ระบุชื่อห้อง เช่น ป.1/1" class="w-full sm:w-64 border-0 rounded-xl p-3.5 pl-11 focus:ring-4 focus:ring-white/30 text-slate-800 font-bold bg-white shadow-inner placeholder-slate-400 transition-all" required>
                        </div>
                        <button type="submit" class="tactile-btn bg-slate-900 hover:bg-black text-white px-8 py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center sm:justify-start whitespace-nowrap"><i class="ph ph-plus-circle mr-2 text-xl"></i> สร้างห้อง</button>
                    </form>
                </div>
                <div class="flex gap-3 w-full md:w-auto justify-end bg-black/10 p-2 rounded-2xl backdrop-blur-sm">
                    <button onclick="window.toggleAllClasses(true)" class="flex-1 md:flex-none tactile-btn bg-white/20 hover:bg-white/30 text-white border border-white/20 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm flex items-center justify-center"><i class="ph ph-arrows-out-line-vertical mr-2"></i> ขยาย</button>
                    <button onclick="window.toggleAllClasses(false)" class="flex-1 md:flex-none tactile-btn bg-white/20 hover:bg-white/30 text-white border border-white/20 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm flex items-center justify-center"><i class="ph ph-arrows-in-line-vertical mr-2"></i> ยุบ</button>
                </div>
            </div>
        </div>
        <div id="list-classes" class="space-y-5"></div>
    `;
    container.innerHTML = html;
    window.updateClassesList();
}

window.toggleAllClasses = function(expand) {
    if (typeof window.classToggleState === 'undefined') window.classToggleState = {};
    Object.keys(DB.classes).forEach(cId => {
        window.classToggleState[cId] = expand;
    });
    window.updateClassesList();
}

window.toggleClass = function(cId) {
    if (typeof window.classToggleState === 'undefined') window.classToggleState = {};
    
    const content = document.getElementById(`content-${cId}`);
    const icon = document.getElementById(`icon-${cId}`);
    const header = document.getElementById(`header-${cId}`);
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.classList.remove('ph-caret-right');
        icon.classList.add('ph-caret-down');
        header.classList.add('bg-slate-50', 'border-b', 'border-slate-100');
        window.classToggleState[cId] = true;
    } else {
        content.classList.add('hidden');
        icon.classList.remove('ph-caret-down');
        icon.classList.add('ph-caret-right');
        header.classList.remove('bg-slate-50', 'border-b', 'border-slate-100');
        window.classToggleState[cId] = false;
    }
}

window.addClass = function() {
    const name = $('inp-class-name').value.trim();
    const id = generateId();
    DB.classes[id] = { name, students: [] };
    
    if (typeof window.classToggleState === 'undefined') window.classToggleState = {};
    window.classToggleState[id] = true; 
    
    window.saveDB();
    $('inp-class-name').value = '';
    window.updateClassesList();
    window.notify('สร้างห้องเรียนสำเร็จ');
}

window.updateClassesList = function() {
    const cont = $('list-classes');
    if(!cont) return;
    cont.innerHTML = '';
    if(Object.keys(DB.classes).length === 0) {
        cont.innerHTML = `<div class="text-center p-16 text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed animate-fade-in-up shadow-sm">
            <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><i class="ph ph-door text-5xl text-slate-300"></i></div>
            <p class="text-lg font-bold text-slate-500">ยังไม่มีข้อมูลห้องเรียน</p>
            <p class="text-sm mt-1">กรุณาสร้างห้องเรียนด้านบนเพื่อเริ่มต้น</p>
        </div>`;
        return;
    }

    if (typeof window.classToggleState === 'undefined') {
        window.classToggleState = {};
    }

    let delay = 0;
    window.getSortedClassEntries().forEach(([cId, cls]) => {
        let isExpanded = window.classToggleState[cId] || false;
        let contentClass = isExpanded ? '' : 'hidden';
        let iconClass = isExpanded ? 'ph-caret-down' : 'ph-caret-right';
        let headerActiveBg = isExpanded ? 'bg-slate-50 border-b border-slate-100' : '';

        let stuHtml = cls.students.length ? `
            <div class="overflow-x-auto border border-slate-200 rounded-xl mt-4 shadow-sm bg-white relative">
                <table class="w-full text-left text-sm min-w-max">
                    <thead class="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th class="p-3.5 w-16 text-center text-slate-500 font-extrabold uppercase text-[11px] tracking-wider">เลขที่</th>
                            <th class="p-3.5 w-32 text-slate-500 font-extrabold uppercase text-[11px] tracking-wider">รหัสประจำตัว</th>
                            <th class="p-3.5 text-slate-500 font-extrabold uppercase text-[11px] tracking-wider">ชื่อ-สกุล</th>
                            <th class="p-3.5 w-28 text-center text-slate-500 font-extrabold uppercase text-[11px] tracking-wider sticky right-0 bg-slate-50 z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.02)] border-l border-slate-200">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${cls.students.map((s, i) => `
                            <tr class="hover:bg-indigo-50/50 transition-colors group">
                                <td class="p-3 text-center text-slate-500 font-medium">${i+1}</td>
                                <td class="p-3 font-mono text-slate-600 text-xs bg-slate-50/50 group-hover:bg-white transition-colors">${window.escapeHtml(s.studentId)}</td>
                                <td class="p-3 font-bold text-slate-700">${window.escapeHtml(s.name)}</td>
                                <td class="p-2 text-center sticky right-0 bg-white group-hover:bg-indigo-50/50 z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.02)] border-l border-slate-100 transition-colors">
                                    <div class="flex items-center justify-center gap-1.5">
                                        <button title="ย้ายห้องพร้อมคะแนน" data-class-id="${window.escapeHtml(cId)}" data-student-id="${window.escapeHtml(String(s.studentId || ''))}" onclick="window.showMoveStudentModalFromButton(this)" class="tactile-btn bg-indigo-50 text-indigo-600 hover:text-white hover:bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center transition-all border border-indigo-200 shadow-sm"><i class="ph ph-arrows-left-right text-lg"></i></button>
                                        <button title="ลบนักเรียน" onclick="window.delStudent('${cId}', ${i})" class="tactile-btn bg-rose-50 text-rose-500 hover:text-white hover:bg-rose-600 w-8 h-8 rounded-lg flex items-center justify-center transition-all border border-rose-200 shadow-sm"><i class="ph ph-trash text-lg"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : `<div class="text-sm text-slate-400 font-medium italic mt-4 bg-slate-50 py-6 text-center rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center"><i class="ph ph-users text-3xl mb-2 text-slate-300"></i>ไม่มีรายชื่อนักเรียน</div>`;

        cont.innerHTML += `
            <div class="modern-card overflow-hidden animate-fade-in-up border border-slate-200" style="animation-delay: ${delay}s">
                <div id="header-${cId}" class="flex justify-between items-center p-5 cursor-pointer select-none transition-colors hover:bg-slate-50 ${headerActiveBg}" onclick="window.toggleClass('${cId}')">
                    <h3 class="text-xl font-extrabold text-slate-800 flex items-center group">
                        <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors shadow-inner border border-slate-200">
                            <i class="ph ${iconClass} text-slate-500 group-hover:text-indigo-600 transition-colors font-bold" id="icon-${cId}"></i>
                        </div>
                        <span class="tracking-tight">ห้อง ${cls.name}</span>
                        <span class="ml-4 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 shadow-sm flex items-center gap-1.5"><i class="ph ph-users"></i> ${cls.students.length} คน</span>
                    </h3>
                    <div class="flex items-center" onclick="event.stopPropagation()">
                        <button onclick="window.delClass('${cId}')" class="text-red-500 hover:bg-red-50 p-2 rounded-lg text-sm mr-2 transition-colors flex items-center"><i class="ph ph-trash mr-1 text-lg"></i> ลบห้อง</button>
                        <label class="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors border border-emerald-100 shadow-sm flex items-center">
                            <i class="ph ph-file-xls mr-1 text-lg"></i> นำเข้า Excel/CSV
                            <input type="file" accept=".csv, .xlsx" class="hidden" onchange="window.importStudents(event, '${cId}')">
                        </label>
                    </div>
                </div>
                <div id="content-${cId}" class="${contentClass} p-5 pt-0 bg-white">
                    ${stuHtml}
                    <form onsubmit="event.preventDefault(); window.addStudent('${cId}')" class="mt-4 flex gap-2">
                        <input type="text" id="add-s-id-${cId}" placeholder="รหัสประจำตัว" class="w-1/3 border border-slate-300 rounded-lg p-2 text-sm focus-ring" required>
                        <input type="text" id="add-s-name-${cId}" placeholder="ชื่อ-นามสกุล" class="flex-1 border border-slate-300 rounded-lg p-2 text-sm focus-ring" required>
                        <button type="submit" class="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg text-sm transition-colors shadow">เพิ่ม</button>
                    </form>
                </div>
            </div>
        `;
        delay += 0.05;
    });
}

window.delClass = function(id) {
    window.showCustomConfirm('ยืนยันการลบห้องเรียน', 'ลบห้องเรียนนี้และรายชื่อนักเรียนทั้งหมดหรือไม่?\n\n<span class="text-rose-600 font-bold">ข้อมูลคะแนนที่เกี่ยวข้องกับห้องนี้จะถูกลบไปด้วย</span>', 'danger', () => {
        delete DB.classes[id];
        window.saveDB(); window.updateClassesList(); window.notify('ลบห้องเรียนแล้ว');
    });
}
window.addStudent = function(cId) {
    const sId = $(`add-s-id-${cId}`).value.trim();
    const name = $(`add-s-name-${cId}`).value.trim();
    DB.classes[cId].students.push({ studentId: sId, name });
    window.sortClassStudents(cId);
    window.saveDB(); window.updateClassesList(); window.notify('เพิ่มนักเรียนแล้ว');
}
window.delStudent = function(cId, idx) {
    window.showCustomConfirm('ยืนยันการลบนักเรียน', 'คุณต้องการลบรายชื่อนักเรียนคนนี้ออกจากห้องเรียนใช่หรือไม่?', 'danger', () => {
        DB.classes[cId].students.splice(idx, 1);
        window.saveDB(); window.updateClassesList();
    });
}

window.processExcelImport = function(file, cId, inputElement) {
    const reader = new FileReader();
    reader.onload = async function(evt) {
        const data = evt.target.result;
        const workbook = XLSX.read(data, {type: 'binary'});
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, {header: 1});
        
        let newStudents = [];
        let count = 0;
        for(let i=0; i<json.length; i++) {
            const row = json[i];
            if(row.length >= 2 && row[0] && row[1] && i > 0) { 
                newStudents.push({ studentId: String(row[0]).trim(), name: String(row[1]).trim() });
                count++;
            }
        }
        
        if(count > 0) {
            DB.classes[cId].students = newStudents;
            window.sortClassStudents(cId);
            if (typeof window.classToggleState === 'undefined') window.classToggleState = {};
            window.classToggleState[cId] = true; 
            window.saveDB();
            window.updateClassesList();
            window.notify(`นำเข้าและเขียนทับรายชื่อสำเร็จ ${count} คน`);
        } else {
            window.notify('ไม่พบข้อมูลนักเรียนในไฟล์', true);
        }
        if(inputElement) inputElement.value = ''; 
    };
    reader.readAsBinaryString(file);
}

window.importStudents = function(e, cId) {
    const file = e.target.files[0];
    const inputEl = e.target;
    if(!file) return;

    const existingCount = DB.classes[cId].students.length;
    if (existingCount > 0) {
        const confirmMsg = `ห้องเรียนนี้มีรายชื่อนักเรียนอยู่แล้ว <span class="font-bold text-rose-600">${existingCount}</span> คน\n\nการนำเข้าไฟล์ใหม่จะ <strong class="text-slate-800">"ลบรายชื่อเดิมและเขียนทับทั้งหมด"</strong>\n\nคุณยืนยันที่จะดำเนินการต่อหรือไม่?`;
        window.showCustomConfirm('ยืนยันการเขียนทับข้อมูล', confirmMsg, 'danger', 
            () => { window.processExcelImport(file, cId, inputEl); },
            () => { inputEl.value = ''; }
        );
    } else {
        window.processExcelImport(file, cId, inputEl);
    }
}

window.renderAdminSubjects = function(container) {
    $('page-title').innerText = 'จัดการรายวิชา';
    let html = `
        <div class="modern-card p-8 mb-8 bg-gradient-to-r from-amber-400 to-orange-500 border-none relative overflow-hidden animate-fade-in-up text-white shadow-xl shadow-amber-200/50">
            <div class="absolute right-0 top-1/2 -translate-y-1/2 opacity-20 transform scale-[2] translate-x-10"><i class="ph ph-books text-9xl"></i></div>
            <div class="relative z-10 w-full md:w-3/4 lg:w-2/3">
                <h3 class="text-2xl font-extrabold mb-1">เพิ่มรายวิชาใหม่ในหลักสูตร</h3>
                <p class="text-amber-50 font-medium mb-6">สร้างรหัสและชื่อวิชา รวมถึงกำหนดหัวหน้ากลุ่มสาระสำหรับเซ็นอนุมัติในรายงาน</p>
                
                <form onsubmit="event.preventDefault(); window.addSubject();" class="flex flex-col md:flex-row gap-3 bg-black/10 p-2.5 rounded-2xl backdrop-blur-sm border border-white/20">
                    <input type="text" id="inp-subj-code" placeholder="รหัสวิชา (ค11101)" class="w-full md:w-1/4 border-0 rounded-xl p-3 focus:ring-4 focus:ring-white/30 text-slate-800 font-bold bg-white/90 placeholder-slate-400" required>
                    <input type="text" id="inp-subj-name" placeholder="ชื่อรายวิชา (คณิตศาสตร์)" class="flex-1 border-0 rounded-xl p-3 focus:ring-4 focus:ring-white/30 text-slate-800 font-bold bg-white/90 placeholder-slate-400" required>
                    <input type="text" id="inp-subj-head" placeholder="หัวหน้ากลุ่มสาระฯ" class="w-full md:w-1/3 border-0 rounded-xl p-3 focus:ring-4 focus:ring-white/30 text-slate-800 font-bold bg-white/90 placeholder-slate-400">
                    <button type="submit" class="tactile-btn bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold shadow-lg whitespace-nowrap flex items-center justify-center"><i class="ph ph-plus-circle mr-2 text-xl"></i> เพิ่ม</button>
                </form>
            </div>
        </div>
        
        <div class="modern-card overflow-hidden animate-fade-in-up stagger-1">
            <div class="overflow-x-auto custom-scrollbar relative">
                <table class="w-full text-left min-w-max">
                    <thead class="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th class="p-5 font-extrabold text-slate-600 uppercase text-xs tracking-wider w-40">รหัสวิชา</th>
                            <th class="p-5 font-extrabold text-slate-600 uppercase text-xs tracking-wider">ชื่อวิชา</th>
                            <th class="p-5 font-extrabold text-slate-600 uppercase text-xs tracking-wider">หัวหน้ากลุ่มสาระฯ</th>
                            <th class="p-5 font-extrabold text-slate-600 uppercase text-xs tracking-wider text-center w-28 sticky right-0 bg-slate-50 z-10 shadow-[-4px_0_15px_rgba(0,0,0,0.03)] border-l border-slate-200">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="list-subjects" class="divide-y divide-slate-100"></tbody>
                </table>
            </div>
        </div>
    `;
    container.innerHTML = html;
    window.updateSubjectList();
}

window.addSubject = function() {
    const code = $('inp-subj-code').value.trim();
    const name = $('inp-subj-name').value.trim();
    const headName = $('inp-subj-head').value.trim();
    const id = generateId();
    DB.subjects.push({ id, code, name, headName });
    DB_SubjectData[id] = { classData: {}, scores: {} };
    if (!window.dirtySubjects) window.dirtySubjects = new Set();
    window.markSubjectDirty(id);
    window.saveDB();
    $('inp-subj-code').value = '';
    $('inp-subj-name').value = '';
    $('inp-subj-head').value = '';
    window.updateSubjectList();
    window.notify('เพิ่มวิชาแล้ว');
}

window.updateSubjectList = function() {
    const tb = $('list-subjects');
    if(!tb) return;
    tb.innerHTML = '';
    if(DB.subjects.length === 0) {
        tb.innerHTML = `<tr><td colspan="4" class="p-16 text-center text-slate-400 bg-slate-50/50 italic font-medium"><div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner"><i class="ph ph-books text-5xl text-slate-300"></i></div>ยังไม่มีข้อมูลรายวิชาในระบบ</td></tr>`;
        return;
    }
    DB.subjects.forEach(s => {
        tb.innerHTML += `
            <tr class="hover:bg-slate-50/80 transition-colors group">
                <td class="p-5 font-mono text-slate-500 font-bold bg-slate-50/50 group-hover:bg-white text-sm transition-colors border-r border-slate-100 border-dashed">${s.code || '-'}</td>
                <td class="p-5 font-extrabold text-slate-800 text-lg">${s.name}</td>
                <td class="p-5 text-slate-600 font-medium flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200"><i class="ph ph-user"></i></div> ${s.headName || '-'}</td>
                <td class="p-4 text-center sticky right-0 bg-white group-hover:bg-slate-50/80 z-10 shadow-[-4px_0_15px_rgba(0,0,0,0.03)] border-l border-slate-100 transition-colors">
                    <button onclick="window.delSubject('${s.id}')" class="tactile-btn text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 w-10 h-10 flex items-center justify-center rounded-xl transition-all mx-auto border border-rose-200 shadow-sm" title="ลบวิชานี้"><i class="ph ph-trash text-xl"></i></button>
                </td>
            </tr>
        `;
    });
}

window.delSubject = function(id) {
    window.showCustomConfirm('ยืนยันการลบรายวิชา', 'ลบรายวิชานี้?\n\n<span class="text-rose-600 font-bold">ข้อมูลโครงสร้างและคะแนนทั้งหมดที่ครูกรอกไว้จะสูญหายทันทีและไม่สามารถกู้คืนได้!</span>', 'danger', () => {
        DB.subjects = DB.subjects.filter(x => x.id !== id);
        delete DB_SubjectData[id];
        if(typeof window.firebaseDeleteSubj === 'function') window.firebaseDeleteSubj(id);
        window.saveDB(); window.updateSubjectList(); window.notify('ลบรายวิชาสำเร็จ');
    });
}

window.renderAdminSettings = function(container) {
    $('page-title').innerText = 'ตั้งค่าโรงเรียน & สำรองข้อมูล';
    const s = DB.schoolInfo;
    const g = DB.gradeSettings;
    const scorePolicy = window.normalizeScoreEntryPolicy(s.scoreEntryPolicy);
    const themeMode = s.themeMode === 'dark' ? 'dark' : 'light';
    
    let html = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up">
        
        <!-- ข้อมูลโรงเรียน -->
        <div class="modern-card overflow-hidden border-t-4 border-indigo-500">
            <div class="p-6 bg-slate-50/50 border-b border-slate-100">
                <h3 class="text-xl font-extrabold text-slate-800 flex items-center"><div class="w-10 h-10 bg-indigo-100 text-indigo-600 flex items-center justify-center rounded-xl mr-3 shadow-inner"><i class="ph ph-buildings text-xl"></i></div> ข้อมูลพื้นฐานโรงเรียน</h3>
                <p class="text-sm text-slate-500 font-medium mt-1 ml-13 pl-13">ข้อมูลนี้จะไปปรากฏบนหัวกระดาษรายงาน ปพ. ต่างๆ</p>
            </div>
            <div class="p-6 space-y-5">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="md:col-span-2">
                        <label class="block text-sm font-bold text-slate-700 mb-1.5 ml-1">ชื่อโรงเรียน</label>
                        <input type="text" id="set-sch" value="${s.name}" class="w-full border border-slate-200 rounded-xl p-3 focus-ring bg-slate-50 focus:bg-white transition-colors font-bold text-slate-800">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1.5 ml-1">ปีการศึกษาตั้งต้น</label>
                        <input type="text" id="set-yr" value="${s.year}" class="w-full border border-slate-200 rounded-xl p-3 focus-ring bg-slate-50 focus:bg-white transition-colors font-bold text-slate-800">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1.5 ml-1">ตราสัญลักษณ์โรงเรียน (Logo)</label>
                        <div class="flex items-center gap-3">
                            <div class="relative w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm overflow-hidden shrink-0 group">
                                <i class="ph ph-image text-slate-300 absolute ${s.logo ? 'hidden' : ''}"></i>
                                <img id="preview-logo" src="${s.logo || ''}" class="w-full h-full object-contain ${s.logo ? '' : 'hidden'} group-hover:opacity-50 transition-opacity bg-white p-1">
                            </div>
                            <label class="tactile-btn bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 px-4 py-2.5 rounded-lg text-sm font-bold cursor-pointer transition-colors shadow-sm w-full text-center truncate">
                                <i class="ph ph-upload-simple mr-1"></i> อัปโหลดรูปใหม่
                                <input type="file" accept="image/*" onchange="window.uploadLogo(event)" class="hidden">
                            </label>
                        </div>
                    </div>
                </div>
                <div class="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1.5 ml-1">หัวหน้าฝ่ายวิชาการ (เซ็นอนุมัติ)</label>
                        <input type="text" id="set-h2" value="${s.academicHead||''}" class="w-full border border-slate-200 rounded-xl p-3 focus-ring bg-slate-50 focus:bg-white transition-colors font-bold text-slate-800">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1.5 ml-1">ผู้อำนวยการ (เซ็นอนุมัติ)</label>
                        <input type="text" id="set-h3" value="${s.director||''}" class="w-full border border-slate-200 rounded-xl p-3 focus-ring bg-slate-50 focus:bg-white transition-colors font-bold text-slate-800">
                    </div>
                </div>
            </div>
        </div>

        <!-- เกณฑ์ตัดเกรด -->
        <div class="modern-card overflow-hidden border-t-4 border-amber-500 stagger-1">
            <div class="p-6 bg-slate-50/50 border-b border-slate-100">
                <h3 class="text-xl font-extrabold text-slate-800 flex items-center"><div class="w-10 h-10 bg-amber-100 text-amber-600 flex items-center justify-center rounded-xl mr-3 shadow-inner"><i class="ph ph-chart-bar text-xl"></i></div> เกณฑ์การตัดเกรดอิงเกณฑ์</h3>
                <p class="text-sm text-slate-500 font-medium mt-1 ml-13 pl-13">กำหนดคะแนนดิบขั้นต่ำ (ร้อยละ) ของแต่ละระดับผลการเรียน</p>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
                    ${['4.0','3.5','3.0','2.5','2.0','1.5','1.0'].map(gr => `
                        <div class="flex items-center bg-slate-50 rounded-xl p-1.5 border border-slate-100 focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-200 transition-all">
                            <div class="w-16 font-extrabold text-slate-700 text-center bg-white py-2 rounded-lg shadow-sm border border-slate-100 mr-2 text-sm text-indigo-700">เกรด ${gr}</div>
                            <input type="number" id="set-g${gr.replace('.','')}" value="${g[gr]}" class="w-full border-none bg-transparent p-2 text-center font-bold text-slate-800 text-lg focus:outline-none" min="0" max="100">
                            <span class="text-slate-400 font-medium text-sm pr-3">คะแนน</span>
                        </div>
                    `).join('')}
                </div>
                <div class="pt-5 border-t border-slate-100 flex items-center bg-rose-50/30 p-4 rounded-xl border border-rose-100/50">
                    <div class="flex-1">
                        <label class="block text-sm font-extrabold text-rose-800 mb-0.5"><i class="ph ph-warning-circle"></i> เกณฑ์สอบผ่านขั้นต่ำ</label>
                        <p class="text-xs font-medium text-rose-600/70">นักเรียนต้องได้คะแนนรวมตั้งแต่กี่คะแนนจึงจะถือว่าผ่าน</p>
                    </div>
                    <div class="w-32 flex items-center bg-white rounded-xl p-1 border border-rose-200 shadow-sm focus-within:border-rose-400 focus-within:ring-1 focus-within:ring-rose-300 transition-all">
                        <input type="number" id="set-gPass" value="${g.passThreshold}" class="w-full border-none bg-transparent p-2 text-center font-black text-rose-700 text-xl focus:outline-none" min="0" max="100">
                    </div>
                </div>
            </div>
        </div>
        
        <!-- โหมดแสดงผล -->
        <div class="modern-card overflow-hidden border-t-4 border-slate-700 stagger-2">
            <div class="p-6 bg-slate-50/50 border-b border-slate-100">
                <h3 class="text-xl font-extrabold text-slate-800 flex items-center"><div class="w-10 h-10 bg-slate-200 text-slate-700 flex items-center justify-center rounded-xl mr-3 shadow-inner"><i class="ph ph-moon-stars text-xl"></i></div> โหมดแสดงผล</h3>
                <p class="text-sm text-slate-500 font-medium mt-1 ml-13 pl-13">สลับหน้าจอสำหรับทำงานกลางวัน/กลางคืน ลดแสงจ้าเวลาใช้งานนาน</p>
            </div>
            <div class="p-6 space-y-4">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1.5 ml-1">ค่าเริ่มต้นของระบบ</label>
                    <select id="set-theme-default" class="w-full border border-slate-200 rounded-xl p-3 focus-ring bg-slate-50 focus:bg-white transition-colors font-bold text-slate-800">
                        <option value="light" ${themeMode === 'light' ? 'selected' : ''}>Light mode - โหมดสว่าง</option>
                        <option value="dark" ${themeMode === 'dark' ? 'selected' : ''}>Dark mode - โหมดกลางคืน</option>
                    </select>
                </div>
                <button type="button" onclick="window.toggleThemeMode()" class="tactile-btn w-full bg-slate-800 hover:bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 font-bold transition-all"><i class="ph ph-circle-half-tilt text-xl"></i> สลับโหมดของเครื่องนี้ทันที</button>
            </div>
        </div>

        <!-- เวลาเปิดลงคะแนน -->
        <div class="modern-card overflow-hidden border-t-4 border-emerald-500 stagger-2">
            <div class="p-6 bg-emerald-50/50 border-b border-emerald-100">
                <h3 class="text-xl font-extrabold text-slate-800 flex items-center"><div class="w-10 h-10 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-xl mr-3 shadow-inner"><i class="ph ph-calendar-check text-xl"></i></div> เวลาเปิด/ปิดลงคะแนน</h3>
                <p class="text-sm text-slate-500 font-medium mt-1 ml-13 pl-13">เมื่ออยู่นอกช่วงวันที่กำหนด ครูจะเห็นแจ้งเตือนและระบบจะปิดช่องกรอกคะแนนอัตโนมัติ</p>
            </div>
            <div class="p-6 space-y-5">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1.5 ml-1">สถานะการลงคะแนน</label>
                    <select id="set-score-mode" class="w-full border border-slate-200 rounded-xl p-3 focus-ring bg-slate-50 focus:bg-white transition-colors font-bold text-slate-800">
                        <option value="always" ${scorePolicy.mode === 'always' ? 'selected' : ''}>เปิดลงคะแนนตลอดเวลา</option>
                        <option value="scheduled" ${scorePolicy.mode === 'scheduled' ? 'selected' : ''}>เปิดเฉพาะช่วงวันที่กำหนด</option>
                        <option value="closed" ${scorePolicy.mode === 'closed' ? 'selected' : ''}>ปิดลงคะแนนชั่วคราว</option>
                    </select>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1.5 ml-1">เปิดให้ลงคะแนนตั้งแต่วันที่</label>
                        <input type="date" id="set-score-start" value="${scorePolicy.startDate}" class="w-full border border-slate-200 rounded-xl p-3 focus-ring bg-slate-50 focus:bg-white transition-colors font-bold text-slate-800">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1.5 ml-1">ปิดรับคะแนนวันที่</label>
                        <input type="date" id="set-score-end" value="${scorePolicy.endDate}" class="w-full border border-slate-200 rounded-xl p-3 focus-ring bg-slate-50 focus:bg-white transition-colors font-bold text-slate-800">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1.5 ml-1">ข้อความแจ้งเตือนหน้าครูผู้สอน (ไม่บังคับ)</label>
                    <textarea id="set-score-notice" rows="3" class="w-full border border-slate-200 rounded-xl p-3 focus-ring bg-slate-50 focus:bg-white transition-colors font-medium text-slate-800" placeholder="เช่น กรุณาบันทึกคะแนนให้เสร็จก่อนวันปิดระบบ">${window.escapeHtml(scorePolicy.notice)}</textarea>
                </div>
                <div class="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm font-bold text-indigo-800 flex items-start gap-2">
                    <i class="ph ph-info text-xl shrink-0"></i>
                    <div>ปุ่มพิมพ์รายงานยังใช้งานได้ตามปกติ ระบบจะปิดเฉพาะการแก้ไขคะแนน โครงสร้างคะแนน การนำเข้าคะแนน และการบันทึกคะแนน</div>
                </div>
            </div>
        </div>

        <!-- Save Button spans across -->
        <div class="lg:col-span-2 animate-fade-in-up stagger-2">
            <button onclick="window.saveSettings()" class="tactile-btn w-full bg-primary-gradient text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:shadow-2xl transition-all text-xl flex justify-center items-center gap-2"><i class="ph ph-floppy-disk text-2xl"></i> บันทึกการตั้งค่าระบบทั้งหมด</button>
        </div>

        <!-- Backup & Restore -->
        <div class="modern-card p-8 lg:col-span-2 border border-slate-200 bg-slate-50/30 animate-fade-in-up stagger-3">
            <h3 class="text-xl font-extrabold text-slate-800 mb-6 flex items-center pb-4 border-b border-slate-200"><div class="w-10 h-10 bg-slate-200 text-slate-600 flex items-center justify-center rounded-xl mr-3 shadow-inner"><i class="ph ph-database text-xl"></i></div> จัดการฐานข้อมูล (Database Tools)</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button onclick="window.backupData()" class="tactile-btn bg-slate-800 hover:bg-slate-900 text-white px-5 py-4 rounded-xl shadow-lg flex flex-col items-center justify-center gap-2 font-bold transition-all"><i class="ph ph-download-simple text-3xl opacity-80"></i> สำรองข้อมูล (Backup)</button>
                
                <label class="tactile-btn bg-white border-2 border-dashed border-slate-300 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 px-5 py-4 rounded-xl cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 font-bold">
                    <i class="ph ph-upload-simple text-3xl opacity-80"></i> กู้คืนข้อมูล (Restore)
                    <input type="file" accept=".json" class="hidden" onchange="window.restoreData(event)">
                </label>
                
                <button onclick="window.forceSyncToCloud()" class="tactile-btn bg-sky-500 hover:bg-sky-600 text-white px-5 py-4 rounded-xl shadow-lg shadow-sky-200/50 flex flex-col items-center justify-center gap-2 font-bold transition-all border border-sky-400"><i class="ph ph-cloud-arrow-up text-3xl opacity-90"></i> อัปโหลดทับคลาวด์</button>
                
                <button onclick="window.clearAllData()" class="tactile-btn bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white px-5 py-4 rounded-xl transition-all flex flex-col items-center justify-center gap-2 font-bold"><i class="ph ph-warning-octagon text-3xl opacity-80"></i> ล้างข้อมูลโรงเรียน</button>
            </div>

            <div class="mt-6 pt-6 border-t border-slate-200">
                <h4 class="text-lg font-extrabold text-slate-800 mb-1 flex items-center gap-2"><i class="ph ph-archive-box text-xl text-amber-600"></i> คลังข้อมูลรายปีการศึกษา</h4>
                <p class="text-sm text-slate-500 font-medium mb-4">
                    ระบบเก็บคะแนนที่ใช้งานอยู่ได้ปีการศึกษาเดียว ก่อนขึ้นปีใหม่ให้กดเก็บปีปัจจุบันเข้าคลังไว้
                    แล้วจะเลือกพิมพ์รายงานย้อนหลังได้จากหน้า “รายงานแจ้งผู้ปกครอง” (อ่านอย่างเดียว ไม่กระทบคะแนนปัจจุบัน)
                </p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button id="archive-year-btn" onclick="window.archiveCurrentYear()" class="tactile-btn bg-amber-500 hover:bg-amber-600 text-white px-5 py-4 rounded-xl shadow-lg shadow-amber-200/50 flex flex-col items-center justify-center gap-2 font-bold transition-all"><i class="ph ph-archive-box text-3xl opacity-80"></i> เก็บปีการศึกษานี้เข้าคลัง</button>
                    <div id="archive-year-list" class="bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-600 flex items-center justify-center">กำลังตรวจสอบคลังข้อมูล...</div>
                </div>
            </div>

            <div class="mt-6 pt-6 border-t border-slate-200">
                <h4 class="text-lg font-extrabold text-slate-800 mb-1 flex items-center gap-2"><i class="ph ph-floppy-disk-back text-xl text-emerald-600"></i> คลังคะแนนเก็บรายภาคเรียน</h4>
                <p class="text-sm text-slate-500 font-medium mb-4">
                    บันทึกคะแนนเก็บ (ตัวชี้วัด K/P/A) กลางภาค ปลายภาค รวม และเกรด ของทุกวิชาทุกห้องในภาคเรียนที่ ${state.term}/${window.escapeHtml(DB.schoolInfo.year || '')} เก็บไว้บนคลาวด์
                    กดซ้ำได้ ทุกครั้งเป็นรุ่นใหม่ไม่เขียนทับของเดิม ควรกดเมื่อจบภาคเรียน ก่อนเริ่มกรอกเทอมถัดไป (เปลี่ยนภาคเรียนได้ที่เมนูด้านซ้าย)
                </p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-3">
                        <button id="term-archive-btn" onclick="window.saveTermScoreArchive()" class="tactile-btn bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-4 rounded-xl shadow-lg shadow-emerald-200/50 flex flex-col items-center justify-center gap-2 font-bold transition-all"><i class="ph ph-floppy-disk-back text-3xl opacity-80"></i> บันทึกคะแนนเทอม ${state.term} เข้าคลัง</button>
                        <button onclick="window.exportCurrentTermScores()" class="tactile-btn bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-5 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all"><i class="ph ph-file-xls text-xl"></i> ดาวน์โหลด Excel คะแนนเทอม ${state.term} (ปัจจุบัน)</button>
                    </div>
                    <div id="term-archive-list" class="bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-600 flex items-center justify-center">กำลังตรวจสอบคลังคะแนน...</div>
                </div>
            </div>
        </div>

        <!-- บัญชีเข้าใช้งาน -->
        <div class="modern-card p-8 lg:col-span-2 border-t-4 border-emerald-500 animate-fade-in-up stagger-3">
            <h3 class="text-xl font-extrabold text-slate-800 mb-2 flex items-center pb-4 border-b border-slate-200"><div class="w-10 h-10 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-xl mr-3 shadow-inner"><i class="ph ph-shield-check text-xl"></i></div> บัญชีเข้าใช้งานของครู</h3>
            <p class="text-sm text-slate-500 font-medium mb-5">
                ระบบเปลี่ยนมาใช้บัญชีของ Firebase แล้ว รหัสผ่านไม่ได้เก็บอยู่ในฐานข้อมูลของโรงเรียนอีกต่อไป
                ครูที่ยังไม่มีบัญชีจะเข้าระบบไม่ได้จนกว่าจะกดสร้างบัญชีให้
            </p>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <div class="text-3xl font-extrabold text-slate-800">${DB.teachers.length}</div>
                    <div class="text-xs font-bold text-slate-500 mt-1">ครูทั้งหมด</div>
                </div>
                <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <div class="text-3xl font-extrabold text-emerald-700">${DB.teachers.filter(t => t.authUid).length}</div>
                    <div class="text-xs font-bold text-emerald-600 mt-1">มีบัญชีแล้ว</div>
                </div>
                <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <div class="text-3xl font-extrabold text-amber-700">${DB.teachers.filter(t => !t.authUid).length}</div>
                    <div class="text-xs font-bold text-amber-600 mt-1">ยังไม่มีบัญชี</div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button id="provision-btn" onclick="window.provisionTeacherAccounts()" class="tactile-btn bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-4 rounded-xl shadow-lg shadow-emerald-200/50 flex flex-col items-center justify-center gap-2 font-bold transition-all"><i class="ph ph-user-switch text-3xl opacity-90"></i> สร้างบัญชีให้ครูที่ยังไม่มี</button>
                <button onclick="window.syncPublicDirectory(); window.notify('อัปเดตรายชื่อในหน้าเข้าสู่ระบบแล้ว');" class="tactile-btn bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-4 rounded-xl flex flex-col items-center justify-center gap-2 font-bold transition-all"><i class="ph ph-address-book text-3xl opacity-80"></i> อัปเดตรายชื่อหน้าเข้าสู่ระบบ</button>
            </div>

            <div id="provision-result" class="mt-5"></div>
        </div>
    </div>`;
    container.innerHTML = html;

    if(typeof window.renderTermArchiveList === 'function') window.renderTermArchiveList();
    window.refreshGuardianArchiveYears().then(() => {
        const box = $('archive-year-list');
        if(!box) return;
        const years = window.guardianArchiveYears || [];
        box.innerHTML = years.length
            ? `<div class="w-full"><div class="font-bold text-slate-700 mb-1">ปีที่เก็บไว้แล้ว</div>${years.map(y =>
                `<div class="flex justify-between border-t border-slate-100 py-1"><span>ปี ${window.escapeHtml(y.year)}</span><span class="text-slate-400">${y.classCount || 0} ห้อง · ${(y.terms || []).length} ภาคเรียน</span></div>`
              ).join('')}</div>`
            : 'ยังไม่มีปีการศึกษาในคลังข้อมูล';
    });
}

window.uploadLogo = function(e) {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = async function(evt) {
            DB.schoolInfo.logo = await window.compressImageDataUrl(evt.target.result);
            const el = $('preview-logo');
            el.src = DB.schoolInfo.logo;
            el.classList.remove('hidden');
            el.previousElementSibling.classList.add('hidden'); 
            window.updateLogoAndHeader();
            window.saveDB();
        };
        reader.readAsDataURL(file);
    }
}

window.saveSettings = function() {
    DB.schoolInfo.name = $('set-sch').value;
    DB.schoolInfo.year = $('set-yr').value;
    DB.schoolInfo.academicHead = $('set-h2').value;
    DB.schoolInfo.director = $('set-h3').value;
    DB.schoolInfo.themeMode = $('set-theme-default').value === 'dark' ? 'dark' : 'light';

    const scoreMode = $('set-score-mode').value;
    const scoreStart = $('set-score-start').value;
    const scoreEnd = $('set-score-end').value;
    const scoreNotice = $('set-score-notice').value.trim();

    if(scoreMode === 'scheduled') {
        if(!scoreStart || !scoreEnd) {
            window.notify('กรุณากำหนดวันที่เปิดและวันที่ปิดลงคะแนนให้ครบถ้วน', true);
            return;
        }
        if(scoreStart > scoreEnd) {
            window.notify('วันที่เปิดลงคะแนนต้องไม่เกินวันที่ปิดรับคะแนน', true);
            return;
        }
    }

    DB.schoolInfo.scoreEntryPolicy = {
        mode: ['always', 'scheduled', 'closed'].includes(scoreMode) ? scoreMode : 'always',
        startDate: scoreStart,
        endDate: scoreEnd,
        notice: scoreNotice
    };
    
    ['4.0','3.5','3.0','2.5','2.0','1.5','1.0'].forEach(gr => {
        DB.gradeSettings[gr] = Number($(`set-g${gr.replace('.','')}`).value);
    });
    DB.gradeSettings.passThreshold = Number($('set-gPass').value);

    window.saveDB();
    window.applyThemeMode(DB.schoolInfo.themeMode);
    window.updateLogoAndHeader();
    window.notify('บันทึกการตั้งค่าสำเร็จ');
}

window.backupData = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({db: DB, sub: DB_SubjectData}));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `anpscore_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
}

window.restoreData = function(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if(data.db && data.sub) {
                isRestoringBackup = true;
                DB = data.db;
                DB_SubjectData = data.sub;
                await window.compressSchoolLogo(DB);
                window.DB = DB;
                window.DB_SubjectData = DB_SubjectData;
                if(window.repairAllSubjectScoreValues) window.repairAllSubjectScoreValues();
                if(window.recalculateAllLoadedProgressSummaries) window.recalculateAllLoadedProgressSummaries();

                if (!window.dirtySubjects) window.dirtySubjects = new Set();
                Object.keys(window.DB_SubjectData || {}).forEach(id => {
                    window.markSubjectDirty(id);
                    if(window.markAllScoreClassesDirty) window.markAllScoreClassesDirty(id);
                });
                window.saveLocalDB();

                window.notify('กำลังกู้คืนและอัปโหลดข้อมูลสำรองขึ้นคลาวด์...');
                // A restore replaces the cloud copy: write every document whole
                if(typeof window.requestFullCloudSync === 'function') window.requestFullCloudSync();
                if(typeof window.firebaseSaveNowFn === 'function') {
                    await window.firebaseSaveNowFn();
                } else if(typeof window.firebaseSaveFn === 'function') {
                    window.firebaseSaveFn();
                    await new Promise(resolve => setTimeout(resolve, 2500));
                }

                isRestoringBackup = false;
                window.notify('กู้คืนข้อมูลสำเร็จ ระบบจะทำการรีโหลด');
                setTimeout(() => location.reload(), 800);
            } else {
                window.notify('ไฟล์ Backup ไม่ถูกต้อง', true);
            }
        } catch(err) {
            isRestoringBackup = false;
            console.error(err);
            window.notify('เกิดข้อผิดพลาดในการอ่านไฟล์', true);
        }
    };
    reader.readAsText(file);
}

window.clearAllData = function() {
    window.showCustomConfirm('ยืนยันการล้างข้อมูลโรงเรียน', 'อันตราย! คุณต้องการลบข้อมูลโรงเรียน รายวิชา ครู และนักเรียนทั้งหมดทิ้งใช่หรือไม่?\n\n<span class="text-rose-600 font-bold">(การกระทำนี้จะลบข้อมูลถาวร ไม่สามารถกู้คืนได้เว้นแต่คุณจะมีไฟล์ Backup)</span>', 'danger', () => {
        localStorage.removeItem('anpscore_db');
        localStorage.removeItem('anpscore_subjectData');
        location.reload();
    });
}

window.renderTeacherProfile = function(container) {
    $('page-title').innerText = 'ตั้งค่าโปรไฟล์ส่วนตัว';
    const t = DB.teachers.find(x => x.id === state.user.id);
    if(!t) return;

    let avatarHtml = t.picUrl 
        ? `<img src="${window.formatImgUrl(t.picUrl)}" class="w-28 h-28 rounded-[2rem] object-cover shadow-xl border-4 border-white" onerror="this.onerror=null; this.src=''; this.outerHTML='<div class=\\'w-28 h-28 bg-indigo-100 text-indigo-600 rounded-[2rem] flex items-center justify-center text-5xl font-extrabold shadow-inner border-4 border-white\\'>${t.name.charAt(0)}</div>'">`
        : `<div class="w-28 h-28 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-[2rem] flex items-center justify-center text-5xl font-extrabold shadow-xl border-4 border-white">${t.name.charAt(0)}</div>`;

    let html = `
        <div class="modern-card p-8 max-w-3xl mx-auto mt-6 animate-fade-in-up">
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-10 pb-8 border-b border-slate-100 text-center sm:text-left">
                <div class="relative">
                    ${avatarHtml}
                    <div class="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-lg border-2 border-white shadow-sm flex items-center gap-1">
                        <span class="relative flex h-2 w-2">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        Online
                    </div>
                </div>
                <div class="pt-2">
                    <h3 class="text-3xl font-extrabold text-slate-800 tracking-tight">${t.name}</h3>
                    <p class="text-slate-500 font-medium mt-1.5 flex items-center justify-center sm:justify-start gap-1.5"><i class="ph ph-identification-badge text-lg"></i> บัญชีครูผู้สอน (Teacher Account)</p>
                </div>
            </div>

            <form onsubmit="event.preventDefault(); window.saveTeacherProfile();" class="space-y-6">
                <div>
                    <label class="block text-sm font-extrabold text-slate-700 mb-2 ml-1">ชื่อ-สกุล</label>
                    <div class="relative">
                        <i class="ph ph-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl"></i>
                        <input type="text" id="prof-name" value="${t.name}" class="w-full border border-slate-200 rounded-xl p-4 pl-12 focus-ring font-bold text-slate-800 bg-slate-50 focus:bg-white transition-colors" required>
                    </div>
                </div>
                
                <div class="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <label class="block text-sm font-extrabold text-slate-700 mb-1 ml-1 flex items-center gap-1.5"><i class="ph ph-lock-key text-lg"></i> เปลี่ยนรหัสผ่าน</label>
                    <p class="text-xs text-slate-500 mb-3 ml-1">เว้นว่างไว้ถ้ายังไม่ต้องการเปลี่ยน</p>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input type="password" id="prof-pwd-current" autocomplete="current-password" class="w-full border border-slate-200 rounded-xl p-3.5 focus-ring font-medium text-slate-800 bg-white transition-colors" placeholder="รหัสผ่านปัจจุบัน">
                        <input type="password" id="prof-pwd-new" autocomplete="new-password" minlength="6" class="w-full border border-slate-200 rounded-xl p-3.5 focus-ring font-medium text-slate-800 bg-white transition-colors" placeholder="รหัสผ่านใหม่">
                        <input type="password" id="prof-pwd-confirm" autocomplete="new-password" minlength="6" class="w-full border border-slate-200 rounded-xl p-3.5 focus-ring font-medium text-slate-800 bg-white transition-colors" placeholder="ยืนยันรหัสผ่านใหม่">
                    </div>
                </div>

                <div class="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
                    <label class="block text-sm font-extrabold text-indigo-900 mb-2 ml-1 flex items-center gap-1.5"><i class="ph ph-image text-lg"></i> ลิงก์รูปประจำตัว (Google Drive หรือ URL รูปภาพ)</label>
                    <div class="relative">
                        <i class="ph ph-link absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 text-xl"></i>
                        <input type="text" id="prof-pic" value="${t.picUrl || ''}" class="w-full border border-indigo-200 rounded-xl p-4 pl-12 focus-ring font-medium text-slate-800 bg-white transition-colors" placeholder="วางลิงก์รูปภาพที่นี่ (เว้นว่างได้)">
                    </div>
                    <div class="mt-3 text-sm text-indigo-700 font-medium bg-white p-3 rounded-lg border border-indigo-100 shadow-sm flex items-start gap-2">
                        <i class="ph ph-lightbulb text-xl text-amber-500 shrink-0"></i>
                        <span><strong>วิธีใช้ภาพจาก Google Drive:</strong> อัปโหลดรูปของคุณขึ้น Google Drive -> คลิกขวาเลือก Share -> เลือกเป็น <strong>"Anyone with the link (ทุกคนที่มีลิงก์)"</strong> -> กดยืนยัน Copy Link มาวางในช่องนี้ได้เลย</span>
                    </div>
                </div>

                <div class="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
                    <button type="submit" class="tactile-btn w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-white bg-primary-gradient shadow-lg shadow-indigo-200 flex items-center justify-center text-lg tracking-wide"><i class="ph ph-floppy-disk mr-2 text-xl"></i> บันทึกการเปลี่ยนแปลง</button>
                </div>
            </form>
        </div>
    `;
    container.innerHTML = html;
}

window.saveTeacherProfile = async function() {
    const name = $('prof-name').value.trim();
    const pic = $('prof-pic').value.trim();
    const current = $('prof-pwd-current').value;
    const next = $('prof-pwd-new').value;
    const confirm = $('prof-pwd-confirm').value;

    // เปลี่ยนรหัสผ่านที่ Firebase Auth ไม่ได้เก็บลงฐานข้อมูลของระบบ
    if(current || next || confirm) {
        if(!window.anpAuth) return window.notify('ระบบยังเชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', true);
        if(!current) return window.notify('กรุณากรอกรหัสผ่านปัจจุบัน', true);
        if(next !== confirm) return window.notify('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน', true);
        try {
            await window.anpAuth.changeOwnPassword(current, next);
            $('prof-pwd-current').value = '';
            $('prof-pwd-new').value = '';
            $('prof-pwd-confirm').value = '';
            window.notify('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
        } catch(err) {
            return window.notify(window.anpAuth.describeAuthError(err), true);
        }
    }

    let t = DB.teachers.find(x => x.id === state.user.id);
    if(t) {
        t.name = name;
        t.picUrl = pic;
        window.saveDB();
        window.updateLogoAndHeader();
        window.notify('อัปเดตโปรไฟล์และบันทึกข้อมูลเรียบร้อยแล้ว');
    }
}
