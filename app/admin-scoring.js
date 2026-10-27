/* ANPSCORE — หน้าผู้ดูแลระบบ นำเข้าส่งออกคะแนนสอบ และคะแนนพิเศษ
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

window.renderAdminDash = async function(container) {
    $('page-title').innerText = 'แดชบอร์ดภาพรวมผู้ดูแลระบบ';

    const over100Audit = typeof window.scanSchoolOver100Scores === 'function' ? window.scanSchoolOver100Scores(state.term) : [];
    const totalOver100Classes = over100Audit.length;
    const totalOver100Students = over100Audit.reduce((sum, item) => sum + item.students.length, 0);

    let html = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in-up">
        <div class="modern-card p-6 border-l-8 border-indigo-500 relative overflow-hidden group">
            <div class="absolute -right-8 -top-8 text-indigo-50 opacity-50 group-hover:scale-125 transition-transform duration-500"><i class="ph ph-users text-9xl"></i></div>
            <div class="relative z-10">
                <div class="text-slate-500 font-bold uppercase tracking-wider text-xs mb-1">บุคลากรครูทั้งหมด</div>
                <div class="text-5xl font-extrabold text-slate-800">${DB.teachers.length} <span class="text-lg text-slate-400 font-medium">ท่าน</span></div>
            </div>
        </div>
        <div class="modern-card p-6 border-l-8 border-emerald-400 relative overflow-hidden group stagger-1">
            <div class="absolute -right-8 -top-8 text-emerald-50 opacity-50 group-hover:scale-125 transition-transform duration-500"><i class="ph ph-chalkboard text-9xl"></i></div>
            <div class="relative z-10">
                <div class="text-slate-500 font-bold uppercase tracking-wider text-xs mb-1">ห้องเรียนในระบบ</div>
                <div class="text-5xl font-extrabold text-slate-800">${Object.keys(DB.classes).length} <span class="text-lg text-slate-400 font-medium">ห้อง</span></div>
            </div>
        </div>
        <div class="modern-card p-6 border-l-8 border-amber-400 relative overflow-hidden group stagger-2">
            <div class="absolute -right-8 -top-8 text-amber-50 opacity-50 group-hover:scale-125 transition-transform duration-500"><i class="ph ph-books text-9xl"></i></div>
            <div class="relative z-10">
                <div class="text-slate-500 font-bold uppercase tracking-wider text-xs mb-1">รายวิชาทั้งหมด</div>
                <div class="text-5xl font-extrabold text-slate-800">${DB.subjects.length} <span class="text-lg text-slate-400 font-medium">วิชา</span></div>
            </div>
        </div>
    </div>`;

    if(totalOver100Students > 0) {
        html += `
        <div class="modern-card p-5 mb-8 border-2 border-rose-300 bg-gradient-to-r from-rose-50 via-rose-100/60 to-amber-50 rounded-2xl shadow-md animate-fade-in-up">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-start sm:items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-200 animate-pulse">
                        <i class="ph ph-warning-octagon text-2xl font-bold"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-base sm:text-lg font-black text-rose-900">ตรวจพบคะแนนเกิน 100 คะแนนในระบบ</h3>
                            <span class="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-black text-xs">${totalOver100Students} คน (${totalOver100Classes} ห้อง)</span>
                        </div>
                        <p class="text-xs text-rose-700 font-medium mt-0.5">มีนักเรียนที่มีคะแนนรวมเกินเกณฑ์ 100 คะแนน กรุณาตรวจสอบและปรับปรุงคะแนนให้ถูกต้อง</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button onclick="window.showOver100AuditModal()" class="tactile-btn bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-black text-xs shadow-md shadow-rose-200 flex items-center gap-1.5 cursor-pointer">
                        <i class="ph ph-magnifying-glass text-base"></i> ดูรายละเอียดและไปแก้ไข
                    </button>
                </div>
            </div>
        </div>`;
    }

    html += `<div class="mb-8">${window.renderActiveUsersPanel(false)}</div>`;

    // เดิมแบ่งแค่ "มีคะแนนบ้าง" กับ "ยังไม่มีเลย" ห้องที่กรอกไป 25% จึงถูกนับเป็นเสร็จ
    // ภาพรวมเลยขึ้น 100% ทั้งที่ยังกรอกไม่ครบสักห้อง แยกเป็นสามกลุ่มตามความจริงแทน
    const doneItems = []; const partialItems = []; const notStartedItems = [];
    let teacherWorkloadHtml = '';

    DB.teachers.forEach(t => {
        let currentTermAsg = window.getTeacherAssignments(t, state.term);
        let assignedSubjectsCount = 0; let assignmentDetailsHtml = '';

        if(currentTermAsg && Object.keys(currentTermAsg).length > 0) {
            assignedSubjectsCount = Object.keys(currentTermAsg).length;
            Object.keys(currentTermAsg).forEach(subId => {
                let sub = DB.subjects.find(x => x.id === subId); if(!sub) return;
                const assignedClassIds = window.sortClassIds(Array.isArray(currentTermAsg[subId]) ? currentTermAsg[subId] : []);
                const progressValues = assignedClassIds
                    .filter(cId => DB.classes[cId])
                    .map(cId => window.calculateClassProgress(subId, cId, state.term));
                const subjectProgressPct = progressValues.length ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) : 0;
                const progressBadgeClass = subjectProgressPct >= 100
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : (subjectProgressPct > 0 ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-rose-100 text-rose-700 border-rose-200');
                const progressIcon = subjectProgressPct >= 100 ? 'ph-check-circle' : (subjectProgressPct > 0 ? 'ph-chart-line-up' : 'ph-clock');
                const classNames = assignedClassIds.map(cId => { let cls = DB.classes[cId]; return cls ? cls.name : '?'; }).join(', ');
                assignmentDetailsHtml += `<div class="bg-white p-2.5 rounded-lg border border-slate-100 text-xs mb-2 shadow-sm hover:shadow transition-shadow"><div class="font-bold text-indigo-900 flex items-start gap-1.5"><i class="ph ph-book-open text-indigo-500 mt-0.5 shrink-0 text-sm"></i> <span class="break-words leading-tight">${sub.name}</span><span class="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${progressBadgeClass} text-[10px] font-black"><i class="ph ${progressIcon}"></i>${subjectProgressPct}%</span></div><div class="text-slate-500 ml-5 mt-1 font-medium bg-slate-50 px-2 py-0.5 rounded inline-block">ห้อง: ${classNames}</div></div>`;

                assignedClassIds.forEach(clsId => {
                    let cls = DB.classes[clsId]; if(!cls) return;
                    let progressPct = window.calculateClassProgress(subId, clsId, state.term);
                    let statusBadge = '';
                    if(progressPct >= 100) statusBadge = `<span class="ml-2 text-[11px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-sm"><i class="ph ph-check-circle fill-current"></i> 100%</span>`;
                    else if(progressPct > 0) statusBadge = `<span class="ml-2 text-[11px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-sm"><i class="ph ph-chart-line-up"></i> ${progressPct}%</span>`;
                    else statusBadge = `<span class="ml-2 text-[11px] bg-rose-100 text-rose-700 px-2 py-1 rounded-md font-bold flex items-center gap-1 shadow-sm"><i class="ph ph-clock"></i> 0%</span>`;

                    let itemHtml = `<div class="p-3.5 bg-white border border-slate-100 rounded-xl shadow-sm mb-3 text-sm flex items-center justify-between hover:shadow-md transition-shadow group">
                        <div class="flex items-center"><div class="w-1.5 h-8 ${progressPct >= 100 ? 'bg-emerald-400' : (progressPct > 0 ? 'bg-indigo-400' : 'bg-rose-400')} rounded-full mr-3 group-hover:scale-y-110 transition-transform"></div> <div><strong class="text-slate-800 text-base">${sub.name}</strong> <span class="text-slate-500 ml-2 font-medium">ห้อง ${cls.name}</span></div></div>
                        <div class="flex items-center gap-3"><div class="text-slate-500 text-xs bg-slate-100 px-2.5 py-1 rounded-md font-semibold">ครู${t.name}</div>${statusBadge}</div>
                    </div>`;
                    const item = { pct: progressPct, html: itemHtml };
                    if(progressPct >= 100) doneItems.push(item);
                    else if(progressPct > 0) partialItems.push(item);
                    else notStartedItems.push(item);
                });
            });
        } else {
            assignmentDetailsHtml = `<div class="text-sm text-slate-400 font-medium italic text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">ไม่มีภาระงานในเทอมนี้</div>`;
        }

        let tAvatarHtml = t.picUrl 
            ? `<img src="${window.formatImgUrl(t.picUrl)}" class="w-12 h-12 rounded-2xl object-cover shadow-lg shadow-indigo-200 border border-indigo-100 shrink-0" onerror="this.onerror=null; this.outerHTML='<div class=\\'w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center font-extrabold text-white shrink-0 shadow-lg shadow-indigo-200 text-xl\\'>${t.name.charAt(0)}</div>'">`
            : `<div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center font-extrabold text-white shrink-0 shadow-lg shadow-indigo-200 text-xl">${t.name.charAt(0)}</div>`;

        teacherWorkloadHtml += `
            <div class="modern-card p-5 flex flex-col h-full hover:ring-2 hover:ring-indigo-100 border-transparent">
                <div class="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
                    ${tAvatarHtml}
                    <div>
                        <div class="font-extrabold text-slate-800 text-lg leading-tight">${t.name}</div>
                        <div class="text-[11px] px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md inline-block mt-1 font-bold border border-indigo-100">สอน ${assignedSubjectsCount} วิชา</div>
                    </div>
                </div>
                <div class="mt-auto space-y-1 max-h-[14rem] overflow-y-auto custom-scrollbar pr-2">
                    ${assignmentDetailsHtml}
                </div>
            </div>
        `;
    });

    html += `
    <div class="mb-10 animate-fade-in-up stagger-1">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-2">
            <h3 class="text-xl font-extrabold text-slate-800 flex items-center"><i class="ph ph-briefcase-metal mr-2 text-indigo-500 text-2xl"></i> สรุปภาระงานสอนของครู (เทอม ${state.term})</h3>
            <div class="flex items-center gap-2">
                <button onclick="window.showExecutiveReportModal()" class="tactile-btn bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-md shadow-emerald-200 transition-colors" title="ดูรายงานสรุปสำหรับผู้บริหาร แยกรายบุคคล"><i class="ph ph-file-text text-base"></i> รายงานผู้บริหาร (สรุปรายบุคคล)</button>
                <button onclick="window.showGradeBoundaryInspectorModal()" class="tactile-btn bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-sm transition-colors" title="ตรวจสอบและปัดคะแนนคาบเกี่ยวเกรด (54, 59, 64, 69, 74, 79)"><i class="ph ph-trend-up text-base text-teal-600"></i> ปัดคะแนนคาบเกี่ยวเกรด</button>
                ${totalOver100Students > 0 
                    ? `<button onclick="window.showOver100AuditModal()" class="tactile-btn bg-rose-500 hover:bg-rose-600 text-white px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-md shadow-rose-200 animate-pulse" title="ตรวจพบคะแนนเกิน 100 คะแนน"><i class="ph ph-warning-octagon text-base"></i> คะแนนเกิน 100 (${totalOver100Students} คน)</button>`
                    : `<button onclick="window.showOver100AuditModal()" class="tactile-btn bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-sm" title="ตรวจสอบคะแนนเกิน 100 คะแนนทั้งโรงเรียน"><i class="ph ph-shield-check text-base text-emerald-600"></i> ตรวจคะแนนเกิน 100</button>`}
                <button id="btn-dashboard-sync" onclick="window.resyncAllDashboardProgress()" class="tactile-btn bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-sm transition-colors" title="ดึงข้อมูลคะแนนล่าสุดจากคลาวด์และคำนวณเปอร์เซ็นต์ใหม่"><i class="ph ph-arrows-clockwise text-base"></i> ซิงก์ความคืบหน้า</button>
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            ${teacherWorkloadHtml || '<div class="col-span-full modern-card p-10 text-center text-slate-500 font-medium">ยังไม่มีข้อมูลครูผู้สอนในระบบ</div>'}
        </div>
    </div>`;

    const doneCount = doneItems.length;
    const partialCount = partialItems.length;
    const notStartedCount = notStartedItems.length;
    const totalAssigned = doneCount + partialCount + notStartedCount;
    const incompleteCount = partialCount + notStartedCount;
    // ภาพรวมนับเฉพาะรายการที่กรอกครบ 100% เท่านั้น กรอกค้างไว้ไม่ถือว่าเสร็จ
    const overallProgress = totalAssigned === 0 ? 0 : Math.round((doneCount / totalAssigned) * 100);
    // เรียงจากน้อยไปมาก ให้รายการที่ค้างมากที่สุดอยู่บนสุด
    partialItems.sort((a, b) => a.pct - b.pct);
    const doneHtml = doneItems.map(item => item.html).join('');
    const partialHtml = partialItems.map(item => item.html).join('');
    const notStartedHtml = notStartedItems.map(item => item.html).join('');

    html += `
    <div class="modern-card p-8 mb-8 animate-fade-in-up stagger-2 bg-gradient-to-b from-white to-slate-50/50">
        <div class="flex items-end justify-between mb-6 border-b border-slate-100 pb-4">
            <h3 class="text-xl font-extrabold text-slate-800 flex items-center"><i class="ph ph-chart-line-up mr-2 text-indigo-500 text-2xl"></i> ความคืบหน้าการบันทึกคะแนน</h3>
            <div class="text-right">
                <div class="text-3xl font-black text-indigo-600">${overallProgress}%</div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-wide">ภาพรวมทั้งโรงเรียน</div>
            </div>
        </div>
        
        <div class="w-full bg-slate-100 rounded-full h-3 mb-3 overflow-hidden shadow-inner">
            <div class="bg-primary-gradient h-3 rounded-full transition-all duration-1000 relative" style="width: ${overallProgress}%">
                <div class="absolute inset-0 bg-white/20 w-full h-full animate-[pulse_2s_ease-in-out_infinite]"></div>
            </div>
        </div>
        <p class="text-sm text-slate-600 font-medium mb-8">กรอกครบ 100% แล้ว <span class="font-bold text-emerald-700">${doneCount}</span> จากทั้งหมด <span class="font-bold text-slate-800">${totalAssigned}</span> รายการสอน${incompleteCount > 0 ? ` — <span class="font-bold text-amber-700">ยังไม่ครบอีก ${incompleteCount} รายการ</span>` : ''}</p>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="bg-amber-50/60 p-5 rounded-2xl border border-amber-200/70 shadow-sm lg:order-first">
                <h4 class="font-extrabold text-amber-800 mb-4 flex items-center text-lg"><div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mr-2"><i class="ph ph-hourglass-medium text-amber-600 text-xl"></i></div> ยังกรอกไม่ครบ 100% <span class="ml-2 text-sm font-black bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-lg">${partialCount}</span></h4>
                <div class="max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    ${partialHtml || '<p class="text-sm text-amber-600/50 font-medium italic text-center py-6">ไม่มีรายการที่กรอกค้างไว้</p>'}
                </div>
            </div>
            <div class="bg-rose-50/50 p-5 rounded-2xl border border-rose-100/60 shadow-sm">
                <h4 class="font-extrabold text-rose-800 mb-4 flex items-center text-lg"><div class="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center mr-2"><i class="ph ph-clock text-rose-600 text-xl"></i></div> ยังไม่เริ่มกรอก (0%) <span class="ml-2 text-sm font-black bg-rose-200/70 text-rose-900 px-2 py-0.5 rounded-lg">${notStartedCount}</span></h4>
                <div class="max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    ${notStartedHtml || '<p class="text-sm text-rose-600/50 font-medium italic text-center py-6">เริ่มกรอกครบทุกรายการแล้ว</p>'}
                </div>
            </div>
            <div class="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100/60 shadow-sm">
                <h4 class="font-extrabold text-emerald-800 mb-4 flex items-center text-lg"><div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-2"><i class="ph ph-check-circle text-emerald-600 text-xl"></i></div> กรอกครบแล้ว <span class="ml-2 text-sm font-black bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-lg">${doneCount}</span></h4>
                <div class="max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    ${doneHtml || '<p class="text-sm text-emerald-600/50 font-medium italic text-center py-6">ยังไม่มีรายการที่กรอกครบ</p>'}
                </div>
            </div>
        </div>
    </div>`;
    container.innerHTML = html;
}

window.adminScoreSelection = window.adminScoreSelection || { subjId: '', clsId: '' };

window.openAdminScorebook = function() {
    if(!state.user || state.user.role !== 'admin') return;
    const subjectSelect = $('admin-score-subject');
    const classSelect = $('admin-score-class');
    const subId = subjectSelect ? subjectSelect.value : '';
    const clsId = classSelect ? classSelect.value : '';
    if(!subId || !clsId || !DB.subjects.some(sub => String(sub.id) === String(subId)) || !DB.classes[clsId]) {
        window.notify('กรุณาเลือกวิชาและห้องเรียนให้ครบ', true);
        return;
    }
    window.adminScoreSelection = { subjId: subId, clsId };
    state.subjId = subId;
    state.clsId = clsId;
    window.navigate('teacher_scoring');
}

window.normalizeAdminMidtermClassKey = function(value) {
    const text = String(value ?? '').trim().replace(/\s+/g, ' ');
    const match = text.match(/(?:ป(?:ระถมศึกษาปีที่)?\.?\s*)?(\d+)\s*[\/.]\s*(\d+)/i);
    return match ? `${Number(match[1])}/${Number(match[2])}` : '';
}

window.normalizeAdminMidtermSubjectKey = function(value) {
    const text = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s()（）\[\]{}._\-–—/\\:;,'"ฯ]/g, '')
        .replace(/กลุ่มสาระการเรียนรู้|กลุ่มสาระ|รายวิชา/g, '');
    if(!text || text === 'รวม' || text === 'ร้อยละ') return '';
    if(text.includes('อังกฤษ') && (text.includes('สื่อสาร') || text.includes('เพิ่มเติม'))) return 'อังกฤษสื่อสาร';
    if(text.includes('ภาษาจีน') || text === 'จีน') return 'ภาษาจีน';
    if(text.includes('ภาษาอังกฤษ') || text === 'อังกฤษ') return 'ภาษาอังกฤษ';
    if(text.includes('สังคม')) return 'สังคมศึกษา';
    if(text.includes('ประวัติ')) return 'ประวัติศาสตร์';
    if(text.includes('สุขศึกษา') || text === 'สุข') return 'สุขศึกษา';
    if(text.includes('ศิลป') || text.includes('ทัศนศิลป์')) return 'ศิลปะ';
    if(text.includes('การงาน')) return 'การงานอาชีพ';
    if(text.includes('วิทย')) return 'วิทยาศาสตร์';
    if(text.includes('คณิต')) return 'คณิตศาสตร์';
    if(text.includes('ภาษาไทย') || text === 'ไทย') return 'ภาษาไทย';
    return text;
}

window.getAdminSubjectSortRank = function(name) {
    const text = String(name || '').trim();
    if(text.includes('อังกฤษ') && (text.includes('สื่อสาร') || text.includes('เพิ่มเติม'))) return 10;
    if(text.includes('จีน')) return 9;
    if(text.includes('อังกฤษ')) return 8;
    if(text.includes('การงาน')) return 7;
    if(text.includes('ศิลป')) return 6;
    if(text.includes('สุขศึกษา') || text.includes('พลศึกษา')) return 5;
    if(text.includes('ประวัติ')) return 4;
    if(text.includes('สังคม')) return 3;
    if(text.includes('วิทย')) return 2;
    if(text.includes('คณิต')) return 1;
    if(text.includes('ภาษาไทย') || text === 'ไทย') return 0;
    if(text.includes('พลเมือง')) return 11;
    if(text.includes('ทุจริต')) return 12;
    return 99;
}

window.getAdminMidtermSubjectsForClass = function(cId) {
    const linked = typeof window.getGuardianReportSubjects === 'function'
        ? window.getGuardianReportSubjects(cId)
        : [];
    const linkedIds = new Set(linked.map(sub => String(sub.id)));
    return (DB.subjects || [])
        .filter(sub => linkedIds.has(String(sub.id)))
        .slice()
        .sort((a, b) => window.getAdminSubjectSortRank(a.name) - window.getAdminSubjectSortRank(b.name));
}

window.exportAdminExamSummary = async function(examType = null) {
    if(!state.user || state.user.role !== 'admin') return;
    if(typeof XLSX === 'undefined') {
        window.notify('ไม่พบตัวสร้างไฟล์ Excel กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', true);
        return;
    }

    const selectedType = examType || ($('admin-report-score-type') ? $('admin-report-score-type').value : 'mid');
    const scoreType = selectedType === 'final' ? 'final' : 'mid';
    const scoreLabel = scoreType === 'final' ? 'ปลายภาค' : 'กลางภาค';
    const classEntries = window.getSortedClassEntries();
    if(!classEntries.length) {
        window.notify('ยังไม่มีห้องเรียนสำหรับส่งออก', true);
        return;
    }

    if(typeof window.firebaseLoadScoresForSubjectsBulk === 'function') {
        window.notify(`กำลังดึงคะแนน${scoreLabel}ล่าสุดจากคลาวด์...`);
        const allSubjectIds = new Set();
        classEntries.forEach(([cId]) => {
            window.getAdminMidtermSubjectsForClass(cId).forEach(sub => allSubjectIds.add(String(sub.id)));
        });
        try { await window.firebaseLoadScoresForSubjectsBulk(Array.from(allSubjectIds)); }
        catch(err) { console.warn('Admin exam summary score preload failed:', err); }
    }

    const workbook = XLSX.utils.book_new();
    const usedSheetNames = new Set();
    const schoolName = String((DB.schoolInfo && DB.schoolInfo.name) || 'โรงเรียน');
    const schoolYear = String((DB.schoolInfo && DB.schoolInfo.year) || '');
    let exportedRooms = 0;
    classEntries.forEach(([cId, cls]) => {
        const subjects = window.getAdminMidtermSubjectsForClass(cId);
        if(!subjects.length || !(cls.students || []).length) return;
        const classKey = window.normalizeAdminMidtermClassKey(cls.name) || String(cls.name || cId);
        const fullScores = subjects.map(sub => window.getGuardianExamFullScore(sub.id, cId, scoreType));
        const totalFullScore = fullScores.reduce((sum, value) => sum + Number(value || 0), 0);
        const teacherName = typeof window.getGuardianHomeroomDefault === 'function'
            ? window.getGuardianHomeroomDefault(cId)
            : '';
        const lastCol = subjects.length + 4;
        const rows = [
            [`แบบสรุปรวมคะแนนในกลุ่มสาระการเรียนรู้/รายวิชาของนักเรียน   ประจำ${scoreLabel}เรียนที่ ${state.term}   ปีการศึกษา ${schoolYear}`],
            [schoolName],
            ['ระดับชั้นประถมศึกษาปีที่', '', '', classKey, 'จำนวน', '', (cls.students || []).length, 'คน', '', 'ครูประจำชั้น', '', '', teacherName],
            ['กลุ่มสาระ/วิชา', '', '', ...subjects.map(sub => sub.name || ''), 'รวม', 'ร้อยละ'],
            ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ  -  สกุล', ...fullScores, totalFullScore, '']
        ];

        (cls.students || []).forEach((student, index) => {
            const scores = subjects.map(sub => window.getGuardianExamScore(sub.id, cId, student.studentId, scoreType));
            const filledScores = scores.filter(score => score !== null && score !== undefined && score !== '');
            const total = filledScores.reduce((sum, score) => sum + Number(score || 0), 0);
            const percent = totalFullScore > 0 ? (total / totalFullScore) * 100 : 0;
            rows.push([
                index + 1,
                String(student.studentId || ''),
                student.name || '',
                ...scores.map(score => score === null || score === undefined ? '' : score),
                total,
                percent
            ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } }
        ];
        worksheet['!cols'] = [
            { wch: 7 }, { wch: 14 }, { wch: 30 },
            ...subjects.map(() => ({ wch: 12 })),
            { wch: 12 }, { wch: 12 }
        ];
        worksheet['!rows'] = [{ hpt: 24 }, { hpt: 22 }, { hpt: 22 }, { hpt: 52 }, { hpt: 24 }];
        const dataStartRow = 5;
        const percentCol = subjects.length + 4;
        for(let row = dataStartRow; row < rows.length; row++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: percentCol });
            if(worksheet[cellRef]) worksheet[cellRef].z = '0.00';
        }

        let sheetName = classKey.replace('/', '.').replace(/[\\/:*?"<>|]/g, '_').slice(0, 31) || `ห้อง${exportedRooms + 1}`;
        const baseName = sheetName;
        let suffix = 2;
        while(usedSheetNames.has(sheetName)) {
            sheetName = `${baseName.slice(0, 27)}_${suffix++}`;
        }
        usedSheetNames.add(sheetName);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        exportedRooms++;
    });

    if(exportedRooms === 0) {
        window.notify('ไม่พบห้องที่มีรายวิชาและรายชื่อนักเรียนสำหรับส่งออก', true);
        return;
    }
    const safeYear = String((DB.schoolInfo && DB.schoolInfo.year) || '').replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(workbook, `แบบสรุปคะแนนรวม_${scoreLabel}_เทอม${state.term}_${safeYear}.xlsx`);
    window.notify(`ส่งออกคะแนนสอบ${scoreLabel}แล้ว ${exportedRooms} ห้อง`);
}

window.exportAdminMidtermSummary = function() {
    return window.exportAdminExamSummary('mid');
}

window.MAX_ADMIN_EXAM_PDF_ROWS_PER_PAGE = 45;

window.buildAdminExamPdfPage = function(cId, cls, scoreType = 'mid', pageNumber = 1, totalPages = 1, studentsOverride = null, startIndex = 0) {
    if(typeof window.buildExecutiveReportPage === 'function') {
        return window.buildExecutiveReportPage(cId, cls, scoreType, pageNumber, totalPages);
    }
    return '';
};

window.exportAdminExamSummaryPdf = async function(examType = null) {
    if(!state.user || state.user.role !== 'admin') return;
    if(typeof window.openExecutiveReportModal === 'function') {
        const selectedType = examType || ($('admin-report-score-type') ? $('admin-report-score-type').value : 'final');
        window.openExecutiveReportModal();
        setTimeout(() => {
            const radio = document.querySelector(`input[name="exec-modal-score-type"][value="${selectedType === 'mid' ? 'mid' : 'final'}"]`);
            if(radio) radio.checked = true;
        }, 60);
    }
};

window.checkAdminExamEntryStatus = async function() {
    if(!state.user || state.user.role !== 'admin') return;
    const classEntries = window.getSortedClassEntries().filter(([cId, cls]) => {
        return (cls.students || []).length > 0 && window.getAdminMidtermSubjectsForClass(cId).length > 0;
    });
    const output = $('admin-exam-status-output');
    const button = $('admin-exam-status-check-btn');
    const originalButtonHtml = button ? button.innerHTML : '';
    if(!classEntries.length) {
        window.notify('ไม่พบห้องที่มีรายวิชาและรายชื่อนักเรียนสำหรับตรวจสอบ', true);
        return;
    }
    if(button) { button.disabled = true; button.innerHTML = '<i class="ph ph-spinner-gap animate-spin text-xl"></i> กำลังตรวจสอบ'; }
    if(output) output.innerHTML = `<div class="py-8 text-center text-slate-500"><i class="ph ph-spinner-gap text-3xl text-rose-500 animate-spin"></i><p class="font-bold mt-2">กำลังดึงคะแนนล่าสุดจากคลาวด์เพื่อตรวจสอบ (ตรวจสอบอย่างเดียว ไม่แก้ไขคะแนน)...</p></div>`;

    try {
        // Read-only check: pulls the latest scores from the cloud so the check reflects
        // reality, but never writes, edits, or deletes anything.
        if(typeof window.firebaseLoadScoresForSubjectsBulk === 'function') {
            const allSubjectIds = new Set();
            classEntries.forEach(([cId]) => {
                window.getAdminMidtermSubjectsForClass(cId).forEach(sub => allSubjectIds.add(String(sub.id)));
            });
            try { await window.firebaseLoadScoresForSubjectsBulk(Array.from(allSubjectIds)); }
            catch(err) { console.warn('Exam status check score refresh failed:', err); }
        }

        const rows = [];
        let roomsFullyMissingMid = 0;
        classEntries.forEach(([cId, cls]) => {
            const subjects = window.getAdminMidtermSubjectsForClass(cId);
            const students = cls.students || [];
            const total = students.length;
            const classKey = window.normalizeAdminMidtermClassKey(cls.name) || String(cls.name || cId);
            let roomMidFilled = 0;
            subjects.forEach(sub => {
                let midCount = 0, finalCount = 0;
                students.forEach(stu => {
                    if(window.getGuardianExamScore(sub.id, cId, stu.studentId, 'mid') !== null) midCount++;
                    if(window.getGuardianExamScore(sub.id, cId, stu.studentId, 'final') !== null) finalCount++;
                });
                roomMidFilled += midCount;
                rows.push({ classKey, subjectName: sub.name || '', total, midCount, finalCount });
            });
            if(roomMidFilled === 0) roomsFullyMissingMid++;
        });

        const missingMidRows = rows.filter(r => r.midCount === 0);
        const partialMidRows = rows.filter(r => r.midCount > 0 && r.midCount < r.total);
        const missingFinalRows = rows.filter(r => r.finalCount === 0);

        const esc = value => window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '');
        const rowHtml = (r, type) => {
            const count = type === 'mid' ? r.midCount : r.finalCount;
            const statusClass = count === 0 ? 'text-rose-600' : (count < r.total ? 'text-amber-600' : 'text-emerald-600');
            const statusText = count === 0 ? 'ยังไม่ได้ลงเลย' : (count < r.total ? `ลงบางส่วน (${count}/${r.total})` : 'ครบแล้ว');
            return `<tr class="border-b border-slate-100">
                <td class="py-2 px-3 font-bold text-slate-700">${esc(r.classKey)}</td>
                <td class="py-2 px-3 text-slate-600">${esc(r.subjectName)}</td>
                <td class="py-2 px-3 font-bold ${statusClass}">${statusText}</td>
            </tr>`;
        };
        const buildTable = (title, list, type) => {
            if(!list.length) return `<div class="text-sm text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-4"><i class="ph ph-check-circle"></i> ${esc(title)}: ไม่มี</div>`;
            return `<div class="mb-6">
                <h4 class="font-extrabold text-slate-800 mb-2">${esc(title)} (${list.length} รายการ)</h4>
                <div class="overflow-x-auto border border-slate-200 rounded-xl">
                    <table class="w-full text-sm">
                        <thead><tr class="bg-slate-50 text-left text-slate-500 font-bold"><th class="py-2 px-3">ห้อง</th><th class="py-2 px-3">รายวิชา</th><th class="py-2 px-3">สถานะ</th></tr></thead>
                        <tbody>${list.map(r => rowHtml(r, type)).join('')}</tbody>
                    </table>
                </div>
            </div>`;
        };

        const summaryCards = `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div class="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3"><span class="text-rose-500 font-bold text-xs">ห้องที่ยังไม่ได้ลงกลางภาคเลยสักวิชา</span><strong class="block text-2xl text-rose-700 mt-1">${roomsFullyMissingMid} ห้อง</strong></div>
                <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"><span class="text-amber-600 font-bold text-xs">รายวิชา/ห้อง ที่ยังไม่ได้ลงกลางภาคเลย</span><strong class="block text-2xl text-amber-700 mt-1">${missingMidRows.length} รายการ</strong></div>
                <div class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"><span class="text-slate-500 font-bold text-xs">รายวิชา/ห้อง ที่ยังไม่ได้ลงปลายภาคเลย</span><strong class="block text-2xl text-slate-700 mt-1">${missingFinalRows.length} รายการ</strong></div>
            </div>`;

        if(output) {
            output.innerHTML = summaryCards
                + buildTable('รายวิชา/ห้อง ที่ยังไม่ได้ลงคะแนนกลางภาคเลย', missingMidRows, 'mid')
                + buildTable('รายวิชา/ห้อง ที่ลงคะแนนกลางภาคบางส่วน', partialMidRows, 'mid')
                + buildTable('รายวิชา/ห้อง ที่ยังไม่ได้ลงคะแนนปลายภาคเลย', missingFinalRows, 'final');
        }
        window.notify(`ตรวจสอบเสร็จแล้ว พบ ${missingMidRows.length} รายวิชา/ห้องที่ยังไม่ได้ลงคะแนนกลางภาคเลย`);
    } catch(err) {
        console.error('Admin exam status check failed:', err);
        window.notify('ตรวจสอบสถานะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', true);
        if(output) output.innerHTML = '';
    } finally {
        if(button) { button.disabled = false; button.innerHTML = originalButtonHtml; }
    }
}

window.getAdminMidtermTermNode = function(subId, clsId, stuId) {
    const studentNode = (((DB_SubjectData[subId] || {}).scores || {})[clsId] || {})[stuId] || {};
    if(studentNode[state.term] && typeof studentNode[state.term] === 'object') return studentNode[state.term];
    if(studentNode.term !== undefined && String(studentNode.term) === String(state.term)) return studentNode;
    return null;
}

window.persistAdminExamImportIsolated = async function(plan) {
    const scoreUpdates = Array.isArray(plan && plan.updates) ? plan.updates : [];
    const examUpdates = Array.isArray(plan && plan.examUpdates) ? plan.examUpdates : [];

    scoreUpdates.forEach(({ subId, clsId, stuId, field, score }) => {
        const scoreField = field || 'midTermScore';
        window.scheduleScoreAutoSave(subId, clsId, stuId, state.term, scoreField, score);
    });
    window.persistScoreSafetyLogNow();
    window.saveSubjectDataLocalNow();

    if(scoreUpdates.length && typeof window.firebaseBatchWriteScoreNodes !== 'function') {
        throw new Error('isolated cloud score writer is not ready');
    }
    if(examUpdates.length && typeof window.firebasePatchExamSettings !== 'function') {
        throw new Error('isolated exam settings writer is not ready');
    }

    const cloudTasks = examUpdates.map(({ subId, clsId, fullScore, mid, final }) => {
        const patch = {};
        if(Number.isFinite(Number(fullScore)) && Number(fullScore) > 0) patch.mid = Number(fullScore);
        if(Number.isFinite(Number(mid)) && Number(mid) > 0) patch.mid = Number(mid);
        if(Number.isFinite(Number(final)) && Number(final) > 0) patch.final = Number(final);
        return window.firebasePatchExamSettings(subId, clsId, state.term, patch);
    });

    if(scoreUpdates.length) {
        // Bulk imports touch far too many cells to flush through the interactive per-cell
        // autosave path (one Firestore write per cell, all fired at once) without tripping
        // Firestore's write-rate quota, which fails silently and leaves the import
        // unsynced to the cloud (it only looks saved until the next refresh). Use a batched
        // write instead: a handful of writeBatch() commits covering every touched cell.
        const targets = [];
        const seenTargets = new Set();
        scoreUpdates.forEach(({ subId, clsId, stuId }) => {
            const key = `${subId}|${clsId}|${stuId}`;
            if(seenTargets.has(key)) return;
            seenTargets.add(key);
            targets.push({ subId, clsId, stuId });
        });
        cloudTasks.push((async () => {
            const result = await window.firebaseBatchWriteScoreNodes(targets);
            if(result.failed > 0) {
                throw new Error(`คลาวด์บันทึกคะแนนไม่ครบ (${result.failed}/${result.total} รายการ)`);
            }
            scoreUpdates.forEach(({ subId, clsId, stuId, field }) => {
                const scoreField = field || 'midTermScore';
                const key = window.scoreAutoSaveKey(subId, clsId, stuId, state.term, scoreField);
                if(scoreAutoSaveTimers[key]) { clearTimeout(scoreAutoSaveTimers[key]); delete scoreAutoSaveTimers[key]; }
                delete scoreAutoSavePending[key];
                window.clearScoreSubjectPendingIfDone(subId, clsId, stuId);
            });
            window.persistScoreAutoSavePending();
            window.setScoreAutoSaveStatus('saved', 'บันทึกอัตโนมัติแล้ว');
        })());
    }
    await Promise.all(cloudTasks);
}

window.parseAdminMidtermWorkbook = function(workbook, fileName = '') {
    const classMap = new Map();
    window.getSortedClassEntries().forEach(([cId, cls]) => {
        const key = window.normalizeAdminMidtermClassKey(cls.name || cId);
        if(key) classMap.set(key, { cId, cls });
    });
    const updateMap = new Map();
    const examUpdateMap = new Map();
    const matchedRooms = new Set();
    const matchedSubjects = new Set();
    const unmatchedSheets = [];
    const unmatchedSubjects = new Set();
    const lockedPairs = new Set();
    let matchedStudentRows = 0;
    let unmatchedStudents = 0;
    let invalidScores = 0;
    let duplicateCells = 0;
    let overwriteCount = 0;
    let unchangedScoreCount = 0;
    let lowerScoreCount = 0;
    const autoAdjustedMidtermKeys = new Set();

    (workbook.SheetNames || []).forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
        if(!rows.length) return;
        const hintValues = [sheetName, ...rows.slice(0, 6).flat()];
        let classEntry = null;
        for(const hint of hintValues) {
            const key = window.normalizeAdminMidtermClassKey(hint);
            if(key && classMap.has(key)) {
                classEntry = classMap.get(key);
                break;
            }
        }
        if(!classEntry) {
            unmatchedSheets.push(sheetName);
            return;
        }
        const { cId, cls } = classEntry;
        const idHeaderRow = rows.findIndex(row => row.some(cell => String(cell ?? '').replace(/\s+/g, '').includes('รหัสนักเรียน')));
        if(idHeaderRow < 1) {
            unmatchedSheets.push(sheetName);
            return;
        }
        const idCol = rows[idHeaderRow].findIndex(cell => String(cell ?? '').replace(/\s+/g, '').includes('รหัสนักเรียน'));
        const nameCol = rows[idHeaderRow].findIndex(cell => String(cell ?? '').replace(/\s+/g, '').includes('ชื่อ'));
        const subjectHeaderRow = rows[idHeaderRow - 1] || [];
        const totalCol = subjectHeaderRow.findIndex((cell, col) => col > nameCol && String(cell ?? '').trim() === 'รวม');
        const endSubjectCol = totalCol > nameCol ? totalCol : subjectHeaderRow.length;
        const studentById = new Map((cls.students || []).map(stu => [String(stu.studentId || '').trim().replace(/\.0$/, ''), stu]).filter(([key]) => key));
        const subjectMap = new Map();
        window.getAdminMidtermSubjectsForClass(cId).forEach(sub => {
            const key = window.normalizeAdminMidtermSubjectKey(sub.name);
            if(!key) return;
            if(!subjectMap.has(key)) subjectMap.set(key, []);
            subjectMap.get(key).push(sub);
        });
        const subjectUseCounts = new Map();
        const mappedColumns = [];

        for(let col = Math.max(nameCol + 1, 3); col < endSubjectCol; col++) {
            const header = subjectHeaderRow[col];
            const subjectKey = window.normalizeAdminMidtermSubjectKey(header);
            if(!subjectKey) continue;
            const matches = subjectMap.get(subjectKey) || [];
            const matchIndex = subjectUseCounts.get(subjectKey) || 0;
            if(!matches[matchIndex]) {
                unmatchedSubjects.add(String(header || `คอลัมน์ ${col + 1}`));
                continue;
            }
            const sub = matches[matchIndex];
            subjectUseCounts.set(subjectKey, matchIndex + 1);
            const fullScoreRaw = Number(String((rows[idHeaderRow] || [])[col] ?? '').trim().replace(/,/g, '.'));
            const fullScore = Number.isFinite(fullScoreRaw) && fullScoreRaw > 0
                ? fullScoreRaw
                : window.getGuardianExamFullScore(sub.id, cId, 'mid');
            const pairKey = `${sub.id}|${cId}`;
            const lockKey = window.getScoreLockKey(sub.id, cId, state.term);
            const lock = window.scoreLocks && window.scoreLocks[lockKey];
            if(window.isScoreLockActive(lock) && lock.sessionId !== browserSessionId) {
                lockedPairs.add(pairKey);
                continue;
            }
            mappedColumns.push({ col, sub, fullScore, pairKey });
            examUpdateMap.set(pairKey, { subId: sub.id, clsId: cId, fullScore });
            matchedSubjects.add(String(sub.id));
        }

        if(!mappedColumns.length) return;
        matchedRooms.add(String(cId));
        for(let rowIndex = idHeaderRow + 1; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex] || [];
            const studentId = String(row[idCol] ?? '').trim().replace(/\.0$/, '');
            if(!studentId) continue;
            const student = studentById.get(studentId);
            if(!student) {
                if(row.some(cell => String(cell ?? '').trim() !== '')) unmatchedStudents++;
                continue;
            }
            matchedStudentRows++;
            mappedColumns.forEach(({ col, sub, fullScore, pairKey }) => {
                const rawValue = row[col];
                if(rawValue === undefined || rawValue === null || String(rawValue).trim() === '' || String(rawValue).trim() === '-') return;
                let score = Number(String(rawValue).trim().replace(/,/g, '.'));
                if(!Number.isFinite(score) || score < 0 || score > Number(fullScore)) {
                    invalidScores++;
                    return;
                }
                const halfScore = Math.round((Number(fullScore) / 2) * 100) / 100;
                let midtermAdjusted = false;
                if(score < halfScore) {
                    score = halfScore;
                    midtermAdjusted = true;
                }
                const oldTermNode = window.getAdminMidtermTermNode(sub.id, cId, student.studentId);
                const oldNormalized = oldTermNode && window.normalizeScoreValue
                    ? window.normalizeScoreValue(oldTermNode.midTermScore, 'midTermScore')
                    : (oldTermNode ? oldTermNode.midTermScore : '');
                const updateKey = `${pairKey}|${student.studentId}`;
                const plannedUpdate = updateMap.get(updateKey);
                const comparisonValue = plannedUpdate ? plannedUpdate.score : oldNormalized;
                if(comparisonValue !== '' && Number(comparisonValue) === score) { unchangedScoreCount++; return; }
                if(comparisonValue !== '' && score < Number(comparisonValue)) { lowerScoreCount++; return; }
                if(plannedUpdate) duplicateCells++;
                if(!plannedUpdate && oldNormalized !== '' && score > Number(oldNormalized)) overwriteCount++;
                if(midtermAdjusted) autoAdjustedMidtermKeys.add(`${cId}|${student.studentId}`);
                updateMap.set(updateKey, {
                    subId: sub.id,
                    clsId: cId,
                    stuId: student.studentId,
                    score,
                    oldValue: oldNormalized
                });
            });
        }
    });

    return {
        fileName,
        updates: Array.from(updateMap.values()),
        examUpdates: Array.from(examUpdateMap.values()),
        matchedRooms: matchedRooms.size,
        matchedSubjects: matchedSubjects.size,
        matchedStudentRows,
        overwriteCount,
        invalidScores,
        unmatchedStudents,
        unmatchedSheets,
        unmatchedSubjects: Array.from(unmatchedSubjects),
        lockedPairs: lockedPairs.size,
        duplicateCells,
        unchangedScoreCount,
        lowerScoreCount,
        autoAdjustedMidtermCount: autoAdjustedMidtermKeys.size
    };
}

window.applyAdminMidtermImport = async function(plan) {
    if(!state.user || state.user.role !== 'admin') return;
    if(!plan || !Array.isArray(plan.updates) || !plan.updates.length || window.adminMidtermImportRunning) return;
    window.adminMidtermImportRunning = true;
    try {
        plan.examUpdates.forEach(({ subId, clsId, fullScore }) => {
            if(!DB_SubjectData[subId]) DB_SubjectData[subId] = { classData: {}, scores: {} };
            const sd = DB_SubjectData[subId];
            if(!sd.classData) sd.classData = {};
            if(!sd.scores) sd.scores = {};
            if(!sd.classData[clsId]) sd.classData[clsId] = { examSettings: {} };
            if(!sd.classData[clsId].examSettings) sd.classData[clsId].examSettings = {};
            if(!sd.classData[clsId].examSettings[state.term]) sd.classData[clsId].examSettings[state.term] = { mid: fullScore, final: 30 };
            sd.classData[clsId].examSettings[state.term].mid = fullScore;
        });

        plan.updates.forEach(({ subId, clsId, stuId, score }) => {
            const sd = DB_SubjectData[subId];
            if(!sd.scores[clsId]) sd.scores[clsId] = {};
            if(!sd.scores[clsId][stuId]) sd.scores[clsId][stuId] = {};
            if(!sd.scores[clsId][stuId][state.term]) sd.scores[clsId][stuId][state.term] = {};
            sd.scores[clsId][stuId][state.term].midTermScore = score;
            window.rememberScoreSafetyValue(subId, clsId, stuId, state.term, 'midTermScore', score, { persistDelay: 1000 });
        });

        window.notify(`นำเข้าคะแนนกลางภาค ${plan.updates.length} ช่องแล้ว กำลังบันทึกขึ้นคลาวด์...`);

        try {
            await window.persistAdminExamImportIsolated(plan);
            window.notify(`นำเข้าและบันทึกคะแนนกลางภาคบนคลาวด์สำเร็จ ${plan.updates.length} ช่อง โดยไม่แก้ไขคะแนนรายหน่วย`);
        } catch(err) {
            console.error('Admin midterm isolated cloud save failed:', err);
            window.notify('คะแนนสอบถูกเก็บในเครื่องและเข้าคิวซิงก์รายช่องแล้ว แต่คลาวด์ยังบันทึกไม่ครบ ระบบจะลองใหม่โดยไม่แตะคะแนนรายหน่วย', true);
        }
    } finally {
        window.adminMidtermImportRunning = false;
    }
}

window.importAdminMidtermSummary = function(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if(!file) return;
    if(!state.user || state.user.role !== 'admin') { input.value = ''; return; }
    const status = window.getScoreEntryStatus();
    if(!status.allowed) {
        window.notify(status.message, true);
        input.value = '';
        return;
    }
    if(typeof XLSX === 'undefined') {
        window.notify('ไม่พบตัวอ่านไฟล์ Excel กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', true);
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(loadEvent) {
        try {
            const workbook = XLSX.read(loadEvent.target.result, { type: 'array' });
            const plan = window.parseAdminMidtermWorkbook(workbook, file.name);
            if(!plan.updates.length) {
                const reason = plan.lockedPairs
                    ? `สมุดคะแนนที่พบถูกล็อกอยู่ ${plan.lockedPairs} วิชา/ห้อง`
                    : ((plan.unchangedScoreCount || plan.lowerScoreCount)
                        ? `ไม่มีคะแนนที่สูงกว่าคะแนนเดิม (เท่าเดิม ${plan.unchangedScoreCount || 0} ช่อง ต่ำกว่าเดิม ${plan.lowerScoreCount || 0} ช่อง)`
                        : 'ไม่พบคะแนนใหม่ที่ตรงกับรหัสนักเรียน ห้อง และรายวิชาในระบบ');
                window.notify(`ไม่สามารถนำเข้าได้: ${reason}`, true);
                return;
            }
            const notes = [
                `ไฟล์: ${file.name}`,
                `พบ ${plan.matchedRooms} ห้อง ${plan.matchedSubjects} วิชา`,
                `จะนำเข้าเฉพาะคะแนนสอบกลางภาค ${plan.updates.length} ช่อง`,
                `คะแนนเดิมที่จะถูกเพิ่มและแทนที่ ${plan.overwriteCount} ช่อง`,
                '',
                'ช่องว่างในไฟล์จะถูกข้าม ไม่ล้างคะแนนเดิม'
            ];
            if(plan.invalidScores) notes.push(`ข้ามคะแนนไม่ถูกต้อง/เกินคะแนนเต็ม ${plan.invalidScores} ช่อง`);
            if(plan.unchangedScoreCount) notes.push(`ข้ามคะแนนเท่าเดิม ${plan.unchangedScoreCount} ช่อง`);
            if(plan.lowerScoreCount) notes.push(`ข้ามคะแนนต่ำกว่าคะแนนเดิม ${plan.lowerScoreCount} ช่อง เพื่อป้องกันคะแนนลดลง`);
            if(plan.autoAdjustedMidtermCount) notes.push(`พบคะแนนต่ำกว่าครึ่ง ${plan.autoAdjustedMidtermCount} คน ระบบจะปรับเป็นครึ่งของคะแนนเต็มอัตโนมัติ`);
            if(plan.unmatchedStudents) notes.push(`ข้ามรหัสนักเรียนที่ไม่ตรง ${plan.unmatchedStudents} แถว`);
            if(plan.unmatchedSheets.length) notes.push(`ข้ามชีตที่หาห้องไม่พบ ${plan.unmatchedSheets.length} ชีต`);
            if(plan.unmatchedSubjects.length) notes.push(`ข้ามชื่อวิชาที่จับคู่ไม่ได้ ${plan.unmatchedSubjects.length} รายการ`);
            if(plan.lockedPairs) notes.push(`ข้ามสมุดคะแนนที่มีผู้ใช้อื่นกำลังกรอก ${plan.lockedPairs} วิชา/ห้อง`);
            window.showCustomConfirm(
                'ยืนยันนำเข้าคะแนนสอบกลางภาค',
                notes.join('\n'),
                plan.overwriteCount > 0 ? 'warning' : 'info',
                () => window.applyAdminMidtermImport(plan)
            );
        } catch(err) {
            console.error('Admin midterm import parse failed:', err);
            window.notify('อ่านไฟล์ไม่สำเร็จ กรุณาใช้ไฟล์แบบสรุปคะแนนกลางภาคตามต้นแบบ', true);
        } finally {
            input.value = '';
        }
    };
    reader.onerror = function() {
        input.value = '';
        window.notify('อ่านไฟล์ Excel ไม่สำเร็จ', true);
    };
    reader.readAsArrayBuffer(file);
}

window.getAdminExamFullScore = function(subId, clsId, scoreType) {
    const sd = DB_SubjectData[subId] || {};
    const classConfig = (sd.classData && sd.classData[clsId]) ? sd.classData[clsId] : sd;
    const exam = (classConfig.examSettings && classConfig.examSettings[state.term]) || {};
    const key = scoreType === 'finalScore' ? 'final' : 'mid';
    const fallback = key === 'final' ? 30 : 20;
    const value = Number(exam[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

window.exportAdminExamImportTemplate = function(examType = null) {
    if(!state.user || state.user.role !== 'admin') return;
    if(typeof XLSX === 'undefined') {
        window.notify('ไม่พบตัวสร้างไฟล์ Excel กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', true);
        return;
    }
    const selectedType = examType || ($('admin-template-score-type') ? $('admin-template-score-type').value : 'midTermScore');
    const scoreField = selectedType === 'finalScore' ? 'finalScore' : 'midTermScore';
    const scoreLabel = scoreField === 'finalScore' ? 'ปลายภาค' : 'กลางภาค';
    const classEntries = window.getSortedClassEntries();
    if(!classEntries.length) {
        window.notify('ยังไม่มีห้องเรียนสำหรับสร้างแม่แบบ', true);
        return;
    }

    const workbook = XLSX.utils.book_new();
    const usedSheetNames = new Set();
    const schoolName = String((DB.schoolInfo && DB.schoolInfo.name) || 'โรงเรียน');
    const schoolYear = String((DB.schoolInfo && DB.schoolInfo.year) || '');
    let exportedRooms = 0;

    classEntries.forEach(([cId, cls]) => {
        const subjects = window.getAdminMidtermSubjectsForClass(cId);
        const students = cls.students || [];
        if(!subjects.length || !students.length) return;
        const classKey = window.normalizeAdminMidtermClassKey(cls.name) || String(cls.name || cId);
        const scoreColumns = subjects.map(sub => ({
            sub,
            type: scoreField,
            label: scoreLabel,
            fullScore: window.getAdminExamFullScore(sub.id, cId, scoreField)
        }));
        const rows = [
            [`แม่แบบนำเข้าคะแนนสอบ${scoreLabel} เทอม ${state.term} ปีการศึกษา ${schoolYear}`],
            [schoolName],
            ['ห้องเรียน', '', '', classKey, 'เทอม', state.term, 'ปีการศึกษา', schoolYear],
            ['ข้อมูลนักเรียน', '', '', ...subjects.map(sub => sub.name || '')],
            ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-สกุล', ...scoreColumns.map(item => item.label)],
            ['คะแนนเต็ม', '', '', ...scoreColumns.map(item => item.fullScore)]
        ];
        students.forEach((student, index) => {
            rows.push([index + 1, String(student.studentId || ''), student.name || '', ...scoreColumns.map(() => '')]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const lastCol = 2 + scoreColumns.length;
        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } }
        ];
        worksheet['!cols'] = [
            { wch: 8 }, { wch: 15 }, { wch: 32 },
            ...scoreColumns.map(() => ({ wch: 12 }))
        ];
        worksheet['!rows'] = [
            { hpt: 26 }, { hpt: 22 }, { hpt: 22 }, { hpt: 38 }, { hpt: 24 }, { hpt: 22 }
        ];

        let sheetName = classKey.replace('/', '.').replace(/[\\/:*?"<>|]/g, '_').slice(0, 31) || `ห้อง${exportedRooms + 1}`;
        const baseName = sheetName;
        let suffix = 2;
        while(usedSheetNames.has(sheetName)) sheetName = `${baseName.slice(0, 27)}_${suffix++}`;
        usedSheetNames.add(sheetName);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        exportedRooms++;
    });

    if(!exportedRooms) {
        window.notify('ไม่พบห้องที่มีรายวิชาและรายชื่อนักเรียนสำหรับสร้างแม่แบบ', true);
        return;
    }
    const safeYear = schoolYear.replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(workbook, `แม่แบบนำเข้าคะแนนสอบ_${scoreLabel}_เทอม${state.term}_${safeYear}.xlsx`);
    window.notify(`ดาวน์โหลดแม่แบบนำเข้าคะแนนสอบ${scoreLabel}แล้ว ${exportedRooms} ห้อง`);
}

window.toggleAdminExamImportOverwriteSubjects = function(checked) {
    const wrap = $('admin-exam-import-overwrite-subjects-wrap');
    if(wrap) wrap.classList.toggle('hidden', !checked);
    if(!checked) {
        document.querySelectorAll('.admin-exam-import-overwrite-subject').forEach(el => { el.checked = false; });
        document.querySelectorAll('.admin-exam-import-overwrite-class').forEach(el => { el.checked = false; });
    }
}

window.setAdminExamImportOverwriteClasses = function(checked) {
    document.querySelectorAll('.admin-exam-import-overwrite-class').forEach(el => { el.checked = checked; });
}

window.parseAdminExamImportWorkbook = function(workbook, fileName = '', options = {}) {
    const overwriteExisting = !!options.overwriteExisting;
    const overwriteSubjectIds = new Set((options.overwriteSubjectIds || []).map(String));
    const overwriteClassIds = new Set((options.overwriteClassIds || []).map(String));
    const classMap = new Map();
    window.getSortedClassEntries().forEach(([cId, cls]) => {
        const key = window.normalizeAdminMidtermClassKey(cls.name || cId);
        if(key) classMap.set(key, { cId, cls });
    });
    const updateMap = new Map();
    const examUpdateMap = new Map();
    const matchedRooms = new Set();
    const matchedSubjects = new Set();
    const unmatchedSheets = [];
    const unmatchedSubjects = new Set();
    const lockedPairs = new Set();
    let matchedStudentRows = 0;
    let unmatchedStudents = 0;
    let invalidScores = 0;
    let midtermCount = 0;
    let finalCount = 0;
    let unchangedScoreCount = 0;
    let existingScoreSkippedCount = 0;
    let overwrittenScoreCount = 0;
    const autoAdjustedMidtermKeys = new Set();

    (workbook.SheetNames || []).forEach(sheetName => {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
        if(!rows.length) return;
        let classEntry = null;
        for(const hint of [sheetName, ...rows.slice(0, 7).flat()]) {
            const key = window.normalizeAdminMidtermClassKey(hint);
            if(key && classMap.has(key)) { classEntry = classMap.get(key); break; }
        }
        if(!classEntry) { unmatchedSheets.push(sheetName); return; }

        const { cId, cls } = classEntry;
        const idHeaderRow = rows.findIndex(row => row.some(cell => String(cell ?? '').replace(/\s+/g, '').includes('รหัสนักเรียน')));
        if(idHeaderRow < 1 || !rows[idHeaderRow + 1]) { unmatchedSheets.push(sheetName); return; }
        const idCol = rows[idHeaderRow].findIndex(cell => String(cell ?? '').replace(/\s+/g, '').includes('รหัสนักเรียน'));
        const nameCol = rows[idHeaderRow].findIndex(cell => String(cell ?? '').replace(/\s+/g, '').includes('ชื่อ'));
        const subjectHeaderRow = rows[idHeaderRow - 1] || [];
        const scoreTypeRow = rows[idHeaderRow] || [];
        const fullScoreRow = rows[idHeaderRow + 1] || [];
        const studentById = new Map((cls.students || []).map(stu => [String(stu.studentId || '').trim().replace(/\.0$/, ''), stu]).filter(([key]) => key));
        const subjectMap = new Map();
        window.getAdminMidtermSubjectsForClass(cId).forEach(sub => {
            const key = window.normalizeAdminMidtermSubjectKey(sub.name);
            if(!key) return;
            if(!subjectMap.has(key)) subjectMap.set(key, []);
            subjectMap.get(key).push(sub);
        });
        const subjectUseCounts = new Map();

        const mappedColumns = [];
        let carriedSubjectHeader = '';
        let carriedSubject = null;
        const maxColumns = Math.max(subjectHeaderRow.length, scoreTypeRow.length, fullScoreRow.length);
        for(let col = Math.max(nameCol + 1, 3); col < maxColumns; col++) {
            const rawHeader = String(subjectHeaderRow[col] ?? '').trim();
            if(rawHeader) {
                carriedSubjectHeader = rawHeader;
                const nextSubjectKey = window.normalizeAdminMidtermSubjectKey(carriedSubjectHeader);
                const matches = subjectMap.get(nextSubjectKey) || [];
                const matchIndex = subjectUseCounts.get(nextSubjectKey) || 0;
                carriedSubject = matches[matchIndex] || null;
                if(carriedSubject) subjectUseCounts.set(nextSubjectKey, matchIndex + 1);
                else unmatchedSubjects.add(carriedSubjectHeader || `คอลัมน์ ${col + 1}`);
            }
            const subjectKey = window.normalizeAdminMidtermSubjectKey(carriedSubjectHeader);
            const typeLabel = String(scoreTypeRow[col] ?? '').replace(/\s+/g, '');
            const field = typeLabel.includes('กลาง') ? 'midTermScore' : (typeLabel.includes('ปลาย') ? 'finalScore' : '');
            if(!subjectKey || !field || !carriedSubject) continue;
            const sub = carriedSubject;
            const fullScoreRaw = Number(String(fullScoreRow[col] ?? '').trim().replace(/,/g, '.'));
            const fullScore = Number.isFinite(fullScoreRaw) && fullScoreRaw > 0
                ? fullScoreRaw
                : window.getAdminExamFullScore(sub.id, cId, field);
            const pairKey = `${sub.id}|${cId}`;
            const lockKey = window.getScoreLockKey(sub.id, cId, state.term);
            const lock = window.scoreLocks && window.scoreLocks[lockKey];
            if(window.isScoreLockActive(lock) && lock.sessionId !== browserSessionId) {
                lockedPairs.add(pairKey);
                continue;
            }
            mappedColumns.push({ col, sub, field, fullScore, pairKey });
            const examUpdate = examUpdateMap.get(pairKey) || { subId: sub.id, clsId: cId };
            examUpdate[field === 'finalScore' ? 'final' : 'mid'] = fullScore;
            examUpdateMap.set(pairKey, examUpdate);
            matchedSubjects.add(String(sub.id));
        }
        if(!mappedColumns.length) return;

        matchedRooms.add(String(cId));
        for(let rowIndex = idHeaderRow + 2; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex] || [];
            const studentId = String(row[idCol] ?? '').trim().replace(/\.0$/, '');
            if(!studentId) continue;
            const student = studentById.get(studentId);
            if(!student) {
                if(row.some(cell => String(cell ?? '').trim() !== '')) unmatchedStudents++;
                continue;
            }
            matchedStudentRows++;
            mappedColumns.forEach(({ col, sub, field, fullScore, pairKey }) => {
                const rawValue = row[col];
                if(rawValue === undefined || rawValue === null || String(rawValue).trim() === '' || String(rawValue).trim() === '-') return;
                let score = Number(String(rawValue).trim().replace(/,/g, '.'));
                if(!Number.isFinite(score) || score < 0 || score > fullScore) { invalidScores++; return; }
                let midtermAdjusted = false;
                if(field === 'midTermScore') {
                    const halfScore = Math.round((Number(fullScore) / 2) * 100) / 100;
                    if(score < halfScore) {
                        score = halfScore;
                        midtermAdjusted = true;
                    }
                }
                const oldTermNode = window.getAdminMidtermTermNode(sub.id, cId, student.studentId);
                const oldNormalized = oldTermNode && window.normalizeScoreValue
                    ? window.normalizeScoreValue(oldTermNode[field], field)
                    : (oldTermNode ? oldTermNode[field] : '');
                const updateKey = `${pairKey}|${student.studentId}|${field}`;
                const plannedUpdate = updateMap.get(updateKey);
                // By default a cell that already has a score in the system is never touched -
                // import only fills in cells that are still blank. The admin can explicitly
                // opt into overwrite mode and pick exactly which subject(s) AND which room(s)
                // it applies to - anything else present in this same file (even with a
                // differing value) is treated the same as the default: existing score wins,
                // file value is ignored, so fixing one subject/room can never silently change
                // another.
                if(oldNormalized !== '') {
                    const subjectOverwriteAllowed = overwriteExisting
                        && overwriteSubjectIds.has(String(sub.id))
                        && overwriteClassIds.has(String(cId));
                    if(!subjectOverwriteAllowed) { existingScoreSkippedCount++; return; }
                    if(Number(oldNormalized) === score) { unchangedScoreCount++; return; }
                }
                if(plannedUpdate && Number(plannedUpdate.score) === score) { unchangedScoreCount++; return; }
                if(oldNormalized !== '') overwrittenScoreCount++;
                if(midtermAdjusted) autoAdjustedMidtermKeys.add(`${cId}|${student.studentId}`);
                updateMap.set(updateKey, { subId: sub.id, clsId: cId, stuId: student.studentId, field, score, oldValue: oldNormalized });
                if(field === 'finalScore') finalCount++;
                else midtermCount++;
            });
        }
    });

    return {
        fileName,
        updates: Array.from(updateMap.values()),
        examUpdates: Array.from(examUpdateMap.values()),
        matchedRooms: matchedRooms.size,
        matchedSubjects: matchedSubjects.size,
        matchedStudentRows,
        midtermCount,
        finalCount,
        invalidScores,
        unmatchedStudents,
        unmatchedSheets,
        unmatchedSubjects: Array.from(unmatchedSubjects),
        lockedPairs: lockedPairs.size,
        unchangedScoreCount,
        existingScoreSkippedCount,
        overwrittenScoreCount,
        overwriteExisting,
        affectedSubjectIds: Array.from(matchedSubjects),
        overwriteSubjectIds: Array.from(overwriteSubjectIds),
        overwriteClassIds: Array.from(overwriteClassIds),
        autoAdjustedMidtermCount: autoAdjustedMidtermKeys.size
    };
}

window.applyAdminExamImport = async function(plan) {
    if(!state.user || state.user.role !== 'admin') return;
    if(!plan || !Array.isArray(plan.updates) || !plan.updates.length || window.adminExamImportRunning) return;
    window.adminExamImportRunning = true;
    try {
        plan.examUpdates.forEach(({ subId, clsId, mid, final }) => {
            if(!DB_SubjectData[subId]) DB_SubjectData[subId] = { classData: {}, scores: {} };
            const sd = DB_SubjectData[subId];
            if(!sd.classData) sd.classData = {};
            if(!sd.scores) sd.scores = {};
            if(!sd.classData[clsId]) sd.classData[clsId] = { examSettings: {} };
            if(!sd.classData[clsId].examSettings) sd.classData[clsId].examSettings = {};
            if(!sd.classData[clsId].examSettings[state.term]) sd.classData[clsId].examSettings[state.term] = { mid: 20, final: 30 };
            if(Number.isFinite(Number(mid)) && Number(mid) > 0) sd.classData[clsId].examSettings[state.term].mid = Number(mid);
            if(Number.isFinite(Number(final)) && Number(final) > 0) sd.classData[clsId].examSettings[state.term].final = Number(final);
        });

        plan.updates.forEach(({ subId, clsId, stuId, field, score }) => {
            const sd = DB_SubjectData[subId];
            if(!sd.scores[clsId]) sd.scores[clsId] = {};
            if(!sd.scores[clsId][stuId]) sd.scores[clsId][stuId] = {};
            if(!sd.scores[clsId][stuId][state.term]) sd.scores[clsId][stuId][state.term] = {};
            const termNode = sd.scores[clsId][stuId][state.term];
            termNode[field] = score;
            window.rememberScoreSafetyValue(subId, clsId, stuId, state.term, field, score, { persistDelay: 1000 });
        });

        window.notify(`นำเข้าคะแนนสอบ ${plan.updates.length} ช่องแล้ว กำลังบันทึกขึ้นคลาวด์...`);
        try {
            await window.persistAdminExamImportIsolated(plan);
            window.notify(`บันทึกคะแนนกลางภาค ${plan.midtermCount} ช่อง และปลายภาค ${plan.finalCount} ช่อง สำเร็จ โดยไม่แก้ไขคะแนนรายหน่วย`);
        } catch(err) {
            console.error('Admin exam isolated cloud save failed:', err);
            window.notify('คะแนนสอบถูกเก็บในเครื่องและเข้าคิวซิงก์รายช่องแล้ว แต่คลาวด์ยังบันทึกไม่ครบ ระบบจะลองใหม่โดยไม่แตะคะแนนรายหน่วย', true);
        }
    } finally {
        window.adminExamImportRunning = false;
    }
}

window.importAdminExamTemplate = function(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if(!file) return;
    if(!state.user || state.user.role !== 'admin') { input.value = ''; return; }
    const status = window.getScoreEntryStatus();
    if(!status.allowed) { window.notify(status.message, true); input.value = ''; return; }
    if(typeof XLSX === 'undefined') {
        window.notify('ไม่พบตัวอ่านไฟล์ Excel กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', true);
        input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = async function(loadEvent) {
        try {
            // The "never overwrite an existing score" check compares against the local
            // DB_SubjectData cache. If that cache hasn't been freshly loaded for every
            // subject, cells that actually already have a cloud score can look blank
            // locally and get written over. Force a fresh cloud load for every subject
            // in the school right before comparing, so the check is always accurate.
            if(typeof window.firebaseLoadScoresForSubjectsBulk === 'function') {
                window.notify('กำลังดึงคะแนนล่าสุดจากคลาวด์ก่อนตรวจสอบไฟล์...');
                const allSubjectIds = new Set();
                window.getSortedClassEntries().forEach(([cId]) => {
                    window.getAdminMidtermSubjectsForClass(cId).forEach(sub => allSubjectIds.add(String(sub.id)));
                });
                try { await window.firebaseLoadScoresForSubjectsBulk(Array.from(allSubjectIds)); }
                catch(err) { console.warn('Pre-import score refresh failed:', err); }
            }
            const overwriteExisting = !!($('admin-exam-import-overwrite') && $('admin-exam-import-overwrite').checked);
            const overwriteSubjectIds = overwriteExisting
                ? Array.from(document.querySelectorAll('.admin-exam-import-overwrite-subject:checked')).map(el => el.value)
                : [];
            const overwriteClassIds = overwriteExisting
                ? Array.from(document.querySelectorAll('.admin-exam-import-overwrite-class:checked')).map(el => el.value)
                : [];
            if(overwriteExisting && !overwriteSubjectIds.length) {
                window.notify('ติ๊กเขียนทับคะแนนเดิมแล้ว กรุณาเลือกอย่างน้อย 1 วิชาที่จะเขียนทับด้วย', true);
                input.value = '';
                return;
            }
            if(overwriteExisting && !overwriteClassIds.length) {
                window.notify('ติ๊กเขียนทับคะแนนเดิมแล้ว กรุณาเลือกอย่างน้อย 1 ห้องที่จะเขียนทับด้วย', true);
                input.value = '';
                return;
            }
            if($('admin-exam-import-overwrite')) $('admin-exam-import-overwrite').checked = false;
            window.toggleAdminExamImportOverwriteSubjects(false);
            const workbook = XLSX.read(loadEvent.target.result, { type: 'array' });
            const plan = window.parseAdminExamImportWorkbook(workbook, file.name, { overwriteExisting, overwriteSubjectIds, overwriteClassIds });
            if(!plan.updates.length) {
                const reason = plan.lockedPairs
                    ? `สมุดคะแนนที่พบถูกล็อกอยู่ ${plan.lockedPairs} วิชา/ห้อง`
                    : (plan.existingScoreSkippedCount
                        ? `ทุกช่องที่พบมีคะแนนอยู่แล้วในระบบ ${plan.existingScoreSkippedCount} ช่อง (นำเข้าได้เฉพาะช่องที่ยังไม่มีคะแนน หรือติ๊กเขียนทับแล้วเลือกวิชา+ห้องนั้น)`
                        : 'ไม่พบคะแนนกลางภาคหรือปลายภาคที่ตรงกับห้อง วิชา และรหัสนักเรียนในระบบ');
                window.notify(`ไม่สามารถนำเข้าได้: ${reason}`, true);
                return;
            }
            const subjectNamesById = ids => ids
                .map(subId => { const sub = (DB.subjects || []).find(s => String(s.id) === String(subId)); return sub ? (sub.name || '') : ''; })
                .filter(Boolean);
            const classNamesById = ids => ids
                .map(cId => { const cls = DB.classes && DB.classes[cId]; return cls ? (cls.name || cId) : ''; })
                .filter(Boolean);
            const notes = overwriteExisting ? [
                `ไฟล์: ${file.name}`,
                `พบ ${plan.matchedRooms} ห้อง ${plan.matchedSubjects} วิชา`,
                `⚠️ โหมดเขียนทับ: จะเขียนทับคะแนนเดิม ${plan.overwrittenScoreCount} ช่อง`,
                `เฉพาะวิชาที่เลือก: ${subjectNamesById(plan.overwriteSubjectIds || []).join(', ') || '-'}`,
                `เฉพาะห้องที่เลือก: ${classNamesById(plan.overwriteClassIds || []).join(', ') || '-'}`,
                `จะนำเข้าคะแนนกลางภาค ${plan.midtermCount} ช่อง และปลายภาค ${plan.finalCount} ช่อง (รวมทั้งช่องว่างเดิมและช่องที่เขียนทับ)`,
                '',
                'วิชา/ห้องอื่นที่ไม่ได้เลือกไว้จะไม่ถูกแตะต้องเลย แม้จะมีอยู่ในไฟล์นี้ก็ตาม — ใช้คะแนนเดิมในระบบต่อไป'
            ] : [
                `ไฟล์: ${file.name}`,
                `พบ ${plan.matchedRooms} ห้อง ${plan.matchedSubjects} วิชา`,
                `จะนำเข้าคะแนนกลางภาค ${plan.midtermCount} ช่อง และปลายภาค ${plan.finalCount} ช่อง`,
                '',
                'นำเข้าเฉพาะช่องที่ยังไม่มีคะแนนในระบบเท่านั้น ช่องที่มีคะแนนอยู่แล้วจะไม่ถูกแก้ไขหรือบันทึกซ้ำ'
            ];
            if(plan.existingScoreSkippedCount) notes.push(`ข้ามช่องที่มีคะแนนอยู่แล้ว ${plan.existingScoreSkippedCount} ช่อง`);
            if(plan.invalidScores) notes.push(`ข้ามคะแนนไม่ถูกต้อง/เกินคะแนนเต็ม ${plan.invalidScores} ช่อง`);
            if(plan.unchangedScoreCount) notes.push(`ข้ามค่าซ้ำ/เท่าเดิม ${plan.unchangedScoreCount} ช่อง`);
            if(plan.autoAdjustedMidtermCount) notes.push(`พบคะแนนกลางภาคต่ำกว่าครึ่ง ${plan.autoAdjustedMidtermCount} คน ระบบจะปรับเป็นครึ่งของคะแนนเต็มอัตโนมัติ`);
            if(plan.unmatchedStudents) notes.push(`ข้ามรหัสนักเรียนที่ไม่ตรง ${plan.unmatchedStudents} แถว`);
            if(plan.unmatchedSheets.length) notes.push(`ข้ามชีตที่หาห้องไม่พบ ${plan.unmatchedSheets.length} ชีต`);
            if(plan.unmatchedSubjects.length) notes.push(`ข้ามชื่อวิชาที่จับคู่ไม่ได้ ${plan.unmatchedSubjects.length} รายการ`);
            if(plan.lockedPairs) notes.push(`ข้ามสมุดคะแนนที่มีผู้ใช้อื่นกำลังกรอก ${plan.lockedPairs} วิชา/ห้อง`);
            window.showCustomConfirm(
                overwriteExisting ? 'ยืนยันเขียนทับคะแนนสอบ (เฉพาะวิชาในไฟล์นี้)' : 'ยืนยันนำเข้าคะแนนสอบกลางภาคและปลายภาค',
                notes.join('\n'),
                overwriteExisting ? 'warning' : 'info',
                () => window.applyAdminExamImport(plan)
            );
        } catch(err) {
            console.error('Admin exam import parse failed:', err);
            window.notify('อ่านไฟล์ไม่สำเร็จ กรุณาดาวน์โหลดและใช้แม่แบบนำเข้าคะแนนสอบจากระบบ', true);
        } finally {
            input.value = '';
        }
    };
    reader.onerror = function() {
        input.value = '';
        window.notify('อ่านไฟล์ Excel ไม่สำเร็จ', true);
    };
    reader.readAsArrayBuffer(file);
}

window.getAdminGradeLevelKey = function(value) {
    const classKey = window.normalizeAdminMidtermClassKey(value);
    return classKey ? classKey.split('/')[0] : '';
}

window.adminExamBonusSelection = window.adminExamBonusSelection || {
    subjId: '',
    scoreType: 'midTermScore',
    scope: 'class',
    targetId: ''
};

window.getAdminExamBonusTargetOptionsHtml = function(scope = 'class', selectedId = '') {
    const classEntries = window.getSortedClassEntries();
    if(scope === 'grade') {
        const grades = new Map();
        classEntries.forEach(([cId, cls]) => {
            const key = window.getAdminGradeLevelKey(cls.name || cId);
            if(!key) return;
            if(!grades.has(key)) grades.set(key, []);
            grades.get(key).push(cId);
        });
        return Array.from(grades.entries())
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([key, classIds]) => `<option value="${window.escapeHtml(key)}" ${String(key) === String(selectedId) ? 'selected' : ''}>ระดับชั้น ป.${window.escapeHtml(key)} (${classIds.length} ห้อง)</option>`)
            .join('');
    }
    return classEntries.map(([cId, cls]) => `
        <option value="${window.escapeHtml(cId)}" ${String(cId) === String(selectedId) ? 'selected' : ''}>ห้อง ${window.escapeHtml(cls.name || cId)} (${(cls.students || []).length} คน)</option>
    `).join('');
}

window.refreshAdminExamBonusTargets = function() {
    const scopeEl = $('admin-bonus-scope');
    const targetEl = $('admin-bonus-target');
    if(!scopeEl || !targetEl) return;
    const scope = scopeEl.value === 'grade' ? 'grade' : 'class';
    window.adminExamBonusSelection.scope = scope;
    const currentClassId = window.adminScoreSelection && window.adminScoreSelection.clsId;
    const preferred = scope === 'grade'
        ? window.getAdminGradeLevelKey(DB.classes[currentClassId] && DB.classes[currentClassId].name)
        : currentClassId;
    targetEl.innerHTML = window.getAdminExamBonusTargetOptionsHtml(scope, preferred);
    window.adminExamBonusSelection.targetId = targetEl.value || '';
}

window.buildAdminExamBonusPlan = function() {
    if(!state.user || state.user.role !== 'admin') return null;
    const subId = $('admin-bonus-subject') ? $('admin-bonus-subject').value : '';
    const scoreType = $('admin-bonus-score-type') && $('admin-bonus-score-type').value === 'finalScore' ? 'finalScore' : 'midTermScore';
    const scope = $('admin-bonus-scope') && $('admin-bonus-scope').value === 'grade' ? 'grade' : 'class';
    const targetId = $('admin-bonus-target') ? $('admin-bonus-target').value : '';
    const bonus = Number($('admin-bonus-value') ? $('admin-bonus-value').value : '');
    const subject = (DB.subjects || []).find(sub => String(sub.id) === String(subId));
    if(!subject || !targetId || !Number.isFinite(bonus) || bonus <= 0) return null;

    const classEntries = window.getSortedClassEntries();
    const selectedClasses = classEntries.filter(([cId, cls]) => scope === 'grade'
        ? window.getAdminGradeLevelKey(cls.name || cId) === String(targetId)
        : String(cId) === String(targetId));
    const updates = [];
    const changedClasses = new Map();
    let blankScores = 0;
    let atMaximum = 0;
    let cappedScores = 0;
    let lockedClasses = 0;
    let unassignedClasses = 0;
    let studentCount = 0;

    selectedClasses.forEach(([clsId, cls]) => {
        const hasSubject = window.getAdminMidtermSubjectsForClass(clsId)
            .some(sub => String(sub.id) === String(subId));
        if(!hasSubject) { unassignedClasses++; return; }
        const lockKey = window.getScoreLockKey(subId, clsId, state.term);
        const lock = window.scoreLocks && window.scoreLocks[lockKey];
        if(window.isScoreLockActive(lock) && lock.sessionId !== browserSessionId) {
            lockedClasses++;
            return;
        }
        const maxScore = window.getAdminExamFullScore(subId, clsId, scoreType);
        studentCount += (cls.students || []).length;
        (cls.students || []).forEach(student => {
            const termNode = window.getAdminMidtermTermNode(subId, clsId, student.studentId);
            const oldValue = termNode && window.normalizeScoreValue
                ? window.normalizeScoreValue(termNode[scoreType], scoreType)
                : (termNode ? termNode[scoreType] : '');
            if(oldValue === '') { blankScores++; return; }
            const oldScore = Number(oldValue);
            if(!Number.isFinite(oldScore)) { blankScores++; return; }
            if(oldScore >= maxScore) { atMaximum++; return; }
            const rawNewScore = oldScore + bonus;
            const newScore = Math.round(Math.min(maxScore, rawNewScore) * 100) / 100;
            if(rawNewScore > maxScore) cappedScores++;
            if(newScore === oldScore) return;
            updates.push({ subId, clsId, stuId: student.studentId, field: scoreType, oldScore, newScore, maxScore });
            changedClasses.set(String(clsId), cls.name || clsId);
        });
    });

    const targetLabel = scope === 'grade'
        ? `ระดับชั้น ป.${targetId}`
        : `ห้อง ${selectedClasses[0] ? (selectedClasses[0][1].name || targetId) : targetId}`;
    return {
        subId,
        subjectName: subject.name || '',
        scoreType,
        scoreLabel: scoreType === 'finalScore' ? 'ปลายภาค' : 'กลางภาค',
        scope,
        targetId,
        targetLabel,
        bonus,
        updates,
        changedClasses: Array.from(changedClasses.entries()),
        selectedClassCount: selectedClasses.length,
        studentCount,
        blankScores,
        atMaximum,
        cappedScores,
        lockedClasses,
        unassignedClasses
    };
}

window.confirmAdminExamBonus = async function() {
    if(!state.user || state.user.role !== 'admin') return;
    const status = window.getScoreEntryStatus();
    if(!status.allowed) { window.notify(status.message, true); return; }
    if(window.adminExamBonusRunning) return;

    // A bonus is computed on top of the score already on record, so it has to read the real
    // one. Every other admin tool (Excel export, PDF report, status check, import) pulls the
    // subject's scores from the cloud before it does anything; this one trusted whatever sat
    // in the local cache, which on the admin page is only filled in lazily. Students whose
    // scores were never cached read as blank and got skipped as "no existing score", and a
    // stale cached value produced a bonus on top of the wrong base that the next cloud read
    // merged away again - the bonus looked applied, then quietly vanished from the reports.
    const bonusSubjectId = $('admin-bonus-subject') ? $('admin-bonus-subject').value : '';
    const refreshBtn = $('admin-bonus-apply-btn');
    const refreshBtnHtml = refreshBtn ? refreshBtn.innerHTML : '';
    if(bonusSubjectId && typeof window.firebaseLoadScoresForSubjectsBulk === 'function') {
        if(refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="ph ph-spinner-gap animate-spin text-lg"></i> กำลังดึงคะแนน';
        }
        try {
            await window.firebaseLoadScoresForSubjectsBulk([bonusSubjectId]);
        } catch(err) {
            console.warn('Exam bonus score refresh failed:', err);
            window.notify('ดึงคะแนนล่าสุดจากคลาวด์ไม่สำเร็จ ยังไม่ได้บวกคะแนน กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่', true);
            return;
        } finally {
            if(refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = refreshBtnHtml;
            }
        }
    }

    const plan = window.buildAdminExamBonusPlan();
    if(!plan) {
        window.notify('กรุณาเลือกวิชา ประเภทคะแนน ขอบเขต และระบุคะแนนที่ต้องการบวกให้ถูกต้อง', true);
        return;
    }
    if(!plan.updates.length) {
        const details = [];
        if(plan.blankScores) details.push(`คะแนนว่าง ${plan.blankScores} คน`);
        if(plan.atMaximum) details.push(`คะแนนเต็มแล้ว ${plan.atMaximum} คน`);
        if(plan.lockedClasses) details.push(`ห้องถูกล็อก ${plan.lockedClasses} ห้อง`);
        window.notify(`ไม่มีคะแนนที่สามารถบวกเพิ่มได้${details.length ? ` (${details.join(', ')})` : ''}`, true);
        return;
    }
    const notes = [
        `วิชา: ${plan.subjectName}`,
        `คะแนนสอบ: ${plan.scoreLabel}`,
        `ขอบเขต: ${plan.targetLabel}`,
        `บวกเพิ่ม: ${plan.bonus} คะแนน`,
        `นักเรียนที่จะเปลี่ยนคะแนน: ${plan.updates.length} คน ใน ${plan.changedClasses.length} ห้อง`,
        '',
        'คะแนนที่เกินจะถูกจำกัดไว้ที่คะแนนเต็มตามโครงสร้างของแต่ละห้อง'
    ];
    if(plan.cappedScores) notes.push(`มี ${plan.cappedScores} คนที่จะถูกจำกัดไว้ที่คะแนนเต็ม`);
    if(plan.blankScores) notes.push(`ข้ามนักเรียนที่ยังไม่มีคะแนนเดิม ${plan.blankScores} คน`);
    if(plan.atMaximum) notes.push(`ข้ามนักเรียนที่ได้คะแนนเต็มแล้ว ${plan.atMaximum} คน`);
    if(plan.lockedClasses) notes.push(`ข้ามห้องที่ครูคนอื่นกำลังกรอก ${plan.lockedClasses} ห้อง`);
    if(plan.unassignedClasses) notes.push(`ข้ามห้องที่ไม่มีวิชานี้ ${plan.unassignedClasses} ห้อง`);
    window.showCustomConfirm(
        'ยืนยันการบวกคะแนนสอบแบบกลุ่ม',
        notes.join('\n'),
        'warning',
        () => window.applyAdminExamBonus(plan)
    );
}

window.applyAdminExamBonus = async function(plan) {
    if(!state.user || state.user.role !== 'admin' || !plan || !Array.isArray(plan.updates) || !plan.updates.length || window.adminExamBonusRunning) return;
    const status = window.getScoreEntryStatus();
    if(!status.allowed) { window.notify(status.message, true); return; }
    window.adminExamBonusRunning = true;
    try {
        const changedClasses = new Set();
        const lockedDuringConfirm = new Set();
        const appliedCells = [];
        let changedDuringConfirm = 0;
        let appliedCount = 0;
        plan.updates.forEach(({ subId, clsId, stuId, field, oldScore }) => {
            const lockKey = window.getScoreLockKey(subId, clsId, state.term);
            const lock = window.scoreLocks && window.scoreLocks[lockKey];
            if(window.isScoreLockActive(lock) && lock.sessionId !== browserSessionId) {
                lockedDuringConfirm.add(String(clsId));
                return;
            }
            const currentTermNode = window.getAdminMidtermTermNode(subId, clsId, stuId);
            const currentValue = currentTermNode && window.normalizeScoreValue
                ? window.normalizeScoreValue(currentTermNode[field], field)
                : (currentTermNode ? currentTermNode[field] : '');
            if(currentValue === '' || Number(currentValue) !== Number(oldScore)) {
                changedDuringConfirm++;
                return;
            }
            const maxScore = window.getAdminExamFullScore(subId, clsId, field);
            const newScore = Math.round(Math.min(maxScore, Number(currentValue) + Number(plan.bonus)) * 100) / 100;
            if(newScore === Number(currentValue)) return;
            if(!DB_SubjectData[subId]) DB_SubjectData[subId] = { classData: {}, scores: {} };
            const sd = DB_SubjectData[subId];
            if(!sd.scores) sd.scores = {};
            if(!sd.scores[clsId]) sd.scores[clsId] = {};
            if(!sd.scores[clsId][stuId]) sd.scores[clsId][stuId] = {};
            if(!sd.scores[clsId][stuId][state.term]) sd.scores[clsId][stuId][state.term] = { indicators: {} };
            // Write back into the very node the old score was read from. Score nodes come in
            // two shapes - keyed by term, or a flat node carrying its own term field - and
            // getAdminMidtermTermNode reads both. Always writing to the term-keyed node meant
            // that for a flat node the bonus landed in a brand new node nobody reads, so the
            // score never changed and the reports never showed it.
            const termNode = currentTermNode || sd.scores[clsId][stuId][state.term];
            if(!termNode.indicators) termNode.indicators = {};
            termNode[field] = newScore;
            window.rememberScoreSafetyValue(subId, clsId, stuId, state.term, field, newScore, { persistDelay: 1000 });
            // Flag the cell as an in-flight write, the same way the scoring table and the
            // import flow do. Without it an incoming cloud snapshot merges the pre-bonus
            // value back over the new one before the write reaches the cloud, and the record
            // does not survive a refresh either, so an interrupted save was lost silently.
            window.markScoreSubjectPending(subId, clsId, stuId);
            window.registerPendingScoreWrite(subId, clsId, stuId, state.term, field, newScore);
            appliedCells.push({ subId, clsId, stuId, field });
            changedClasses.add(String(clsId));
            appliedCount++;
        });
        if(!appliedCount) {
            window.notify('ไม่มีคะแนนที่บวกเพิ่มได้ เนื่องจากคะแนนหรือสถานะการใช้งานมีการเปลี่ยนแปลง', true);
            return;
        }
        changedClasses.forEach(clsId => window.markScoreClassBundleDirty(plan.subId, clsId));
        window.persistScoreSafetyLogNow();
        window.saveSubjectDataLocalNow();
        window.notify(`บวกคะแนน${plan.scoreLabel}แล้ว ${appliedCount} คน กำลังบันทึกขึ้นคลาวด์...`);
        // Write only the student documents that actually changed, in one batch, instead of
        // re-saving the whole subject through firebaseSaveNowFn - fewer round trips, and it
        // cannot stall behind unrelated subject data.
        if(typeof window.firebaseBatchWriteScoreNodes === 'function') {
            const targets = [];
            const seenTargets = new Set();
            appliedCells.forEach(({ subId, clsId, stuId }) => {
                const key = `${subId}|${clsId}|${stuId}`;
                if(seenTargets.has(key)) return;
                seenTargets.add(key);
                targets.push({ subId, clsId, stuId });
            });
            let result = { attempted: false, failed: targets.length, total: targets.length };
            try {
                result = await window.firebaseBatchWriteScoreNodes(targets);
            } catch(err) {
                console.error('Admin exam bonus cloud save failed:', err);
            }
            if(result && result.attempted && result.failed === 0) {
                appliedCells.forEach(({ subId, clsId, stuId, field }) => window.resolvePendingScoreWrite(subId, clsId, stuId, state.term, field));
                const skipped = changedDuringConfirm + lockedDuringConfirm.size;
                window.notify(`บวกคะแนน${plan.scoreLabel}และบันทึกบนคลาวด์สำเร็จ ${appliedCount} คน${skipped ? ` ข้ามรายการที่เปลี่ยนแปลงระหว่างยืนยัน ${skipped} รายการ` : ''}`);
            } else {
                // Leave the pending records in place: they persist across a refresh and the
                // retry queue keeps pushing them until the cloud accepts them.
                if(typeof window.retryPendingScoreAutoSaves === 'function') window.retryPendingScoreAutoSaves(3000);
                window.requestDirtyCloudFlush(30000);
                window.notify('คะแนนถูกเก็บในเครื่องและเข้าคิวซิงก์แล้ว แต่คลาวด์ยังบันทึกไม่ครบ ระบบจะลองใหม่อัตโนมัติ', true);
            }
        } else {
            window.requestDirtyCloudFlush(5000);
            window.notify('คะแนนถูกเก็บในเครื่องแล้ว และจะซิงก์เมื่อคลาวด์พร้อม', true);
        }
    } finally {
        window.adminExamBonusRunning = false;
    }
}

window.renderAdminScoringHub = function(container) {
    $('page-title').innerText = 'ลงคะแนนทุกวิชา';
    const subjects = DB.subjects || [];
    const classEntries = window.getSortedClassEntries();
    if(!subjects.length || !classEntries.length) {
        container.innerHTML = `
            <div class="border border-dashed border-amber-300 bg-amber-50 rounded-2xl py-16 px-6 text-center">
                <i class="ph ph-warning-circle text-5xl text-amber-500"></i>
                <h3 class="text-xl font-extrabold text-amber-900 mt-3">ยังไม่พร้อมเปิดตารางคะแนน</h3>
                <p class="text-sm text-amber-700 mt-1">กรุณาเพิ่มรายวิชาและห้องเรียนในระบบก่อน</p>
            </div>`;
        return;
    }

    const currentSubjectId = subjects.some(sub => String(sub.id) === String(window.adminScoreSelection.subjId))
        ? String(window.adminScoreSelection.subjId)
        : String(subjects[0].id);
    const currentClassId = classEntries.some(([cId]) => String(cId) === String(window.adminScoreSelection.clsId))
        ? String(window.adminScoreSelection.clsId)
        : String(classEntries[0][0]);
    window.adminScoreSelection = { subjId: currentSubjectId, clsId: currentClassId };

    const subjectOptions = subjects.map(sub => `
        <option value="${window.escapeHtml(sub.id)}" ${String(sub.id) === currentSubjectId ? 'selected' : ''}>${window.escapeHtml(sub.name || 'ไม่ระบุชื่อวิชา')}${sub.code ? ` (${window.escapeHtml(sub.code)})` : ''}</option>
    `).join('');
    const classOptions = classEntries.map(([cId, cls]) => `
        <option value="${window.escapeHtml(cId)}" ${String(cId) === currentClassId ? 'selected' : ''}>ห้อง ${window.escapeHtml(cls.name || cId)} - นักเรียน ${(cls.students || []).length} คน</option>
    `).join('');
    const bonusSubjectId = subjects.some(sub => String(sub.id) === String(window.adminExamBonusSelection.subjId))
        ? String(window.adminExamBonusSelection.subjId)
        : currentSubjectId;
    const bonusScope = window.adminExamBonusSelection.scope === 'grade' ? 'grade' : 'class';
    const defaultBonusTarget = bonusScope === 'grade'
        ? window.getAdminGradeLevelKey((DB.classes[currentClassId] || {}).name)
        : currentClassId;
    const bonusTargetId = window.adminExamBonusSelection.targetId || defaultBonusTarget;
    window.adminExamBonusSelection = {
        subjId: bonusSubjectId,
        scoreType: window.adminExamBonusSelection.scoreType === 'finalScore' ? 'finalScore' : 'midTermScore',
        scope: bonusScope,
        targetId: bonusTargetId
    };
    const bonusSubjectOptions = subjects.map(sub => `
        <option value="${window.escapeHtml(sub.id)}" ${String(sub.id) === bonusSubjectId ? 'selected' : ''}>${window.escapeHtml(sub.name || 'ไม่ระบุชื่อวิชา')}</option>
    `).join('');
    const bonusTargetOptions = window.getAdminExamBonusTargetOptionsHtml(bonusScope, bonusTargetId);

    container.innerHTML = `
        <section class="mb-5 border-b border-slate-200 pb-4 animate-fade-in-up">
            <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div>
                    <div class="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-1"><i class="ph ph-pencil-line text-lg"></i> สิทธิ์ผู้ดูแลระบบ</div>
                    <h2 class="text-2xl font-extrabold text-slate-800">เปิดสมุดคะแนนทุกวิชาและทุกห้อง</h2>
                    <p class="text-sm text-slate-500 font-medium mt-1">เลือกวิชาและห้องเรียน แล้วกรอกคะแนนด้วยตารางเดียวกับครูผู้สอน</p>
                </div>
                <div class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg flex items-center gap-2">
                    <i class="ph ph-shield-check text-lg"></i> ใช้ระบบล็อกและบันทึกอัตโนมัติ
                </div>
            </div>
        </section>
        ${window.renderScoreEntryStatusBanner(true)}
        <section class="modern-card p-6 animate-fade-in-up stagger-1">
            <div class="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                <div>
                    <label for="admin-score-subject" class="block text-sm font-extrabold text-slate-700 mb-2">รายวิชา</label>
                    <select id="admin-score-subject" onchange="window.adminScoreSelection.subjId=this.value" class="w-full border border-slate-200 rounded-xl px-4 py-3.5 bg-slate-50 focus-ring font-bold text-slate-800">
                        ${subjectOptions}
                    </select>
                </div>
                <div>
                    <label for="admin-score-class" class="block text-sm font-extrabold text-slate-700 mb-2">ห้องเรียน</label>
                    <select id="admin-score-class" onchange="window.adminScoreSelection.clsId=this.value" class="w-full border border-slate-200 rounded-xl px-4 py-3.5 bg-slate-50 focus-ring font-bold text-slate-800">
                        ${classOptions}
                    </select>
                </div>
                <button onclick="window.openAdminScorebook()" class="tactile-btn h-[52px] px-7 rounded-xl bg-primary-gradient text-white font-extrabold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 whitespace-nowrap">
                    <i class="ph ph-arrow-square-out text-xl"></i> เปิดตารางคะแนน
                </button>
            </div>
            <div class="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3"><span class="text-slate-400 font-bold">รายวิชาทั้งหมด</span><strong class="block text-xl text-slate-800 mt-1">${subjects.length} วิชา</strong></div>
                <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3"><span class="text-slate-400 font-bold">ห้องเรียนทั้งหมด</span><strong class="block text-xl text-slate-800 mt-1">${classEntries.length} ห้อง</strong></div>
                <div class="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3"><span class="text-indigo-500 font-bold">ขอบเขตสิทธิ์</span><strong class="block text-base text-indigo-900 mt-1">แก้ไขได้ทุกวิชาและทุกห้อง</strong></div>
            </div>
        </section>
        <section class="mt-6 border-y border-slate-200 py-5 animate-fade-in-up stagger-2">
            <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
                        <i class="ph ph-file-xls text-xl"></i>
                        คะแนนสอบกลางภาคและปลายภาค
                    </div>
                    <h3 class="text-xl font-extrabold text-slate-800 mt-1">รายงานผู้บริหารและแม่แบบนำเข้าคะแนนสอบ</h3>
                    <p class="text-sm text-slate-500 font-medium mt-1">ดาวน์โหลดแม่แบบที่มีห้อง วิชา รหัส และรายชื่อนักเรียนครบ แล้วกรอกเฉพาะช่องกลางภาคหรือปลายภาค</p>
                </div>
                <div class="flex flex-col sm:flex-row sm:flex-wrap gap-3 shrink-0">
                    <div class="flex h-[48px] rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
                        <label for="admin-report-score-type" class="sr-only">เลือกคะแนนสอบสำหรับรายงานผู้บริหาร</label>
                        <select id="admin-report-score-type" class="h-full px-3 bg-transparent border-0 border-r border-emerald-200 text-emerald-900 font-extrabold focus:ring-0 cursor-pointer">
                            <option value="mid">กลางภาค</option>
                            <option value="final">ปลายภาค</option>
                        </select>
                        <button id="admin-exam-report-pdf-btn" onclick="window.exportAdminExamSummaryPdf()" class="tactile-btn h-full px-4 text-emerald-800 font-extrabold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60 disabled:cursor-wait">
                            <i class="ph ph-file-pdf text-xl"></i> รายงานผู้บริหาร PDF
                        </button>
                    </div>
                    <div class="flex h-[48px] rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
                        <label for="admin-template-score-type" class="sr-only">เลือกคะแนนสอบสำหรับแม่แบบนำเข้า</label>
                        <select id="admin-template-score-type" class="h-full px-3 bg-transparent border-0 border-r border-indigo-200 text-indigo-900 font-extrabold focus:ring-0 cursor-pointer">
                            <option value="midTermScore">กลางภาค</option>
                            <option value="finalScore">ปลายภาค</option>
                        </select>
                        <button onclick="window.exportAdminExamImportTemplate()" class="tactile-btn h-full px-4 text-indigo-800 font-extrabold flex items-center justify-center gap-2 whitespace-nowrap">
                            <i class="ph ph-file-arrow-down text-xl"></i> แม่แบบนำเข้า
                        </button>
                    </div>
                    <label class="tactile-btn h-[48px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer">
                        <i class="ph ph-upload-simple text-xl"></i> นำเข้าคะแนนสอบ
                        <input type="file" accept=".xlsx,.xls" class="hidden" onchange="window.importAdminExamTemplate(event)">
                    </label>
                </div>
            </div>
            <div class="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <label class="flex items-start gap-2 text-xs font-bold text-amber-800 cursor-pointer">
                    <input type="checkbox" id="admin-exam-import-overwrite" class="mt-0.5 w-4 h-4 accent-amber-600 shrink-0" onchange="window.toggleAdminExamImportOverwriteSubjects(this.checked)">
                    <span>เขียนทับคะแนนเดิม (ติ๊กแล้วเลือกวิชา + ห้องด้านล่าง — จะถามยืนยันอีกครั้งก่อนบันทึก) วิชา/ห้องที่ไม่ได้เลือกจะไม่ถูกแตะต้องเลย แม้จะมีอยู่ในไฟล์ก็ตาม</span>
                </label>
                <div id="admin-exam-import-overwrite-subjects-wrap" class="hidden mt-2.5 pt-2.5 border-t border-amber-200">
                    <div class="text-xs font-bold text-amber-700 mb-1.5">เลือกวิชาที่จะเขียนทับ (เลือกได้หลายวิชา):</div>
                    <div class="flex flex-wrap gap-2">
                        ${subjects.map(sub => `
                            <label class="flex items-center gap-1.5 text-xs font-bold bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-amber-50">
                                <input type="checkbox" class="admin-exam-import-overwrite-subject w-3.5 h-3.5 accent-amber-600" value="${window.escapeHtml(sub.id)}">
                                ${window.escapeHtml(sub.name || 'ไม่ระบุชื่อวิชา')}
                            </label>
                        `).join('')}
                    </div>
                    <div class="text-xs font-bold text-amber-700 mb-1.5 mt-3 flex items-center justify-between gap-2">
                        <span>เลือกห้องที่จะเขียนทับ (เลือกได้หลายห้อง):</span>
                        <span class="flex gap-2">
                            <button type="button" onclick="window.setAdminExamImportOverwriteClasses(true)" class="text-indigo-600 hover:underline font-bold">เลือกทั้งหมด</button>
                            <button type="button" onclick="window.setAdminExamImportOverwriteClasses(false)" class="text-slate-500 hover:underline font-bold">ล้างทั้งหมด</button>
                        </span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        ${classEntries.map(([cId, cls]) => `
                            <label class="flex items-center gap-1.5 text-xs font-bold bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-amber-50">
                                <input type="checkbox" class="admin-exam-import-overwrite-class w-3.5 h-3.5 accent-amber-600" value="${window.escapeHtml(cId)}">
                                ${window.escapeHtml(cls.name || cId)}
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="mt-4 flex items-start gap-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <i class="ph ph-shield-check text-lg text-indigo-600 shrink-0"></i>
                <span>ค่าเริ่มต้น: นำเข้าเฉพาะช่องที่ยังไม่มีคะแนนในระบบ ช่องที่มีคะแนนอยู่แล้วจะไม่ถูกแก้ไขหรือบันทึกซ้ำ ไม่แตะคะแนนหน่วย/ตัวชี้วัด และข้ามวิชา/ห้องที่ครูคนอื่นกำลังกรอกอยู่</span>
            </div>
        </section>
        <section class="mt-6 pb-6 border-b border-slate-200 animate-fade-in-up stagger-3">
            <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div class="flex items-start gap-3">
                    <div class="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0"><i class="ph ph-magnifying-glass text-2xl"></i></div>
                    <div>
                        <h3 class="text-xl font-extrabold text-slate-800">ตรวจสอบห้อง/วิชาที่ยังไม่ได้ลงคะแนนสอบ</h3>
                        <p class="text-sm text-slate-500 font-medium mt-1">ตรวจสอบอย่างเดียว ไม่มีการแก้ไขหรือลบคะแนนใดๆ ทั้งสิ้น</p>
                    </div>
                </div>
                <button id="admin-exam-status-check-btn" onclick="window.checkAdminExamEntryStatus()" class="tactile-btn h-[46px] px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60 disabled:cursor-wait shrink-0">
                    <i class="ph ph-list-checks text-xl"></i> ตรวจสอบสถานะการลงคะแนน
                </button>
            </div>
            <div id="admin-exam-status-output"></div>
        </section>
        <section class="mt-6 pb-6 border-b border-slate-200 animate-fade-in-up stagger-3">
            <div class="flex items-start gap-3 mb-4">
                <div class="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0"><i class="ph ph-plus-circle text-2xl"></i></div>
                <div>
                    <h3 class="text-xl font-extrabold text-slate-800">บวกคะแนนสอบแบบกลุ่ม</h3>
                    <p class="text-sm text-slate-500 font-medium mt-1">ใช้กับคะแนนเดิมของรายวิชาที่เลือก และจำกัดคะแนนไม่ให้เกินโครงสร้างคะแนนของแต่ละห้อง</p>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.25fr_.8fr_.75fr_1fr_.55fr_auto] gap-3 items-end">
                <div>
                    <label for="admin-bonus-subject" class="block text-xs font-extrabold text-slate-600 mb-1.5">รายวิชา</label>
                    <select id="admin-bonus-subject" onchange="window.adminExamBonusSelection.subjId=this.value" class="w-full h-[46px] border border-slate-200 rounded-xl px-3 bg-white focus-ring font-bold text-slate-800">${bonusSubjectOptions}</select>
                </div>
                <div>
                    <label for="admin-bonus-score-type" class="block text-xs font-extrabold text-slate-600 mb-1.5">คะแนนสอบ</label>
                    <select id="admin-bonus-score-type" onchange="window.adminExamBonusSelection.scoreType=this.value" class="w-full h-[46px] border border-slate-200 rounded-xl px-3 bg-white focus-ring font-bold text-slate-800">
                        <option value="midTermScore" ${window.adminExamBonusSelection.scoreType === 'midTermScore' ? 'selected' : ''}>กลางภาค</option>
                        <option value="finalScore" ${window.adminExamBonusSelection.scoreType === 'finalScore' ? 'selected' : ''}>ปลายภาค</option>
                    </select>
                </div>
                <div>
                    <label for="admin-bonus-scope" class="block text-xs font-extrabold text-slate-600 mb-1.5">ขอบเขต</label>
                    <select id="admin-bonus-scope" onchange="window.refreshAdminExamBonusTargets()" class="w-full h-[46px] border border-slate-200 rounded-xl px-3 bg-white focus-ring font-bold text-slate-800">
                        <option value="class" ${bonusScope === 'class' ? 'selected' : ''}>ห้องเรียน</option>
                        <option value="grade" ${bonusScope === 'grade' ? 'selected' : ''}>ระดับชั้น</option>
                    </select>
                </div>
                <div>
                    <label for="admin-bonus-target" class="block text-xs font-extrabold text-slate-600 mb-1.5">ชั้น/ห้องเป้าหมาย</label>
                    <select id="admin-bonus-target" onchange="window.adminExamBonusSelection.targetId=this.value" class="w-full h-[46px] border border-slate-200 rounded-xl px-3 bg-white focus-ring font-bold text-slate-800">${bonusTargetOptions}</select>
                </div>
                <div>
                    <label for="admin-bonus-value" class="block text-xs font-extrabold text-slate-600 mb-1.5">คะแนนที่บวก</label>
                    <input id="admin-bonus-value" type="number" min="0.01" step="0.5" placeholder="เช่น 2" class="w-full h-[46px] border border-amber-200 rounded-xl px-3 bg-amber-50 focus-ring font-extrabold text-amber-900">
                </div>
                <button id="admin-bonus-apply-btn" onclick="window.confirmAdminExamBonus()" class="tactile-btn h-[46px] px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold flex items-center justify-center gap-2 whitespace-nowrap shadow-sm shadow-amber-200">
                    <i class="ph ph-plus text-lg"></i> บวกคะแนน
                </button>
            </div>
            <div class="mt-3 flex items-start gap-2 text-xs font-bold text-slate-600">
                <i class="ph ph-info text-lg text-amber-600 shrink-0"></i>
                <span>ข้ามนักเรียนที่ยังไม่มีคะแนนเดิมและห้องที่กำลังถูกใช้งาน คะแนนรายคนยังเปิดแก้ไขภายหลังได้จากตารางคะแนนตามปกติ</span>
            </div>
        </section>
        <section class="mt-6 pb-6 border-b border-slate-200 animate-fade-in-up stagger-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-teal-50 via-emerald-50 to-indigo-50 border-2 border-emerald-200 shadow-sm">
                <div class="flex items-start gap-3.5">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-200">
                        <i class="ph ph-trend-up text-2xl font-bold"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-xl font-black text-slate-800">ระบบตรวจสอบและปัดคะแนนคาบเกี่ยวเกรด (+1 คะแนน)</h3>
                            <span class="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[11px] shadow-sm">เพิ่มเกรดทันที</span>
                        </div>
                        <p class="text-sm text-slate-600 font-medium mt-1">
                            ตรวจสอบนักเรียนที่ได้คะแนน <strong>54, 59, 64, 69, 74, 79</strong> แล้วปัดขึ้นอีก 1 คะแนนอัตโนมัติ เพื่อเลื่อนระดับผลการเรียน (เกรด) ให้กับนักเรียนทันที (ไม่เกิน 100 คะแนนเต็ม)
                        </p>
                    </div>
                </div>
                <button onclick="window.showGradeBoundaryInspectorModal()" class="tactile-btn h-[48px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-2 whitespace-nowrap shadow-md shadow-emerald-200 shrink-0">
                    <i class="ph ph-magnifying-glass-plus text-xl"></i> เปิดระบบตรวจสอบและปัดคะแนน
                </button>
            </div>
        </section>`;
}

window.generateExecutiveReportData = function(term = state.term) {
    const list = [];
    (DB.teachers || []).forEach(t => {
        const asg = window.getTeacherAssignments(t, term);
        if(!asg || Object.keys(asg).length === 0) return;
        const subjectsList = [];
        let totalAssigned = 0;
        let completeCount = 0;
        let totalPctSum = 0;

        Object.entries(asg).forEach(([subId, classIds]) => {
            const sub = (DB.subjects || []).find(s => s.id === subId);
            if(!sub) return;
            const sd = (window.DB_SubjectData && window.DB_SubjectData[subId]) || {};

            (Array.isArray(classIds) ? classIds : []).forEach(cId => {
                const cls = DB.classes && DB.classes[cId];
                if(!cls) return;
                totalAssigned++;
                const progress = window.calculateClassProgress(subId, cId, term);
                totalPctSum += progress;
                if(progress >= 100) completeCount++;

                const cfg = sd.classData && sd.classData[cId];
                const units = cfg ? (cfg.learningUnits || []).filter(u => String(u.term) === String(term)) : [];
                const exam = cfg && cfg.examSettings ? cfg.examSettings[term] : { mid: 20, final: 30 };
                const scStore = sd.scores ? sd.scores[cId] : null;

                let hasFinal = false;
                let hasMid = false;
                let unitFilledCount = 0;

                if(scStore) {
                    (cls.students || []).forEach(s => {
                        const sc = scStore[s.studentId] && (scStore[s.studentId][term] || (scStore[s.studentId].term === term ? scStore[s.studentId] : null));
                        if(sc) {
                            if(window.normalizeScoreValue(sc.finalScore, 'finalScore') !== '') hasFinal = true;
                            if(window.normalizeScoreValue(sc.midTermScore, 'midTermScore') !== '') hasMid = true;
                        }
                    });
                    units.forEach(u => {
                        let uFilled = false;
                        (u.indicators || []).forEach(ind => {
                            (cls.students || []).forEach(s => {
                                const sc = scStore[s.studentId] && (scStore[s.studentId][term] || (scStore[s.studentId].term === term ? scStore[s.studentId] : null));
                                if(sc && sc.indicators && sc.indicators[ind.id]) {
                                    if(window.normalizeScoreValue(sc.indicators[ind.id].k, 'k') !== '' ||
                                       window.normalizeScoreValue(sc.indicators[ind.id].p, 'p') !== '' ||
                                       window.normalizeScoreValue(sc.indicators[ind.id].a, 'a') !== '') uFilled = true;
                                }
                            });
                        });
                        if(uFilled) unitFilledCount++;
                    });
                }

                let missingNote = '';
                const over100List = typeof window.checkClassOver100Scores === 'function' ? window.checkClassOver100Scores(subId, cId, term) : [];
                const over100Count = over100List.length;

                if(progress >= 100) {
                    missingNote = 'กรอกครบ 100%';
                } else {
                    const parts = [];
                    if(!hasFinal && Number(exam ? exam.final : 30) > 0) parts.push(`ขาดสอบปลายภาค (${exam ? exam.final : 30} คะแนน)`);
                    if(units.length > unitFilledCount) parts.push(`ขาดหน่วย ${units.length - unitFilledCount}/${units.length} หน่วย`);
                    missingNote = parts.length > 0 ? parts.join(', ') : 'กรอกไม่ครบทุกตัวชี้วัด';
                }

                if(over100Count > 0) {
                    missingNote = (missingNote ? missingNote + ' | ' : '') + `⚠️ คะแนนเกิน 100 (${over100Count} คน)`;
                }

                subjectsList.push({
                    subId,
                    subjectName: sub.name,
                    cId,
                    className: cls.name,
                    studentCount: (cls.students || []).length,
                    progress,
                    missingNote,
                    over100Count,
                    isComplete: progress >= 100 && over100Count === 0
                });
            });
        });

        const avgProgress = totalAssigned > 0 ? Math.round(totalPctSum / totalAssigned) : 0;
        list.push({
            teacherId: t.id,
            teacherName: t.name,
            picUrl: t.picUrl,
            totalAssigned,
            completeCount,
            pendingCount: totalAssigned - completeCount,
            avgProgress,
            isAllComplete: totalAssigned > 0 && completeCount === totalAssigned,
            subjectsList: subjectsList.sort((a,b) => a.progress - b.progress)
        });
    });

    return list.sort((a,b) => a.avgProgress - b.avgProgress);
};

window.showExecutiveReportModal = function(activeFilter = 'pending') {
    const term = String(state.term);
    const data = window.generateExecutiveReportData(term);
    
    const totalTeachers = data.length;
    const completedTeachers = data.filter(t => t.isAllComplete).length;
    const pendingTeachers = totalTeachers - completedTeachers;
    const totalItems = data.reduce((sum, t) => sum + t.totalAssigned, 0);
    const completedItems = data.reduce((sum, t) => sum + t.completeCount, 0);
    const pendingItems = totalItems - completedItems;
    const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    let filtered = data;
    if(activeFilter === 'pending') filtered = data.filter(t => !t.isAllComplete);
    else if(activeFilter === 'complete') filtered = data.filter(t => t.isAllComplete);

    let listHtml = '';
    filtered.forEach((t) => {
        const badgeColor = t.isAllComplete ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : (t.avgProgress >= 70 ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : (t.avgProgress >= 50 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-rose-100 text-rose-800 border-rose-200'));
        const avatar = t.picUrl 
            ? `<img src="${window.formatImgUrl(t.picUrl)}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" onerror="this.outerHTML='<div class=\\'w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shrink-0\\'>${t.teacherName.charAt(0)}</div>'">`
            : `<div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shrink-0">${t.teacherName.charAt(0)}</div>`;

        let rowsHtml = '';
        t.subjectsList.forEach(s => {
            const pBadge = s.progress >= 100 
                ? '<span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-black">100%</span>' 
                : `<span class="px-2 py-0.5 rounded-md ${s.progress >= 70 ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'} text-xs font-black">${s.progress}%</span>`;
            const over100Badge = s.over100Count > 0 
                ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-black text-[10px] inline-flex items-center gap-0.5 animate-pulse"><i class="ph ph-warning"></i> เกิน 100 (${s.over100Count})</span>` 
                : '';
            const rowClass = s.over100Count > 0 ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/80';
            rowsHtml += `
                <tr class="border-b border-slate-100 ${rowClass} transition-colors text-xs">
                    <td class="py-2.5 px-3 font-bold text-slate-800">
                        <div class="flex items-center gap-1.5">
                            <span>${s.subjectName}</span>
                            <button onclick="window.openScorebookForClass('${s.subId}', '${s.cId}')" class="text-indigo-600 hover:text-indigo-800 p-0.5 rounded hover:bg-indigo-50 transition-colors" title="ไปที่สมุดคะแนนห้องนี้"><i class="ph ph-arrow-square-out text-sm"></i></button>
                        </div>
                    </td>
                    <td class="py-2.5 px-3 font-extrabold text-indigo-600">ห้อง ${s.className}</td>
                    <td class="py-2.5 px-3 text-center text-slate-500 font-semibold">${s.studentCount} คน</td>
                    <td class="py-2.5 px-3 text-center">${pBadge}${over100Badge}</td>
                    <td class="py-2.5 px-3 font-medium ${s.isComplete ? 'text-emerald-700' : (s.over100Count > 0 ? 'text-rose-700 font-bold' : 'text-slate-600')}">${s.missingNote}</td>
                </tr>
            `;
        });

        listHtml += `
            <div class="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm mb-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                    <div class="flex items-center gap-3">
                        ${avatar}
                        <div>
                            <div class="font-extrabold text-slate-800 text-base flex items-center gap-2">
                                <span>${t.teacherName}</span>
                                <span class="text-xs px-2 py-0.5 rounded-md border font-black ${badgeColor}">เฉลี่ย ${t.avgProgress}%</span>
                            </div>
                            <div class="text-xs text-slate-500 font-medium mt-0.5">
                                สอน ${t.totalAssigned} ห้อง | ครบ 100%: <b class="text-emerald-700">${t.completeCount}</b> ห้อง | ค้าง: <b class="text-amber-700">${t.pendingCount}</b> ห้อง
                            </div>
                        </div>
                    </div>
                    <div class="w-full sm:w-36">
                        <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                            <div class="bg-indigo-600 h-2.5 rounded-full" style="width: ${t.avgProgress}%"></div>
                        </div>
                    </div>
                </div>
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-slate-50 text-slate-500 text-[11px] font-extrabold uppercase border-b border-slate-200">
                                <th class="py-2 px-3">รายวิชา</th>
                                <th class="py-2 px-3">ห้องเรียน</th>
                                <th class="py-2 px-3 text-center">นักเรียน</th>
                                <th class="py-2 px-3 text-center">ความคืบหน้า</th>
                                <th class="py-2 px-3">สถานะ / สิ่งที่คงค้าง</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </div>
        `;
    });

    const modalHtml = `
        <div class="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xl shadow-inner">
                    <i class="ph ph-file-text"></i>
                </div>
                <div>
                    <h3 class="text-xl font-extrabold text-slate-800">รายงานสรุปผลการเรียน สำหรับผู้บริหาร (เทอม ${term})</h3>
                    <div class="text-xs text-slate-500 font-medium">สรุปสถานะการบันทึกคะแนนและรายการคงค้าง จำแนกรายบุคคล</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="window.exportExecutiveReportExcel()" class="tactile-btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-200 transition-colors">
                    <i class="ph ph-file-xls text-base"></i> ส่งออก Excel
                </button>
                <button onclick="window.hideModal()" class="text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full w-9 h-9 flex items-center justify-center transition-colors">
                    <i class="ph ph-x text-lg font-bold"></i>
                </button>
            </div>
        </div>

        <!-- KPI Header Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div class="bg-indigo-50 border border-indigo-100 p-3.5 rounded-xl text-center">
                <div class="text-[11px] font-bold text-indigo-600 uppercase">ครูทั้งหมด</div>
                <div class="text-2xl font-black text-indigo-950 mt-0.5">${totalTeachers} <span class="text-xs font-bold text-indigo-500">ท่าน</span></div>
            </div>
            <div class="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl text-center">
                <div class="text-[11px] font-bold text-emerald-600 uppercase">กรอกครบ 100%</div>
                <div class="text-2xl font-black text-emerald-950 mt-0.5">${completedTeachers} <span class="text-xs font-bold text-emerald-500">ท่าน (${completedItems} ห้อง)</span></div>
            </div>
            <div class="bg-amber-50 border border-amber-100 p-3.5 rounded-xl text-center">
                <div class="text-[11px] font-bold text-amber-600 uppercase">อยู่ระหว่างกรอก</div>
                <div class="text-2xl font-black text-amber-950 mt-0.5">${pendingTeachers} <span class="text-xs font-bold text-amber-500">ท่าน (${pendingItems} ห้อง)</span></div>
            </div>
            <div class="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center">
                <div class="text-[11px] font-bold text-slate-500 uppercase">ภาพรวมโรงเรียน</div>
                <div class="text-2xl font-black text-slate-800 mt-0.5">${overallProgress}%</div>
            </div>
        </div>

        <!-- Filter Tabs -->
        <div class="flex gap-2 mb-4 border-b border-slate-200 pb-2">
            <button onclick="window.showExecutiveReportModal('pending')" class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${activeFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                ค้างกรอก (${pendingTeachers})
            </button>
            <button onclick="window.showExecutiveReportModal('complete')" class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${activeFilter === 'complete' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                ครบ 100% (${completedTeachers})
            </button>
            <button onclick="window.showExecutiveReportModal('all')" class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors ${activeFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                ทุกคน (${totalTeachers})
            </button>
        </div>

        <div class="max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            ${listHtml || '<div class="text-center py-10 text-slate-400 font-bold">ไม่มีข้อมูลในตัวกรองนี้</div>'}
        </div>
    `;

    window.showModal(modalHtml, 'max-w-5xl');
};

window.exportExecutiveReportExcel = function() {
    if(typeof XLSX === 'undefined') {
        window.notify('ไม่พบไลบรารี XLSX สำหรับส่งออก', true);
        return;
    }
    const term = String(state.term);
    const data = window.generateExecutiveReportData(term);
    const rows = [
        ['รายงานสรุปผลการบันทึกผลการเรียน สำหรับผู้บริหาร'],
        [`ภาคเรียนที่ ${term} ปีการศึกษา ${(DB.schoolInfo && DB.schoolInfo.year) || ''} โรงเรียนอนุพงศ์พัชร`],
        [`ข้อมูล ณ วันที่: ${new Date().toLocaleDateString('th-TH')}`],
        [],
        ['ลำดับ', 'ชื่อ-สกุลครูผู้สอน', 'รายวิชา', 'ห้องเรียน', 'จำนวนนักเรียน', 'ความคืบหน้า (%)', 'สถานะ', 'รายละเอียดที่คงค้าง']
    ];

    let rowNum = 1;
    data.forEach(t => {
        t.subjectsList.forEach(s => {
            rows.push([
                rowNum++,
                t.teacherName,
                s.subjectName,
                s.className,
                s.studentCount,
                s.progress,
                s.isComplete ? 'ครบ 100%' : 'อยู่ระหว่างกรอก',
                s.missingNote
            ]);
        });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `สรุปผู้บริหาร_เทอม${term}`);
    const safeYear = String((DB.schoolInfo && DB.schoolInfo.year) || '').replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(workbook, `รายงานสรุปผู้บริหาร_การบันทึกคะแนน_เทอม${term}_${safeYear}.xlsx`);
    window.notify('ส่งออกไฟล์ Excel สำหรับผู้บริหารสำเร็จแล้ว');
};

window.openScorebookForClass = function(subId, cId) {
    if(typeof window.hideModal === 'function') window.hideModal();
    state.subjId = String(subId);
    state.clsId = String(cId);
    window.adminScoreSelection = { subjId: String(subId), clsId: String(cId) };
    window.navigate('teacher_scoring');
};

window.scanSchoolOver100Scores = function(term = state.term) {
    const targetTerm = String(term);
    const results = [];
    if(!DB || !DB.teachers || !DB.subjects || !DB.classes) return results;

    const seenCombos = new Set();
    DB.teachers.forEach(t => {
        const asg = window.getTeacherAssignments(t, targetTerm);
        if(!asg) return;
        Object.keys(asg).forEach(subId => {
            const sub = DB.subjects.find(x => String(x.id) === String(subId));
            if(!sub) return;
            const classIds = Array.isArray(asg[subId]) ? asg[subId] : [];
            classIds.forEach(cId => {
                const key = `${subId}_${cId}`;
                if(seenCombos.has(key)) return;
                seenCombos.add(key);

                const cls = DB.classes[cId];
                if(!cls) return;
                const over100 = typeof window.checkClassOver100Scores === 'function'
                    ? window.checkClassOver100Scores(subId, cId, targetTerm)
                    : [];
                if(over100 && over100.length > 0) {
                    results.push({
                        teacherId: t.id,
                        teacherName: t.name,
                        subId: sub.id,
                        subjectCode: sub.code || '',
                        subjectName: sub.name,
                        cId: cId,
                        className: cls.name,
                        students: over100
                    });
                }
            });
        });
    });
    return results;
};

window.showOver100AuditModal = function() {
    const term = String(state.term);
    const auditData = typeof window.scanSchoolOver100Scores === 'function' ? window.scanSchoolOver100Scores(term) : [];
    const totalClasses = auditData.length;
    const totalStudents = auditData.reduce((sum, item) => sum + item.students.length, 0);

    let contentHtml = '';
    if(totalClasses === 0) {
        contentHtml = `
            <div class="text-center py-12 px-4 bg-emerald-50/50 rounded-2xl border border-emerald-200">
                <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <i class="ph ph-shield-check text-4xl"></i>
                </div>
                <h4 class="text-xl font-extrabold text-emerald-900 mb-1">ไม่พบคะแนนเกิน 100 คะแนน</h4>
                <p class="text-sm text-emerald-700 max-w-md mx-auto">
                    การตรวจสอบคะแนนทุกรายวิชาและทุกห้องเรียนในเทอม ${term} ถูกต้องเรียบร้อย ไม่มีนักเรียนคนใดที่มีคะแนนรวมเกิน 100 คะแนน
                </p>
            </div>
        `;
    } else {
        const rowsHtml = auditData.map(item => `
            <div class="p-4 bg-white rounded-2xl border-2 border-rose-200 shadow-sm mb-4 hover:border-rose-300 transition-all">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-xs border border-indigo-100">ห้อง ${item.className}</span>
                            <h4 class="font-black text-slate-800 text-base">${item.subjectName} ${item.subjectCode ? `(${item.subjectCode})` : ''}</h4>
                        </div>
                        <div class="text-xs text-slate-500 font-medium mt-1">
                            ครูผู้สอน: <span class="font-bold text-slate-700">ครู${item.teacherName}</span> • พบคะแนนเกิน <span class="font-black text-rose-600">${item.students.length} คน</span>
                        </div>
                    </div>
                    <button onclick="window.openScorebookForClass('${item.subId}', '${item.cId}')" class="tactile-btn bg-primary-gradient text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-indigo-200 flex items-center gap-1.5 shrink-0 hover:opacity-95 cursor-pointer">
                        <i class="ph ph-arrow-square-out text-base"></i> ไปแก้ไขคะแนนห้องนี้
                    </button>
                </div>
                <div class="mt-3 overflow-x-auto">
                    <table class="w-full text-left text-xs">
                        <thead>
                            <tr class="text-slate-400 font-bold border-b border-slate-100">
                                <th class="py-1 px-2 text-center w-12">เลขที่</th>
                                <th class="py-1 px-2 text-center w-28">รหัสนักเรียน</th>
                                <th class="py-1 px-2">ชื่อ-นามสกุล</th>
                                <th class="py-1 px-2 text-center w-28">คะแนนรวม</th>
                                <th class="py-1 px-2 text-center w-24">เกินเกณฑ์</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                            ${item.students.map(s => `
                                <tr class="hover:bg-rose-50/50">
                                    <td class="py-1.5 px-2 text-center text-slate-500 font-bold">${s.index}</td>
                                    <td class="py-1.5 px-2 text-center font-mono text-slate-500">${s.studentId}</td>
                                    <td class="py-1.5 px-2 font-bold text-slate-800">${s.name}</td>
                                    <td class="py-1.5 px-2 text-center font-black text-rose-600 bg-rose-50/80 rounded">${s.total} / 100</td>
                                    <td class="py-1.5 px-2 text-center font-black text-rose-700">+${s.excess} คะแนน</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `).join('');

        contentHtml = `
            <div class="grid grid-cols-2 gap-4 mb-5">
                <div class="p-3.5 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
                        <i class="ph ph-chalkboard text-xl"></i>
                    </div>
                    <div>
                        <div class="text-2xl font-black text-rose-900">${totalClasses} ห้อง</div>
                        <div class="text-[11px] font-bold text-rose-700">ห้องเรียนที่พบคะแนนเกิน</div>
                    </div>
                </div>
                <div class="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
                        <i class="ph ph-user-circle-gear text-xl"></i>
                    </div>
                    <div>
                        <div class="text-2xl font-black text-amber-900">${totalStudents} คน</div>
                        <div class="text-[11px] font-bold text-amber-700">จำนวนนักเรียนที่คะแนนเกิน</div>
                    </div>
                </div>
            </div>
            <div class="max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                ${rowsHtml}
            </div>
        `;
    }

    const modalHtml = `
        <div class="flex justify-between items-start mb-5 pb-4 border-b border-slate-100">
            <div>
                <h3 class="text-xl font-black text-slate-800 flex items-center gap-2">
                    <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
                        <i class="ph ph-warning-octagon text-2xl font-bold"></i>
                    </div>
                    <span>ตรวจสอบคะแนนเกิน 100 คะแนน (เทอม ${term})</span>
                </h3>
                <p class="text-xs text-slate-500 font-medium mt-1">
                    ระบบสแกนคะแนนรวม (ตัวชี้วัด + กลางภาค + ปลายภาค) ของทุกรายวิชาและห้องเรียนเพื่อป้องกันข้อผิดพลาด
                </p>
            </div>
            <button onclick="window.hideModal()" class="text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100">
                <i class="ph ph-x text-xl"></i>
            </button>
        </div>
        ${contentHtml}
    `;
    window.showModal(modalHtml, 'max-w-4xl');
};

/* ==========================================================================
   ระบบตรวจสอบและปัดคะแนนคาบเกี่ยวเกรด (+1 คะแนนอัตโนมัติ)
   ตรวจจับคะแนน 54, 59, 64, 69, 74, 79 (และ 49) แล้วปัดขึ้น 1 คะแนนเพื่อเลื่อนเกรด
   ไม่เกิน 100 คะแนนเต็มเด็ดขาด
   ========================================================================== */

window.gradeBoundaryInspectorState = {
    scope: 'all',
    targetId: '',
    subjectId: 'all',
    targetScores: [54, 59, 64, 69, 74, 79],
    include49: false,
    results: [],
    selectedKeys: new Set(),
    searchQuery: '',
    isLoading: false
};

window.scanGradeBoundaryStudents = function(options = {}) {
    const term = String(options.term || (window.state && state.term) || '1');
    const scope = options.scope || 'all';
    const targetId = options.targetId || '';
    const subjectId = options.subjectId || 'all';
    const targetScores = Array.isArray(options.targetScores) && options.targetScores.length > 0
        ? options.targetScores.map(Number)
        : [54, 59, 64, 69, 74, 79];

    const classEntries = typeof window.getSortedClassEntries === 'function'
        ? window.getSortedClassEntries()
        : Object.entries(DB.classes || {});

    let targetClasses = classEntries;
    if (scope === 'grade' && targetId) {
        targetClasses = classEntries.filter(([cId, cls]) => {
            const gradeKey = typeof window.getAdminGradeLevelKey === 'function'
                ? window.getAdminGradeLevelKey(cls.name || cId)
                : ((cls.name || '').split('/')[0].replace(/\D/g, ''));
            return String(gradeKey) === String(targetId);
        });
    } else if (scope === 'class' && targetId) {
        targetClasses = classEntries.filter(([cId]) => String(cId) === String(targetId));
    }

    const allSubjects = DB.subjects || [];
    let targetSubjects = allSubjects;
    if (subjectId && subjectId !== 'all') {
        targetSubjects = allSubjects.filter(sub => String(sub.id) === String(subjectId));
    }

    const matches = [];

    targetClasses.forEach(([cId, cls]) => {
        const classSubjects = typeof window.getAdminMidtermSubjectsForClass === 'function'
            ? window.getAdminMidtermSubjectsForClass(cId)
            : allSubjects;
        const validSubjectIds = new Set(classSubjects.map(s => String(s.id)));

        const students = cls.students || [];

        targetSubjects.forEach(sub => {
            if (!validSubjectIds.has(String(sub.id))) return;

            const sd = (window.DB_SubjectData && window.DB_SubjectData[sub.id]) || {};
            const scStore = sd.scores ? sd.scores[cId] : null;
            if (!scStore) return;

            students.forEach((stu, sIdx) => {
                const total = window.getStudentTotalScore(stu, sub.id, cId, term);
                if (total === null || total === undefined || total <= 0) return;

                const roundedTotal = Math.round(Number(total));
                if (targetScores.includes(roundedTotal)) {
                    const oldGrade = window.calculateGrade(total, DB.gradeSettings);
                    const newTotal = roundedTotal + 1;
                    if (newTotal > 100) return; // Strict safety: ไม่เกิน 100 คะแนนเต็มเด็ดขาด
                    const newGrade = window.calculateGrade(newTotal, DB.gradeSettings);

                    // ตรวจสอบช่องคะแนนที่จะเพิ่ม 1 คะแนน
                    const termNode = typeof window.getAdminMidtermTermNode === 'function'
                        ? window.getAdminMidtermTermNode(sub.id, cId, stu.studentId)
                        : (scStore[stu.studentId] && (scStore[stu.studentId][term] || scStore[stu.studentId]));

                    const maxFinal = typeof window.getAdminExamFullScore === 'function'
                        ? window.getAdminExamFullScore(sub.id, cId, 'finalScore')
                        : 30;
                    const maxMid = typeof window.getAdminExamFullScore === 'function'
                        ? window.getAdminExamFullScore(sub.id, cId, 'midTermScore')
                        : 20;

                    let targetField = 'finalScore';
                    let fieldLabel = 'ปลายภาค';
                    let currentFieldValue = termNode && termNode.finalScore !== undefined ? Number(termNode.finalScore) : 0;
                    let maxFieldScore = maxFinal;

                    if (currentFieldValue + 1 > maxFinal) {
                        const midVal = termNode && termNode.midTermScore !== undefined ? Number(termNode.midTermScore) : 0;
                        if (midVal + 1 <= maxMid) {
                            targetField = 'midTermScore';
                            fieldLabel = 'กลางภาค';
                            currentFieldValue = midVal;
                            maxFieldScore = maxMid;
                        }
                    }

                    const newFieldValue = currentFieldValue + 1;
                    if (newFieldValue > maxFieldScore) return; // ไม่เกินคะแนนเต็มของช่องนั้น

                    matches.push({
                        key: `${sub.id}_${cId}_${stu.studentId}`,
                        subId: sub.id,
                        subjectName: sub.name || '',
                        subjectCode: sub.code || '',
                        cId,
                        className: cls.name || cId,
                        studentId: stu.studentId,
                        studentName: stu.name || '',
                        studentIndex: sIdx + 1,
                        currentTotal: roundedTotal,
                        newTotal,
                        oldGrade,
                        newGrade,
                        targetField,
                        fieldLabel,
                        currentFieldValue,
                        newFieldValue,
                        maxFieldScore
                    });
                }
            });
        });
    });

    return matches;
};

window.applyGradeBoundaryAdjustments = async function(itemsToApply) {
    if (!state.user || (state.user.role !== 'admin' && state.user.role !== 'teacher')) {
        window.notify('คุณไม่มีสิทธิ์แก้ไขคะแนน', true);
        return { success: false, count: 0 };
    }
    if (!Array.isArray(itemsToApply) || itemsToApply.length === 0) {
        window.notify('กรุณาเลือกนักเรียนอย่างน้อย 1 คน', true);
        return { success: false, count: 0 };
    }

    const term = String((window.state && state.term) || '1');
    const changedClasses = new Set();
    const appliedCells = [];
    const targets = [];
    const seenTargets = new Set();
    let appliedCount = 0;

    for (const item of itemsToApply) {
        const { subId, cId, studentId, targetField, newFieldValue, newTotal } = item;
        if (newTotal > 100) continue; // Safety guard: ไม่เกิน 100 คะแนนเต็มเด็ดขาด

        if (!DB_SubjectData[subId]) DB_SubjectData[subId] = { classData: {}, scores: {} };
        const sd = DB_SubjectData[subId];
        if (!sd.scores) sd.scores = {};
        if (!sd.scores[cId]) sd.scores[cId] = {};
        if (!sd.scores[cId][studentId]) sd.scores[cId][studentId] = {};
        if (!sd.scores[cId][studentId][term]) sd.scores[cId][studentId][term] = { indicators: {} };

        const currentTermNode = typeof window.getAdminMidtermTermNode === 'function'
            ? window.getAdminMidtermTermNode(subId, cId, studentId)
            : sd.scores[cId][studentId][term];

        const termNode = currentTermNode || sd.scores[cId][studentId][term];
        if (!termNode.indicators) termNode.indicators = {};

        termNode[targetField] = newFieldValue;

        if (typeof window.rememberScoreSafetyValue === 'function') {
            window.rememberScoreSafetyValue(subId, cId, studentId, term, targetField, newFieldValue, { persistDelay: 1000 });
        }
        if (typeof window.markScoreSubjectPending === 'function') {
            window.markScoreSubjectPending(subId, cId, studentId);
        }
        if (typeof window.registerPendingScoreWrite === 'function') {
            window.registerPendingScoreWrite(subId, cId, studentId, term, targetField, newFieldValue);
        }

        appliedCells.push({ subId, clsId: cId, stuId: studentId, field: targetField });
        changedClasses.add(String(cId));

        const targetKey = `${subId}|${cId}|${studentId}`;
        if (!seenTargets.has(targetKey)) {
            seenTargets.add(targetKey);
            targets.push({ subId, clsId: cId, stuId: studentId });
        }

        appliedCount++;
    }

    if (appliedCount === 0) {
        window.notify('ไม่มีรายการที่สามารถปรับคะแนนได้', true);
        return { success: false, count: 0 };
    }

    changedClasses.forEach(clsId => {
        itemsToApply.forEach(it => {
            if (typeof window.markScoreClassBundleDirty === 'function') {
                window.markScoreClassBundleDirty(it.subId, clsId);
            }
        });
    });

    if (typeof window.persistScoreSafetyLogNow === 'function') window.persistScoreSafetyLogNow();
    if (typeof window.saveSubjectDataLocalNow === 'function') window.saveSubjectDataLocalNow();

    window.notify(`ปัดคะแนน +1 ให้กับนักเรียน ${appliedCount} รายการเรียบร้อย กำลังบันทึกขึ้นคลาวด์...`);

    if (typeof window.firebaseBatchWriteScoreNodes === 'function' && targets.length > 0) {
        try {
            const result = await window.firebaseBatchWriteScoreNodes(targets);
            if (result && result.attempted && result.failed === 0) {
                appliedCells.forEach(({ subId, clsId, stuId, field }) => {
                    if (typeof window.resolvePendingScoreWrite === 'function') {
                        window.resolvePendingScoreWrite(subId, clsId, stuId, term, field);
                    }
                });
                window.notify(`บันทึกคะแนนขึ้นคลาวด์สำเร็จ ${appliedCount} รายการ`, false);
            } else {
                if (typeof window.retryPendingScoreAutoSaves === 'function') window.retryPendingScoreAutoSaves(3000);
                if (typeof window.requestDirtyCloudFlush === 'function') window.requestDirtyCloudFlush(30000);
            }
        } catch (err) {
            console.error('Firebase batch write error:', err);
            if (typeof window.requestDirtyCloudFlush === 'function') window.requestDirtyCloudFlush(30000);
        }
    } else {
        if (typeof window.requestDirtyCloudFlush === 'function') window.requestDirtyCloudFlush(5000);
    }

    return { success: true, count: appliedCount };
};

window.showGradeBoundaryInspectorModal = function(initialScope = 'all', initialTarget = '') {
    const st = window.gradeBoundaryInspectorState;
    st.scope = initialScope || 'all';
    st.targetId = initialTarget || '';
    st.subjectId = 'all';
    st.targetScores = [54, 59, 64, 69, 74, 79];
    st.include49 = false;
    st.results = [];
    st.selectedKeys = new Set();
    st.searchQuery = '';
    st.isLoading = false;

    window.renderGradeBoundaryInspectorModalView();
    window.refreshGradeBoundaryInspectorModal(true);
};

window.renderGradeBoundaryInspectorModalView = function() {
    const st = window.gradeBoundaryInspectorState;
    const term = String((window.state && state.term) || '1');
    const classEntries = typeof window.getSortedClassEntries === 'function'
        ? window.getSortedClassEntries()
        : Object.entries(DB.classes || {});
    const subjects = DB.subjects || [];

    const gradeKeys = Array.from(new Set(classEntries.map(([cId, cls]) => {
        return typeof window.getAdminGradeLevelKey === 'function'
            ? window.getAdminGradeLevelKey(cls.name || cId)
            : ((cls.name || '').split('/')[0].replace(/\D/g, ''));
    }))).sort((a, b) => Number(a) - Number(b));

    const modalHtml = `
    <div class="flex flex-col max-h-[85vh]">
        <!-- Header -->
        <div class="flex justify-between items-start pb-4 border-b border-slate-100 shrink-0">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center text-2xl font-black shrink-0">
                    <i class="ph ph-trend-up"></i>
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h3 class="text-xl font-black text-slate-800">ระบบตรวจสอบและปัดคะแนนคาบเกี่ยวเกรด (+1 คะแนน)</h3>
                        <span class="px-2.5 py-0.5 rounded-full bg-teal-600 text-white font-extrabold text-[11px]">เทอม ${term}</span>
                    </div>
                    <p class="text-xs text-slate-500 font-medium mt-0.5">
                        ตรวจสอบนักเรียนที่ได้คะแนน 54, 59, 64, 69, 74, 79 เพื่อปัดขึ้นอีก 1 คะแนนและเลื่อนเกรดอัตโนมัติ (ไม่เกิน 100 คะแนนเต็ม)
                    </p>
                </div>
            </div>
            <button onclick="window.hideModal()" class="text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <i class="ph ph-x text-xl"></i>
            </button>
        </div>

        <!-- Filter Controls -->
        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 mt-4 shrink-0 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                    <label class="block text-xs font-extrabold text-slate-600 mb-1">1. ขอบเขต</label>
                    <select id="gb-modal-scope" onchange="window.handleGradeBoundaryScopeChange(this.value)" class="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white font-bold text-xs text-slate-800 focus-ring">
                        <option value="all" ${st.scope === 'all' ? 'selected' : ''}>ทุกห้องทั้งโรงเรียน (ป.1 - ป.6)</option>
                        <option value="grade" ${st.scope === 'grade' ? 'selected' : ''}>เลือกระดับชั้น</option>
                        <option value="class" ${st.scope === 'class' ? 'selected' : ''}>เลือกเฉพาะห้องเรียน</option>
                    </select>
                </div>

                <div id="gb-modal-target-wrap" class="${st.scope === 'all' ? 'hidden' : ''}">
                    <label class="block text-xs font-extrabold text-slate-600 mb-1">2. ชั้น/ห้องเป้าหมาย</label>
                    <select id="gb-modal-target" class="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white font-bold text-xs text-slate-800 focus-ring">
                        ${st.scope === 'grade'
                            ? gradeKeys.map(gk => `<option value="${gk}" ${String(st.targetId) === String(gk) ? 'selected' : ''}>ระดับชั้น ป.${gk}</option>`).join('')
                            : classEntries.map(([cId, cls]) => `<option value="${cId}" ${String(st.targetId) === String(cId) ? 'selected' : ''}>ห้อง ${cls.name || cId}</option>`).join('')
                        }
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-extrabold text-slate-600 mb-1">3. รายวิชา</label>
                    <select id="gb-modal-subject" class="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white font-bold text-xs text-slate-800 focus-ring">
                        <option value="all">ทุกรายวิชา (${subjects.length} วิชา)</option>
                        ${subjects.map(s => `<option value="${s.id}" ${String(st.subjectId) === String(s.id) ? 'selected' : ''}>${s.name || s.id}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- คะแนนเป้าหมาย Checkboxes -->
            <div class="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-extrabold text-slate-700 mr-1">คะแนนเป้าหมาย:</span>
                    ${[
                        { score: 79, next: 80, oldG: '3.5', newG: '4.0' },
                        { score: 74, next: 75, oldG: '3.0', newG: '3.5' },
                        { score: 69, next: 70, oldG: '2.5', newG: '3.0' },
                        { score: 64, next: 65, oldG: '2.0', newG: '2.5' },
                        { score: 59, next: 60, oldG: '1.5', newG: '2.0' },
                        { score: 54, next: 55, oldG: '1.0', newG: '1.5' }
                    ].map(item => `
                        <label class="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${st.targetScores.includes(item.score) ? 'bg-teal-50 border-teal-300 text-teal-800 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}">
                            <input type="checkbox" name="gb-target-scores" value="${item.score}" ${st.targetScores.includes(item.score) ? 'checked' : ''} onchange="window.handleGradeBoundaryTargetChange()" class="rounded text-teal-600 focus:ring-0">
                            <span>${item.score} <i class="ph ph-arrow-right text-[10px] text-teal-500"></i> ${item.next} (เกรด ${item.newG})</span>
                        </label>
                    `).join('')}
                    <label class="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${st.include49 ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm' : 'bg-white border-slate-200 text-slate-400'}">
                        <input type="checkbox" id="gb-target-49" ${st.include49 ? 'checked' : ''} onchange="window.handleGradeBoundaryTargetChange()" class="rounded text-amber-600 focus:ring-0">
                        <span>49 <i class="ph ph-arrow-right text-[10px] text-amber-500"></i> 50 (เกรด 1.0)</span>
                    </label>
                </div>

                <button id="gb-scan-btn" onclick="window.refreshGradeBoundaryInspectorModal(true)" class="tactile-btn px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
                    <i class="ph ph-arrows-clockwise text-base"></i> ดึงคะแนนและตรวจสอบ
                </button>
            </div>
        </div>

        <!-- Dynamic Results Area -->
        <div id="grade-boundary-results-wrap" class="mt-4 flex-1 overflow-y-auto min-h-[280px]">
            <!-- Results Table Rendered Here -->
        </div>

        <!-- Footer Action Bar -->
        <div id="grade-boundary-footer" class="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div class="text-xs font-bold text-slate-600 flex items-center gap-2">
                <span id="gb-selected-count-badge" class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">เลือกอยู่ 0 รายการ</span>
                <span class="text-slate-400">• จำกัดคะแนนไม่เกิน 100 คะแนนเต็มเด็ดขาด</span>
            </div>
            <div class="flex items-center gap-2.5 w-full sm:w-auto">
                <button type="button" onclick="window.exportGradeBoundaryToExcel()" class="tactile-btn flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-slate-200">
                    <i class="ph ph-file-xls text-base text-emerald-600"></i> ส่งออก Excel
                </button>
                <button type="button" id="gb-apply-btn" onclick="window.confirmApplyGradeBoundaryAdjustments()" class="tactile-btn flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200 disabled:opacity-50">
                    <i class="ph ph-check-circle text-base"></i> ปัดขึ้นอัตโนมัติ (+1 คะแนน)
                </button>
                <button type="button" onclick="window.hideModal()" class="tactile-btn px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs">
                    ปิด
                </button>
            </div>
        </div>
    </div>
    `;

    window.showModal(modalHtml, 'max-w-5xl');
};

window.handleGradeBoundaryScopeChange = function(scope) {
    const st = window.gradeBoundaryInspectorState;
    st.scope = scope;
    const wrap = document.getElementById('gb-modal-target-wrap');
    const select = document.getElementById('gb-modal-target');
    if (!wrap || !select) return;

    if (scope === 'all') {
        wrap.classList.add('hidden');
        st.targetId = '';
    } else if (scope === 'grade') {
        wrap.classList.remove('hidden');
        const classEntries = typeof window.getSortedClassEntries === 'function' ? window.getSortedClassEntries() : Object.entries(DB.classes || {});
        const gradeKeys = Array.from(new Set(classEntries.map(([cId, cls]) => {
            return typeof window.getAdminGradeLevelKey === 'function'
                ? window.getAdminGradeLevelKey(cls.name || cId)
                : ((cls.name || '').split('/')[0].replace(/\D/g, ''));
        }))).sort((a, b) => Number(a) - Number(b));
        select.innerHTML = gradeKeys.map(gk => `<option value="${gk}">ระดับชั้น ป.${gk}</option>`).join('');
        st.targetId = select.value || '';
    } else if (scope === 'class') {
        wrap.classList.remove('hidden');
        const classEntries = typeof window.getSortedClassEntries === 'function' ? window.getSortedClassEntries() : Object.entries(DB.classes || {});
        select.innerHTML = classEntries.map(([cId, cls]) => `<option value="${cId}">ห้อง ${cls.name || cId}</option>`).join('');
        st.targetId = select.value || '';
    }
};

window.handleGradeBoundaryTargetChange = function() {
    const st = window.gradeBoundaryInspectorState;
    const checkboxes = document.querySelectorAll('input[name="gb-target-scores"]:checked');
    const list = Array.from(checkboxes).map(cb => Number(cb.value));
    const chk49 = document.getElementById('gb-target-49');
    st.include49 = chk49 ? chk49.checked : false;
    if (st.include49 && !list.includes(49)) list.push(49);
    st.targetScores = list;
};

window.refreshGradeBoundaryInspectorModal = async function(preload = false) {
    const st = window.gradeBoundaryInspectorState;
    const wrap = document.getElementById('grade-boundary-results-wrap');
    if (!wrap) return;

    const btn = document.getElementById('gb-scan-btn');
    const origBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner-gap animate-spin text-base"></i> กำลังตรวจสอบ...';
    }

    wrap.innerHTML = `
        <div class="text-center py-16">
            <div class="w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin mx-auto mb-3"></div>
            <div class="font-extrabold text-sm text-slate-700">กำลังตรวจสอบคะแนนคาบเกี่ยวเกรด...</div>
            <div class="text-xs text-slate-400 mt-1">กำลังดึงข้อมูลล่าสุดจากคลาวด์และคำนวณคะแนนรวม</div>
        </div>
    `;

    try {
        const scopeEl = document.getElementById('gb-modal-scope');
        if (scopeEl) st.scope = scopeEl.value;
        const targetEl = document.getElementById('gb-modal-target');
        if (targetEl && st.scope !== 'all') st.targetId = targetEl.value;
        const subEl = document.getElementById('gb-modal-subject');
        if (subEl) st.subjectId = subEl.value;
        window.handleGradeBoundaryTargetChange();

        // ดึงคะแนนจากคลาวด์หากมีการร้องขอ preload
        if (preload && typeof window.firebaseLoadScoresForSubjectsBulk === 'function') {
            const allSubjects = DB.subjects || [];
            let subjectsToPreload = allSubjects;
            if (st.subjectId && st.subjectId !== 'all') {
                subjectsToPreload = allSubjects.filter(s => String(s.id) === String(st.subjectId));
            }
            if (subjectsToPreload.length > 0) {
                try {
                    await window.firebaseLoadScoresForSubjectsBulk(subjectsToPreload.map(s => String(s.id)));
                } catch (e) {
                    console.warn('Preload for grade boundary scan failed:', e);
                }
            }
        }

        const matches = window.scanGradeBoundaryStudents({
            term: state.term,
            scope: st.scope,
            targetId: st.targetId,
            subjectId: st.subjectId,
            targetScores: st.targetScores
        });

        st.results = matches;
        st.selectedKeys = new Set(matches.map(m => m.key));

        window.renderGradeBoundaryResultsTable();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origBtnHtml;
        }
    }
};

window.renderGradeBoundaryResultsTable = function() {
    const st = window.gradeBoundaryInspectorState;
    const wrap = document.getElementById('grade-boundary-results-wrap');
    if (!wrap) return;

    const query = (st.searchQuery || '').trim().toLowerCase();
    const filtered = st.results.filter(item => {
        if (!query) return true;
        return (
            (item.studentName || '').toLowerCase().includes(query) ||
            (item.studentId || '').toLowerCase().includes(query) ||
            (item.className || '').toLowerCase().includes(query) ||
            (item.subjectName || '').toLowerCase().includes(query)
        );
    });

    const total = st.results.length;
    const selectedCount = st.selectedKeys.size;

    // อัปเดตตัวนับและสถานะปุ่ม
    const countBadge = document.getElementById('gb-selected-count-badge');
    if (countBadge) {
        countBadge.innerText = `เลือกอยู่ ${selectedCount} / ${total} รายการ`;
    }
    const applyBtn = document.getElementById('gb-apply-btn');
    if (applyBtn) {
        applyBtn.disabled = selectedCount === 0;
        applyBtn.innerHTML = `<i class="ph ph-check-circle text-base"></i> ปัดขึ้นอัตโนมัติ (+1 คะแนน) สำหรับคนที่เลือก (${selectedCount} คน)`;
    }

    if (total === 0) {
        wrap.innerHTML = `
            <div class="text-center py-12 px-4 bg-emerald-50/50 rounded-2xl border border-emerald-200">
                <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <i class="ph ph-shield-check text-4xl"></i>
                </div>
                <h4 class="text-lg font-black text-emerald-900 mb-1">ไม่พบนักเรียนที่มีคะแนนคาบเกี่ยวเกรด</h4>
                <p class="text-xs text-emerald-700 max-w-md mx-auto">
                    ไม่พบคะแนน ${st.targetScores.join(', ')} ในขอบเขตที่เลือก นักเรียนทุกคนมีคะแนนที่ชัดเจนในแต่ละเกรด หรือได้รับการปรับคะแนนเรียบร้อยแล้ว
                </p>
            </div>
        `;
        return;
    }

    // คำนวณสรุปแจกแจงตามคะแนน
    const breakdown = {};
    st.results.forEach(it => {
        const key = `${it.currentTotal} -> ${it.newTotal} (เกรด ${it.newGrade})`;
        breakdown[key] = (breakdown[key] || 0) + 1;
    });

    const breakdownPills = Object.entries(breakdown).map(([k, count]) => `
        <span class="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold flex items-center gap-1.5 shadow-sm">
            <span>${k}:</span> <strong class="text-teal-900 font-black">${count} คน</strong>
        </span>
    `).join('');

    const rowsHtml = filtered.map(item => {
        const isChecked = st.selectedKeys.has(item.key);
        return `
            <tr class="hover:bg-teal-50/40 transition-colors ${isChecked ? 'bg-teal-50/20' : ''}">
                <td class="py-2 px-3 text-center">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleGradeBoundaryItem('${item.key}', this.checked)" class="rounded text-teal-600 focus:ring-0 cursor-pointer">
                </td>
                <td class="py-2 px-2 text-center font-bold text-slate-400 text-xs">${item.studentIndex}</td>
                <td class="py-2 px-2 text-center">
                    <span class="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-xs">ห้อง ${item.className}</span>
                </td>
                <td class="py-2 px-2 text-center font-mono text-slate-500 text-xs">${item.studentId}</td>
                <td class="py-2 px-3 font-bold text-slate-800 text-xs">${item.studentName}</td>
                <td class="py-2 px-3 font-semibold text-slate-700 text-xs">
                    ${item.subjectName} ${item.subjectCode ? `<span class="text-[10px] text-slate-400">(${item.subjectCode})</span>` : ''}
                </td>
                <td class="py-2 px-2 text-center font-extrabold text-xs">
                    <span class="text-slate-600 font-bold">${item.currentTotal}</span>
                    <i class="ph ph-arrow-right text-[10px] text-teal-500 mx-1"></i>
                    <span class="text-emerald-700 font-black bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">${item.newTotal}</span>
                </td>
                <td class="py-2 px-2 text-center text-xs">
                    <div class="inline-flex items-center gap-1">
                        <span class="text-slate-400 line-through">${item.oldGrade}</span>
                        <i class="ph ph-arrow-right text-[10px] text-emerald-500"></i>
                        <span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black text-xs shadow-sm">${item.newGrade}</span>
                    </div>
                </td>
                <td class="py-2 px-2 text-center text-xs font-bold text-slate-600">
                    <span class="text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${item.fieldLabel} (${item.currentFieldValue} <i class="ph ph-arrow-right text-[9px]"></i> ${item.newFieldValue})</span>
                </td>
            </tr>
        `;
    }).join('');

    const allChecked = filtered.length > 0 && filtered.every(it => st.selectedKeys.has(it.key));

    wrap.innerHTML = `
        <!-- KPI summary -->
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-black text-slate-700">พบทั้งหมด:</span>
                <span class="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-black shadow-sm">${total} รายการ</span>
                ${breakdownPills}
            </div>
            <div class="w-full sm:w-64">
                <input type="text" placeholder="ค้นหาชื่อ, รหัส, วิชา, ห้อง..." value="${window.escapeHtml(st.searchQuery || '')}" oninput="window.handleGradeBoundarySearch(this.value)" class="w-full h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold focus-ring bg-white">
            </div>
        </div>

        <!-- Table -->
        <div class="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div class="max-h-[50vh] overflow-y-auto custom-scrollbar">
                <table class="w-full text-left border-collapse text-xs">
                    <thead class="sticky top-0 bg-slate-100/95 backdrop-blur-md text-slate-600 font-extrabold border-b border-slate-200 z-10">
                        <tr>
                            <th class="py-2.5 px-3 text-center w-10">
                                <input type="checkbox" ${allChecked ? 'checked' : ''} onchange="window.toggleGradeBoundarySelectAll(this.checked)" class="rounded text-teal-600 focus:ring-0 cursor-pointer" title="เลือกทั้งหมด">
                            </th>
                            <th class="py-2.5 px-2 text-center w-12">ลำดับ</th>
                            <th class="py-2.5 px-2 text-center w-20">ห้อง</th>
                            <th class="py-2.5 px-2 text-center w-24">รหัส</th>
                            <th class="py-2.5 px-3 min-w-[140px]">ชื่อ - สกุล</th>
                            <th class="py-2.5 px-3 min-w-[130px]">รายวิชา</th>
                            <th class="py-2.5 px-2 text-center w-28">คะแนน (+1)</th>
                            <th class="py-2.5 px-2 text-center w-28">เกรดใหม่</th>
                            <th class="py-2.5 px-2 text-center w-36">ช่องที่บวกคะแนน</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${rowsHtml || `<tr><td colspan="9" class="py-8 text-center text-slate-400 font-bold">ไม่พบรายการที่ตรงกับคำค้นหา</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

window.handleGradeBoundarySearch = function(query) {
    window.gradeBoundaryInspectorState.searchQuery = query;
    window.renderGradeBoundaryResultsTable();
};

window.toggleGradeBoundarySelectAll = function(checked) {
    const st = window.gradeBoundaryInspectorState;
    if (checked) {
        st.results.forEach(it => st.selectedKeys.add(it.key));
    } else {
        st.selectedKeys.clear();
    }
    window.renderGradeBoundaryResultsTable();
};

window.toggleGradeBoundaryItem = function(key, checked) {
    const st = window.gradeBoundaryInspectorState;
    if (checked) {
        st.selectedKeys.add(key);
    } else {
        st.selectedKeys.delete(key);
    }
    window.renderGradeBoundaryResultsTable();
};

window.confirmApplyGradeBoundaryAdjustments = function() {
    const st = window.gradeBoundaryInspectorState;
    const selectedItems = st.results.filter(it => st.selectedKeys.has(it.key));
    if (selectedItems.length === 0) {
        window.notify('กรุณาเลือกนักเรียนอย่างน้อย 1 คน', true);
        return;
    }

    const title = 'ยืนยันการปัดคะแนนขึ้น (+1 คะแนน)';
    const message = `
        คุณต้องการปัดคะแนนขึ้น 1 คะแนน ให้กับนักเรียนจำนวน <strong class="text-emerald-700 font-black">${selectedItems.length} รายการ</strong> หรือไม่?
        <div class="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 font-medium space-y-1">
            <div>• นักเรียนทุกคนที่เลือกจะได้รับคะแนนเพิ่ม 1 คะแนน และ<strong>เลื่อนเกรดทันที</strong></div>
            <div>• ระบบจำกัดคะแนนรวมไม่ให้เกิน 100 คะแนนเต็มเด็ดขาด</div>
            <div>• ข้อมูลจะถูกบันทึกขึ้น Firebase Cloud อัตโนมัติ</div>
        </div>
    `;

    if (typeof window.showCustomConfirm === 'function') {
        window.showCustomConfirm(title, message, 'success', async () => {
            const btn = document.getElementById('gb-apply-btn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="ph ph-spinner-gap animate-spin text-base"></i> กำลังบันทึกคะแนน...';
            }
            try {
                const res = await window.applyGradeBoundaryAdjustments(selectedItems);
                if (res && res.success) {
                    window.notify(`ปัดคะแนน +1 ให้กับนักเรียน ${res.count} คน สำเร็จเรียบร้อย ทุกคนได้เลื่อนเกรดแล้ว!`);
                    await window.refreshGradeBoundaryInspectorModal(false);
                }
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    } else {
        if (confirm(`ยืนยันการปัดคะแนน +1 ให้นักเรียน ${selectedItems.length} รายการ?`)) {
            window.applyGradeBoundaryAdjustments(selectedItems).then(res => {
                if (res && res.success) {
                    window.notify(`ปัดคะแนน +1 เรียบร้อย ${res.count} คน`);
                    window.refreshGradeBoundaryInspectorModal(false);
                }
            });
        }
    }
};

window.exportGradeBoundaryToExcel = function() {
    if (typeof XLSX === 'undefined') {
        window.notify('ไม่พบคลังคำสั่ง XLSX สำหรับส่งออกไฟล์', true);
        return;
    }
    const st = window.gradeBoundaryInspectorState;
    if (!st.results || st.results.length === 0) {
        window.notify('ไม่พบข้อมูลสำหรับส่งออก Excel', true);
        return;
    }

    const term = String((window.state && state.term) || '1');
    const year = String((window.DB && DB.schoolInfo && DB.schoolInfo.year) || '2568');

    const headers = [
        'ลำดับ',
        'ห้องเรียน',
        'รหัสนักเรียน',
        'ชื่อ-นามสกุล',
        'รายวิชา',
        'คะแนนเดิม',
        'คะแนนใหม่ (+1)',
        'เกรดเดิม',
        'เกรดใหม่',
        'ช่องคะแนนที่ปรับ',
        'คะแนนช่องเดิม',
        'คะแนนช่องใหม่'
    ];

    const rows = [headers];
    st.results.forEach((item, idx) => {
        rows.push([
            idx + 1,
            `ห้อง ${item.className}`,
            item.studentId,
            item.studentName,
            item.subjectName,
            item.currentTotal,
            item.newTotal,
            item.oldGrade,
            item.newGrade,
            item.fieldLabel,
            item.currentFieldValue,
            item.newFieldValue
        ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `ปัดคะแนน_เทอม${term}`);
    const fileName = `รายชื่อนักเรียนปัดคะแนนคาบเกี่ยวเกรด_เทอม${term}_ปี${year}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    window.notify(`ส่งออก ${fileName} สำเร็จ (${st.results.length} รายการ)`);
};
