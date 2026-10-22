/* ANPSCORE — รายงานแจ้งผู้ปกครอง และคลังข้อมูลรายปี
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

window.guardianReportState = {
    classId: '',
    scoreType: 'mid',
    archiveYear: '',   // ว่าง = ใช้คะแนนปีปัจจุบัน, มีค่า = ดึงจากคลังข้อมูล (อ่านอย่างเดียว)
    conduct: 'เรียบร้อย',
    homeroomTeacherName: '',
    greeting: 'เรียน ท่านผู้ปกครอง',
    intro: '',
    previewStudentId: ''
};
window.guardianArchiveYears = [];
window.guardianReportModel = null;
window.guardianReportCloudCache = {};
window.guardianReportRequestId = 0;

window.loadGuardianReportSettings = function() {
    try {
        const saved = JSON.parse(localStorage.getItem('anpscore_guardianReportSettings') || '{}');
        if(saved && typeof saved === 'object' && !Array.isArray(saved)) {
            window.guardianReportState = Object.assign(window.guardianReportState, saved);
        }
    } catch(e) {}
    if(!['mid', 'final', 'both'].includes(window.guardianReportState.scoreType)) {
        window.guardianReportState.scoreType = 'mid';
    }
}

window.saveGuardianReportSettings = function() {
    try {
        const s = window.guardianReportState;
        localStorage.setItem('anpscore_guardianReportSettings', JSON.stringify({
            classId: s.classId,
            scoreType: s.scoreType,
            archiveYear: s.archiveYear,
            conduct: s.conduct,
            homeroomTeacherName: s.homeroomTeacherName,
            greeting: s.greeting,
            intro: s.intro
        }));
    } catch(e) {}
}

window.getGuardianReportAllowedClassIds = function() {
    if(state.user && state.user.role === 'admin') {
        return window.getSortedClassEntries().map(([cId]) => cId);
    }
    const teacher = DB.teachers.find(item => item.id === (state.user && state.user.id));
    const classIds = window.getTeacherHomeroomClasses(teacher, state.term)
        .filter(cId => !!DB.classes[cId]);
    return window.sortClassIds(classIds);
}

window.getGuardianReportSubjects = function(cId) {
    const assignedSubjectIds = new Set();
    (DB.teachers || []).forEach(teacher => {
        const assignments = window.getTeacherAssignments(teacher, state.term);
        Object.entries(assignments || {}).forEach(([subId, classIds]) => {
            if((Array.isArray(classIds) ? classIds : []).some(id => String(id) === String(cId))) {
                assignedSubjectIds.add(String(subId));
            }
        });
    });

    return (DB.subjects || [])
        .filter(sub => {
            const sd = DB_SubjectData[sub.id];
            const hasClassConfig = !!(sd && sd.classData && sd.classData[cId]);
            const hasScores = !!(sd && sd.scores && sd.scores[cId]);
            return assignedSubjectIds.has(String(sub.id)) || hasClassConfig || hasScores;
        })
        .slice()
        .sort((a, b) => window.getAdminSubjectSortRank(a.name) - window.getAdminSubjectSortRank(b.name));
}

window.getGuardianHomeroomDefault = function(cId) {
    if(state.user && state.user.role === 'teacher') {
        const teacher = DB.teachers.find(item => item.id === state.user.id);
        return teacher ? teacher.name : '';
    }
    const teacher = (DB.teachers || []).find(item => {
        return window.getTeacherHomeroomClasses(item, state.term)
            .some(id => String(id) === String(cId));
    });
    return teacher ? teacher.name : '';
}

window.getGuardianExamFullScore = function(subId, cId, scoreType) {
    if(scoreType === 'final') return 100;
    const sd = DB_SubjectData[subId] || {};
    const classConfig = (sd.classData && sd.classData[cId]) ? sd.classData[cId] : sd;
    const exam = (classConfig.examSettings && classConfig.examSettings[state.term]) || {};
    const value = Number(exam.mid);
    return Number.isFinite(value) && value >= 0 ? value : 20;
}

window.guardianScoreBlockHasAnyValue = function(termNode) {
    if(!termNode || typeof termNode !== 'object') return false;
    if(window.normalizeScoreValue(termNode.midTermScore, 'midTermScore') !== '') return true;
    if(window.normalizeScoreValue(termNode.finalScore, 'finalScore') !== '') return true;
    return Object.values(termNode.indicators || {}).some(indicatorScores => {
        if(!indicatorScores || typeof indicatorScores !== 'object') return false;
        return ['k', 'p', 'a'].some(key =>
            window.normalizeScoreValue(indicatorScores[key], key) !== ''
        );
    });
}

window.getGuardianExamScore = function(subId, cId, studentId, scoreType) {
    const sd = DB_SubjectData[subId] || {};
    const studentNode = (((sd.scores || {})[cId] || {})[studentId]) || {};
    let termNode = studentNode[state.term];
    if(!termNode && (studentNode.midTermScore !== undefined || studentNode.finalScore !== undefined)) {
        termNode = studentNode;
    }
    termNode = termNode || {};
    if(scoreType === 'final') {
        if(!window.guardianScoreBlockHasAnyValue(termNode)) return null;
        const student = ((DB.classes[cId] && DB.classes[cId].students) || [])
            .find(item => String(item.studentId) === String(studentId));
        if(!student) return null;
        const total = Number(window.getStudentTotalScore(student, subId, cId, state.term));
        return Number.isFinite(total) ? total : null;
    }
    const normalized = window.normalizeScoreValue(termNode.midTermScore, 'midTermScore');
    if(normalized === '') return null;
    const score = Number(normalized);
    return Number.isFinite(score) ? score : null;
}

window.guardianFormatNumber = function(value, fallback = '-') {
    if(value === null || value === undefined || value === '') return fallback;
    const num = Number(value);
    if(!Number.isFinite(num)) return fallback;
    return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

window.getGuardianAcademicResult = function(percentage) {
    if(percentage >= 80) return 'ดีเยี่ยม';
    if(percentage >= 70) return 'ดี';
    if(percentage >= 50) return 'พอใช้';
    return 'ควรปรับปรุง';
}

window.getGuardianDefaultIntro = function(scoreType) {
    if(scoreType === 'final') {
        return `การประเมินผลการเรียนปลายภาค ภาคเรียนที่ ${state.term} ปีการศึกษา ${DB.schoolInfo.year} คะแนนที่แจ้งเป็นคะแนนรวมรายวิชาเต็ม 100 คะแนน จึงขอแจ้งผลการเรียนให้ผู้ปกครองทราบดังนี้`;
    }
    if(scoreType === 'both') {
        return `การประเมินผลการเรียน ภาคเรียนที่ ${state.term} ปีการศึกษา ${DB.schoolInfo.year} รายงานฉบับนี้แสดงทั้งคะแนนสอบกลางภาคและคะแนนรวมทั้งภาคเรียน (เต็ม 100 คะแนน) โดยผลการเรียนและเกรดคิดจากคะแนนรวมทั้งภาคซึ่งรวมคะแนนกลางภาคไว้แล้ว จึงขอแจ้งให้ผู้ปกครองทราบดังนี้`;
    }
    return `การประเมินผลการเรียนกลางภาค ภาคเรียนที่ ${state.term} ปีการศึกษา ${DB.schoolInfo.year} คะแนนที่แจ้งเป็นคะแนนสอบกลางภาคตามคะแนนเต็มของแต่ละรายวิชา จึงขอแจ้งผลคะแนนให้ผู้ปกครองทราบดังนี้`;
}

window.isGuardianSystemIntro = function(value) {
    const text = String(value || '').trim();
    if(!text) return true;
    return text.includes('เป็นส่วนหนึ่งของการวัดและประเมินผล')
        || text.includes('คะแนนที่แจ้งเป็นคะแนนรวมรายวิชาเต็ม 100 คะแนน')
        || text.includes('แสดงทั้งคะแนนสอบกลางภาคและคะแนนรวมทั้งภาคเรียน')
        || text.includes('คะแนนที่แจ้งเป็นคะแนนสอบกลางภาคตามคะแนนเต็มของแต่ละรายวิชา');
}

window.changeGuardianScoreType = function(scoreType) {
    const currentType = window.guardianReportState.scoreType;
    const introInput = $('guardian-intro');
    const currentDefault = window.getGuardianDefaultIntro(currentType);
    window.guardianReportState.scoreType = scoreType;
    if(introInput && (window.isGuardianSystemIntro(introInput.value) || introInput.value.trim() === currentDefault)) {
        introInput.value = window.getGuardianDefaultIntro(scoreType);
    }
    window.guardianReportModel = null;
    window.saveGuardianReportSettings();
    setTimeout(() => {
        if(state.activePage === 'guardian_reports') window.generateGuardianReports({ automatic: true });
    }, 0);
}

window.captureGuardianReportForm = function() {
    const s = window.guardianReportState;
    const classSelect = $('guardian-class-select');
    const scoreType = document.querySelector('input[name="guardian-score-type"]:checked');
    if(classSelect) s.classId = classSelect.value;
    if(scoreType) s.scoreType = scoreType.value;
    if($('guardian-conduct')) s.conduct = $('guardian-conduct').value.trim() || 'เรียบร้อย';
    if($('guardian-homeroom')) s.homeroomTeacherName = $('guardian-homeroom').value.trim();
    if($('guardian-greeting')) s.greeting = $('guardian-greeting').value.trim() || 'เรียน ท่านผู้ปกครอง';
    if($('guardian-intro')) s.intro = $('guardian-intro').value.trim();
    window.saveGuardianReportSettings();
}

window.changeGuardianArchiveYear = function(year) {
    window.captureGuardianReportForm();
    window.guardianReportState.archiveYear = String(year || '');
    window.guardianReportState.previewStudentId = '';
    window.guardianReportModel = null;
    window.saveGuardianReportSettings();
    const wrapper = $('content-wrapper');
    if(wrapper) window.renderGuardianReports(wrapper);
}

window.refreshGuardianArchiveYears = async function() {
    try {
        window.guardianArchiveYears = await window.firebaseListArchiveYears();
    } catch(e) {
        window.guardianArchiveYears = [];
    }
    // ถ้าปีที่เลือกไว้หายไปจากคลัง ให้กลับมาใช้ปีปัจจุบันแทน
    const s = window.guardianReportState;
    if(s.archiveYear && !window.guardianArchiveYears.some(y => String(y.year) === String(s.archiveYear))) {
        s.archiveYear = '';
    }
}

window.changeGuardianReportClass = function(cId) {
    const allowedClassIds = window.getGuardianReportAllowedClassIds();
    if(state.user && state.user.role === 'teacher' && !allowedClassIds.includes(String(cId))) {
        if(window.notify) window.notify('ครูสามารถดูได้เฉพาะห้องที่ตนเองเป็นครูประจำชั้นเท่านั้น', true);
        return;
    }
    window.captureGuardianReportForm();
    window.guardianReportState.classId = cId;
    window.guardianReportState.homeroomTeacherName = window.getGuardianHomeroomDefault(cId);
    window.guardianReportState.previewStudentId = '';
    window.guardianReportModel = null;
    window.saveGuardianReportSettings();
    const wrapper = $('content-wrapper');
    if(wrapper) window.renderGuardianReports(wrapper);
}

window.toggleStudentFee = function(cId, stuIndex) {
    if(!state.user || state.user.role !== 'admin') {
        if(window.notify) window.notify('เฉพาะผู้ดูแลระบบ (แอดมิน) เท่านั้นที่มีสิทธิ์ระงับคะแนนผู้ค้างชำระ', true);
        return;
    }
    const cls = DB.classes[cId];
    if(!cls || !cls.students || !cls.students[stuIndex]) return;
    const stu = cls.students[stuIndex];
    stu.feeUnpaid = !stu.feeUnpaid;
    window.refreshGuardianFeeStudentTable(cId);
};

window.changeStudentAnnounceMode = function(cId, stuIndex, mode) {
    if(!state.user || state.user.role !== 'admin') {
        if(window.notify) window.notify('เฉพาะผู้ดูแลระบบ (แอดมิน) เท่านั้นที่มีสิทธิ์ตั้งค่าสิทธิ์ประกาศผลรายบุคคล', true);
        return;
    }
    const cls = DB.classes[cId];
    if(!cls || !cls.students || !cls.students[stuIndex]) return;
    cls.students[stuIndex].announceMode = mode;
};

window.changeStudentFeeNote = function(cId, stuIndex, note) {
    if(!state.user || state.user.role !== 'admin') {
        if(window.notify) window.notify('เฉพาะผู้ดูแลระบบ (แอดมิน) เท่านั้นที่มีสิทธิ์บันทึกหมายเหตุค่าธรรมเนียม', true);
        return;
    }
    const cls = DB.classes[cId];
    if(!cls || !cls.students || !cls.students[stuIndex]) return;
    cls.students[stuIndex].feeNote = String(note || '').trim();
};

window.setAllClassFee = function(cId, feeUnpaid) {
    if(!state.user || state.user.role !== 'admin') {
        if(window.notify) window.notify('เฉพาะผู้ดูแลระบบ (แอดมิน) เท่านั้นที่มีสิทธิ์ระงับคะแนนผู้ค้างชำระ', true);
        return;
    }
    const cls = DB.classes[cId];
    if(!cls || !Array.isArray(cls.students)) return;
    cls.students.forEach(stu => {
        stu.feeUnpaid = !!feeUnpaid;
    });
    window.refreshGuardianFeeStudentTable(cId);
};

window.refreshGuardianFeeStudentTable = function(cId) {
    const cls = DB.classes[cId];
    if(!cls) return;
    const students = cls.students || [];
    const tbody = $('guardian-student-fee-rows');
    const summaryEl = $('guardian-fee-summary-counts');
    const paidCount = students.filter(s => !s.feeUnpaid).length;
    const unpaidCount = students.filter(s => s.feeUnpaid).length;
    if(summaryEl) {
        summaryEl.innerHTML = `
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <i class="ph ph-check-circle mr-1 text-sm"></i> ชำระแล้ว ${paidCount} คน
            </span>
            ${unpaidCount > 0 ? `
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <i class="ph ph-warning-circle mr-1 text-sm"></i> ค้างชำระค่าธรรมเนียม ${unpaidCount} คน
            </span>` : ''}
        `;
    }
    if(tbody) {
        tbody.innerHTML = students.map((stu, idx) => {
            const isUnpaid = !!stu.feeUnpaid;
            const stuMode = stu.announceMode || 'inherit';
            return `
                <tr class="hover:bg-slate-50 transition ${isUnpaid ? 'bg-rose-50/40' : ''}">
                    <td class="py-2.5 px-3 text-center font-bold text-slate-500">${idx + 1}</td>
                    <td class="py-2.5 px-3 font-semibold text-slate-700">${window.escapeHtml(stu.studentId || '')}</td>
                    <td class="py-2.5 px-3 font-bold text-slate-800">${window.escapeHtml(stu.name || '')}</td>
                    <td class="py-2.5 px-3 text-center">
                        <button type="button" onclick="window.toggleStudentFee('${window.escapeHtml(cId)}', ${idx})" class="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${isUnpaid ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'}">
                            <i class="ph ${isUnpaid ? 'ph-warning-circle text-rose-600' : 'ph-check-circle text-emerald-600'} text-base"></i>
                            ${isUnpaid ? 'ค้างชำระ (ปิดคะแนน)' : 'ชำระแล้ว (ปกติ)'}
                        </button>
                    </td>
                    <td class="py-2.5 px-3">
                        <select onchange="window.changeStudentAnnounceMode('${window.escapeHtml(cId)}', ${idx}, this.value)" class="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 focus-ring w-full max-w-[200px]">
                            <option value="inherit" ${stuMode === 'inherit' ? 'selected' : ''}>ตามค่าของห้อง</option>
                            <option value="both" ${stuMode === 'both' ? 'selected' : ''}>แสดงทั้งหมด (กลาง+ปลาย)</option>
                            <option value="mid" ${stuMode === 'mid' ? 'selected' : ''}>เฉพาะกลางภาค</option>
                            <option value="final" ${stuMode === 'final' ? 'selected' : ''}>เฉพาะปลายภาค</option>
                            <option value="none" ${stuMode === 'none' ? 'selected' : ''}>ปิดทั้งหมด (ไม่ประกาศ)</option>
                        </select>
                    </td>
                    <td class="py-2.5 px-3">
                        <input type="text" value="${window.escapeHtml(stu.feeNote || '')}" onchange="window.changeStudentFeeNote('${window.escapeHtml(cId)}', ${idx}, this.value)" placeholder="เช่น รอชำระงวด 2, ขอยื่นผ่อนผัน" class="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 focus-ring w-full">
                    </td>
                </tr>
            `;
        }).join('');
    }
};

window.saveGuardianReleaseConfig = async function(cId) {
    if(!state.user || state.user.role !== 'admin') {
        if(window.notify) window.notify('เฉพาะผู้ดูแลระบบ (แอดมิน) เท่านั้นที่มีสิทธิ์ตั้งค่าประกาศผลและระงับสิทธิ์', true);
        return;
    }
    const cls = DB.classes[cId];
    if(!cls) {
        window.notify('ไม่พบข้อมูลห้องเรียน', true);
        return;
    }
    const modeEl = document.querySelector('input[name="guardian-release-mode"]:checked');
    const noticeEl = $('guardian-fee-notice');
    const mode = modeEl ? modeEl.value : 'both';
    const feeMessage = noticeEl ? String(noticeEl.value || '').trim() : '';
    if(!cls.guardianRelease) cls.guardianRelease = {};
    cls.guardianRelease.mode = mode;
    cls.guardianRelease.feeMessage = feeMessage;
    cls.guardianRelease.updatedAt = new Date().toISOString();

    const btn = $('btn-save-guardian-release');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="ph ph-spinner-gap text-lg animate-spin"></i> กำลังบันทึก...`;
    }
    try {
        const ok = await window.saveDBWithFeedback('การตั้งค่าประกาศผลผู้ปกครอง');
        if(ok) {
            window.notify('บันทึกการตั้งค่าประกาศผลและสิทธิ์ผู้ปกครองสำเร็จ');
            if(window.guardianReportModel && String(window.guardianReportModel.classId) === String(cId)) {
                window.renderGuardianReportPreview();
            }
        }
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="ph ph-floppy-disk text-lg"></i> บันทึกการตั้งค่าประกาศผล`;
        }
    }
};

window.renderGuardianReports = function(container) {
    $('page-title').innerText = 'รายงานแจ้งผลคะแนนผู้ปกครอง';
    window.loadGuardianReportSettings();
    const allowedClassIds = window.getGuardianReportAllowedClassIds();
    const s = window.guardianReportState;
    if(!allowedClassIds.some(id => String(id) === String(s.classId))) {
        s.classId = allowedClassIds[0] || '';
        s.homeroomTeacherName = window.getGuardianHomeroomDefault(s.classId);
    }
    const assignedHomeroomName = window.getGuardianHomeroomDefault(s.classId);
    if(assignedHomeroomName) s.homeroomTeacherName = assignedHomeroomName;

    const defaultIntro = window.getGuardianDefaultIntro(s.scoreType);
    if(window.isGuardianSystemIntro(s.intro)) s.intro = defaultIntro;
    const classOptions = allowedClassIds.map(cId => {
        const cls = DB.classes[cId];
        return `<option value="${window.escapeHtml(cId)}" ${String(cId) === String(s.classId) ? 'selected' : ''}>${window.escapeHtml(cls ? cls.name : cId)}</option>`;
    }).join('');
    const roleHint = state.user && state.user.role === 'admin'
        ? 'ผู้ดูแลระบบสามารถเลือกดูและพิมพ์รายงานได้ทุกห้อง'
        : 'แสดงเฉพาะห้องประจำชั้นที่ผู้ดูแลระบบมอบหมายให้ในภาคเรียนนี้';

    const currentClass = DB.classes[s.classId];
    const currentRelease = (currentClass && currentClass.guardianRelease) || {};
    const currentReleaseMode = currentRelease.mode || 'both';
    const feeNotice = currentRelease.feeMessage !== undefined ? currentRelease.feeMessage : 'กรุณาติดต่อห้องธุรการหรือฝ่ายการเงิน เพื่อชำระค่าธรรมเนียมการศึกษาก่อนดูผลคะแนน';
    const classStudents = (currentClass && currentClass.students) || [];
    const paidCount = classStudents.filter(stu => !stu.feeUnpaid).length;
    const unpaidCount = classStudents.filter(stu => stu.feeUnpaid).length;
    const isAdmin = !!(state.user && state.user.role === 'admin');

    container.innerHTML = `
        <section class="mb-5 border-b border-slate-200 pb-4 animate-fade-in-up">
            <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div>
                    <div class="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-1"><i class="ph ph-file-text text-lg"></i> รายงานรายบุคคล</div>
                    <h2 class="text-2xl font-extrabold text-slate-800">แบบรายงานผลการพัฒนาคุณภาพทางการศึกษา</h2>
                    <p class="text-sm text-slate-500 font-medium mt-1">${roleHint}</p>
                </div>
                <div class="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                    <i class="ph ph-shield-check text-lg"></i> อ่านคะแนนเท่านั้น ไม่แก้ไขฐานข้อมูล
                </div>
            </div>
        </section>

        ${allowedClassIds.length ? `
        <section class="bg-white border border-slate-200 rounded-lg p-5 shadow-sm animate-fade-in-up stagger-1">
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-extrabold text-slate-700 mb-2">ห้องเรียน</label>
                    <select id="guardian-class-select" onchange="window.changeGuardianReportClass(this.value)" class="w-full border border-slate-200 rounded-lg px-3 py-3 bg-slate-50 focus-ring font-bold text-slate-800">
                        ${classOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-extrabold text-slate-700 mb-2">ปีการศึกษา</label>
                    <select id="guardian-year-select" onchange="window.changeGuardianArchiveYear(this.value)" class="w-full border border-slate-200 rounded-lg px-3 py-3 bg-slate-50 focus-ring font-bold text-slate-800">
                        <option value="">ปีปัจจุบัน (${window.escapeHtml(DB.schoolInfo.year || '-')})</option>
                        ${(window.guardianArchiveYears || []).map(item =>
                            `<option value="${window.escapeHtml(item.year)}" ${String(s.archiveYear) === String(item.year) ? 'selected' : ''}>คลังข้อมูล ปี ${window.escapeHtml(item.year)}</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-extrabold text-slate-700 mb-2">ดึงคะแนนจาก</label>
                    <div class="grid grid-cols-3 gap-2 h-[50px]">
                        <label class="cursor-pointer">
                            <input type="radio" name="guardian-score-type" value="mid" onchange="window.changeGuardianScoreType(this.value)" class="peer sr-only" ${s.scoreType === 'mid' ? 'checked' : ''}>
                            <span class="h-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-bold text-sm peer-checked:bg-indigo-50 peer-checked:text-indigo-700 peer-checked:border-indigo-400"><i class="ph ph-calendar-blank"></i> กลางภาค</span>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="guardian-score-type" value="final" onchange="window.changeGuardianScoreType(this.value)" class="peer sr-only" ${s.scoreType === 'final' ? 'checked' : ''}>
                            <span class="h-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-bold text-sm peer-checked:bg-indigo-50 peer-checked:text-indigo-700 peer-checked:border-indigo-400"><i class="ph ph-calendar-check"></i> ปลายภาค</span>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="guardian-score-type" value="both" onchange="window.changeGuardianScoreType(this.value)" class="peer sr-only" ${s.scoreType === 'both' ? 'checked' : ''}>
                            <span class="h-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 font-bold text-sm peer-checked:bg-indigo-50 peer-checked:text-indigo-700 peer-checked:border-indigo-400"><i class="ph ph-columns"></i> รวมทั้งสอง</span>
                        </label>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-extrabold text-slate-700 mb-2">ครูประจำชั้น</label>
                    <input id="guardian-homeroom" type="text" value="${window.escapeHtml(s.homeroomTeacherName)}" ${state.user && state.user.role === 'teacher' ? 'readonly' : ''} class="w-full border border-slate-200 rounded-lg px-3 py-3 bg-slate-50 focus-ring font-medium text-slate-800 read-only:cursor-not-allowed read-only:text-slate-500" placeholder="ชื่อครูประจำชั้น">
                </div>
                <div>
                    <label class="block text-sm font-extrabold text-slate-700 mb-2">ความประพฤติ</label>
                    <input id="guardian-conduct" type="text" value="${window.escapeHtml(s.conduct)}" class="w-full border border-slate-200 rounded-lg px-3 py-3 bg-slate-50 focus-ring font-medium text-slate-800" placeholder="เช่น เรียบร้อย">
                </div>
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-[260px_1fr_auto] gap-3 mt-4 items-end">
                <div>
                    <label class="block text-sm font-extrabold text-slate-700 mb-2">คำขึ้นต้น</label>
                    <input id="guardian-greeting" type="text" value="${window.escapeHtml(s.greeting)}" class="w-full border border-slate-200 rounded-lg px-3 py-3 bg-slate-50 focus-ring font-medium text-slate-800">
                </div>
                <div>
                    <label class="block text-sm font-extrabold text-slate-700 mb-2">ข้อความแจ้งผู้ปกครอง</label>
                    <input id="guardian-intro" type="text" value="${window.escapeHtml(s.intro || defaultIntro)}" class="w-full border border-slate-200 rounded-lg px-3 py-3 bg-slate-50 focus-ring font-medium text-slate-800">
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <button id="guardian-generate-btn" onclick="window.generateGuardianReports()" class="tactile-btn h-[50px] px-5 rounded-lg bg-primary-gradient text-white font-extrabold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 whitespace-nowrap">
                        <i class="ph ph-arrows-clockwise text-xl"></i> รีเฟรชคะแนนล่าสุด
                    </button>
                    <button type="button" onclick="window.openExecutiveReportModal(window.guardianReportState.classId)" class="tactile-btn h-[50px] px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 whitespace-nowrap">
                        <i class="ph ph-file-pdf text-xl"></i> พิมพ์รายงานผู้บริหาร (PDF)
                    </button>
                </div>
            </div>
        </section>

        ${isAdmin ? `
        <!-- ตั้งค่าประกาศผลออนไลน์สู่ผู้ปกครอง และสิทธิ์รายบุคคล (ค่าธรรมเนียมการศึกษา) - แสดงเฉพาะผู้ดูแลระบบ (แอดมิน) -->
        <section class="bg-white border border-slate-200 rounded-lg p-5 shadow-sm mt-5 animate-fade-in-up stagger-2">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                    <div class="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-1">
                        <i class="ph ph-broadcast text-lg"></i> ระบบประกาศผลออนไลน์สู่ผู้ปกครอง &amp; จัดการสิทธิ์รายบุคคล
                    </div>
                    <h3 class="text-lg font-extrabold text-slate-800">
                        กำหนดการประกาศผล และระงับคะแนนผู้ค้างชำระค่าธรรมเนียมการศึกษา (${currentClass ? window.escapeHtml(currentClass.name) : ''})
                    </h3>
                    <p class="text-xs text-slate-500 mt-0.5">
                        กำหนดรูปแบบคะแนนที่ประกาศให้ผู้ปกครองเห็น หรือระงับการแสดงผลรายบุคคลสำหรับนักเรียนที่ยังไม่ชำระค่าธรรมเนียมการศึกษา
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="window.saveGuardianReleaseConfig('${window.escapeHtml(s.classId)}')" id="btn-save-guardian-release" class="tactile-btn px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow flex items-center gap-2">
                        <i class="ph ph-floppy-disk text-lg"></i> บันทึกการตั้งค่าประกาศผล
                    </button>
                </div>
            </div>

            <!-- Classroom level settings -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                    <label class="block text-xs font-extrabold text-slate-700 mb-2">รูปแบบคะแนนที่ประกาศให้ผู้ปกครองเห็น (ทั้งห้อง)</label>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <label class="cursor-pointer">
                            <input type="radio" name="guardian-release-mode" value="none" ${currentReleaseMode === 'none' ? 'checked' : ''} class="peer sr-only">
                            <div class="h-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-center font-bold text-xs peer-checked:bg-rose-50 peer-checked:text-rose-700 peer-checked:border-rose-400 peer-checked:shadow-sm">
                                <i class="ph ph-lock-key block text-lg mb-1 mx-auto text-rose-500"></i> ปิดทั้งหมด<br><span class="text-[10px] font-normal text-slate-400">(ยังไม่ประกาศ)</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="guardian-release-mode" value="mid" ${currentReleaseMode === 'mid' ? 'checked' : ''} class="peer sr-only">
                            <div class="h-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-center font-bold text-xs peer-checked:bg-indigo-50 peer-checked:text-indigo-700 peer-checked:border-indigo-400 peer-checked:shadow-sm">
                                <i class="ph ph-calendar-blank block text-lg mb-1 mx-auto text-indigo-500"></i> เฉพาะกลางภาค<br><span class="text-[10px] font-normal text-slate-400">(คะแนนกลางภาค)</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="guardian-release-mode" value="final" ${currentReleaseMode === 'final' ? 'checked' : ''} class="peer sr-only">
                            <div class="h-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-center font-bold text-xs peer-checked:bg-indigo-50 peer-checked:text-indigo-700 peer-checked:border-indigo-400 peer-checked:shadow-sm">
                                <i class="ph ph-calendar-check block text-lg mb-1 mx-auto text-indigo-500"></i> เฉพาะปลายภาค<br><span class="text-[10px] font-normal text-slate-400">(คะแนนรวม 100)</span>
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="guardian-release-mode" value="both" ${currentReleaseMode === 'both' ? 'checked' : ''} class="peer sr-only">
                            <div class="h-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-center font-bold text-xs peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-checked:border-emerald-400 peer-checked:shadow-sm">
                                <i class="ph ph-columns block text-lg mb-1 mx-auto text-emerald-500"></i> แสดงทั้งหมด<br><span class="text-[10px] font-normal text-slate-400">(กลางภาค + ปลายภาค)</span>
                            </div>
                        </label>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-extrabold text-slate-700 mb-2">ข้อความแจ้งเตือนกรณีค้างชำระค่าธรรมเนียมการศึกษา</label>
                    <input type="text" id="guardian-fee-notice" value="${window.escapeHtml(feeNotice)}" class="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-xs font-medium text-slate-800 focus-ring" placeholder="เช่น กรุณาติดต่อห้องธุรการหรือฝ่ายการเงิน เพื่อชำระค่าธรรมเนียมการศึกษาก่อนดูผลคะแนน">
                    <p class="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <i class="ph ph-info"></i> ข้อความนี้จะแสดงในหน้าผลการเรียนของผู้ปกครอง เมื่อนักเรียนถูกตั้งสถานะว่าค้างชำระค่าธรรมเนียม
                    </p>
                </div>
            </div>

            <!-- Student table with fee hold & individual overrides -->
            <div class="mt-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div class="flex items-center gap-2" id="guardian-fee-summary-counts">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <i class="ph ph-check-circle mr-1 text-sm"></i> ชำระแล้ว ${paidCount} คน
                        </span>
                        ${unpaidCount > 0 ? `
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <i class="ph ph-warning-circle mr-1 text-sm"></i> ค้างชำระค่าธรรมเนียม ${unpaidCount} คน
                        </span>` : ''}
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="window.setAllClassFee('${window.escapeHtml(s.classId)}', false)" class="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1.5 transition">
                            <i class="ph ph-check-circle"></i> ชำระแล้วทุกคน
                        </button>
                        <button type="button" onclick="window.setAllClassFee('${window.escapeHtml(s.classId)}', true)" class="text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg px-2.5 py-1.5 transition">
                            <i class="ph ph-x-circle"></i> ระงับสิทธิ์ทุกคน
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto border border-slate-200 rounded-xl">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                            <tr>
                                <th class="py-2.5 px-3 w-12 text-center">เลขที่</th>
                                <th class="py-2.5 px-3 w-28">รหัสนักเรียน</th>
                                <th class="py-2.5 px-3 min-w-[160px]">ชื่อ - นามสกุล</th>
                                <th class="py-2.5 px-3 w-48 text-center">สถานะค่าธรรมเนียมการศึกษา</th>
                                <th class="py-2.5 px-3 w-48">รูปแบบประกาศผลรายบุคคล</th>
                                <th class="py-2.5 px-3 min-w-[150px]">หมายเหตุเฉพาะราย</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 bg-white" id="guardian-student-fee-rows">
                            ${classStudents.map((stu, idx) => {
                                const isUnpaid = !!stu.feeUnpaid;
                                const stuMode = stu.announceMode || 'inherit';
                                return `
                                    <tr class="hover:bg-slate-50 transition ${isUnpaid ? 'bg-rose-50/40' : ''}">
                                        <td class="py-2.5 px-3 text-center font-bold text-slate-500">${idx + 1}</td>
                                        <td class="py-2.5 px-3 font-semibold text-slate-700">${window.escapeHtml(stu.studentId || '')}</td>
                                        <td class="py-2.5 px-3 font-bold text-slate-800">${window.escapeHtml(stu.name || '')}</td>
                                        <td class="py-2.5 px-3 text-center">
                                            <button type="button" onclick="window.toggleStudentFee('${window.escapeHtml(s.classId)}', ${idx})" class="tactile-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${isUnpaid ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'}">
                                                <i class="ph ${isUnpaid ? 'ph-warning-circle text-rose-600' : 'ph-check-circle text-emerald-600'} text-base"></i>
                                                ${isUnpaid ? 'ค้างชำระ (ปิดคะแนน)' : 'ชำระแล้ว (ปกติ)'}
                                            </button>
                                        </td>
                                        <td class="py-2.5 px-3">
                                            <select onchange="window.changeStudentAnnounceMode('${window.escapeHtml(s.classId)}', ${idx}, this.value)" class="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 focus-ring w-full max-w-[200px]">
                                                <option value="inherit" ${stuMode === 'inherit' ? 'selected' : ''}>ตามค่าของห้อง</option>
                                                <option value="both" ${stuMode === 'both' ? 'selected' : ''}>แสดงทั้งหมด (กลาง+ปลาย)</option>
                                                <option value="mid" ${stuMode === 'mid' ? 'selected' : ''}>เฉพาะกลางภาค</option>
                                                <option value="final" ${stuMode === 'final' ? 'selected' : ''}>เฉพาะปลายภาค</option>
                                                <option value="none" ${stuMode === 'none' ? 'selected' : ''}>ปิดทั้งหมด (ไม่ประกาศ)</option>
                                            </select>
                                        </td>
                                        <td class="py-2.5 px-3">
                                            <input type="text" value="${window.escapeHtml(stu.feeNote || '')}" onchange="window.changeStudentFeeNote('${window.escapeHtml(s.classId)}', ${idx}, this.value)" placeholder="เช่น รอชำระงวด 2, ขอยื่นผ่อนผัน" class="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs font-medium text-slate-700 focus-ring w-full">
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
        ` : ''}

        <div id="guardian-report-output" class="mt-5"></div>
        ` : `
        <div class="border border-dashed border-slate-300 rounded-lg py-16 text-center text-slate-500 bg-white">
            <i class="ph ph-chalkboard-teacher text-5xl text-slate-300"></i>
            <h3 class="font-extrabold text-lg text-slate-700 mt-3">ยังไม่ได้รับมอบหมายห้องประจำชั้น</h3>
            <p class="text-sm mt-1">ผู้ดูแลระบบต้องเลือกห้องประจำชั้นให้ครูในหน้าจัดการครู ภาคเรียน ${state.term}</p>
        </div>`}
    `;

    if(allowedClassIds.length && s.classId && !s.archiveYear) {
        try {
            window.guardianReportModel = window.buildGuardianReportModel();
            if(window.guardianReportModel && window.guardianReportModel.students && window.guardianReportModel.students.length > 0) {
                if(!window.guardianReportModel.students.some(stu => String(stu.studentId) === String(s.previewStudentId))) {
                    s.previewStudentId = window.guardianReportModel.students[0].studentId;
                }
                window.renderGuardianReportResults();
            } else {
                const output = $('guardian-report-output');
                if(output) {
                    const loadingLabel = s.scoreType === 'final' ? 'ปลายภาค' : (s.scoreType === 'both' ? 'กลางภาคและรวมทั้งภาค' : 'กลางภาค');
                    output.innerHTML = `<div class="py-12 text-center text-slate-500"><i class="ph ph-spinner-gap text-4xl text-indigo-500 animate-spin"></i><p class="font-bold mt-3">กำลังดึงคะแนน${loadingLabel}ล่าสุดอัตโนมัติ</p></div>`;
                }
            }
        } catch(e) {
            console.warn('Immediate local model render failed:', e);
            const output = $('guardian-report-output');
            if(output) {
                const loadingLabel = s.scoreType === 'final' ? 'ปลายภาค' : (s.scoreType === 'both' ? 'กลางภาคและรวมทั้งภาค' : 'กลางภาค');
                output.innerHTML = `<div class="py-12 text-center text-slate-500"><i class="ph ph-spinner-gap text-4xl text-indigo-500 animate-spin"></i><p class="font-bold mt-3">กำลังดึงคะแนน${loadingLabel}ล่าสุดอัตโนมัติ</p></div>`;
            }
        }
    } else if(window.guardianReportModel && String(window.guardianReportModel.classId) === String(s.classId)) {
        window.renderGuardianReportResults();
    } else if(allowedClassIds.length) {
        const output = $('guardian-report-output');
        if(output) {
            const loadingLabel = s.scoreType === 'final' ? 'ปลายภาค' : (s.scoreType === 'both' ? 'กลางภาคและรวมทั้งภาค' : 'กลางภาค');
            output.innerHTML = `<div class="py-12 text-center text-slate-500"><i class="ph ph-spinner-gap text-4xl text-indigo-500 animate-spin"></i><p class="font-bold mt-3">กำลังดึงคะแนน${loadingLabel}ล่าสุดอัตโนมัติ</p></div>`;
        }
    }
    if(allowedClassIds.length) {
        setTimeout(() => {
            if(state.activePage === 'guardian_reports') window.generateGuardianReports({ automatic: true });
        }, 0);
    }

    // ดึงรายชื่อปีในคลังครั้งเดียวต่อการเข้าหน้า แล้วอัปเดตตัวเลือกปีโดยไม่ต้องวาดใหม่ทั้งหน้า
    if(!window.guardianArchiveYearsLoaded) {
        window.guardianArchiveYearsLoaded = true;
        window.refreshGuardianArchiveYears().then(() => {
            if(state.activePage === 'guardian_reports' && window.guardianArchiveYears && window.guardianArchiveYears.length) {
                const yearSelect = $('guardian-year-select');
                if(yearSelect) {
                    yearSelect.innerHTML = `
                        <option value="">ปีปัจจุบัน (${window.escapeHtml(DB.schoolInfo.year || '-')})</option>
                        ${window.guardianArchiveYears.map(item =>
                            `<option value="${window.escapeHtml(item.year)}" ${String(s.archiveYear) === String(item.year) ? 'selected' : ''}>คลังข้อมูล ปี ${window.escapeHtml(item.year)}</option>`
                        ).join('')}
                    `;
                }
            }
        });
    }
}

window.loadGuardianScoresFromCloud = async function(cId, subjects) {
    const cacheKey = `${state.term}|${cId}`;
    const cachedAt = Number(window.guardianReportCloudCache[cacheKey] || 0);
    if(Date.now() - cachedAt < 2 * 60 * 1000) return { attempted: false, failed: 0, cached: true };
    if(!window.cloudSyncState || !window.cloudSyncState.connected) return { attempted: false, failed: 0, localOnly: true };
    if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) return { attempted: false, failed: 0, localOnly: true };

    const cls = DB.classes[cId];
    const studentIds = cls && Array.isArray(cls.students) ? cls.students.map(stu => stu.studentId).filter(Boolean) : [];
    let failed = 0;
    let changed = false;
    for(let i = 0; i < subjects.length; i += 2) {
        const batch = subjects.slice(i, i + 2);
        const results = await Promise.all(batch.map(async sub => {
            try {
                return await window.firebaseLoadClassScores(sub.id, cId, studentIds, { refresh: false });
            } catch(err) {
                console.warn('Guardian report score preload failed:', sub.id, err);
                failed++;
                return false;
            }
        }));
        if(results.some(Boolean)) changed = true;
        if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) break;
    }
    if(changed && window.saveSubjectDataLocalNow) window.saveSubjectDataLocalNow();
    if(failed === 0) window.guardianReportCloudCache[cacheKey] = Date.now();
    return { attempted: true, failed, changed };
}

// ---- คลังข้อมูลรายปีการศึกษา (ฝั่งแอป) --------------------------------
// เก็บเฉพาะข้อมูลที่จำเป็นต่อการออกรายงานย้อนหลัง ไม่ใช่คะแนนดิบทั้งก้อน
// ทำให้เอกสารเล็กและกู้กลับมาพิมพ์ได้ทันทีโดยไม่ต้องพึ่งโครงสร้างคะแนนปัจจุบัน
window.buildYearArchiveSnapshot = function() {
    const originalTerm = state.term;
    const entries = [];
    try {
        ['1', '2'].forEach(term => {
            state.term = term;
            window.getSortedClassEntries().forEach(([clsId, cls]) => {
                const subjects = window.getGuardianReportSubjects(clsId).map(sub => ({
                    id: sub.id,
                    name: sub.name || 'ไม่ระบุชื่อวิชา',
                    midFullScore: window.getGuardianExamFullScore(sub.id, clsId, 'mid'),
                    finalFullScore: 100
                }));
                const students = (cls.students || []).map(stu => ({
                    studentId: stu.studentId || '',
                    name: stu.name || '',
                    rows: subjects.map(sub => ({
                        mid: window.getGuardianExamScore(sub.id, clsId, stu.studentId, 'mid'),
                        final: window.getGuardianExamScore(sub.id, clsId, stu.studentId, 'final')
                    }))
                }));
                // ข้ามห้อง/เทอมที่ยังไม่มีคะแนนเลย เพื่อไม่ให้คลังเต็มไปด้วยเอกสารว่าง
                const hasAnyScore = students.some(stu =>
                    stu.rows.some(r => r.mid !== null || r.final !== null));
                if(!hasAnyScore) return;
                entries.push({
                    term, classId: clsId,
                    payload: { className: cls.name || '', subjects, students,
                        homeroomTeacherName: window.getGuardianHomeroomDefault(clsId) }
                });
            });
        });
    } finally {
        state.term = originalTerm;
    }
    return { entries };
};

window.archiveCurrentYear = async function() {
    const year = String((DB.schoolInfo && DB.schoolInfo.year) || '').trim();
    if(!year) return window.notify('กรุณาระบุปีการศึกษาในหน้าตั้งค่าก่อน', true);
    if(!confirm(`เก็บคะแนนปีการศึกษา ${year} เข้าคลังข้อมูล?\n\nระบบจะบันทึกภาพรวมคะแนนทั้ง 2 ภาคเรียนไว้สำหรับพิมพ์รายงานย้อนหลัง\nคะแนนที่ใช้งานอยู่จะไม่ถูกแก้ไขหรือลบ`)) return;

    const btn = $('archive-year-btn');
    if(btn) { btn.disabled = true; btn.innerHTML = '<i class="ph ph-spinner-gap text-3xl animate-spin"></i> กำลังเก็บเข้าคลัง...'; }
    try {
        const snapshot = window.buildYearArchiveSnapshot();
        if(snapshot.entries.length === 0) {
            window.notify('ยังไม่มีคะแนนให้เก็บเข้าคลัง', true);
        } else {
            const saved = await window.firebaseSaveYearArchive(year, snapshot);
            window.notify(`เก็บปีการศึกษา ${year} เข้าคลังแล้ว (${saved} ห้อง/ภาคเรียน)`);
        }
    } catch(err) {
        console.error(err);
        window.notify('เก็บเข้าคลังไม่สำเร็จ: ' + (err.message || ''), true);
    }
    if($('archive-year-btn')) {
        $('archive-year-btn').disabled = false;
        $('archive-year-btn').innerHTML = '<i class="ph ph-archive-box text-3xl opacity-80"></i> เก็บปีการศึกษานี้เข้าคลัง';
    }
};

// สร้างโมเดลรายงานจากข้อมูลในคลัง (อ่านอย่างเดียว) ใช้ตรรกะสรุปผลชุดเดียวกับปีปัจจุบัน
window.buildArchivedReportModel = function(archive, scoreType) {
    if(!archive) return null;
    const isBoth = scoreType === 'both';
    const subjects = archive.subjects.map(sub => ({
        id: sub.id, name: sub.name, code: '',
        fullScore: (scoreType === 'final' || isBoth) ? sub.finalFullScore : sub.midFullScore,
        midFullScore: sub.midFullScore
    })).filter(sub => sub.fullScore > 0);

    let missingCount = 0, filledCount = 0;
    const students = archive.students.map((stu, index) => {
        let totalScore = 0, totalMidScore = 0;
        const gradePoints = [];
        const scoreRows = subjects.map((sub, i) => {
            const raw = stu.rows[i] || {};
            const score = (scoreType === 'final' || isBoth) ? raw.final : raw.mid;
            const midScore = isBoth ? raw.mid : null;
            if(score === null || score === undefined) missingCount++;
            else { filledCount++; totalScore += score; }
            if(midScore !== null && midScore !== undefined) totalMidScore += midScore;
            const grade = (scoreType === 'final' || isBoth) && score !== null && score !== undefined
                ? window.calculateGrade(score, DB.gradeSettings) : '';
            if(grade !== '') gradePoints.push(Number(grade));
            return { subjectId: sub.id, score: score === undefined ? null : score, midScore, grade };
        });
        const totalFullScore = subjects.reduce((sum, sub) => sum + sub.fullScore, 0);
        const totalMidFullScore = subjects.reduce((sum, sub) => sum + (sub.midFullScore || 0), 0);
        const percentage = totalFullScore > 0 ? (totalScore / totalFullScore) * 100 : 0;
        const midPercentage = totalMidFullScore > 0 ? (totalMidScore / totalMidFullScore) * 100 : 0;
        return {
            studentId: stu.studentId, name: stu.name, number: index + 1, scoreRows,
            totalScore, totalFullScore, totalMidScore, totalMidFullScore,
            midPercentage, percentage,
            gradeAverage: gradePoints.length ? gradePoints.reduce((a, b) => a + b, 0) / gradePoints.length : null,
            academicResult: window.getGuardianAcademicResult(percentage)
        };
    });

    const s = window.guardianReportState;
    return {
        classId: s.classId, className: archive.className, scoreType,
        scoreLabel: scoreType === 'final' ? 'ปลายภาค (รวม 100 คะแนน)'
            : (scoreType === 'both' ? 'กลางภาคและรวมทั้งภาค' : 'กลางภาค'),
        subjects, students, missingCount, filledCount,
        generatedAt: Date.now(), archivedYear: s.archiveYear,
        settings: {
            conduct: s.conduct,
            homeroomTeacherName: s.homeroomTeacherName || archive.homeroomTeacherName || '',
            greeting: s.greeting, intro: s.intro
        }
    };
};

window.buildGuardianReportModel = function() {
    const s = window.guardianReportState;
    const cls = DB.classes[s.classId];
    if(!cls) return null;
    const isBoth = s.scoreType === 'both';
    const allSubjects = window.getGuardianReportSubjects(s.classId);
    const subjects = allSubjects.map(sub => ({
        id: sub.id,
        name: sub.name || 'ไม่ระบุชื่อวิชา',
        code: sub.code || '',
        fullScore: window.getGuardianExamFullScore(sub.id, s.classId, isBoth ? 'final' : s.scoreType),
        midFullScore: window.getGuardianExamFullScore(sub.id, s.classId, 'mid')
    })).filter(sub => sub.fullScore > 0);

    let missingCount = 0;
    let filledCount = 0;
    const students = (cls.students || []).map((student, index) => {
        let totalScore = 0;
        let totalMidScore = 0;
        const gradePoints = [];
        const scoreRows = subjects.map(sub => {
            // โหมด "รวมทั้งสอง" ดึงทั้งคะแนนกลางภาคและคะแนนรวมทั้งภาคมาแสดงคู่กัน
            const score = window.getGuardianExamScore(sub.id, s.classId, student.studentId, isBoth ? 'final' : s.scoreType);
            const midScore = isBoth
                ? window.getGuardianExamScore(sub.id, s.classId, student.studentId, 'mid')
                : null;
            if(score === null) missingCount++;
            else {
                filledCount++;
                totalScore += score;
            }
            if(midScore !== null) totalMidScore += midScore;
            // เกรดคิดจากคะแนนรวมทั้งภาค (เต็ม 100) ซึ่งรวมคะแนนกลางภาคอยู่แล้ว
            const grade = (s.scoreType === 'final' || isBoth) && score !== null
                ? window.calculateGrade(score, DB.gradeSettings)
                : '';
            if(grade !== '') gradePoints.push(Number(grade));
            return { subjectId: sub.id, score, midScore, grade };
        });
        const totalFullScore = subjects.reduce((sum, sub) => sum + sub.fullScore, 0);
        const totalMidFullScore = subjects.reduce((sum, sub) => sum + (sub.midFullScore || 0), 0);
        const percentage = totalFullScore > 0 ? (totalScore / totalFullScore) * 100 : 0;
        const midPercentage = totalMidFullScore > 0 ? (totalMidScore / totalMidFullScore) * 100 : 0;
        const gradeAverage = gradePoints.length
            ? gradePoints.reduce((sum, grade) => sum + grade, 0) / gradePoints.length
            : null;
        return {
            studentId: student.studentId || '',
            name: student.name || '',
            number: index + 1,
            feeUnpaid: !!student.feeUnpaid,
            feeNote: student.feeNote || '',
            announceMode: student.announceMode || 'inherit',
            scoreRows,
            totalScore,
            totalFullScore,
            totalMidScore,
            totalMidFullScore,
            midPercentage,
            percentage,
            gradeAverage,
            academicResult: window.getGuardianAcademicResult(percentage)
        };
    });

    return {
        classId: s.classId,
        className: cls.name || '',
        scoreType: s.scoreType,
        scoreLabel: s.scoreType === 'final'
            ? 'ปลายภาค (รวม 100 คะแนน)'
            : (s.scoreType === 'both' ? 'กลางภาคและรวมทั้งภาค' : 'กลางภาค'),
        subjects,
        students,
        missingCount,
        filledCount,
        generatedAt: Date.now(),
        settings: {
            conduct: s.conduct,
            homeroomTeacherName: s.homeroomTeacherName,
            greeting: s.greeting,
            intro: s.intro
        }
    };
}

window.generateGuardianReports = async function(options = {}) {
    window.captureGuardianReportForm();
    const requestId = ++window.guardianReportRequestId;
    const s = window.guardianReportState;

    // ตรวจสอบสิทธิ์เข้มงวด: ครูต้องดูได้เฉพาะห้องประจำชั้นของตนเองเท่านั้น
    const allowedClassIds = window.getGuardianReportAllowedClassIds();
    if(state.user && state.user.role === 'teacher') {
        if(!allowedClassIds.length) {
            window.notify('คุณยังไม่ได้รับมอบหมายเป็นครูประจำชั้นในภาคเรียนนี้', true);
            return;
        }
        if(!allowedClassIds.includes(String(s.classId))) {
            s.classId = allowedClassIds[0];
            s.homeroomTeacherName = window.getGuardianHomeroomDefault(s.classId);
        }
    }

    const cls = DB.classes[s.classId];
    if(!cls) {
        window.notify('กรุณาเลือกห้องเรียนก่อนสร้างรายงาน', true);
        return;
    }
    // โหมดคลังข้อมูล: อ่านจาก snapshot ที่เก็บไว้ ไม่ต้องแตะคะแนนสดหรือดึงจากคลาวด์
    if(s.archiveYear) {
        const archive = await window.firebaseLoadArchiveClass(s.archiveYear, state.term, s.classId);
        if(requestId !== window.guardianReportRequestId) return;
        if(!archive) {
            $('guardian-report-output').innerHTML = `
                <div class="py-12 text-center text-slate-500">
                    <i class="ph ph-archive-box text-4xl text-amber-500"></i>
                    <p class="font-bold mt-3">ไม่พบข้อมูลห้อง ${window.escapeHtml(cls.name || '')} ภาคเรียนที่ ${window.escapeHtml(state.term)} ในคลังปี ${window.escapeHtml(s.archiveYear)}</p>
                    <p class="text-sm mt-1">ลองเปลี่ยนภาคเรียน ห้องเรียน หรือเลือกปีอื่น</p>
                </div>`;
            window.guardianReportModel = null;
            return;
        }
        window.guardianReportModel = window.buildArchivedReportModel(archive, s.scoreType);
        const archModel = window.guardianReportModel;
        if(!archModel.students.some(stu => String(stu.studentId) === String(s.previewStudentId))) {
            s.previewStudentId = (archModel.students[0] || {}).studentId || '';
        }
        window.renderGuardianReportResults({ attempted: false, failed: 0 });
        if(!options.automatic) window.notify(`เปิดรายงานจากคลังข้อมูลปี ${s.archiveYear}`);
        return;
    }

    const subjects = window.getGuardianReportSubjects(s.classId);

    const cacheKey = `${state.term}|${s.classId}`;
    const cachedAt = Number((window.guardianReportCloudCache && window.guardianReportCloudCache[cacheKey]) || 0);
    // ถ้าเป็นการดึงอัตโนมัติ และเพิ่งตรวจคลาวด์ไปไม่เกิน 2 นาที ให้ใช้ข้อมูลเดิมทันที ไม่ต้อง query ซ้ำ
    if(options.automatic && (Date.now() - cachedAt < 2 * 60 * 1000)) {
        if(!window.guardianReportModel || String(window.guardianReportModel.classId) !== String(s.classId)) {
            window.guardianReportModel = window.buildGuardianReportModel();
            const m = window.guardianReportModel;
            if(m && m.students && m.students.length > 0) {
                if(!m.students.some(stu => String(stu.studentId) === String(s.previewStudentId))) {
                    s.previewStudentId = m.students[0].studentId;
                }
                window.renderGuardianReportResults({ cached: true });
            }
        }
        return;
    }

    const btn = $('guardian-generate-btn');
    const restoreButton = () => {
        const currentBtn = $('guardian-generate-btn');
        if(!currentBtn) return;
        currentBtn.disabled = false;
        currentBtn.innerHTML = '<i class="ph ph-arrows-clockwise text-xl"></i> รีเฟรชคะแนนล่าสุด';
    };
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner-gap text-xl animate-spin"></i> กำลังดึงคะแนนล่าสุด';
    }
    let cloudResult = { attempted: false, failed: 0 };
    try {
        cloudResult = await window.firebaseLoadScoresForSubjectsBulk(subjects.map(sub => sub.id));
    } catch(err) {
        console.warn('Guardian report cloud load failed:', err);
        cloudResult.failed = subjects.length;
    }
    if(requestId !== window.guardianReportRequestId) return;

    if(!cloudResult.failed) {
        if(!window.guardianReportCloudCache) window.guardianReportCloudCache = {};
        window.guardianReportCloudCache[cacheKey] = Date.now();
    }

    window.guardianReportModel = window.buildGuardianReportModel();
    const model = window.guardianReportModel;
    if(!model || model.students.length === 0) {
        restoreButton();
        window.notify('ห้องนี้ยังไม่มีรายชื่อนักเรียน', true);
        return;
    }
    if(!model.students.some(stu => String(stu.studentId) === String(s.previewStudentId))) {
        s.previewStudentId = model.students[0].studentId;
    }
    window.renderGuardianReportResults(cloudResult);
    restoreButton();
    if(cloudResult.failed > 0) {
        window.notify('ดึงคะแนนบางรายวิชาจากคลาวด์ไม่สำเร็จ จึงใช้ข้อมูลล่าสุดในเครื่องร่วมด้วย', true);
    } else if(!options.automatic) {
        window.notify(`สร้างรายงานห้อง ${model.className} จากคะแนน${model.scoreLabel}แล้ว`);
    }
}

window.renderGuardianReportResults = function(cloudResult = null) {
    const output = $('guardian-report-output');
    const model = window.guardianReportModel;
    if(!output || !model) return;
    const isAdmin = !!(state.user && state.user.role === 'admin');
    const s = window.guardianReportState;
    const previewId = s.previewStudentId || (model.students[0] && model.students[0].studentId) || '';
    const studentOptions = model.students.map(stu =>
        `<option value="${window.escapeHtml(stu.studentId)}" ${String(stu.studentId) === String(previewId) ? 'selected' : ''}>${stu.number}. ${window.escapeHtml(stu.studentId)} ${window.escapeHtml(stu.name)}</option>`
    ).join('');
    const coverageTotal = model.filledCount + model.missingCount;
    const coverage = coverageTotal ? Math.round((model.filledCount / coverageTotal) * 100) : 0;
    const cloudNote = cloudResult && cloudResult.localOnly
        ? 'ใช้ข้อมูลล่าสุดในเครื่อง เนื่องจากคลาวด์ยังไม่พร้อม'
        : (cloudResult && cloudResult.cached ? 'ใช้ข้อมูลคลาวด์ที่เพิ่งตรวจสอบล่าสุด' : 'ตรวจข้อมูลล่าสุดแล้ว');

    if(model.subjects.length === 0) {
        output.innerHTML = `
            <section class="border-y border-slate-200 py-4 animate-fade-in-up">
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div><p class="text-xs font-bold text-slate-400">ห้องเรียน</p><p class="font-extrabold text-slate-800 mt-1">${window.escapeHtml(model.className)}</p></div>
                    <div><p class="text-xs font-bold text-slate-400">แหล่งคะแนน</p><p class="font-extrabold text-indigo-700 mt-1">${model.scoreLabel}</p></div>
                    <div><p class="text-xs font-bold text-slate-400">นักเรียน</p><p class="font-extrabold text-slate-800 mt-1">${model.students.length} คน</p></div>
                    <div><p class="text-xs font-bold text-slate-400">รายวิชาที่ผูกกับห้อง</p><p class="font-extrabold text-amber-700 mt-1">0 วิชา</p></div>
                </div>
            </section>
            <div class="mt-5 border border-dashed border-amber-300 bg-amber-50 rounded-lg py-14 px-5 text-center">
                <i class="ph ph-file-dashed text-5xl text-amber-500"></i>
                <h3 class="font-extrabold text-lg text-amber-900 mt-3">ยังไม่พบรายวิชาที่ผูกกับห้องนี้</h3>
                <p class="text-sm text-amber-700 mt-1">กรุณาตรวจสอบการมอบหมายงานสอนของห้อง ${window.escapeHtml(model.className)} ในหน้าจัดการครูผู้สอน</p>
                <p class="text-xs text-slate-500 mt-3">${cloudNote}</p>
            </div>`;
        return;
    }

    output.innerHTML = `
        <section class="border-y border-slate-200 py-4 animate-fade-in-up">
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div><p class="text-xs font-bold text-slate-400">ห้องเรียน</p><p class="font-extrabold text-slate-800 mt-1">${window.escapeHtml(model.className)}</p></div>
                <div><p class="text-xs font-bold text-slate-400">แหล่งคะแนน</p><p class="font-extrabold text-indigo-700 mt-1">${model.scoreLabel}</p></div>
                <div><p class="text-xs font-bold text-slate-400">นักเรียน</p><p class="font-extrabold text-slate-800 mt-1">${model.students.length} คน</p></div>
                <div><p class="text-xs font-bold text-slate-400">รายวิชา</p><p class="font-extrabold text-slate-800 mt-1">${model.subjects.length} วิชา</p></div>
                <div><p class="text-xs font-bold text-slate-400">ข้อมูลคะแนน</p><p class="font-extrabold ${model.missingCount ? 'text-amber-700' : 'text-emerald-700'} mt-1">${coverage}% ${model.missingCount ? `(ขาด ${model.missingCount} ช่อง)` : '(ครบ)'}</p></div>
            </div>
            <p class="text-xs text-slate-500 mt-3 flex items-center gap-1.5"><i class="ph ph-cloud-check text-base"></i>${cloudNote}</p>
        </section>
        <section class="mt-5">
            <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
                <div class="w-full md:max-w-xl">
                    <label class="block text-sm font-extrabold text-slate-700 mb-2">ตัวอย่างรายงานของนักเรียน</label>
                    <select id="guardian-preview-student" onchange="window.guardianReportState.previewStudentId=this.value; window.renderGuardianReportPreview();" class="w-full border border-slate-200 rounded-lg px-3 py-3 bg-white focus-ring font-medium text-slate-800">
                        ${studentOptions}
                    </select>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    ${isAdmin ? `
                    <select id="guardian-print-filter" class="border border-slate-200 rounded-lg px-3 py-3 bg-white text-xs font-bold text-slate-700 focus-ring shadow-sm">
                        <option value="all">พิมพ์ทุกคนในห้อง (${model.students.length} คน)</option>
                        <option value="paid-only">ข้ามนักเรียนที่ค้างชำระค่าธรรมเนียม (${model.students.filter(s => !s.feeUnpaid).length} คน)</option>
                    </select>
                    ` : ''}
                    <button onclick="window.printGuardianReports()" class="tactile-btn px-6 py-3 rounded-lg bg-slate-900 text-white font-extrabold flex items-center justify-center gap-2 shadow-lg">
                        <i class="ph ph-printer text-xl"></i> พิมพ์รายงาน
                    </button>
                    <button type="button" onclick="window.openExecutiveReportModal(window.guardianReportState.classId)" class="tactile-btn px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center justify-center gap-2 shadow-lg">
                        <i class="ph ph-file-pdf text-xl"></i> พิมพ์รายงานผู้บริหาร (PDF)
                    </button>
                </div>
            </div>
            <div id="guardian-report-preview" class="guardian-report-preview-shell"></div>
        </section>
    `;
    window.renderGuardianReportPreview();
}

window.renderGuardianReportPreview = function() {
    const target = $('guardian-report-preview');
    const model = window.guardianReportModel;
    if(!target || !model) return;
    const student = model.students.find(item => String(item.studentId) === String(window.guardianReportState.previewStudentId)) || model.students[0];
    if(!student) return;
    window.guardianReportState.previewStudentId = student.studentId;
    const feeNoticeHtml = student.feeUnpaid ? `
        <div class="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3 shadow-sm animate-fade-in-up">
            <i class="ph ph-warning-circle text-2xl text-rose-600 shrink-0 mt-0.5"></i>
            <div>
                <p class="font-bold text-sm text-rose-900">นักเรียนคนนี้มีสถานะ: ค้างชำระค่าธรรมเนียมการศึกษา</p>
                <p class="mt-0.5 text-rose-700">ในระบบประกาศผลออนไลน์ของผู้ปกครอง คะแนนจะถูกปิดซ่อนไว้ และแสดงข้อความแจ้งเตือนให้ผู้ปกครองติดต่อชำระค่าธรรมเนียมก่อน</p>
                ${student.feeNote ? `<p class="mt-1 font-semibold text-rose-800">หมายเหตุเฉพาะราย: ${window.escapeHtml(student.feeNote)}</p>` : ''}
            </div>
        </div>
    ` : '';
    const isPreviewAdmin = !!(state.user && state.user.role === 'admin');
    target.innerHTML = (isPreviewAdmin ? feeNoticeHtml : '') + window.generateGuardianReportPage(student, model, student.number, model.students.length);
}

window.generateGuardianReportPage = function(student, model, pageNumber, totalPages) {
    const logoUrl = window.formatImgUrl((DB.schoolInfo && DB.schoolInfo.logo) || '');
    const logoHtml = logoUrl
        ? `<img src="${window.escapeHtml(logoUrl)}" alt="ตราโรงเรียน" class="guardian-report-logo" onerror="this.style.display='none'">`
        : '';
    const isBothReport = model.scoreType === 'both';
    const isFinalReport = model.scoreType === 'final' || isBothReport;
    const scoreRows = model.subjects.map((sub, index) => {
        const scoreRow = student.scoreRows[index] || {};
        if(isBothReport) {
            return `
            <tr>
                <td style="width:30px;text-align:center;">${index + 1}</td>
                <td style="text-align:left;">${window.escapeHtml(sub.name)}</td>
                <td style="text-align:center;width:64px;">${window.guardianFormatNumber(sub.midFullScore, '0')}</td>
                <td style="text-align:center;width:64px;font-weight:700;">${window.guardianFormatNumber(scoreRow.midScore, '')}</td>
                <td style="text-align:center;width:64px;">${window.guardianFormatNumber(sub.fullScore, '0')}</td>
                <td style="text-align:center;width:64px;font-weight:700;">${window.guardianFormatNumber(scoreRow.score, '')}</td>
                <td style="text-align:center;width:50px;font-weight:700;">${window.escapeHtml(scoreRow.grade || '')}</td>
            </tr>`;
        }
        return `
            <tr>
                <td style="width:36px;text-align:center;">${index + 1}</td>
                <td style="text-align:left;">${window.escapeHtml(sub.name)}</td>
                <td style="text-align:center;width:${isFinalReport ? '92px' : '82px'};">${window.guardianFormatNumber(sub.fullScore, '0')}</td>
                <td style="text-align:center;width:${isFinalReport ? '92px' : '82px'};font-weight:700;">${window.guardianFormatNumber(scoreRow.score, '')}</td>
                ${isFinalReport ? `<td style="text-align:center;width:58px;font-weight:700;">${window.escapeHtml(scoreRow.grade || '')}</td>` : ''}
            </tr>`;
    }).join('');
    const schoolName = (DB.schoolInfo && DB.schoolInfo.name) || 'โรงเรียน';
    const directorName = (DB.schoolInfo && DB.schoolInfo.director) || '......................................................';
    const teacherName = model.settings.homeroomTeacherName || '......................................................';
    const introText = model.settings.intro || window.getGuardianDefaultIntro(model.scoreType);
    const densityClass = model.subjects.length > 19
        ? 'guardian-report-tight'
        : (model.subjects.length > 13
            ? 'guardian-report-compact'
            : (model.subjects.length > 8 ? 'guardian-report-spacious' : 'guardian-report-roomy'));

    return `
        <article class="guardian-report-page ${densityClass}">
            <div class="guardian-report-header">
                ${logoHtml}
                <h2 class="guardian-report-title">แบบรายงานผลการพัฒนาคุณภาพทางการศึกษา</h2>
                <h3 class="guardian-report-school">${window.escapeHtml(schoolName)}</h3>
                <p class="guardian-report-term">คะแนน${model.scoreLabel} ภาคเรียนที่ ${window.escapeHtml(state.term)} ปีการศึกษา ${window.escapeHtml(model.archivedYear || DB.schoolInfo.year)}</p>
            </div>
            <div class="guardian-report-meta">
                <p><strong>รหัสประจำตัว:</strong> ${window.escapeHtml(student.studentId || '-')}</p>
                <p><strong>ชื่อ-สกุล:</strong> ${window.escapeHtml(student.name || '-')}</p>
                <p><strong>ระดับชั้น:</strong> ${window.escapeHtml(model.className)}</p>
                <p><strong>เลขที่:</strong> ${student.number}</p>
            </div>
            <div class="guardian-report-intro">
                <p style="font-weight:700;margin-bottom:2px;">${window.escapeHtml(model.settings.greeting || 'เรียน ท่านผู้ปกครอง')}</p>
                <p style="text-align:justify;text-indent:28px;margin:0;">${window.escapeHtml(introText)}</p>
            </div>
            <table>
                <thead>
                    ${isBothReport ? `
                    <tr>
                        <th rowspan="2" style="width:30px;text-align:center;">ที่</th>
                        <th rowspan="2" style="text-align:left;">ชื่อรายวิชา</th>
                        <th colspan="2" style="text-align:center;">สอบกลางภาค</th>
                        <th colspan="2" style="text-align:center;">รวมทั้งภาคเรียน</th>
                        <th rowspan="2" style="width:50px;text-align:center;">เกรด</th>
                    </tr>
                    <tr>
                        <th style="width:64px;text-align:center;">เต็ม</th>
                        <th style="width:64px;text-align:center;">ได้</th>
                        <th style="width:64px;text-align:center;">เต็ม</th>
                        <th style="width:64px;text-align:center;">ได้</th>
                    </tr>` : `
                    <tr>
                        <th style="width:36px;text-align:center;">ที่</th>
                        <th style="text-align:left;">ชื่อรายวิชา</th>
                        <th style="width:${isFinalReport ? '92px' : '82px'};text-align:center;white-space:nowrap;">คะแนนเต็ม</th>
                        <th style="width:${isFinalReport ? '92px' : '82px'};text-align:center;white-space:nowrap;">คะแนนที่ได้</th>
                        ${isFinalReport ? '<th style="width:58px;text-align:center;">เกรด</th>' : ''}
                    </tr>`}
                </thead>
                <tbody>${scoreRows}</tbody>
                <tfoot>
                    ${isBothReport ? `
                    <tr style="font-weight:700;">
                        <td colspan="2" style="text-align:right;background:#f8fafc;">รวม</td>
                        <td style="text-align:center;background:#f8fafc;">${window.guardianFormatNumber(student.totalMidFullScore, '0')}</td>
                        <td style="text-align:center;background:#f8fafc;">${window.guardianFormatNumber(student.totalMidScore, '0')}</td>
                        <td style="text-align:center;background:#f8fafc;">${window.guardianFormatNumber(student.totalFullScore, '0')}</td>
                        <td style="text-align:center;background:#f8fafc;">${window.guardianFormatNumber(student.totalScore, '0')}</td>
                        <td style="background:#f8fafc;"></td>
                    </tr>
                    <tr style="font-weight:700;">
                        <td colspan="2" style="text-align:right;background:#f8fafc;">คิดเป็นร้อยละ</td>
                        <td colspan="2" style="text-align:center;background:#f8fafc;">${student.midPercentage.toFixed(2)}</td>
                        <td colspan="3" style="text-align:center;background:#f8fafc;">${student.percentage.toFixed(2)}</td>
                    </tr>` : `
                    <tr style="font-weight:700;">
                        <td colspan="2" style="text-align:right;background:#f8fafc;">รวม</td>
                        <td style="text-align:center;background:#f8fafc;">${window.guardianFormatNumber(student.totalFullScore, '0')}</td>
                        <td style="text-align:center;background:#f8fafc;">${window.guardianFormatNumber(student.totalScore, '0')}</td>
                        ${isFinalReport ? '<td style="background:#f8fafc;"></td>' : ''}
                    </tr>
                    <tr style="font-weight:700;">
                        <td colspan="2" style="text-align:right;background:#f8fafc;">คิดเป็นร้อยละ</td>
                        <td colspan="${isFinalReport ? '3' : '2'}" style="text-align:center;background:#f8fafc;">${student.percentage.toFixed(2)}</td>
                    </tr>`}
                </tfoot>
            </table>
            <div class="guardian-report-summary">
                <p><strong>ผลการเรียน:</strong> ${window.escapeHtml(student.academicResult)}</p>
                ${isFinalReport ? `<p><strong>เกรดเฉลี่ย:</strong> ${student.gradeAverage === null ? '-' : student.gradeAverage.toFixed(2)}</p>` : ''}
                <p><strong>ความประพฤติ:</strong> ${window.escapeHtml(model.settings.conduct || 'เรียบร้อย')}</p>
            </div>
            <div class="guardian-report-comment">
                <p style="font-weight:700;">ความคิดเห็นผู้ปกครอง:</p>
                <div class="guardian-comment-line"></div>
                <div class="guardian-comment-line"></div>
                <div class="guardian-comment-line"></div>
                <div class="guardian-comment-line"></div>
                <div class="guardian-comment-line"></div>
            </div>
            <div class="guardian-report-signatures">
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;">
                    <div><div class="guardian-signature-space"></div><p>ลงชื่อ........................................</p><p style="margin-top:3px;">(......................................................)</p><p style="font-weight:700;">ผู้ปกครอง</p></div>
                    <div><div class="guardian-signature-space"></div><p>ลงชื่อ........................................</p><p style="margin-top:3px;">(${window.escapeHtml(teacherName)})</p><p style="font-weight:700;">ครูประจำชั้น</p></div>
                    <div><div class="guardian-signature-space"></div><p>ลงชื่อ........................................</p><p style="margin-top:3px;">(${window.escapeHtml(directorName)})</p><p style="font-weight:700;">ผู้อำนวยการโรงเรียน</p></div>
                </div>
                <p style="text-align:right;color:#64748b;font-size:10px;margin-top:4px;">หน้า ${pageNumber} / ${totalPages}</p>
            </div>
        </article>`;
}

window.openGuardianReportPrint = function() {
    const model = window.guardianReportModel;
    if(!model) return;

    // ตรวจสอบสิทธิ์เข้มงวด: ครูต้องพิมพ์ได้เฉพาะห้องประจำชั้นของตนเองเท่านั้น
    const allowedClassIds = window.getGuardianReportAllowedClassIds();
    if(state.user && state.user.role === 'teacher' && !allowedClassIds.includes(String(model.classId))) {
        window.notify('ครูสามารถพิมพ์ได้เฉพาะห้องที่ตนเองเป็นครูประจำชั้นเท่านั้น', true);
        return;
    }

    const isPrintAdmin = !!(state.user && state.user.role === 'admin');
    const filterEl = $('guardian-print-filter');
    const filterVal = (isPrintAdmin && filterEl) ? filterEl.value : 'all';
    const studentsToPrint = filterVal === 'paid-only'
        ? model.students.filter(s => !s.feeUnpaid)
        : model.students;
    if(studentsToPrint.length === 0) {
        window.notify('ไม่มีนักเรียนที่ตรงตามเงื่อนไขการพิมพ์ที่เลือก (ทุกคนค้างชำระค่าธรรมเนียม)', true);
        return;
    }
    const printView = $('print-view');
    printView.className = 'guardian-print-mode fixed inset-0 bg-slate-800 z-[200] overflow-y-auto print:bg-white print:static';
    const filterNote = filterVal === 'paid-only' ? ' (ข้ามผู้ค้างชำระ)' : '';
    const toolbar = `
        <div class="no-print sticky top-0 w-full bg-slate-900/95 backdrop-blur-md p-4 flex justify-center gap-3 z-[210] shadow-lg border-b border-white/10">
            <button onclick="window.print()" class="tactile-btn bg-emerald-500 hover:bg-emerald-600 text-white px-7 py-3 rounded-lg shadow-lg flex items-center font-bold"><i class="ph ph-printer mr-2 text-xl"></i> ยืนยันสั่งพิมพ์ ${studentsToPrint.length} ฉบับ${filterNote}</button>
            <button onclick="window.closePrintWindow()" class="tactile-btn bg-slate-700 hover:bg-slate-600 text-white px-7 py-3 rounded-lg flex items-center font-bold border border-slate-600"><i class="ph ph-x mr-2 text-xl"></i> ปิด</button>
        </div>`;
    const pages = studentsToPrint.map((student, index) =>
        window.generateGuardianReportPage(student, model, index + 1, studentsToPrint.length)
    ).join('');
    printView.innerHTML = `${toolbar}<div class="py-8 print:py-0">${pages}</div>`;
    printView.classList.remove('hidden');
    $('app-container').classList.add('hidden');
}

window.printGuardianReports = function() {
    const model = window.guardianReportModel;
    if(!model) {
        window.notify('กรุณาสร้างรายงานก่อนสั่งพิมพ์', true);
        return;
    }
    if(model.missingCount > 0) {
        window.showCustomConfirm(
            'คะแนนยังไม่ครบทุกช่อง',
            `รายงานห้องนี้ยังขาดคะแนน${model.scoreLabel} ${model.missingCount} ช่อง ช่องที่ยังไม่มีคะแนนจะแสดงเป็นเครื่องหมาย -\n\nต้องการเปิดหน้าพิมพ์ต่อหรือไม่?`,
            'warning',
            () => window.openGuardianReportPrint()
        );
        return;
    }
    window.openGuardianReportPrint();
}
