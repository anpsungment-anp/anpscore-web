/* ANPSCORE — หน้าผู้ดูแลระบบ นำเข้าส่งออกคะแนนสอบ และคะแนนพิเศษ
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

window.renderAdminDash = async function(container) {
    $('page-title').innerText = 'แดชบอร์ดภาพรวมผู้ดูแลระบบ';
    const progressTerm = String(state.term);
    const missingProgress = window.getMissingAdminDashboardProgressPairs(progressTerm);
    if(missingProgress.length > 0 && typeof window.firebaseBackfillDashboardProgress === 'function') {
        container.innerHTML = `
            <div class="modern-card p-10 flex items-center justify-center gap-4 text-slate-600 min-h-[220px]">
                <i class="ph ph-spinner-gap animate-spin text-3xl text-indigo-500"></i>
                <div><div class="font-extrabold text-slate-800">กำลังซิงก์ความคืบหน้าคะแนนล่าสุด</div><div class="text-sm mt-1">ตรวจคะแนนจากคลาวด์ครั้งเดียว เพื่อให้ทุกเครื่องแสดงผลตรงกัน</div></div>
            </div>`;
        await window.ensureAdminDashboardProgressCurrent(progressTerm);
        if(state.activePage !== 'admin_dash' || String(state.term) !== progressTerm || !container.isConnected) return;
    }
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
        <div class="flex items-center justify-between mb-4 px-2">
            <h3 class="text-xl font-extrabold text-slate-800 flex items-center"><i class="ph ph-briefcase-metal mr-2 text-indigo-500 text-2xl"></i> สรุปภาระงานสอนของครู (เทอม ${state.term})</h3>
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
    const type = scoreType === 'final' ? 'final' : 'mid';
    const scoreLabel = type === 'final' ? 'ปลายภาค' : 'กลางภาค';
    const subjects = window.getAdminMidtermSubjectsForClass(cId);
    const fullClassStudents = (cls && cls.students) || [];
    const students = studentsOverride || fullClassStudents;
    const esc = value => window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
    const formatScore = value => {
        if(value === null || value === undefined || value === '') return '';
        const number = Number(value);
        if(!Number.isFinite(number)) return '';
        return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    };
    const compactSubjectName = value => {
        const name = String(value || '').trim();
        if(name.includes('ภาษาอังกฤษเพื่อการสื่อสาร')) return 'อังกฤษสื่อสาร';
        if(name.includes('คณิตศาสตร์')) return 'คณิตฯ';
        if(name.includes('วิทยาศาสตร์')) return 'วิทย์ฯ';
        if(name.includes('การงานอาชีพ')) return 'การงาน';
        if(name.includes('ภาษาอังกฤษ')) return 'อังกฤษ';
        if(name.includes('สังคมศึกษา')) return 'สังคม';
        if(name.includes('ประวัติศาสตร์')) return 'ประวัติฯ';
        if(name.includes('ภาษาไทย')) return 'ไทย';
        if(name.includes('ภาษาจีน')) return 'จีน';
        if(name.includes('สุขศึกษา')) return 'สุขศึกษา';
        if(name.includes('ทัศนศิลป์')) return 'ทัศนศิลป์';
        if(name.includes('ทุจริต')) return 'ต้านทุจริต';
        return name.replace(/^วิชา\s*/, '');
    };
    const fullScores = subjects.map(sub => Number(window.getGuardianExamFullScore(sub.id, cId, type) || 0));
    const totalFullScore = fullScores.reduce((sum, value) => sum + value, 0);
    let rowHeight = Math.max(11, Math.min(24, Math.floor(900 / Math.max(1, students.length + 2))));
    rowHeight -= rowHeight % 2; // keep rowHeight even so rowHeight*html2canvas scale is a whole pixel (odd heights make html2canvas jitter text vertically every other row)
    const bodyFontSize = Math.max(8, Math.min(10.5, rowHeight - 10.5));
    const className = (cls && cls.name) || cId;
    const teacherName = typeof window.getGuardianHomeroomDefault === 'function' ? window.getGuardianHomeroomDefault(cId) : '';
    const schoolName = String((DB.schoolInfo && DB.schoolInfo.name) || 'โรงเรียน');
    const schoolYear = String((DB.schoolInfo && DB.schoolInfo.year) || '');
    const fixedWidth = 348;
    const subjectWidth = Math.max(22, Math.floor((749 - fixedWidth) / Math.max(1, subjects.length)));
    const subjectHeaderFontSize = subjects.length >= 14 ? 8 : subjects.length >= 12 ? 8.75 : 9;

    const studentRows = students.map((student, index) => {
        const scores = subjects.map(sub => window.getGuardianExamScore(sub.id, cId, student.studentId, type));
        const filledScores = scores.filter(score => score !== null && score !== undefined && score !== '');
        const total = filledScores.reduce((sum, score) => sum + Number(score || 0), 0);
        const percent = totalFullScore > 0 ? (total / totalFullScore) * 100 : 0;
        return `<tr style="height:${rowHeight}px">
            <td><span class="pdf-cell-text">${startIndex + index + 1}</span></td><td><span class="pdf-cell-text">${esc(student.studentId || '')}</span></td><td class="student-name"><span class="pdf-cell-text">${esc(student.name || '')}</span></td>
            ${scores.map(score => `<td><span class="pdf-cell-text">${formatScore(score)}</span></td>`).join('')}
            <td class="summary-cell"><span class="pdf-cell-text">${formatScore(total)}</span></td><td class="summary-cell"><span class="pdf-cell-text">${percent.toFixed(2)}</span></td>
        </tr>`;
    }).join('');

    return `<section class="admin-exam-pdf-page" style="width:793px;height:1122px;box-sizing:border-box;padding:18px 22px 18px;background:#fff;color:#0f172a;font-family:'Sarabun',sans-serif;overflow:hidden;position:relative;">
        <header style="text-align:center;line-height:1.2;margin-bottom:7px;">
            <div style="font-size:17px;font-weight:800;">แบบสรุปรวมคะแนนสอบ${scoreLabel}</div>
            <div style="font-size:15px;font-weight:700;">${esc(schoolName)}</div>
            <div style="font-size:11px;">ภาคเรียนที่ ${esc(state.term)} ปีการศึกษา ${esc(schoolYear)}</div>
        </header>
        <div style="display:flex;justify-content:space-between;gap:12px;font-size:10px;font-weight:600;margin-bottom:6px;border-top:1px solid #475569;padding-top:5px;">
            <span>ชั้น/ห้อง: ${esc(className)}</span><span>นักเรียน: ${fullClassStudents.length} คน${fullClassStudents.length !== students.length ? ` (ที่ ${startIndex + 1}-${startIndex + students.length})` : ''}</span><span>ครูประจำชั้น: ${esc(teacherName || '-')}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:${bodyFontSize}px;line-height:1.18;">
            <colgroup><col style="width:24px"><col style="width:46px"><col style="width:190px">${subjects.map(() => `<col style="width:${subjectWidth}px">`).join('')}<col style="width:42px"><col style="width:46px"></colgroup>
            <thead><tr style="height:66px;background:#e8eefc;">
                <th>ที่</th><th>รหัส</th><th>ชื่อ-สกุล</th>
                ${subjects.map((sub, index) => `<th><div style="font-size:${subjectHeaderFontSize}px;white-space:normal;overflow-wrap:anywhere;line-height:1.15;">${esc(compactSubjectName(sub.name || ''))}</div><div style="font-size:7.5px;color:#475569;margin-top:4px;white-space:nowrap;">เต็ม ${formatScore(fullScores[index])}</div></th>`).join('')}
                <th>รวม<br><span style="font-size:7.5px">${formatScore(totalFullScore)}</span></th><th>ร้อย<br>ละ</th>
            </tr></thead>
            <tbody>${studentRows}</tbody>
        </table>
        <div style="position:absolute;right:22px;bottom:5px;font-size:8px;color:#64748b;">หน้า ${pageNumber} / ${totalPages}</div>
        <style>
            .admin-exam-pdf-page th,.admin-exam-pdf-page td{border:1px solid #64748b;padding:0;text-align:center;vertical-align:middle;overflow:hidden;letter-spacing:0;}
            .admin-exam-pdf-page th{font-size:10px;font-weight:800;line-height:1.15;padding:2px;}
            .admin-exam-pdf-page tbody td{height:${rowHeight}px;box-sizing:border-box;}
            .admin-exam-pdf-page .pdf-cell-text{display:inline-block;position:relative;top:-5px;}
            .admin-exam-pdf-page .student-name{text-align:left;padding-left:5px;padding-right:4px;font-size:${Math.max(8.5, bodyFontSize)}px;font-weight:600;white-space:nowrap;}
            .admin-exam-pdf-page .summary-cell{font-weight:800;background:#f1f5f9;}
        </style>
    </section>`;
}

window.exportAdminExamSummaryPdf = async function(examType = null) {
    if(!state.user || state.user.role !== 'admin') return;
    const selectedType = examType || ($('admin-report-score-type') ? $('admin-report-score-type').value : 'mid');
    const scoreType = selectedType === 'final' ? 'final' : 'mid';
    const scoreLabel = scoreType === 'final' ? 'ปลายภาค' : 'กลางภาค';
    const JsPdfClass = window.jspdf && window.jspdf.jsPDF;
    if(typeof window.html2canvas !== 'function' || !JsPdfClass) {
        window.notify('ไม่พบตัวสร้าง PDF กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', true);
        return;
    }
    const classEntries = window.getSortedClassEntries().filter(([cId, cls]) => {
        return (cls.students || []).length > 0 && window.getAdminMidtermSubjectsForClass(cId).length > 0;
    });
    if(!classEntries.length) {
        window.notify('ไม่พบห้องที่มีรายวิชาและรายชื่อนักเรียนสำหรับสร้าง PDF', true);
        return;
    }

    const maxRowsPerPage = window.MAX_ADMIN_EXAM_PDF_ROWS_PER_PAGE || 45;
    const pagePlan = [];
    classEntries.forEach(([cId, cls]) => {
        const roster = cls.students || [];
        const numChunks = Math.max(1, Math.ceil(roster.length / maxRowsPerPage));
        const chunkSize = Math.ceil(roster.length / numChunks);
        for(let i = 0; i < numChunks; i++) {
            const startIndex = i * chunkSize;
            const studentsChunk = roster.slice(startIndex, startIndex + chunkSize);
            if(!studentsChunk.length) continue;
            pagePlan.push({ cId, cls, studentsChunk, startIndex });
        }
    });

    const button = $('admin-exam-report-pdf-btn');
    const originalButtonHtml = button ? button.innerHTML : '';
    if(button) { button.disabled = true; button.innerHTML = '<i class="ph ph-spinner-gap animate-spin text-xl"></i> กำลังสร้าง PDF'; }
    window.notify(`กำลังสร้างรายงานผู้บริหาร ${classEntries.length} ห้อง รวม ${pagePlan.length} หน้า...`);
    const pdf = new JsPdfClass({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    let pageElement = null;
    try {
        if(document.fonts && document.fonts.ready) await document.fonts.ready;
        if(typeof window.firebaseLoadScoresForSubjectsBulk === 'function') {
            window.notify(`กำลังดึงคะแนน${scoreLabel}ล่าสุดจากคลาวด์...`);
            const allSubjectIds = new Set();
            classEntries.forEach(([cId]) => {
                window.getAdminMidtermSubjectsForClass(cId).forEach(sub => allSubjectIds.add(String(sub.id)));
            });
            try { await window.firebaseLoadScoresForSubjectsBulk(Array.from(allSubjectIds)); }
            catch(err) { console.warn('Admin exam PDF score preload failed:', err); }
        }
        for(let index = 0; index < pagePlan.length; index++) {
            const { cId, cls, studentsChunk, startIndex } = pagePlan[index];
            pageElement = document.createElement('div');
            pageElement.style.cssText = 'position:fixed;left:-12000px;top:0;width:793px;height:1122px;background:#fff;z-index:-9999;';
            pageElement.innerHTML = window.buildAdminExamPdfPage(cId, cls, scoreType, index + 1, pagePlan.length, studentsChunk, startIndex);
            document.body.appendChild(pageElement);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const canvas = await window.html2canvas(pageElement.firstElementChild, {
                scale: 1.5,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                width: 793,
                height: 1122
            });
            if(index > 0) pdf.addPage('a4', 'portrait');
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            pageElement.remove();
            pageElement = null;
        }
        const safeYear = String((DB.schoolInfo && DB.schoolInfo.year) || '').replace(/[\\/:*?"<>|]/g, '_');
        pdf.save(`รายงานผู้บริหาร_คะแนน${scoreLabel}_เทอม${state.term}_${safeYear}.pdf`);
        window.notify(`สร้าง PDF คะแนน${scoreLabel}สำเร็จ ${classEntries.length} ห้อง รวม ${pagePlan.length} หน้า`);
    } catch(err) {
        console.error('Admin exam PDF export failed:', err);
        window.notify('สร้างไฟล์ PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', true);
    } finally {
        if(pageElement && pageElement.remove) pageElement.remove();
        if(button) { button.disabled = false; button.innerHTML = originalButtonHtml; }
    }
}

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
        </section>`;
}
