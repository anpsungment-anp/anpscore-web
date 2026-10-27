/* ANPSCORE — หน้าครู ตารางกรอกคะแนน นำเข้าส่งออก และพิมพ์รายงาน
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

window.renderTeacherDash = function(container) {
    $('page-title').innerText = 'รายวิชาและห้องเรียนของฉัน';
    const t = DB.teachers.find(x => x.id === state.user.id);
    if(!t) return;

    let asg = window.getTeacherAssignments(t, state.term);
    let hasClasses = false;

    let html = `
    <div class="mb-8 animate-fade-in-up">
        <div class="flex items-center gap-3 mb-6 p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
            <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm text-2xl"><i class="ph ph-chalkboard-teacher"></i></div>
            <div>
                <h3 class="text-xl font-extrabold text-indigo-900">ยินดีต้อนรับ, ครู${t.name}</h3>
                <p class="text-indigo-700 font-medium text-sm">เลือกรายวิชาและห้องเรียนด้านล่างเพื่อจัดการผลการเรียน (เทอม ${state.term})</p>
            </div>
        </div>
        <div class="mb-6">${window.renderActiveUsersPanel(true)}</div>
        ${window.renderScoreEntryStatusBanner(true)}
        <div class="space-y-8">`;

    if(asg && Object.keys(asg).length > 0) {
        const subjectOrder = new Map((DB.subjects || []).map((sub, orderIdx) => [String(sub.id), orderIdx]));
        const subjectIds = Object.keys(asg)
            .filter(subId => DB.subjects.find(x => String(x.id) === String(subId)))
            .sort((a, b) => {
                const aOrder = subjectOrder.has(String(a)) ? subjectOrder.get(String(a)) : 999999;
                const bOrder = subjectOrder.has(String(b)) ? subjectOrder.get(String(b)) : 999999;
                if(aOrder !== bOrder) return aOrder - bOrder;
                const aSub = DB.subjects.find(x => String(x.id) === String(a)) || {};
                const bSub = DB.subjects.find(x => String(x.id) === String(b)) || {};
                return `${aSub.code || ''} ${aSub.name || ''}`.localeCompare(`${bSub.code || ''} ${bSub.name || ''}`, 'th', { numeric: true, sensitivity: 'base' });
            });

        subjectIds.forEach((subId, idx) => {
            let sub = DB.subjects.find(x => x.id === subId);
            if(!sub) return;

            const classIds = window.sortClassIds(Array.isArray(asg[subId]) ? asg[subId] : []);
            let classCardsHtml = '';
            let classCount = 0;
            let studentCount = 0;
            const progressValues = [];

            classIds.forEach((clsId, clsIdx) => {
                let cls = DB.classes[clsId];
                if(!cls) return;
                classCount++;
                studentCount += Array.isArray(cls.students) ? cls.students.length : 0;

                let progressPct = window.calculateClassProgress(subId, clsId, state.term);
                progressValues.push(progressPct);
                let statusBadge = '';
                if(progressPct >= 100) {
                    statusBadge = `<div class="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm w-fit"><i class="ph ph-check-circle fill-current"></i> บันทึกแล้ว 100%</div>`;
                } else if(progressPct > 0) {
                    statusBadge = `<div class="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm w-fit"><i class="ph ph-chart-line-up"></i> บันทึกแล้ว ${progressPct}%</div>`;
                } else {
                    statusBadge = `<div class="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm w-fit"><i class="ph ph-clock"></i> ยังไม่มีข้อมูล 0%</div>`;
                }

                classCardsHtml += `
                <div class="modern-card p-6 flex flex-col justify-between hover:ring-2 hover:ring-indigo-400 cursor-pointer group transition-all" style="animation-delay: ${(idx * 0.04) + (clsIdx * 0.015)}s" onclick="state.subjId='${subId}'; state.clsId='${clsId}'; window.navigate('teacher_scoring');">
                    <div>
                        <div class="flex justify-between items-start mb-4 gap-2">
                            <div class="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                                ${cls.name}
                            </div>
                        </div>
                        <h4 class="text-lg font-extrabold text-slate-800 mb-1 leading-tight">${sub.name}</h4>
                        <p class="text-sm text-slate-500 font-medium mb-3">${sub.code ? `รหัส ${sub.code}` : 'ไม่มีรหัสวิชา'}</p>
                        ${statusBadge}
                        <p class="text-xs text-slate-400 font-bold mt-4 flex items-center gap-1.5 bg-slate-50 inline-block px-2.5 py-1.5 rounded-lg border border-slate-100"><i class="ph ph-users text-sm"></i> นักเรียน ${cls.students.length} คน</p>
                    </div>
                    <div class="mt-5 pt-4 border-t border-slate-100 text-center text-sm font-bold text-indigo-600 group-hover:text-indigo-700 flex items-center justify-center gap-1">
                        จัดการคะแนน <i class="ph ph-arrow-right group-hover:translate-x-1 transition-transform"></i>
                    </div>
                </div>`;
            });

            if(classCount > 0) {
                hasClasses = true;
                const subjectProgress = progressValues.length ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) : 0;
                const subjectBadgeClass = subjectProgress >= 100
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : (subjectProgress > 0 ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-rose-100 text-rose-700 border-rose-200');
                const subjectIcon = subjectProgress >= 100 ? 'ph-check-circle' : (subjectProgress > 0 ? 'ph-chart-line-up' : 'ph-clock');
                html += `
                <section class="teacher-subject-group animate-fade-in-up" style="animation-delay: ${idx * 0.05}s">
                    <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-4 px-1 pb-3 border-b border-slate-200">
                        <div>
                            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-black mb-2">
                                <i class="ph ph-book-open text-sm"></i> รายวิชา
                            </div>
                            <h3 class="text-xl font-extrabold text-slate-800 leading-tight">${sub.name}</h3>
                            <p class="text-sm text-slate-500 font-medium mt-1">${sub.code ? `รหัส ${sub.code} • ` : ''}${classCount} ห้อง • นักเรียนรวม ${studentCount} คน</p>
                        </div>
                        <div class="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-black shadow-sm w-fit ${subjectBadgeClass}">
                            <i class="ph ${subjectIcon} text-base"></i> ความคืบหน้า ${subjectProgress}%
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        ${classCardsHtml}
                    </div>
                </section>`;
            }
        });
    }

    if(!hasClasses) {
        html += `
        <div class="col-span-full text-center p-16 bg-white rounded-3xl border border-slate-200 border-dashed shadow-sm">
            <div class="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><i class="ph ph-warning-circle text-5xl text-slate-300"></i></div>
            <h3 class="text-xl font-bold text-slate-600 mb-2">ยังไม่มีการมอบหมายวิชาสอน</h3>
            <p class="text-sm font-medium text-slate-500">กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดรายวิชาและห้องเรียนที่คุณรับผิดชอบในภาคเรียนที่ ${state.term}</p>
        </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
};

window.renderTeacherClasses = function(container) {
    window.renderTeacherDash(container); 
}

// A full-class save can still take a few seconds on a slow connection. The status chip used
// to sit on one unchanging "กำลังบันทึก..." for the whole run, so there was no way to tell a
// slow save from a stuck one - and every impatient extra click started another overlapping
// save. Report which step is running, count the cells as they go, and refuse to overlap.
let forceSaveInFlight = false;
window.t_forceSave = async function() {
    if(!window.ensureCanEditScorebook()) return;
    if(forceSaveInFlight) {
        window.notify('กำลังบันทึกอยู่ กรุณารอให้เสร็จก่อน');
        return;
    }
    forceSaveInFlight = true;
    const btn = document.getElementById('t-force-save-btn');
    const btnHtml = btn ? btn.innerHTML : '';
    if(btn) {
        btn.disabled = true;
        btn.classList.add('opacity-60', 'cursor-not-allowed');
        btn.innerHTML = '<i class="ph ph-spinner-gap animate-spin mr-2 text-xl"></i> กำลังบันทึก...';
    }
    try {
        window.setScoreAutoSaveStatus('pending', 'กำลังบันทึก...');
        await window.flushPendingScoreAutoSaves((done, total) => {
            if(total > 0) window.setScoreAutoSaveStatus('pending', `กำลังบันทึกคะแนนที่ค้าง ${done}/${total}`);
        });
        if(typeof window.updateClassProgressSummaryLocal === 'function') {
            window.updateClassProgressSummaryLocal(state.subjId, state.clsId, state.term);
        }
        window.saveSubjectDataLocalNow();
        window.saveDB(state.subjId);
        window.setScoreAutoSaveStatus('pending', 'กำลังซิงก์ขึ้นคลาวด์...');
        if(typeof window.firebaseSaveNowFn === 'function') {
            await window.withCloudWriteTimeout(window.firebaseSaveNowFn(), 30000, 'subject sync');
        }
        if(typeof window.firebaseSyncProgressSummaryNow === 'function') {
            await window.firebaseSyncProgressSummaryNow(state.subjId, state.clsId, state.term).catch(() => {});
        }
        const stillPending = typeof window.getPendingScoreCellCount === 'function' ? window.getPendingScoreCellCount() : 0;
        const overflows = typeof window.checkClassScoreOverflows === 'function' ? window.checkClassScoreOverflows() : [];
        if(stillPending > 0) {
            window.setScoreAutoSaveStatus('error', `บันทึกในเครื่องแล้ว ค้างอีก ${stillPending} ช่อง`);
            window.notify(`บันทึกในเครื่องเรียบร้อย แต่ยังมี ${stillPending} ช่องที่ยังไม่ขึ้นคลาวด์ ระบบกำลังลองใหม่อัตโนมัติ`, true);
        } else if(overflows.length > 0) {
            window.setScoreAutoSaveStatus('saved', 'บันทึกแล้ว (มีคะแนนเกินเกณฑ์)');
            window.notify(`⚠️ บันทึกข้อมูลแล้ว แต่มีคะแนนเกินเกณฑ์ที่กำหนด ${overflows.length} คน กรุณาตรวจสอบ!`, true);
        } else {
            window.setScoreAutoSaveStatus('saved', 'บันทึกแล้ว');
            window.notify('บันทึกข้อมูลคะแนนเรียบร้อยแล้ว');
        }
    } catch(err) {
        console.error(err);
        if(err && err.isCloudWriteTimeout) {
            // The write is still queued inside the Firestore SDK and the pending-cell queue
            // keeps retrying it, so the scores are not lost - only unconfirmed. Say exactly
            // that rather than "failed", which would push the user into re-entering scores.
            window.setScoreAutoSaveStatus('error', 'บันทึกในเครื่องแล้ว คลาวด์ยังไม่ตอบ');
            window.notify('บันทึกในเครื่องเรียบร้อย แต่คลาวด์ยังไม่ตอบกลับ คะแนนไม่หาย ระบบจะลองส่งใหม่อัตโนมัติ กรุณาตรวจสอบอินเทอร์เน็ต', true);
            if(typeof window.retryPendingScoreAutoSaves === 'function') window.retryPendingScoreAutoSaves(5000);
        } else {
            window.setScoreAutoSaveStatus('error', 'บันทึกไม่สำเร็จ');
            window.notify('บันทึกไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วกดบันทึกอีกครั้ง', true);
        }
    } finally {
        forceSaveInFlight = false;
        if(btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-60', 'cursor-not-allowed');
            btn.innerHTML = btnHtml;
        }
    }
}

window.t_clearScores = function() {
    if(!window.ensureCanEditScorebook()) return;
    window.showCustomConfirm('ยืนยันการล้างคะแนน', 'ต้องการล้างคะแนนทั้งหมดของห้องนี้ในเทอมนี้หรือไม่?\n<span class="text-rose-600 font-bold">(ไม่สามารถกู้คืนได้)</span>', 'danger', async () => {
        let sd = window.getSubjectData();
        let scStore = sd.scores[state.clsId];
        let classConfig = (sd.classData && sd.classData[state.clsId]) ? sd.classData[state.clsId] : {};
        if(scStore) {
            Object.keys(scStore).forEach(sId => {
                if(scStore[sId] && scStore[sId][state.term]) {
                    window.markScoreStructureClearedInSafetyLog(state.subjId, state.clsId, sId, state.term, classConfig);
                    scStore[sId][state.term] = { indicators: {}, midTermScore: '', finalScore: '' };
                }
            });
            
            if (window.firebaseDeleteScoreTerm && DB.classes[state.clsId]) {
                window.saveSubjectDataLocalNow();
                try {
                    window.setScoreAutoSaveStatus('pending', 'กำลังล้างคะแนนบนคลาวด์...');
                    await Promise.all(DB.classes[state.clsId].students.map(stu => window.firebaseDeleteScoreTerm(state.subjId, state.clsId, stu.studentId, state.term)));
                    window.setScoreAutoSaveStatus('saved', 'ล้างคะแนนบนคลาวด์แล้ว');
                } catch(err) {
                    console.error(err);
                    window.setScoreAutoSaveStatus('error', 'ล้างคะแนนบนคลาวด์ไม่สำเร็จ');
                    window.notify('ล้างคะแนนในเครื่องแล้ว แต่ซิงก์คลาวด์ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต', true);
                }
            } else if (window.firebaseUpdateScore) {
                window.saveSubjectDataLocalNow();
            } else {
                window.saveDB();
            }
            if(typeof window.updateClassProgressSummaryLocal === 'function') {
                window.updateClassProgressSummaryLocal(state.subjId, state.clsId, state.term);
            }
            if(typeof window.firebaseSyncProgressSummaryNow === 'function') {
                window.firebaseSyncProgressSummaryNow(state.subjId, state.clsId, state.term).catch(() => {});
            }
            window.persistScoreSafetyLogNow();
            window.t_updateScoreTableValues();
            window.notify('ล้างคะแนนเรียบร้อยแล้ว');
        }
    });
}

window.getScoreImportContext = function() {
    const cls = DB.classes[state.clsId];
    const sub = DB.subjects.find(x => x.id === state.subjId);
    if(!cls || !sub) return null;

    const sd = window.getSubjectData();
    const classConfig = sd.classData[state.clsId] || {};
    const termUnits = (classConfig.learningUnits || []).filter(u => String(u.term) === String(state.term));
    const ex = classConfig.examSettings ? (classConfig.examSettings[state.term] || {mid:20, final:30}) : {mid:20, final:30};
    const slots = [];

    termUnits.forEach((u, unitIdx) => {
        (u.indicators || []).forEach((ind, indIdx) => {
            [
                { type: 'k', label: 'K', maxKey: 'max_k' },
                { type: 'p', label: 'P', maxKey: 'max_p' },
                { type: 'a', label: 'A', maxKey: 'max_a' }
            ].forEach(part => {
                const max = Number(ind[part.maxKey] || 0);
                if(max > 0) {
                    const unitName = u.name || `หน่วยที่ ${unitIdx + 1}`;
                    const indicatorName = ind.name || `ตัวชี้วัด ${indIdx + 1}`;
                    slots.push({
                        kind: 'indicator',
                        unitId: u.id,
                        unitName,
                        indId: ind.id,
                        indicatorName,
                        type: part.type,
                        max,
                        header: `${unitName} | ${indicatorName} | ${part.label} (${max})`
                    });
                }
            });
        });
    });

    const midMax = Number(ex && ex.mid || 0);
    const finalMax = Number(ex && ex.final || 0);
    if(midMax > 0) slots.push({ kind: 'exam', type: 'midTermScore', max: midMax, header: `กลางภาค (${midMax})` });
    if(finalMax > 0) slots.push({ kind: 'exam', type: 'finalScore', max: finalMax, header: `ปลายภาค (${finalMax})` });
    return { cls, sub, sd, classConfig, slots };
};

window.t_showExcelExportOptions = function() {
    const ctx = window.getScoreImportContext();
    if(!ctx || !ctx.cls) { window.notify('กรุณาเลือกวิชาและห้องเรียนก่อนส่งออก Excel', true); return; }
    if(!ctx.cls.students || ctx.cls.students.length === 0) { window.notify('ห้องนี้ยังไม่มีรายชื่อนักเรียน', true); return; }
    if(ctx.slots.length === 0) { window.notify('กรุณาตั้งค่าโครงสร้างคะแนนก่อนส่งออก Excel', true); return; }

    const unitSlotCount = ctx.slots.filter(slot => slot.kind === 'indicator').length;
    const examSlotCount = ctx.slots.filter(slot => slot.kind === 'exam').length;
    window.showModal(`
        <div class="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0"><i class="ph ph-file-xls text-2xl"></i></div>
                <div class="min-w-0">
                    <h3 class="text-xl font-extrabold text-slate-800">ส่งออกคะแนนเป็น Excel</h3>
                    <p class="text-sm font-bold text-slate-500 truncate">${window.escapeHtml(ctx.sub.name)} • ห้อง ${window.escapeHtml(ctx.cls.name)}</p>
                </div>
            </div>
            <button onclick="window.hideModal()" class="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center shrink-0" title="ปิด"><i class="ph ph-x text-xl"></i></button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 py-5">
            <button onclick="window.t_exportScoreExcel('all'); window.hideModal()" class="tactile-btn text-left p-4 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 flex items-start gap-3">
                <i class="ph ph-table text-2xl text-indigo-600 mt-0.5"></i>
                <span><strong class="block text-slate-800">คะแนนทั้งหมด</strong><small class="block text-slate-500 font-bold mt-1">หน่วย กลางภาค ปลายภาค รวม และเกรด</small></span>
            </button>
            <button onclick="window.t_exportScoreExcel('units'); window.hideModal()" class="tactile-btn text-left p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-start gap-3 ${unitSlotCount ? '' : 'opacity-50 pointer-events-none'}">
                <i class="ph ph-books text-2xl text-sky-600 mt-0.5"></i>
                <span><strong class="block text-slate-800">คะแนนหน่วย</strong><small class="block text-slate-500 font-bold mt-1">${unitSlotCount} ช่องคะแนน K P A</small></span>
            </button>
            <button onclick="window.t_exportScoreExcel('exams'); window.hideModal()" class="tactile-btn text-left p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-start gap-3 ${examSlotCount ? '' : 'opacity-50 pointer-events-none'}">
                <i class="ph ph-exam text-2xl text-amber-600 mt-0.5"></i>
                <span><strong class="block text-slate-800">คะแนนสอบกลางและปลาย</strong><small class="block text-slate-500 font-bold mt-1">เฉพาะคะแนนสอบทั้งสองช่วง</small></span>
            </button>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="window.t_exportScoreExcel('mid'); window.hideModal()" class="tactile-btn p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-center">
                    <i class="ph ph-calendar-dot text-xl text-amber-700"></i><strong class="block text-sm text-slate-800 mt-1">กลางภาค</strong>
                </button>
                <button onclick="window.t_exportScoreExcel('final'); window.hideModal()" class="tactile-btn p-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-center">
                    <i class="ph ph-flag-checkered text-xl text-emerald-700"></i><strong class="block text-sm text-slate-800 mt-1">ปลายภาค</strong>
                </button>
            </div>
        </div>
        <div class="flex justify-end pt-4 border-t border-slate-200">
            <button onclick="window.hideModal()" class="tactile-btn px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold">ยกเลิก</button>
        </div>
    `, 'max-w-2xl');
}

window.t_downloadScoreTemplate = function() {
    window.t_showExcelExportOptions();
}

window.t_exportScoreExcel = function(scope = 'all') {
    const ctx = window.getScoreImportContext();
    if(!ctx || !ctx.cls) { window.notify('กรุณาเลือกวิชาและห้องเรียนก่อนส่งออก Excel', true); return; }
    if(!ctx.cls.students || ctx.cls.students.length === 0) { window.notify('ห้องนี้ยังไม่มีรายชื่อนักเรียน', true); return; }

    const slotFilters = {
        all: slot => true,
        units: slot => slot.kind === 'indicator',
        exams: slot => slot.kind === 'exam',
        mid: slot => slot.kind === 'exam' && slot.type === 'midTermScore',
        final: slot => slot.kind === 'exam' && slot.type === 'finalScore'
    };
    const scopeLabels = {
        all: 'คะแนนทั้งหมด',
        units: 'คะแนนหน่วย',
        exams: 'คะแนนสอบกลางและปลาย',
        mid: 'คะแนนกลางภาค',
        final: 'คะแนนปลายภาค'
    };
    const selectedScope = Object.prototype.hasOwnProperty.call(slotFilters, scope) ? scope : 'all';
    const slots = ctx.slots.filter(slotFilters[selectedScope]);
    if(!slots.length) {
        window.notify(`ไม่มี${scopeLabels[selectedScope]}สำหรับส่งออก`, true);
        return;
    }

    const includeSummary = selectedScope === 'all';
    const rows = [
        [`วิชา: ${ctx.sub.name}`, `ห้อง: ${ctx.cls.name}`, `เทอม ${state.term}`, `ประเภท: ${scopeLabels[selectedScope]}`],
        ['เลขที่', 'รหัส', 'ชื่อ-สกุล', ...slots.map(slot => slot.header), ...(includeSummary ? ['รวม', 'เกรด'] : [])]
    ];
    const classScores = (ctx.sd.scores && ctx.sd.scores[state.clsId]) || {};
    ctx.cls.students.forEach((stu, idx) => {
        const studentNode = classScores[stu.studentId] || {};
        const termNode = studentNode[state.term] || {};
        const values = slots.map(slot => {
            let value = '';
            if(slot.kind === 'indicator') {
                value = termNode.indicators && termNode.indicators[slot.indId]
                    ? termNode.indicators[slot.indId][slot.type]
                    : '';
            } else {
                value = termNode[slot.type];
            }
            return window.normalizeScoreValue(value, slot.type);
        });
        const summary = includeSummary
            ? [window.getStudentTotalScore(stu, state.subjId, state.clsId, state.term), window.calculateGrade(window.getStudentTotalScore(stu, state.subjId, state.clsId, state.term), DB.gradeSettings)]
            : [];
        rows.push([idx + 1, stu.studentId || '', stu.name || '', ...values, ...summary]);
    });

    const cleanFilePart = (value) => String(value || '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60);
    const fileName = `${cleanFilePart(scopeLabels[selectedScope])}_${cleanFilePart(ctx.sub.name)}_${cleanFilePart(ctx.cls.name)}_เทอม${state.term}`;

    if(typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 8 },
            { wch: 14 },
            { wch: 28 },
            ...slots.map(slot => ({ wch: slot.kind === 'indicator' ? 28 : 16 })),
            ...(includeSummary ? [{ wch: 12 }, { wch: 10 }] : [])
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'scores');
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
        const csv = rows.map(row => row.map(cell => {
            const text = String(cell ?? '');
            return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        }).join(',')).join('\r\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${fileName}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    window.notify(`ส่งออก${scopeLabels[selectedScope]}เรียบร้อยแล้ว`);
}

window.t_importScores = function(e) {
    const inputEl = e.target;
    const file = inputEl.files && inputEl.files[0];
    if(!file) return;
    if(!window.ensureCanEditScorebook()) { inputEl.value = ''; return; }

    const ctx = window.getScoreImportContext();
    if(!ctx || !ctx.cls) { window.notify('กรุณาเลือกวิชาและห้องเรียนก่อนนำเข้าคะแนน', true); inputEl.value = ''; return; }
    if(!ctx.cls.students || ctx.cls.students.length === 0) { window.notify('ห้องนี้ยังไม่มีรายชื่อนักเรียน', true); inputEl.value = ''; return; }
    if(ctx.slots.length === 0) { window.notify('กรุณาตั้งค่าโครงสร้างคะแนนก่อนนำเข้าคะแนน', true); inputEl.value = ''; return; }
    if(typeof XLSX === 'undefined') { window.notify('ไม่พบตัวอ่านไฟล์ Excel กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', true); inputEl.value = ''; return; }

    const normalizeText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
    const normalizeKey = (value) => normalizeText(value).toLowerCase();
    const compactKey = (value) => normalizeKey(value).replace(/\s+/g, '');
    const idKey = (value) => normalizeText(value).replace(/\.0$/, '');
    const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';
    const toScoreValue = (value, max) => {
        if(isBlank(value) || String(value).trim() === '-') return null;
        const raw = String(value).trim().replace(/,/g, '.').replace('%', '');
        const parsed = Number(raw);
        if(!Number.isFinite(parsed)) return null;
        let score = parsed;
        if(score < 0) score = 0;
        if(Number(max) >= 0 && score > Number(max)) score = Number(max);
        return score;
    };

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const workbook = XLSX.read(evt.target.result, { type: 'binary' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if(!rows || rows.length === 0) throw new Error('empty file');

            const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
            const students = ctx.cls.students || [];
            const studentById = new Map(students.map(stu => [idKey(stu.studentId), stu]).filter(([key]) => key));
            const studentByName = new Map(students.map(stu => [compactKey(stu.name), stu]).filter(([key]) => key));

            let idCol = -1, nameCol = -1, bestIdMatches = 0, bestNameMatches = 0;
            for(let col = 0; col < maxCols; col++) {
                let idMatches = 0, nameMatches = 0;
                rows.forEach(row => {
                    if(studentById.has(idKey(row[col]))) idMatches++;
                    if(studentByName.has(compactKey(row[col]))) nameMatches++;
                });
                if(idMatches > bestIdMatches) { bestIdMatches = idMatches; idCol = col; }
                if(nameMatches > bestNameMatches) { bestNameMatches = nameMatches; nameCol = col; }
            }

            const findStudent = (row) => {
                let stu = idCol >= 0 ? studentById.get(idKey(row[idCol])) : null;
                if(!stu && nameCol >= 0) stu = studentByName.get(compactKey(row[nameCol]));
                if(!stu) {
                    for(let col = 0; col < maxCols; col++) {
                        stu = studentById.get(idKey(row[col]));
                        if(stu) break;
                    }
                }
                if(!stu) {
                    for(let col = 0; col < maxCols; col++) {
                        stu = studentByName.get(compactKey(row[col]));
                        if(stu) break;
                    }
                }
                return stu || null;
            };

            const firstDataRow = rows.findIndex(row => !!findStudent(row));
            if(firstDataRow < 0) throw new Error('no matching students');

            const headerRows = rows.slice(0, firstDataRow);
            const headers = Array.from({ length: maxCols }, (_, col) => {
                return headerRows.map(row => normalizeKey(row[col])).filter(Boolean).join(' ');
            });

            const isSkippedColumn = (col) => {
                if(col === idCol || col === nameCol) return true;
                const header = headers[col];
                return /เลขที่|ลำดับ|no\.?|ชื่อ|รหัส|รวม|total|เกรด|grade|ผลการเรียน/.test(header);
            };

            const mappedColumns = [];
            const usedCols = new Set();
            const findNamedCol = (patterns) => {
                for(let col = 0; col < maxCols; col++) {
                    if(usedCols.has(col) || isSkippedColumn(col)) continue;
                    const header = headers[col];
                    if(patterns.some(pattern => pattern.test(header))) return col;
                }
                return -1;
            };

            const midSlot = ctx.slots.find(slot => slot.kind === 'exam' && slot.type === 'midTermScore');
            const finalSlot = ctx.slots.find(slot => slot.kind === 'exam' && slot.type === 'finalScore');
            if(midSlot) {
                const col = findNamedCol([/กลางภาค/, /\bmid\b/, /midterm/, /mid term/]);
                if(col >= 0) { mappedColumns.push({ col, slot: midSlot }); usedCols.add(col); }
            }
            if(finalSlot) {
                const col = findNamedCol([/ปลายภาค/, /\bfinal\b/, /finalterm/, /final term/]);
                if(col >= 0) { mappedColumns.push({ col, slot: finalSlot }); usedCols.add(col); }
            }

            const candidateScoreCols = [];
            for(let col = 0; col < maxCols; col++) {
                if(!isSkippedColumn(col)) candidateScoreCols.push(col);
            }
            const examHeaderPattern = /กลางภาค|ปลายภาค|\bmid\b|midterm|mid term|\bfinal\b|finalterm|final term/;
            const examOnlyImport = mappedColumns.some(item => item.slot && item.slot.kind === 'exam')
                && candidateScoreCols.length > 0
                && candidateScoreCols.every(col => examHeaderPattern.test(headers[col]));
            const firstScoreCol = Math.max(idCol, nameCol, 1) + 1;
            const sequentialSlots = ctx.slots.filter(slot => {
                if(slot === midSlot && mappedColumns.some(x => x.slot === midSlot)) return false;
                if(slot === finalSlot && mappedColumns.some(x => x.slot === finalSlot)) return false;
                return true;
            });
            let slotIdx = 0;
            if(!examOnlyImport) {
                for(let col = firstScoreCol; col < maxCols && slotIdx < sequentialSlots.length; col++) {
                    if(usedCols.has(col) || isSkippedColumn(col)) continue;
                    mappedColumns.push({ col, slot: sequentialSlots[slotIdx] });
                    usedCols.add(col);
                    slotIdx++;
                }
            }

            if(mappedColumns.length === 0) throw new Error('no score columns');

            const sd = window.getSubjectData();
            if(!sd.scores[state.clsId]) sd.scores[state.clsId] = {};
            const scStore = sd.scores[state.clsId];
            let matchedRows = 0, importedCells = 0, cappedCells = 0;
            let unchangedExamCells = 0, lowerExamCells = 0;
            const autoAdjustedMidtermStudents = new Set();

            rows.forEach(row => {
                const stu = findStudent(row);
                if(!stu) return;
                matchedRows++;
                const sId = stu.studentId;
                if(!scStore[sId]) scStore[sId] = {};
                if(!scStore[sId][state.term]) scStore[sId][state.term] = { indicators: {} };
                if(!scStore[sId][state.term].indicators) scStore[sId][state.term].indicators = {};

                mappedColumns.forEach(({ col, slot }) => {
                    const rawValue = row[col];
                    let score = toScoreValue(rawValue, slot.max);
                    if(score === null) return;
                    if(Number(rawValue) > Number(slot.max)) cappedCells++;
                    let midtermAdjusted = false;
                    if(slot.kind === 'exam' && slot.type === 'midTermScore') {
                        const halfScore = Math.round((Number(slot.max) / 2) * 100) / 100;
                        if(score < halfScore) {
                            score = halfScore;
                            midtermAdjusted = true;
                        }
                    }

                    if(slot.kind === 'indicator') {
                        if(!scStore[sId][state.term].indicators[slot.indId]) scStore[sId][state.term].indicators[slot.indId] = {};
                        scStore[sId][state.term].indicators[slot.indId][slot.type] = score;
                        window.scheduleScoreAutoSave(state.subjId, state.clsId, sId, state.term, `indicators.${slot.indId}.${slot.type}`, score);
                    } else {
                        const oldValue = window.normalizeScoreValue
                            ? window.normalizeScoreValue(scStore[sId][state.term][slot.type], slot.type)
                            : scStore[sId][state.term][slot.type];
                        if(oldValue !== '' && Number(oldValue) === score) { unchangedExamCells++; return; }
                        if(oldValue !== '' && score < Number(oldValue)) { lowerExamCells++; return; }
                        scStore[sId][state.term][slot.type] = score;
                        window.scheduleScoreAutoSave(state.subjId, state.clsId, sId, state.term, slot.type, score);
                        if(midtermAdjusted) autoAdjustedMidtermStudents.add(String(sId));
                    }
                    importedCells++;
                });
            });

            if(matchedRows === 0) throw new Error('no matching students');
            if(importedCells === 0 && (unchangedExamCells || lowerExamCells)) {
                window.notify(`ไม่มีคะแนนสอบที่สูงกว่าคะแนนเดิม ข้ามคะแนนเท่าเดิม ${unchangedExamCells} ช่อง และต่ำกว่าเดิม ${lowerExamCells} ช่อง`);
                return;
            }
            if(importedCells === 0) throw new Error('no score values');

            window.persistScoreSafetyLogNow();
            window.saveSubjectDataLocalNow();
            if(typeof window.flushPendingScoreAutoSaves === 'function') await window.flushPendingScoreAutoSaves();
            if(typeof window.updateClassProgressSummaryLocal === 'function') {
                window.updateClassProgressSummaryLocal(state.subjId, state.clsId, state.term);
            }
            if(typeof window.firebaseSyncProgressSummaryNow === 'function') {
                window.firebaseSyncProgressSummaryNow(state.subjId, state.clsId, state.term).catch(() => {});
            }
            window.t_renderScoreTable();

            let msg = `นำเข้าคะแนนสำเร็จ ${matchedRows} คน ${importedCells} ช่อง`;
            if(cappedCells > 0) msg += ` (มี ${cappedCells} ช่องถูกปรับไม่ให้เกินคะแนนเต็ม)`;
            if(autoAdjustedMidtermStudents.size > 0) msg += ` พบคะแนนกลางภาคต่ำกว่าครึ่ง ${autoAdjustedMidtermStudents.size} คน และปรับเป็นครึ่งของคะแนนเต็มแล้ว`;
            if(unchangedExamCells > 0) msg += ` ข้ามคะแนนสอบเท่าเดิม ${unchangedExamCells} ช่อง`;
            if(lowerExamCells > 0) msg += ` ข้ามคะแนนสอบต่ำกว่าเดิม ${lowerExamCells} ช่อง`;
            const overflows = typeof window.checkClassScoreOverflows === 'function' ? window.checkClassScoreOverflows() : [];
            if(overflows.length > 0) {
                msg += ` ⚠️ ตรวจพบคะแนนเกินเกณฑ์ ${overflows.length} คน กรุณาตรวจสอบ`;
                window.notify(msg, true);
            } else {
                window.notify(msg);
            }
        } catch(err) {
            console.error('Import scores failed:', err);
            window.notify('นำเข้าคะแนนไม่สำเร็จ: ตรวจว่ารหัสนักเรียน/ชื่อ และคอลัมน์คะแนนตรงกับฟอร์มของห้องนี้', true);
        } finally {
            inputEl.value = '';
        }
    };
    reader.onerror = function() {
        inputEl.value = '';
        window.notify('อ่านไฟล์คะแนนไม่สำเร็จ', true);
    };
    reader.readAsBinaryString(file);
}

window.renderAdminScoreReport = function(container) {
    $('page-title').innerText = 'ตรวจสอบผลการเรียน';
    
    let subjectOptions = `<option value="">-- คลิกเพื่อเลือกวิชา --</option>`;
    DB.subjects.forEach(sub => {
        subjectOptions += `<option value="${sub.id}">${sub.code || ''} ${sub.name}</option>`;
    });

    let html = `
        <div class="modern-card p-8 mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-200 border-none relative overflow-hidden">
            <div class="absolute -right-20 -top-20 w-64 h-64 border-[30px] border-white/10 rounded-full blur-sm"></div>
            <div class="absolute right-20 -bottom-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
            
            <div class="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h3 class="text-2xl font-extrabold mb-1">ตรวจสอบสมุดรายงานผลการเรียน</h3>
                    <p class="text-indigo-100 font-medium text-sm">เข้าถึงและดูผลคะแนนนักเรียนรายบุคคลในทุกวิชาที่เปิดสอน</p>
                </div>
                <div class="w-full md:w-1/2 relative">
                    <select id="admin-rep-subj" class="w-full appearance-none border-2 border-white/20 rounded-2xl p-4 pl-5 pr-12 focus:outline-none focus:border-white focus:ring-4 focus:ring-white/20 bg-white/10 backdrop-blur-md text-xl font-bold text-white shadow-lg cursor-pointer transition-all placeholder-white/50" onchange="window.adminShowSubjectClasses(this.value)">
                        ${subjectOptions}
                    </select>
                    <i class="ph ph-caret-down absolute right-5 top-1/2 -translate-y-1/2 text-white pointer-events-none text-xl"></i>
                </div>
            </div>
        </div>
        <div id="admin-rep-content" class="animate-fade-in-up stagger-1">
            <div class="text-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed shadow-sm">
                <div class="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                    <i class="ph ph-magnifying-glass-plus text-5xl text-slate-300"></i>
                </div>
                <h3 class="text-xl font-bold text-slate-600 mb-2">เลือกรายวิชาด้านบนเพื่อเริ่มตรวจสอบ</h3>
                <p class="text-sm font-medium">ระบบจะแสดงรายชื่อห้องเรียนทั้งหมดที่มีการเรียนการสอนในวิชานั้น</p>
            </div>
        </div>
    `;
    container.innerHTML = html;
    
    const selectEl = document.getElementById('admin-rep-subj');
    if(selectEl) {
        Array.from(selectEl.options).forEach(opt => {
            opt.style.color = '#334155';
        });
    }
}

window.adminShowSubjectClasses = async function(subId) {
    const cont = $('admin-rep-content');
    const requestKey = `${subId || ''}-${Date.now()}`;
    if(cont) cont.dataset.adminScoreLoadKey = requestKey;
    if(!subId) {
        cont.innerHTML = `
            <div class="text-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed shadow-sm animate-fade-in-up">
                <div class="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                    <i class="ph ph-magnifying-glass-plus text-5xl text-slate-300"></i>
                </div>
                <h3 class="text-xl font-bold text-slate-600 mb-2">เลือกรายวิชาด้านบนเพื่อเริ่มตรวจสอบ</h3>
                <p class="text-sm font-medium">ระบบจะแสดงรายชื่อห้องเรียนทั้งหมดที่มีการเรียนการสอนในวิชานั้น</p>
            </div>`;
        return;
    }

    const sub = DB.subjects.find(x => x.id === subId);
    if(!sub) return;

    let classesAssigned = [];
    DB.teachers.forEach(t => {
        let currentTermAsg = window.getTeacherAssignments(t, state.term);
        if(currentTermAsg && currentTermAsg[subId]) {
            window.sortClassIds(currentTermAsg[subId]).forEach(cId => {
                classesAssigned.push({ cId: cId, teacher: t });
            });
        }
    });
    classesAssigned.sort((a, b) => window.compareClassEntries([a.cId, DB.classes[a.cId] || {}], [b.cId, DB.classes[b.cId] || {}]));

    if(classesAssigned.length === 0) {
        cont.innerHTML = `
            <div class="modern-card p-12 text-center border-rose-200 bg-rose-50/30 animate-fade-in-up">
                <div class="w-20 h-20 bg-rose-100 text-rose-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 shadow-inner">
                    <i class="ph ph-warning-octagon text-5xl"></i>
                </div>
                <h3 class="text-xl font-extrabold text-rose-800 mb-2">ไม่พบการมอบหมายงาน</h3>
                <p class="text-rose-600 font-medium">ยังไม่มีการกำหนดให้ครูท่านใดสอนวิชานี้ในภาคเรียนที่ ${state.term}</p>
            </div>`;
        return;
    }

    if(typeof window.firebaseLoadSubjectClassScores === 'function') {
        cont.innerHTML = `
            <div class="modern-card p-12 text-center animate-fade-in-up">
                <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                    <i class="ph ph-spinner-gap text-4xl animate-spin"></i>
                </div>
                <h3 class="text-lg font-extrabold text-slate-800 mb-1">กำลังดึงคะแนนล่าสุด</h3>
                <p class="text-sm font-medium text-slate-500">ระบบกำลังตรวจคะแนนจากคลาวด์เฉพาะวิชาและห้องที่เลือก</p>
            </div>
        `;
        try {
            await window.firebaseLoadSubjectClassScores(subId, classesAssigned.map(item => item.cId));
        } catch(err) {
            console.warn('Admin subject score preload failed:', err);
            window.notify('ดึงคะแนนล่าสุดไม่สำเร็จ จะแสดงข้อมูลล่าสุดที่มีในเครื่องก่อน', true);
        }
        if(cont.dataset.adminScoreLoadKey !== requestKey) return;
    }

    let listHtml = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">`;
    classesAssigned.forEach((item, i) => {
        let cls = DB.classes[item.cId];
        if(!cls) return;

        let progressPct = window.calculateClassProgress(subId, item.cId, state.term);
        let statusHtml = '';
        if(progressPct >= 100) {
            statusHtml = `<div class="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"><i class="ph ph-check-circle fill-current"></i> 100%</div>`;
        } else if(progressPct > 0) {
            statusHtml = `<div class="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"><i class="ph ph-chart-line-up"></i> ${progressPct}%</div>`;
        } else {
            statusHtml = `<div class="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"><i class="ph ph-clock"></i> 0%</div>`;
        }
        
        let tAvatarHtml = item.teacher.picUrl 
            ? `<img src="${window.formatImgUrl(item.teacher.picUrl)}" class="w-5 h-5 rounded-full object-cover inline-block mr-1 shadow-sm" onerror="this.onerror=null; this.outerHTML='<i class=\\'ph ph-user mr-1 text-slate-400 text-lg\\'></i>'">`
            : `<i class="ph ph-user mr-1 text-slate-400 text-lg"></i>`;

        listHtml += `
            <div class="modern-card p-6 flex flex-col justify-between hover:ring-2 hover:ring-indigo-400 hover:border-transparent cursor-pointer group animate-fade-in-up" style="animation-delay: ${i * 0.05}s" onclick="window.adminViewClassScore('${subId}', '${item.cId}', '${item.teacher.id}')">
                <div>
                    <div class="flex justify-between items-start mb-4 gap-2">
                        <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner border border-indigo-100/50 group-hover:scale-110 transition-transform">
                            ${cls.name}
                        </div>
                        ${statusHtml}
                    </div>
                    <h4 class="text-base font-extrabold text-slate-800 mb-1 leading-tight">ห้องเรียน ${cls.name}</h4>
                    <p class="text-sm text-slate-500 font-medium flex items-center mt-2">${tAvatarHtml} ครู${item.teacher.name}</p>
                    <p class="text-xs text-slate-400 font-bold mt-2 flex items-center gap-1.5 bg-slate-50 inline-block px-2 py-1 rounded"><i class="ph ph-users text-sm"></i> นร. ${cls.students.length} คน</p>
                </div>
                <div class="mt-5 pt-4 border-t border-slate-100 text-center text-sm font-bold text-indigo-600 group-hover:text-indigo-700 flex items-center justify-center gap-1">
                    ดูตารางคะแนน <i class="ph ph-arrow-right group-hover:translate-x-1 transition-transform"></i>
                </div>
            </div>
        `;
    });
    listHtml += `</div>`;

    cont.innerHTML = `
        <div class="mb-6 flex items-end justify-between animate-fade-in-up border-b border-slate-200 pb-3">
            <div>
                <h3 class="text-xl font-extrabold text-slate-800 flex items-center"><i class="ph ph-door text-indigo-500 mr-2 text-2xl"></i> รายชื่อห้องเรียนที่เรียนวิชานี้</h3>
                <p class="text-sm text-slate-500 font-medium mt-1">วิชา ${sub.name} • เทอม ${state.term}/${DB.schoolInfo.year}</p>
            </div>
            <div class="text-sm font-bold text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">ทั้งหมด ${classesAssigned.length} ห้อง</div>
        </div>
        ${listHtml}
    `;
}

window.adminViewClassScore = async function(subId, cId, teacherId) {
    const sub = DB.subjects.find(x => x.id === subId);
    const cls = DB.classes[cId];
    const teacher = DB.teachers.find(x => x.id === teacherId);
    if(!sub || !cls) return;

    if(window.cloudSyncState && window.cloudSyncState.connected && typeof window.firebaseLoadClassScores === 'function') {
        window.showModal(`
            <div class="p-10 text-center">
                <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                    <i class="ph ph-spinner-gap text-4xl animate-spin"></i>
                </div>
                <h3 class="text-lg font-extrabold text-slate-800 mb-1">กำลังดึงคะแนนล่าสุด</h3>
                <p class="text-sm font-medium text-slate-500">กำลังตรวจข้อมูลของห้อง ${cls.name} จากคลาวด์ก่อนแสดงรายงาน</p>
            </div>
        `, 'max-w-md');
        try {
            await window.firebaseLoadClassScores(subId, cId, (cls.students || []).map(stu => stu.studentId).filter(Boolean));
        } catch(err) {
            console.warn('Admin class score preload failed:', err);
            window.notify('ดึงคะแนนล่าสุดของห้องนี้ไม่สำเร็จ จะแสดงข้อมูลล่าสุดที่มีในเครื่องก่อน', true);
        }
    }

    let sd = DB_SubjectData[subId] || { classData: {}, scores: {} };
    const classConfig = sd.classData[cId] || {};
    let termUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term));

    let thHtml = `
        <th class="w-12 text-center p-3 border-r border-slate-200 sticky left-0 z-20">เลขที่</th>
        <th class="w-24 text-center p-3 border-r border-slate-200 sticky left-[48px] z-20 shadow-[2px_0_10px_rgba(0,0,0,0.05)]">รหัส</th>
        <th class="text-left p-3 border-r border-slate-200">ชื่อ-สกุล</th>
    `;

    termUnits.forEach(u => {
        thHtml += `<th class="text-center p-3 border-r border-slate-200 text-xs w-16" title="${u.name}"><div class="truncate max-w-[80px] mx-auto">${u.name}</div></th>`;
    });

    thHtml += `<th class="text-center p-3 border-r border-slate-200 w-16 text-amber-900 bg-amber-50/50">กลางภาค</th>`;
    thHtml += `<th class="text-center p-3 border-r border-slate-200 w-16 text-amber-900 bg-amber-50/50">ปลายภาค</th>`;
    thHtml += `<th class="text-center p-3 border-r border-slate-200 w-16 text-indigo-900 bg-indigo-50/50">รวม</th><th class="text-center p-3 w-12 text-slate-800 bg-slate-100/80">เกรด</th>`;

    let tableHtml = `
        <div class="overflow-x-auto custom-scrollbar border border-slate-200 rounded-2xl shadow-sm bg-white">
        <table class="w-full text-sm border-collapse min-w-max">
            <thead class="sticky top-0 z-30 shadow-sm border-b border-slate-200 bg-slate-50"><tr>${thHtml}</tr></thead>
            <tbody class="divide-y divide-slate-100">
    `;

    let sumGrade = 0, passCount = 0;

    if(cls.students.length === 0) {
        tableHtml += `<tr><td colspan="${termUnits.length + 7}" class="text-center py-12 text-slate-400 bg-slate-50 italic font-medium">ไม่มีรายชื่อนักเรียนในห้องนี้</td></tr>`;
    } else {
        cls.students.forEach((s, idx) => {
            let scStore = sd.scores[cId] || {};
            let stuNode = scStore[s.studentId] || {};
            let mySc = stuNode[state.term] || { indicators: {}, midTermScore: '', finalScore: '' };

            let trHtml = `
                <tr class="hover:bg-indigo-50/30 transition-colors group">
                    <td class="text-center p-2.5 border-r border-slate-100 text-slate-500 font-medium sticky left-0 bg-white group-hover:bg-indigo-50/90 z-10">${idx+1}</td>
                    <td class="text-center p-2.5 border-r border-slate-100 font-mono text-slate-500 text-xs sticky left-[48px] bg-white group-hover:bg-indigo-50/90 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">${s.studentId}</td>
                    <td class="text-left font-medium p-2.5 border-r border-slate-100 text-slate-700">${s.name}</td>
            `;

            termUnits.forEach(u => {
                let uScore = 0;
                if(u.indicators) {
                    u.indicators.forEach(ind => {
                        let vals = mySc.indicators ? mySc.indicators[ind.id] : null;
                        if(vals) {
                            uScore += window.scoreNumber(vals.k, 'k') + window.scoreNumber(vals.p, 'p') + window.scoreNumber(vals.a, 'a');
                        }
                    });
                }
                trHtml += `<td class="text-center p-2.5 border-r border-slate-100 font-bold text-slate-600 bg-slate-50/30">${uScore || '-'}</td>`;
            });

            trHtml += `<td class="text-center p-2.5 border-r border-slate-100 text-amber-700 font-bold bg-amber-50/10">${window.scoreDisplayValue(mySc.midTermScore, '-', 'midTermScore')}</td>`;
            trHtml += `<td class="text-center p-2.5 border-r border-slate-100 text-amber-700 font-bold bg-amber-50/10">${window.scoreDisplayValue(mySc.finalScore, '-', 'finalScore')}</td>`;

            let total = window.getStudentTotalScore(s, subId, cId, state.term);
            let grade = window.calculateGrade(total, DB.gradeSettings);
            let gradeColor = grade === '0' ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50';
            sumGrade += Number(grade);
            if(total >= DB.gradeSettings.passThreshold) passCount++;

            trHtml += `<td class="text-center p-2.5 border-r border-slate-100 font-black text-indigo-700 bg-indigo-50/30 text-base">${total}</td>`;
            trHtml += `<td class="text-center p-2.5 font-black text-base ${gradeColor}">${grade}</td>`;

            trHtml += `</tr>`;
            tableHtml += trHtml;
        });
    }
    tableHtml += `</tbody></table></div>`;
    
    let tAvatarHtml = teacher && teacher.picUrl 
        ? `<img src="${window.formatImgUrl(teacher.picUrl)}" class="w-6 h-6 rounded-full object-cover shadow-sm inline-block mr-1">` 
        : `<i class="ph ph-user mr-1 text-slate-400"></i>`;

    window.showModal(`
        <div class="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
            <div>
                <div class="flex items-center gap-3 mb-1">
                    <div class="bg-indigo-100 text-indigo-600 p-2 rounded-xl"><i class="ph ph-file-text text-2xl"></i></div>
                    <h3 class="text-2xl font-extrabold text-slate-800 leading-none">${sub.name}</h3>
                </div>
                <div class="flex items-center gap-2 mt-3 text-sm text-slate-600 font-medium flex-wrap">
                    <span class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">ห้อง <strong class="text-slate-800">${cls.name}</strong></span>
                    <span class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 flex items-center gap-1">${tAvatarHtml} ครู${teacher ? teacher.name : '-'}</span>
                    <span class="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5"><i class="ph ph-users text-slate-400"></i> นร. ${cls.students.length} คน</span>
                </div>
            </div>
            <button onclick="window.hideModal()" class="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-full w-12 h-12 flex items-center justify-center shrink-0 transition-all"><i class="ph ph-x text-2xl"></i></button>
        </div>
        
        ${tableHtml}
        
        <div class="flex justify-end mt-8 gap-4 pt-4 border-t border-slate-100">
             <button onclick="window.hideModal()" class="tactile-btn bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-3 rounded-xl transition-colors font-bold">ปิดหน้าต่าง</button>
             <button onclick="window.adminShowAnnualSummary('${subId}', '${cId}', '${teacherId}')" class="tactile-btn bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-6 py-3 rounded-xl transition-all font-bold shadow-sm flex items-center"><i class="ph ph-calendar-check mr-2 text-xl"></i> สรุปรายปี</button>
             <button onclick="window.adminShowPrintSelection('${subId}', '${cId}', '${teacherId}')" class="tactile-btn bg-primary-gradient text-white px-8 py-3 rounded-xl transition-all font-bold shadow-lg shadow-indigo-200 flex items-center"><i class="ph ph-printer mr-2 text-xl"></i> พิมพ์รายงาน 1 ปพ.</button>
        </div>
    `, 'max-w-6xl');
}

window.adminShowAnnualSummary = function(subId, cId, teacherId) {
    const sub = DB.subjects.find(x => x.id === subId);
    const cls = DB.classes[cId];
    const teacher = DB.teachers.find(x => x.id === teacherId);
    if(!sub || !cls) {
        window.notify('ไม่พบข้อมูลวิชาหรือห้องเรียนสำหรับสรุปรายปี', true);
        return;
    }
    window.hideModal();

    let tableHtml = `
    <table class="print-table mb-4">
        <thead>
            <tr>
                <th style="width: 4%">เลขที่</th>
                <th style="width: 8%">รหัส</th>
                <th class="text-left" style="width: 20%; min-width: 100px;">ชื่อ-สกุล</th>
                <th>เทอม 1</th>
                <th>เทอม 2</th>
                <th class="font-bold">รวมรายปี</th>
                <th class="font-bold">เกรด</th>
            </tr>
        </thead>
        <tbody>`;

    let sumGrade = 0, passCount = 0;

    cls.students.forEach((s, idx) => {
        const t1 = window.getStudentTotalScore(s, subId, cId, "1");
        const t2 = window.getStudentTotalScore(s, subId, cId, "2");
        const avg = Math.round((t1 + t2) / 2);
        const grade = window.calculateGrade(avg, DB.gradeSettings);

        sumGrade += Number(grade);
        if(avg >= DB.gradeSettings.passThreshold) passCount++;

        tableHtml += `
            <tr>
                <td>${idx+1}</td>
                <td>${s.studentId}</td>
                <td class="text-left font-medium">${s.name}</td>
                <td>${t1 || ''}</td>
                <td>${t2 || ''}</td>
                <td class="font-bold">${avg}</td>
                <td class="font-bold">${grade}</td>
            </tr>
        `;
    });
    tableHtml += `</tbody></table>`;

    const avgGrade = cls.students.length ? (sumGrade / cls.students.length).toFixed(2) : '0.00';
    const titleHtml = `
        <h3 class="text-lg mt-1 font-bold">รายงานสรุปผลการเรียน <span class="underline decoration-2">รวมเฉลี่ยรายปี</span> ปีการศึกษา ${DB.schoolInfo.year}</h3>
        <p class="mt-1">วิชา ${sub.name} ${sub.code ? `รหัสวิชา ${sub.code}` : ''} ชั้น ${cls.name}</p>
    `;
    const reportHtml = window.generatePrintHTML(titleHtml, tableHtml, cls.students.length, passCount, avgGrade, sub, teacher);
    window.openPrintWindow(reportHtml);
}

window.adminShowPrintSelection = function(subId, cId, teacherId) {
    const sd = DB_SubjectData[subId] || { classData: {} };
    const classConfig = sd.classData[cId] || {};
    let termUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term));

    let unitCheckboxes = termUnits.map((u, i) => `
        <label class="flex items-center p-3 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 transition-all shadow-sm">
            <input type="checkbox" name="print_unit_admin" value="${u.id}" checked class="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mr-3">
            <span class="text-sm font-bold text-slate-700 truncate" title="${u.name}"><span class="text-indigo-500 mr-1 opacity-60 text-xs">หน่วยที่ ${i+1}</span> ${u.name}</span>
        </label>
    `).join('');

    if(termUnits.length === 0) {
        unitCheckboxes = `<div class="text-sm text-slate-400 font-medium italic col-span-2 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">ไม่พบโครงสร้างหน่วยการเรียนรู้ในเทอมนี้</div>`;
    }

    let html = `
        <div class="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
            <div>
                <h3 class="text-2xl font-extrabold text-slate-800 flex items-center"><div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mr-3 shadow-inner"><i class="ph ph-printer text-xl"></i></div> พิมพ์ ปพ. (รายวิชา)</h3>
                <p class="text-sm text-slate-500 font-medium mt-1">เลือกข้อมูลคอลัมน์ที่ต้องการให้ปรากฏบนเอกสารรายงาน</p>
            </div>
            <button onclick="window.hideModal()" class="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-10 h-10 flex items-center justify-center transition-colors"><i class="ph ph-x text-xl font-bold"></i></button>
        </div>
        
        <div class="mb-6">
            <div class="flex justify-between items-center mb-3">
                <p class="font-extrabold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg text-sm">1. เลือกหน่วยการเรียนรู้ (ผลคะแนนรวมต่อหน่วย)</p>
                <button type="button" onclick="document.querySelectorAll('input[name=print_unit_admin]').forEach(cb => cb.checked = !cb.checked)" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded transition-colors">สลับการเลือก (Toggle)</button>
            </div>

            <label class="flex items-center mb-3 ml-1 cursor-pointer w-fit group">
                <input type="checkbox" id="print_kpa_admin" class="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mr-2 transition-colors">
                <span class="text-sm font-bold text-indigo-700 group-hover:text-indigo-800 transition-colors">แสดงคะแนนแยกย่อยทุกตัวชี้วัด (K, P, A) ในแต่ละหน่วย</span>
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                ${unitCheckboxes}
            </div>
        </div>
        
        <div class="mb-8 p-5 rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm relative overflow-hidden">
            <div class="absolute -right-4 -bottom-4 text-amber-500 opacity-10 text-7xl"><i class="ph ph-table"></i></div>
            <p class="font-extrabold text-amber-900 mb-4 relative z-10 text-sm">2. แสดงคอลัมน์ประเมินผลพิเศษ:</p>
            <div class="flex flex-col sm:flex-row flex-wrap gap-4 relative z-10">
                <label class="flex items-center bg-white border border-amber-200 px-4 py-2.5 rounded-xl cursor-pointer hover:border-amber-400 transition-colors shadow-sm flex-1">
                    <input type="checkbox" id="print_mid_admin" checked class="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 mr-3">
                    <span class="text-sm font-bold text-amber-800">คะแนนกลางภาค</span>
                </label>
                <label class="flex items-center bg-white border border-amber-200 px-4 py-2.5 rounded-xl cursor-pointer hover:border-amber-400 transition-colors shadow-sm flex-1">
                    <input type="checkbox" id="print_final_admin" checked class="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 mr-3">
                    <span class="text-sm font-bold text-amber-800">คะแนนปลายภาค</span>
                </label>
                <label class="flex items-center bg-indigo-600 text-white border border-transparent px-4 py-2.5 rounded-xl cursor-pointer shadow-md flex-1 md:col-span-2 shadow-indigo-200">
                    <input type="checkbox" id="print_total_admin" checked class="w-5 h-5 rounded text-indigo-900 focus:ring-white border-none mr-3 bg-white">
                    <span class="text-sm font-extrabold">คะแนนรวม + เกรด</span>
                </label>
            </div>
        </div>
        
        <button onclick="window.adminGenerateSelectedPrint('${subId}', '${cId}', '${teacherId}')" class="tactile-btn w-full bg-primary-gradient text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center text-lg tracking-wide">
            <i class="ph ph-printer mr-2 text-2xl"></i> สร้างเอกสารและสั่งพิมพ์
        </button>
    `;
    window.showModal(html);
}

window.adminGenerateSelectedPrint = function(subId, cId, teacherId) {
    const selectedUnits = Array.from(document.querySelectorAll('input[name="print_unit_admin"]:checked')).map(cb => cb.value);
    const printKpa = $('print_kpa_admin').checked;
    const printMid = $('print_mid_admin').checked;
    const printFinal = $('print_final_admin').checked;
    const printTotal = $('print_total_admin').checked;
    window.hideModal();

    const sub = DB.subjects.find(x => x.id === subId);
    const cls = DB.classes[cId];
    const teacher = DB.teachers.find(x => x.id === teacherId);
    if(!sub || !cls) return;

    let sd = DB_SubjectData[subId] || { classData: {}, scores: {} };
    const classConfig = sd.classData[cId] || {};
    let termUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term) && selectedUnits.includes(u.id));
    const printScoreStore = sd.scores[cId] || {};
    const getPrintColumn = (indicator, type) => window.getEffectiveIndicatorColumn
        ? window.getEffectiveIndicatorColumn(indicator, type, printScoreStore, state.term)
        : { max: Number(indicator[`max_${type}`] || 0) };

    let hasAnyPrintedKpa = false;
    if (printKpa) {
        termUnits.forEach(u => {
            if(u.indicators) {
                u.indicators.forEach(ind => {
                    if (getPrintColumn(ind, 'k').max > 0 || getPrintColumn(ind, 'p').max > 0 || getPrintColumn(ind, 'a').max > 0) hasAnyPrintedKpa = true;
                });
            }
        });
    }
    let rowSpanAttr = hasAnyPrintedKpa ? 'rowspan="3"' : '';

    /* ปรับความกว้าง 3 คอลัมน์แรกให้เล็กลง */
    let thHtmlRow1 = `
        <th ${rowSpanAttr} class="print-num-col">เลขที่</th>
        <th ${rowSpanAttr} class="print-code-col">รหัส</th>
        <th ${rowSpanAttr} class="text-left print-name-col">ชื่อ-สกุล</th>
    `;
    let thHtmlRow2 = ``;
    let thHtmlRow3 = ``;

    termUnits.forEach(u => { 
        if (printKpa && hasAnyPrintedKpa) {
            let uCols = 0;
            let indRow2 = '';
            let indRow3 = '';
            if(u.indicators && u.indicators.length > 0) {
                u.indicators.forEach((ind, iIdx) => {
                    let kpaCols = 0;
                    let kpaRow3 = '';
                    if(getPrintColumn(ind, 'k').max > 0) { kpaRow3 += `<th>K</th>`; kpaCols++; }
                    if(getPrintColumn(ind, 'p').max > 0) { kpaRow3 += `<th>P</th>`; kpaCols++; }
                    if(getPrintColumn(ind, 'a').max > 0) { kpaRow3 += `<th>A</th>`; kpaCols++; }
                    
                    if(kpaCols > 0) {
                        indRow2 += `<th colspan="${kpaCols}" class="print-indicator-header" title="${ind.name}"><span>${ind.name}</span></th>`;
                        indRow3 += kpaRow3;
                        uCols += kpaCols;
                    }
                });
            }
            if (uCols === 0) {
                thHtmlRow1 += `<th ${rowSpanAttr} class="print-unit-header" title="${u.name}"><span>${u.name}</span></th>`;
            } else {
                thHtmlRow1 += `<th colspan="${uCols + 1}" class="print-unit-header" title="${u.name}"><span>${u.name}</span></th>`;
                thHtmlRow2 += indRow2 + `<th rowspan="2" class="align-middle">รวม</th>`;
                thHtmlRow3 += indRow3;
            }
        } else {
            thHtmlRow1 += `<th ${rowSpanAttr} class="print-unit-header" title="${u.name}"><span>${u.name}</span></th>`; 
        }
    });

    if(printMid) thHtmlRow1 += `<th ${rowSpanAttr} class="print-score-col">กลางภาค</th>`;
    if(printFinal) thHtmlRow1 += `<th ${rowSpanAttr} class="print-score-col">ปลายภาค</th>`;
    if(printTotal) thHtmlRow1 += `<th ${rowSpanAttr} class="font-bold print-score-col">รวม</th><th ${rowSpanAttr} class="font-bold print-score-col">เกรด</th>`;

    let tableHtml = `<table class="print-table mb-6"><thead><tr>${thHtmlRow1}</tr>`;
    if (printKpa && hasAnyPrintedKpa) {
        tableHtml += `<tr>${thHtmlRow2}</tr><tr>${thHtmlRow3}</tr>`;
    }
    tableHtml += `</thead><tbody>`;

    let sumGrade = 0, passCount = 0;

    cls.students.forEach((s, idx) => {
        let scStore = sd.scores[cId] || {};
        let stuNode = scStore[s.studentId] || {};
        let mySc = stuNode[state.term] || { indicators: {}, midTermScore: '', finalScore: '' };

        let trHtml = `
            <tr>
                <td>${idx+1}</td>
                <td>${s.studentId}</td>
                <td class="text-left font-medium">${s.name}</td>
        `;

        termUnits.forEach(u => {
            let uTotal = 0;
            if (printKpa && hasAnyPrintedKpa) {
                let hasInd = false;
                if(u.indicators && u.indicators.length > 0) {
                    u.indicators.forEach(ind => {
                        let kpaCols = 0;
                        if(getPrintColumn(ind, 'k').max > 0) kpaCols++;
                        if(getPrintColumn(ind, 'p').max > 0) kpaCols++;
                        if(getPrintColumn(ind, 'a').max > 0) kpaCols++;

                        if(kpaCols > 0) {
                            hasInd = true;
                            let vals = mySc.indicators ? mySc.indicators[ind.id] : null;
                            let vK = vals ? window.scoreDisplayValue(vals.k, '', 'k') : '';
                            let vP = vals ? window.scoreDisplayValue(vals.p, '', 'p') : '';
                            let vA = vals ? window.scoreDisplayValue(vals.a, '', 'a') : '';

                            if(getPrintColumn(ind, 'k').max > 0) { trHtml += `<td>${vK}</td>`; uTotal += Number(vK)||0; }
                            if(getPrintColumn(ind, 'p').max > 0) { trHtml += `<td>${vP}</td>`; uTotal += Number(vP)||0; }
                            if(getPrintColumn(ind, 'a').max > 0) { trHtml += `<td>${vA}</td>`; uTotal += Number(vA)||0; }
                        }
                    });
                }
                if (!hasInd) {
                    trHtml += `<td></td>`;
                } else {
                    trHtml += `<td class="font-bold bg-[#f8fafc] print:bg-transparent">${uTotal || ''}</td>`;
                }
            } else {
                if(u.indicators) {
                    u.indicators.forEach(ind => {
                        let vals = mySc.indicators ? mySc.indicators[ind.id] : null;
                        if(vals) {
                            uTotal += window.scoreNumber(vals.k, 'k') + window.scoreNumber(vals.p, 'p') + window.scoreNumber(vals.a, 'a');
                        }
                    });
                }
                trHtml += `<td>${uTotal || ''}</td>`;
            }
        });

        if(printMid) trHtml += `<td>${window.scoreDisplayValue(mySc.midTermScore, '', 'midTermScore')}</td>`;
        if(printFinal) trHtml += `<td>${window.scoreDisplayValue(mySc.finalScore, '', 'finalScore')}</td>`;

        if(printTotal) {
            let total = window.getStudentTotalScore(s, subId, cId, state.term);
            let grade = window.calculateGrade(total, DB.gradeSettings);
            sumGrade += Number(grade);
            if(total >= DB.gradeSettings.passThreshold) passCount++;
            trHtml += `<td class="font-bold">${total}</td><td class="font-bold">${grade}</td>`;
        }

        trHtml += `</tr>`;
        tableHtml += trHtml;
    });
    tableHtml += `</tbody></table>`;

    let avgGrade = cls.students.length && printTotal ? (sumGrade / cls.students.length).toFixed(2) : '0.00';
    let titleHtml = `
        <h3 class="text-lg mt-1 font-bold">รายงานผลการเรียน ภาคเรียนที่ ${state.term} ปีการศึกษา ${DB.schoolInfo.year}</h3>
        <p class="mt-1">วิชา ${sub.name} ${sub.code ? `รหัสวิชา ${sub.code}` : ''} ชั้น ${cls.name}</p>
    `;

    let reportHtml = window.generatePrintHTML(titleHtml, tableHtml, cls.students.length, printTotal ? passCount : '-', printTotal ? avgGrade : '-', sub, teacher);
    window.openPrintWindow(reportHtml);
}

window.renderTeacherScoring = function(container) {
    const sub = DB.subjects.find(x => x.id === state.subjId);
    const cls = DB.classes[state.clsId];
    const scoreHubPage = state.user && state.user.role === 'admin' ? 'admin_scoring' : 'teacher_classes';
    if(!sub || !cls) { window.navigate(scoreHubPage); return; }

    // ป้องกันครูเข้าถึงห้องที่ตนเองไม่ได้รับมอบหมาย
    if(state.user && state.user.role === 'teacher') {
        const teacher = (DB.teachers || []).find(t => t.id === state.user.id);
        const asg = teacher ? window.getTeacherAssignments(teacher, state.term) : null;
        const allowedClassIds = (asg && Array.isArray(asg[state.subjId])) ? asg[state.subjId].map(String) : [];
        if(!allowedClassIds.includes(String(state.clsId))) {
            if(window.notify) window.notify('คุณไม่มีสิทธิ์เข้าถึงห้องเรียนนี้ (ไม่ได้รับมอบหมายสอน)', true);
            window.navigate('teacher_classes');
            return;
        }
    }

    let sd = window.getSubjectData();
    let classConfig = sd.classData[state.clsId];
    let termUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term));
    
    // A class with no units yet for this term starts from the grade's structure. A class that
    // already has units is never rebuilt from another class here: it used to be replaced by
    // whichever same-grade class had more units, taking that class's indicators instead of its
    // own - and every score typed under its own indicator ids vanished from the table.
    let gradeLevel = window.structureGradeOf(cls);
    let bestPeerUnits = [];
    let bestPeerExam = null;
    for (let [otherCId, otherCls] of Object.entries(DB.classes)) {
        if (otherCId !== state.clsId && window.structureGradeOf(otherCls) === gradeLevel && sd.classData[otherCId]) {
            let otherUnits = window.termUnitsOfConfig(sd.classData[otherCId], state.term);
            if (otherUnits.length > bestPeerUnits.length) {
                bestPeerUnits = otherUnits;
                bestPeerExam = sd.classData[otherCId].examSettings ? sd.classData[otherCId].examSettings[state.term] : null;
            }
        }
    }
    if (bestPeerUnits.length > 0) {
        if (termUnits.length === 0) {
            if(!sd.classData[state.clsId]) sd.classData[state.clsId] = { learningUnits: [], examSettings: {} };
            sd.classData[state.clsId].learningUnits = (sd.classData[state.clsId].learningUnits||[]).filter(u => String(u.term) !== String(state.term));
            sd.classData[state.clsId].learningUnits.push(...JSON.parse(JSON.stringify(bestPeerUnits)));
            if (bestPeerExam) {
                if(!sd.classData[state.clsId].examSettings) sd.classData[state.clsId].examSettings = {};
                sd.classData[state.clsId].examSettings[state.term] = JSON.parse(JSON.stringify(bestPeerExam));
            }
            if(typeof window.markStructureClassDirty === 'function') window.markStructureClassDirty(state.subjId, state.clsId);
            window.saveDB();
            termUnits = (sd.classData[state.clsId].learningUnits||[]).filter(u => String(u.term) === String(state.term));
        }
    }

    $('page-title').innerText = `${sub.name}`;
    $('header-term-display').innerHTML = `ห้อง ${cls.name} <span class="mx-2 opacity-50">|</span> เทอม ${state.term}`;

    window.acquireScoreLock(true);
    let html = `
        ${window.renderScoreEntryStatusBanner(false)}
        ${window.renderScoreLockBannerHtml()}
        <div class="flex flex-col lg:flex-row gap-3 mb-6 items-center justify-between bg-white p-3 rounded-2xl shadow-sm border border-slate-200 animate-fade-in-up">
            <div class="flex gap-2 w-full lg:w-auto overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
                <button onclick="window.navigate('${scoreHubPage}')" class="tactile-btn bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center shrink-0"><i class="ph ph-arrow-left mr-2"></i> กลับ</button>
                <button data-score-write-action onclick="window.t_showUnitConfig()" class="tactile-btn bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 px-4 py-2.5 rounded-xl flex items-center font-bold shrink-0 shadow-sm"><i class="ph ph-list-numbers mr-2 text-lg"></i> โครงสร้างคะแนน</button>
                <button data-score-write-action onclick="window.t_clearScores()" class="tactile-btn bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 px-4 py-2.5 rounded-xl flex items-center font-bold shrink-0 shadow-sm"><i class="ph ph-eraser mr-2 text-lg"></i> ล้างคะแนน</button>
            </div>
            
            <div class="flex gap-2 w-full lg:w-auto justify-end overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
                <button onclick="window.t_showExcelExportOptions()" class="tactile-btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2.5 rounded-xl border border-emerald-100 flex items-center font-bold text-sm shrink-0 shadow-sm"><i class="ph ph-file-xls mr-1.5 text-lg"></i> ส่งออก Excel</button>
                <label data-score-write-action class="tactile-btn bg-emerald-500 text-white hover:bg-emerald-600 px-4 py-2.5 rounded-xl flex items-center font-bold text-sm cursor-pointer mb-0 shrink-0 shadow-sm shadow-emerald-200">
                    <i class="ph ph-upload-simple mr-1.5 text-lg"></i> นำเข้าคะแนน
                    <input type="file" accept=".csv, .xlsx" class="hidden" onchange="window.t_importScores(event)">
                </label>
                
                <div class="w-px h-8 bg-slate-200 mx-1 hidden lg:block"></div>

                <button onclick="window.t_showAnnualSummary()" class="tactile-btn bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 px-4 py-2.5 rounded-xl flex items-center font-bold shrink-0 shadow-sm"><i class="ph ph-calendar-check mr-2 text-lg"></i> สรุปรายปี</button>
                <button onclick="window.t_showPrintSelection()" class="tactile-btn bg-slate-800 text-white hover:bg-slate-900 px-4 py-2.5 rounded-xl shadow-lg shadow-slate-300 flex items-center font-bold shrink-0"><i class="ph ph-printer mr-2 text-lg"></i> พิมพ์ ปพ.</button>
                <div id="score-autosave-status" class="px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 bg-slate-50 text-slate-500 border-slate-200"><i class="ph ph-floppy-disk text-base"></i><span>บันทึกอัตโนมัติพร้อม</span></div>
                <button id="t-force-save-btn" data-score-write-action onclick="window.t_forceSave()" class="tactile-btn bg-primary-gradient text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-200 flex items-center font-black shrink-0"><i class="ph ph-floppy-disk mr-2 text-xl"></i> บันทึก</button>
            </div>
        </div>

        <div id="hidden-scores-banner"></div>
        <div id="over-100-warning-banner-container" class="hidden"></div>
        <div class="modern-card scorebook-card overflow-hidden border-t-4 border-indigo-500 animate-fade-in-up stagger-1" id="score-table-container">
        </div>
    `;
    container.innerHTML = html;
    if(typeof window.subscribeActiveScoreSubject === 'function') {
        window.subscribeActiveScoreSubject(state.subjId, state.clsId, state.term);
    }
    window.t_renderScoreTable();
}

window.getModalScrollSnapshot = function() {
    const mc = $('modal-content');
    const inner = $('unit-config-scroll');
    return {
        top: mc ? (mc.scrollTop || 0) : 0,
        innerTop: inner ? (inner.scrollTop || 0) : 0
    };
}

window.restoreModalScrollSnapshot = function(snapshot = {}, anchorId = '') {
    const mc = $('modal-content');
    if(!mc) return;
    requestAnimationFrame(() => {
        const inner = $('unit-config-scroll');
        const scroller = inner || mc;
        if(anchorId) {
            const target = document.getElementById(anchorId);
            if(target) {
                const scrollerRect = scroller.getBoundingClientRect();
                const targetRect = target.getBoundingClientRect();
                scroller.scrollTop = Math.max(0, scroller.scrollTop + targetRect.top - scrollerRect.top - 18);
                return;
            }
        }
        mc.scrollTop = Number(snapshot.top || 0);
        if(inner) inner.scrollTop = Number(snapshot.innerTop || 0);
    });
}

window.t_showUnitConfig = function(options = {}) {
    if(!window.ensureCanEditScorebook()) return;
    const sd = window.getSubjectData();
    const classConfig = sd.classData[state.clsId];
    const cls = DB.classes[state.clsId];
    const gradeLevel = cls ? cls.name.split('/')[0].trim() : '';
    const sameGradeClasses = Object.values(DB.classes || {}).filter(c => c.name && c.name.split('/')[0].trim() === gradeLevel);
    const peerGradeClasses = sameGradeClasses.filter(c => c.id !== state.clsId);
    
    let termUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term));
    let ex = classConfig.examSettings ? classConfig.examSettings[state.term] : {mid:20, final:30};
    if(!ex) ex = {mid:20, final:30};

    let totalUnitScore = 0;
    termUnits.forEach(u => {
        if(u.indicators) {
            u.indicators.forEach(i => {
                totalUnitScore += Number(i.max_k||0) + Number(i.max_p||0) + Number(i.max_a||0);
            });
        }
    });
    let totalOverall = totalUnitScore + Number(ex.mid) + Number(ex.final);
    let totalColor = totalOverall > 100 ? 'text-rose-600 bg-rose-50' : (totalOverall === 100 ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50');

    let gradeBanner = '';
    if (gradeLevel && sameGradeClasses.length > 1) {
        gradeBanner = `
        <div class="mb-4 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shrink-0">
                    ${gradeLevel}
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black text-indigo-700">โครงสร้างระดับชั้น ${gradeLevel}</span>
                        <span class="text-xs text-slate-500 font-semibold">(${sameGradeClasses.length} ห้อง: ${sameGradeClasses.map(c => c.name).join(', ')})</span>
                    </div>
                    <div class="text-[11px] text-indigo-900/80 font-medium">การเพิ่ม/แก้ไขหน่วยหรือตัวชี้วัด จะส่งไปห้องที่ใช้โครงสร้างเดียวกันในระดับชั้นนี้ ระบบไม่ลบตัวชี้วัดที่ห้องอื่นมีคะแนนแล้ว</div>
                </div>
            </div>
            ${peerGradeClasses.length > 0 ? `
            <button type="button" onclick="window.t_forceSyncGradeStructure()" class="tactile-btn bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm flex items-center shrink-0 transition-colors">
                <i class="ph ph-arrows-clockwise text-base mr-1.5 font-bold"></i> ซิงค์โครงสร้างนี้ไปทุกห้อง [${gradeLevel}]
            </button>
            ` : ''}
        </div>`;
    }

    let uh = `
    ${gradeBanner}
    <div class="mb-5 p-4 rounded-xl flex justify-between items-center border border-slate-200 shadow-sm bg-white">
        <span class="font-extrabold text-slate-700 flex items-center"><i class="ph ph-calculator mr-2 text-indigo-500 text-xl"></i> คะแนนรวมโครงสร้าง:</span>
        <span class="text-2xl font-black px-4 py-1 rounded-lg border border-transparent ${totalColor}">${totalOverall} <span class="text-sm font-bold opacity-70">/ 100</span></span>
    </div>
    ${totalOverall > 100 ? `<div class="mb-5 -mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm font-bold text-rose-700 flex items-start gap-2">
        <i class="ph ph-warning-circle text-lg mt-0.5"></i>
        <span>คะแนนรวมเกินไป <b>${totalOverall - 100}</b> คะแนน — ลดคะแนนตัวชี้วัดหรือคะแนนสอบให้รวมไม่เกิน 100
        <span class="block font-semibold text-rose-600/80">แก้ไขช่องไหนก็ได้ ระบบจะรับค่าที่ทำให้คะแนนรวมลดลงเสมอ</span></span>
    </div>` : ''}
    <div id="unit-config-scroll" class="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">`;
    
    termUnits.forEach((u, uidx) => {
        uh += `<div id="unit-config-${u.id}" class="border border-slate-200 rounded-2xl p-5 mb-5 bg-slate-50/50 shadow-sm relative group overflow-hidden">
            <div class="absolute left-0 top-0 w-1.5 h-full bg-indigo-400 opacity-50"></div>
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <strong class="text-indigo-900 text-lg font-extrabold flex items-center bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-100"><i class="ph ph-bookmark-simple text-indigo-500 mr-2"></i> ${u.name}</strong>
                <div class="flex gap-2 w-full sm:w-auto">
                    <button onclick="window.t_addIndi('${u.id}')" class="tactile-btn flex-1 sm:flex-none text-sm bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold px-3 py-1.5 rounded-lg shadow-sm"><i class="ph ph-plus font-bold"></i> ตัวชี้วัด</button>
                    <button onclick="window.t_delUnit('${u.id}')" class="tactile-btn text-sm text-rose-500 hover:text-white hover:bg-rose-500 bg-white border border-rose-200 font-bold px-3 py-1.5 rounded-lg shadow-sm"><i class="ph ph-trash"></i> ลบหน่วย</button>
                </div>
            </div>
            <div class="overflow-x-auto custom-scrollbar bg-white rounded-xl border border-slate-200 shadow-sm">
                <table class="w-full text-sm text-left min-w-max">
                    <thead class="bg-slate-50 border-b border-slate-200 text-slate-500"><tr><th class="p-3 font-extrabold">ชื่อตัวชี้วัด / มาตรฐาน</th><th class="p-3 w-20 text-center font-extrabold text-indigo-600">K</th><th class="p-3 w-20 text-center font-extrabold text-purple-600">P</th><th class="p-3 w-20 text-center font-extrabold text-amber-600">A</th><th class="p-3 w-12 text-center"></th></tr></thead>
                    <tbody class="divide-y divide-slate-100">`;
        if(u.indicators) {
            u.indicators.forEach((ind, iidx) => {
                uh += `<tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-2"><input type="text" class="w-full border-none bg-transparent focus:ring-2 focus:ring-indigo-200 rounded p-1.5 font-bold text-slate-700" value="${ind.name}" onchange="window.t_updIndi('${u.id}',${iidx},'name',this.value)" placeholder="ระบุชื่อตัวชี้วัด"></td>
                    <td class="p-2 border-l border-slate-100"><input type="number" class="w-full border-none bg-transparent focus:ring-2 focus:ring-indigo-200 rounded p-1.5 text-center font-black text-indigo-600" value="${ind.max_k}" onchange="window.t_updIndi('${u.id}',${iidx},'max_k',this.value)"></td>
                    <td class="p-2 border-l border-slate-100"><input type="number" class="w-full border-none bg-transparent focus:ring-2 focus:ring-purple-200 rounded p-1.5 text-center font-black text-purple-600" value="${ind.max_p}" onchange="window.t_updIndi('${u.id}',${iidx},'max_p',this.value)"></td>
                    <td class="p-2 border-l border-slate-100"><input type="number" class="w-full border-none bg-transparent focus:ring-2 focus:ring-amber-200 rounded p-1.5 text-center font-black text-amber-600" value="${ind.max_a}" onchange="window.t_updIndi('${u.id}',${iidx},'max_a',this.value)"></td>
                    <td class="p-2 border-l border-slate-100 text-center"><button onclick="window.t_delIndi('${u.id}',${iidx})" class="text-slate-300 hover:text-rose-500 hover:bg-rose-50 w-8 h-8 rounded-lg flex items-center justify-center transition-colors mx-auto"><i class="ph ph-x font-bold"></i></button></td>
                </tr>`;
            });
        }
        uh += `</tbody></table></div></div>`;
    });
    uh += `</div>
        <form class="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row gap-3" onsubmit="event.preventDefault(); window.t_addUnit();">
            <div class="relative flex-1">
                <i class="ph ph-bookmark-simple absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input type="text" id="inp-new-unit" placeholder="ระบุชื่อหน่วยการเรียนรู้ใหม่" class="w-full border border-slate-300 rounded-xl p-3 pl-9 focus-ring font-bold bg-white shadow-inner" required>
            </div>
            <button type="submit" class="tactile-btn bg-slate-800 text-white font-bold px-6 py-3 rounded-xl shadow-md whitespace-nowrap flex items-center justify-center"><i class="ph ph-plus-circle mr-2 text-xl"></i> เพิ่มหน่วย</button>
        </form>
        
        <div class="mt-6 p-5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 shadow-sm flex flex-col sm:flex-row gap-6 items-center justify-between relative overflow-hidden">
            <i class="ph ph-exam absolute -right-4 -bottom-4 text-amber-500 opacity-10 text-8xl"></i>
            <div class="relative z-10 w-full sm:w-auto">
                <h4 class="text-base font-extrabold text-amber-900 mb-1 flex items-center"><i class="ph ph-exam mr-2"></i> ตั้งค่าการสอบ</h4>
                <p class="text-xs font-medium text-amber-700/80">คะแนนเต็มที่จะใช้ประเมินผล</p>
            </div>
            <div class="flex gap-4 w-full sm:w-auto relative z-10">
                <div class="flex-1 sm:flex-none">
                    <label class="text-[11px] uppercase tracking-wider text-amber-800 font-extrabold block mb-1.5 ml-1">สอบกลางภาค</label>
                    <input type="number" id="inp-max-mid" value="${ex.mid}" class="w-full sm:w-24 border-0 rounded-xl p-2.5 text-center font-black text-amber-900 bg-white shadow-inner focus:ring-2 focus:ring-amber-400" onchange="window.t_updExam('mid',this.value)">
                </div>
                <div class="flex-1 sm:flex-none">
                    <label class="text-[11px] uppercase tracking-wider text-amber-800 font-extrabold block mb-1.5 ml-1">สอบปลายภาค</label>
                    <input type="number" id="inp-max-fin" value="${ex.final}" class="w-full sm:w-24 border-0 rounded-xl p-2.5 text-center font-black text-amber-900 bg-white shadow-inner focus:ring-2 focus:ring-amber-400" onchange="window.t_updExam('final',this.value)">
                </div>
            </div>
        </div>
    `;

    window.showModal(`
        <div class="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
            <h3 class="text-2xl font-extrabold text-slate-800 flex items-center"><div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mr-3 shadow-inner"><i class="ph ph-list-numbers text-xl"></i></div> โครงสร้างคะแนน</h3>
            <button onclick="window.hideModal(); window.t_renderScoreTable();" class="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-10 h-10 flex items-center justify-center transition-colors"><i class="ph ph-x text-xl font-bold"></i></button>
        </div>
        ${uh}
        <div class="mt-6 flex justify-end">
            <button onclick="window.hideModal(); window.t_renderScoreTable();" class="tactile-btn bg-primary-gradient text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200">เสร็จสิ้น</button>
        </div>
    `, 'max-w-4xl');
    if(options.preserveScroll) window.restoreModalScrollSnapshot(options.snapshot || {}, options.anchorId || '');
}

window.t_forceSyncGradeStructure = function() {
    if(!window.ensureCanEditScorebook()) return;
    const cls = DB.classes[state.clsId];
    if(!cls) return;
    const gradeLevel = cls.name.split('/')[0].trim();
    const peerRooms = Object.values(DB.classes).filter(c => c.name && c.name.split('/')[0].trim() === gradeLevel && c.id !== state.clsId);
    if(peerRooms.length === 0) {
        window.notify(`ระดับชั้น ${gradeLevel} มีห้องนี้เพียงห้องเดียว`, false);
        return;
    }
    window.showCustomConfirm(
        `ซิงค์โครงสร้างคะแนนทั้งระดับชั้น ${gradeLevel}`,
        `ต้องการส่งหน่วยการเรียนรู้ ตัวชี้วัด และคะแนนสอบของห้อง <b>${cls.name}</b> ไปยังทุกห้องในระดับชั้น <b>${gradeLevel}</b> (${peerRooms.map(r => r.name).join(', ')}) หรือไม่?<br><span class="text-xs text-slate-500 mt-2 block">ห้องอื่นจะได้หน่วยและตัวชี้วัดของห้องนี้เพิ่มเข้าไป ส่วนหน่วยหรือตัวชี้วัดที่ห้องนั้นมีอยู่เดิมจะไม่ถูกลบ คะแนนที่กรอกไว้แล้วจึงไม่หาย</span>`,
        'primary',
        () => {
            const count = window.syncClassConfigToSameGrade({ forceAll: true });
            window.saveDBWithFeedback(`โครงสร้างทั้งระดับชั้น (${count} ห้อง)`);
            window.notify(count > 0 ? `ส่งโครงสร้างคะแนนไปยัง ${count} ห้องในระดับชั้น ${gradeLevel} เรียบร้อยแล้ว` : `ทุกห้องในระดับชั้น ${gradeLevel} มีโครงสร้างนี้ครบอยู่แล้ว`, false);
            window.refreshUnitConfigModal();
        },
        () => window.refreshUnitConfigModal()
    );
};

window.refreshUnitConfigModal = function(anchorUnitId = '') {
    const snapshot = window.getModalScrollSnapshot();
    window.t_showUnitConfig({
        preserveScroll: true,
        snapshot,
        anchorId: anchorUnitId ? `unit-config-${anchorUnitId}` : ''
    });
}

window.t_addUnit = function() {
    if(!window.ensureCanEditScorebook()) return;
    const input = $('inp-new-unit');
    let v = input ? input.value.trim() : '';
    if(v) {
        // getSubjectData() makes sure the class has a learningUnits list to add to
        let sd = window.getSubjectData();
        const newUnitId = generateId();
        sd.classData[state.clsId].learningUnits.push({ id: newUnitId, name: v, term: String(state.term), indicators: [] });
        let syncCount = window.syncClassConfigToSameGrade();
        window.refreshUnitConfigModal(newUnitId);
        window.saveDBWithFeedback(syncCount > 0 ? `หน่วยการเรียนรู้ (ซิงค์ ${syncCount} ห้อง)` : 'หน่วยการเรียนรู้');
    }
}

// Before a deletion, every class's scores for this subject are read from the cloud, so the
// check for scores in the other rooms of the grade does not depend on which rooms this device
// happened to open. Resolves true only when the cloud answered in full.
window.loadSubjectScoresForStructureCheck = async function() {
    if(typeof window.firebaseLoadScoresForSubjectsBulk !== 'function') return false;
    try {
        const result = await window.withCloudWriteTimeout(window.firebaseLoadScoresForSubjectsBulk([state.subjId]), 15000, 'score check');
        return !!(result && result.attempted && result.failed === 0);
    } catch(err) {
        console.warn('Score check before structure deletion failed:', err);
        return false;
    }
}

// Same-grade rooms that hold these units/indicators and have a score in them - a deletion
// leaves these rooms' copies in place
window.peerRoomsScoredIn = function(ids) {
    const wanted = new Set((ids || []).map(String));
    const sd = window.getSubjectData();
    const grade = window.structureGradeOf(DB.classes[state.clsId]);
    const rooms = [];
    Object.entries(DB.classes).forEach(([cId, c]) => {
        if(cId === state.clsId || window.structureGradeOf(c) !== grade || !sd.classData[cId]) return;
        const indIds = [];
        window.termUnitsOfConfig(sd.classData[cId], state.term).forEach(u => (u.indicators || []).forEach(i => {
            if(wanted.has(String(u.id)) || wanted.has(String(i.id))) indIds.push(String(i.id));
        }));
        if(window.indicatorIdsWithScores(sd, cId, state.term, indIds).size > 0) rooms.push(c.name);
    });
    return rooms;
}

// Removes units/indicators from the open class (already done by the caller), then carries the
// deletion to the rooms that share the structure - never to a room with a score in them.
window.finishStructureDeletion = function(removedIds, peerScoresKnown, label) {
    window.rememberStructureRemovals(state.subjId, state.clsId, removedIds);
    const syncCount = window.syncClassConfigToSameGrade({ removedIds, peerScoresKnown });
    const kept = (window.lastStructureSync && window.lastStructureSync.keptDeleted) || [];
    window.refreshUnitConfigModal();
    window.saveDBWithFeedback(syncCount > 0 ? `${label} (ซิงค์ ${syncCount} ห้อง)` : label);
    if(kept.length > 0) {
        setTimeout(() => window.notify(peerScoresKnown
            ? `ห้อง ${kept.join(', ')} มีคะแนนในส่วนที่ลบแล้ว จึงยังเก็บไว้ในห้องนั้น คะแนนไม่หาย`
            : `ตรวจคะแนนห้องอื่นจากคลาวด์ไม่ได้ จึงลบเฉพาะห้องนี้ (${kept.join(', ')} ยังเก็บไว้)`, true), 2500);
    }
}

window.t_delUnit = async function(uid) {
    if(!window.ensureCanEditScorebook()) return;
    const unit = ((window.getSubjectData().classData[state.clsId] || {}).learningUnits || []).find(x => x.id === uid);
    if(!unit) return;
    window.notify('กำลังตรวจคะแนนของทุกห้องก่อนลบ...');
    const peerScoresKnown = await window.loadSubjectScoresForStructureCheck();
    const ids = [String(uid)].concat((unit.indicators || []).map(ind => String(ind.id)));
    const scored = window.countStudentsScoredInIndicators(ids.slice(1));
    const peerRooms = peerScoresKnown ? window.peerRoomsScoredIn(ids) : [];
    window.showCustomConfirm('ลบหน่วยการเรียนรู้',
        'ต้องการลบหน่วยการเรียนรู้นี้พร้อมตัวชี้วัดทั้งหมดหรือไม่?' +
        (scored > 0 ? `\n<span class="text-rose-600 font-bold">ห้องนี้มีนักเรียน ${scored} คนที่กรอกคะแนนในหน่วยนี้แล้ว คะแนนเหล่านี้จะไม่ถูกนับอีก</span>` : '') +
        (peerRooms.length > 0 ? `\n<span class="text-slate-600 font-bold">ห้อง ${peerRooms.join(', ')} มีคะแนนในหน่วยนี้ ระบบจะไม่ลบในห้องนั้น</span>` : ''),
        'danger', () => {
        let sd = window.getSubjectData();
        const config = sd.classData[state.clsId];
        // Find it again by id - the structure may have changed while the dialog was open
        const fresh = config.learningUnits.find(x => x.id === uid);
        if(!fresh) { window.refreshUnitConfigModal(); return; }
        const removedIds = [String(uid)].concat((fresh.indicators || []).map(ind => String(ind.id)));
        config.learningUnits = config.learningUnits.filter(x => x.id !== uid);
        window.finishStructureDeletion(removedIds, peerScoresKnown, 'การลบหน่วยการเรียนรู้');
    },
    // The confirmation replaces the structure dialog - bring it back on cancel
    () => window.refreshUnitConfigModal());
}
window.t_addIndi = function(uid) {
    if(!window.ensureCanEditScorebook()) return;
    let sd = window.getSubjectData();
    let u = sd.classData[state.clsId].learningUnits.find(x => x.id === uid);
    if(u) {
        if(!u.indicators) u.indicators = [];
        u.indicators.push({ id: generateId(), name:'ตัวชี้วัดใหม่', max_k:0, max_p:0, max_a:0 });
        window.syncClassConfigToSameGrade();
        window.refreshUnitConfigModal();
        window.saveDBWithFeedback('ตัวชี้วัด');
    }
}
// Sum of every K/P/A indicator max plus the midterm/final max for one class's score
// structure - used by guardStructureTotal to judge whether an edit raises or lowers it.
window.calcClassScoreStructureTotal = function(classConfig, term) {
    const termUnits = (classConfig.learningUnits || []).filter(u => String(u.term) === String(term));
    let total = 0;
    termUnits.forEach(u => {
        (u.indicators || []).forEach(i => {
            total += Number(i.max_k || 0) + Number(i.max_p || 0) + Number(i.max_a || 0);
        });
    });
    const ex = (classConfig.examSettings && classConfig.examSettings[term]) || { mid: 20, final: 30 };
    total += Number(ex.mid || 0) + Number(ex.final || 0);
    return total;
}

// Guard for any edit to the score structure. A structure can already be over 100 -
// from older data or a subject copied between classes - and blocking every edit in
// that state leaves the teacher stuck, unable to lower anything. So only an edit that
// pushes the total further up is refused; anything that brings it down is allowed
// through with a reminder of how much is still left to cut.
// `before` is the total measured before the new value was written in.
window.guardStructureTotal = function(classConfig, term, before) {
    const after = window.calcClassScoreStructureTotal(classConfig, term);
    if(after > 100 && after > before) {
        window.notify(`คะแนนรวมโครงสร้างทั้งหมดต้องไม่เกิน 100 คะแนน (ค่าที่กรอกจะทำให้รวมเป็น ${after})`, true);
        return false;
    }
    if(after > 100) {
        window.notify(`บันทึกแล้ว แต่คะแนนรวมยังเกินอยู่ ${after} คะแนน ต้องลดอีก ${after - 100} คะแนน`, true);
    }
    return true;
}

window.t_updIndi = function(uid, idx, field, val) {
    if(!window.ensureCanEditScorebook()) return;
    let sd = window.getSubjectData();
    let classConfig = sd.classData[state.clsId];
    let u = classConfig.learningUnits.find(x => x.id === uid);
    if(u && u.indicators[idx]) {
        if(field === 'name') {
            u.indicators[idx][field] = val;
        } else {
            const oldValue = Number(u.indicators[idx][field] || 0);
            const before = window.calcClassScoreStructureTotal(classConfig, state.term);
            let newValue = Number(val);
            if(!Number.isFinite(newValue) || newValue < 0) newValue = 0;
            u.indicators[idx][field] = newValue;
            if(!window.guardStructureTotal(classConfig, state.term, before)) {
                u.indicators[idx][field] = oldValue;
                window.refreshUnitConfigModal();
                return;
            }
        }
        window.syncClassConfigToSameGrade();
        window.refreshUnitConfigModal();
        window.saveDBWithFeedback(field === 'name' ? 'ชื่อตัวชี้วัด' : 'คะแนนเต็มตัวชี้วัด');
    }
}
// Students of the open class who already have a K/P/A score in any of these indicators. A
// deletion no longer reaches another room that has scores in them (see
// syncClassConfigToSameGrade), so only this room's students are counted.
window.countStudentsScoredInIndicators = function(indIds) {
    const ids = Array.from(new Set((indIds || []).map(String)));
    if(!DB.classes[state.clsId] || ids.length === 0) return 0;
    const sd = window.getSubjectData();
    let count = 0;
    Object.values((sd.scores || {})[state.clsId] || {}).forEach(stuNode => {
        const inds = (((stuNode || {})[state.term]) || {}).indicators || {};
        const hasScore = ids.some(id => ['k', 'p', 'a'].some(t => window.normalizeScoreValue((inds[id] || {})[t], t) !== ''));
        if(hasScore) count++;
    });
    return count;
}

// The × beside an indicator used to delete it on a single click with no confirmation. Its
// scores stay in the cloud but are tied to the indicator's id, which a re-created indicator
// never gets back - one misclick made a whole column of scores vanish from every total.
window.t_delIndi = async function(uid, idx) {
    if(!window.ensureCanEditScorebook()) return;
    const sd = window.getSubjectData();
    const u = sd.classData[state.clsId].learningUnits.find(x => x.id === uid);
    const ind = u && u.indicators ? u.indicators[idx] : null;
    if(!ind) return;
    window.notify('กำลังตรวจคะแนนของทุกห้องก่อนลบ...');
    const peerScoresKnown = await window.loadSubjectScoresForStructureCheck();
    const scored = window.countStudentsScoredInIndicators([ind.id]);
    const peerRooms = peerScoresKnown ? window.peerRoomsScoredIn([ind.id]) : [];
    const name = window.escapeHtml ? window.escapeHtml(ind.name || '') : (ind.name || '');
    window.showCustomConfirm('ลบตัวชี้วัด',
        `ต้องการลบตัวชี้วัด "${name}" หรือไม่?` +
        (scored > 0 ? `\n<span class="text-rose-600 font-bold">ห้องนี้มีนักเรียน ${scored} คนที่กรอกคะแนนตัวชี้วัดนี้แล้ว คะแนนเหล่านี้จะไม่ถูกนับอีก</span>` : '') +
        (peerRooms.length > 0 ? `\n<span class="text-slate-600 font-bold">ห้อง ${peerRooms.join(', ')} มีคะแนนในตัวชี้วัดนี้ ระบบจะไม่ลบในห้องนั้น</span>` : ''),
        'danger', () => {
            // Find it again by id - the list may have been refreshed while the dialog was open,
            // and deleting by position would then remove a different indicator
            const freshUnit = window.getSubjectData().classData[state.clsId].learningUnits.find(x => x.id === uid);
            const at = freshUnit && freshUnit.indicators ? freshUnit.indicators.findIndex(x => x.id === ind.id) : -1;
            if(at < 0) { window.refreshUnitConfigModal(); return; }
            freshUnit.indicators.splice(at, 1);
            window.finishStructureDeletion([String(ind.id)], peerScoresKnown, 'การลบตัวชี้วัด');
        },
        // The confirmation replaces the structure dialog - bring it back on cancel
        () => window.refreshUnitConfigModal());
}
window.t_updExam = function(type, val) {
    if(!window.ensureCanEditScorebook()) return;
    let sd = window.getSubjectData();
    let classConfig = sd.classData[state.clsId];
    if(!classConfig.examSettings) classConfig.examSettings = {};
    if(!classConfig.examSettings[state.term]) classConfig.examSettings[state.term] = {mid:20, final:30};
    const oldValue = Number(classConfig.examSettings[state.term][type] || 0);
    const before = window.calcClassScoreStructureTotal(classConfig, state.term);
    let newValue = Number(val);
    if(!Number.isFinite(newValue) || newValue < 0) newValue = 0;
    classConfig.examSettings[state.term][type] = newValue;
    if(!window.guardStructureTotal(classConfig, state.term, before)) {
        classConfig.examSettings[state.term][type] = oldValue;
        window.refreshUnitConfigModal();
        return;
    }
    window.syncClassConfigToSameGrade();
    window.refreshUnitConfigModal();
    window.saveDBWithFeedback(type === 'final' ? 'คะแนนเต็มปลายภาค' : 'คะแนนเต็มกลางภาค');
}

window.t_fillAllCol = function(cat, indId, type, maxVal) {
    if(!window.ensureCanEditScorebook()) return;
    const indIdParam = indId ? `'${indId}'` : 'null';
    let html = `
        <div class="-mx-8 -mt-8 bg-indigo-50 p-8 pb-10 rounded-t-[2rem] text-center border-b border-indigo-100">
            <div class="w-20 h-20 bg-white text-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-200 border border-indigo-100 transform -translate-y-4">
                <i class="ph ph-magic-wand text-5xl"></i>
            </div>
            <h3 class="text-2xl font-extrabold text-indigo-900 mb-1">เติมคะแนนทั้งแถว</h3>
            <p class="text-sm text-indigo-700/80 font-medium">คะแนนที่ระบุจะถูกเติมให้กับนักเรียนทุกคนในช่องนี้</p>
        </div>
        
        <form onsubmit="event.preventDefault(); window.t_applyBulkFill('${cat}', ${indIdParam}, '${type}', ${maxVal});" class="p-4 pt-8">
            <label class="block text-center text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">ระบุคะแนน (เต็ม <span class="text-indigo-600 text-lg">${maxVal}</span>)</label>
            <input type="number" id="bulk-fill-input" class="w-full border-0 rounded-2xl p-4 ring-2 ring-indigo-100 focus:ring-4 focus:ring-indigo-300 text-center text-4xl font-black text-indigo-700 mb-8 bg-white shadow-inner transition-all" value="${maxVal}" min="0" max="${maxVal}" step="any">
            
            <div class="flex gap-4 justify-center">
                <button type="button" onclick="window.hideModal()" class="tactile-btn flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl transition-colors">ยกเลิก</button>
                <button type="submit" class="tactile-btn flex-1 bg-primary-gradient text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-colors text-lg tracking-wide">ยืนยันการเติม</button>
            </div>
        </form>
    `;
    window.showModal(html, 'max-w-sm');
    
    setTimeout(() => {
        const inp = document.getElementById('bulk-fill-input');
        if(inp) { inp.focus(); inp.select(); }
    }, 100);
}

window.t_applyBulkFill = function(cat, indId, type, maxVal) {
    if(!window.ensureCanEditScorebook()) return;
    let inputVal = document.getElementById('bulk-fill-input').value;
    let fillVal = inputVal.trim() === '' ? '' : Number(inputVal);

    if (fillVal !== '' && isNaN(fillVal)) { window.notify('กรุณากรอกตัวเลขที่ถูกต้อง', true); return; }
    if (fillVal !== '' && fillVal < 0) fillVal = 0;
    if (fillVal !== '' && fillVal > maxVal) { window.notify(`คะแนนเต็ม ${maxVal}`, true); fillVal = maxVal; }

    const cls = DB.classes[state.clsId];
    if(!cls || cls.students.length === 0) { window.hideModal(); return; }

    let sd = window.getSubjectData();
    let scStore = sd.scores[state.clsId];
    const scoreField = cat === 'ind' ? `indicators.${indId}.${type}` : type;

    cls.students.forEach(stu => {
        let sId = stu.studentId;
        if(!scStore[sId]) scStore[sId] = {};
        if(!scStore[sId][state.term]) scStore[sId][state.term] = { indicators: {} };

        if(cat === 'ind') {
            if(!scStore[sId][state.term].indicators) scStore[sId][state.term].indicators = {};
            if(!scStore[sId][state.term].indicators[indId]) scStore[sId][state.term].indicators[indId] = {};
            scStore[sId][state.term].indicators[indId][type] = fillVal;
        } else if(cat === 'exam') {
            scStore[sId][state.term][type] = fillVal;
        }
        window.rememberScoreSafetyValue(state.subjId, state.clsId, sId, state.term, scoreField, fillVal);
        window.markScoreSubjectPending(state.subjId, state.clsId, sId);
    });

    window.saveSubjectDataLocalNow();
    window.persistScoreSafetyLogNow();
    window.setScoreAutoSaveStatus('pending', 'กำลังบันทึกอัตโนมัติ...');

    // Bulk fill can touch dozens of students at once. Writing each cell one-by-one through
    // the interactive per-cell save queue is safe but serialized (one Firestore round trip
    // after another), so it can sit in "saving" for a long time. Use one batched write
    // instead - it covers every touched cell in a couple of Firestore commits, and any
    // cell that still fails falls back to the reliable per-cell retry queue so nothing is
    // silently dropped.
    const targets = cls.students.map(stu => ({ subId: state.subjId, clsId: state.clsId, stuId: stu.studentId }));
    const fallbackToPerCellRetry = () => {
        cls.students.forEach(stu => {
            window.scheduleScoreAutoSave(state.subjId, state.clsId, stu.studentId, state.term, scoreField, fillVal);
        });
    };
    if (!window.firebaseBatchWriteScoreNodes) {
        window.saveDB();
    } else {
        window.firebaseBatchWriteScoreNodes(targets).then(result => {
            if(result && result.failed > 0) {
                window.setScoreAutoSaveStatus('error', 'บันทึกในเครื่องแล้ว บางส่วนยังไม่ขึ้นคลาวด์ กำลังลองใหม่');
                fallbackToPerCellRetry();
            } else {
                cls.students.forEach(stu => window.clearScoreSubjectPendingIfDone(state.subjId, state.clsId, stu.studentId));
                window.setScoreAutoSaveStatus('saved', 'บันทึกอัตโนมัติแล้ว');
            }
        }).catch(err => {
            console.error('Bulk fill batch save failed:', err);
            window.setScoreAutoSaveStatus('error', 'บันทึกในเครื่องแล้ว กำลังลองซิงก์อีกครั้ง');
            fallbackToPerCellRetry();
        });
    }

    if(typeof window.updateClassProgressSummaryLocal === 'function') {
        window.updateClassProgressSummaryLocal(state.subjId, state.clsId, state.term);
    }
    if(typeof window.firebaseScheduleProgressSummarySync === 'function') {
        window.firebaseScheduleProgressSummarySync(state.subjId, state.clsId, state.term);
    }
    window.hideModal(); window.t_renderScoreTable(); window.notify('เติมคะแนนเรียบร้อยแล้ว');
};

window.t_cacheSc = function(sId, indId, type, val, max, inputEl = null) {
    if(!window.ensureCanEditScorebook()) return;
    let v = val === '' ? '' : Number(val);
    const targetEl = inputEl || document.getElementById(`inp-${type}-${sId}-${indId}`);
    if(v !== '' && v < 0) {
        v = 0;
        if(targetEl) targetEl.value = 0;
    }
    if(v !== '' && v > max) {
        v = max;
        if(targetEl) targetEl.value = max;
        if(typeof window.notify === 'function') {
            window.notify(`⚠️ คะแนน${type.toUpperCase()}เต็ม ${max} คะแนน (ห้ามกรอกเกินเด็ดขาด! ปรับเป็น ${max} ให้อัตโนมัติ)`, true);
        }
    } 
    
    let scStore = window.getSubjectData().scores[state.clsId];
    if(!scStore[sId]) scStore[sId] = {};
    if(!scStore[sId][state.term]) scStore[sId][state.term] = { indicators: {} };
    if(!scStore[sId][state.term].indicators) scStore[sId][state.term].indicators = {};
    if(!scStore[sId][state.term].indicators[indId]) scStore[sId][state.term].indicators[indId] = {};
    
    scStore[sId][state.term].indicators[indId][type] = v;
    window.scheduleScoreAutoSave(state.subjId, state.clsId, sId, state.term, `indicators.${indId}.${type}`, v);
    window.updateRowTotal(sId);
};

window.t_cacheExam = function(sId, type, val, max, inputEl = null) {
    if(!window.ensureCanEditScorebook()) return;
    let v = val === '' ? '' : Number(val);
    const examLabel = type === 'midTermScore' ? 'กลางภาค' : 'ปลายภาค';
    const elId = type === 'midTermScore' ? `inp-mid-${sId}` : `inp-fin-${sId}`;
    const targetEl = inputEl || document.getElementById(elId);
    if(v !== '' && v < 0) {
        v = 0;
        if(targetEl) targetEl.value = 0;
    }
    if(v !== '' && v > max) {
        v = max;
        if(targetEl) targetEl.value = max;
        if(typeof window.notify === 'function') {
            window.notify(`⚠️ คะแนนสอบ${examLabel}เต็ม ${max} คะแนน (ห้ามกรอกเกินเด็ดขาด! ปรับเป็น ${max} ให้อัตโนมัติ)`, true);
        }
    }
    
    let scStore = window.getSubjectData().scores[state.clsId];
    if(!scStore[sId]) scStore[sId] = {};
    if(!scStore[sId][state.term]) scStore[sId][state.term] = { indicators: {} };

    scStore[sId][state.term][type] = v;
    window.scheduleScoreAutoSave(state.subjId, state.clsId, sId, state.term, type, v);
    window.updateRowTotal(sId);
};

window.getScoreUnitVisibilityKey = function() {
    return `anpscore_visible_units_${state.subjId}_${state.clsId}_${state.term}`;
}

window.getEffectiveIndicatorColumn = function(indicator, type, scoreStore = {}, term = state.term) {
    const configuredMax = Number((indicator && indicator[`max_${type}`]) || 0);
    let hasStoredScore = false;
    let observedMax = 0;

    Object.values(scoreStore || {}).forEach(studentNode => {
        if(!studentNode || typeof studentNode !== 'object') return;
        let termNode = studentNode[String(term)];
        if(!termNode && String(studentNode.term || '') === String(term)) termNode = studentNode;
        const indicatorScores = termNode && termNode.indicators ? termNode.indicators[indicator.id] : null;
        if(!indicatorScores) return;
        const rawValue = indicatorScores[type];
        if(rawValue === '' || rawValue === null || rawValue === undefined) return;
        const numericValue = Number(rawValue);
        if(!Number.isFinite(numericValue) || numericValue < 0) return;
        hasStoredScore = true;
        observedMax = Math.max(observedMax, numericValue);
    });

    const recovered = configuredMax <= 0 && hasStoredScore;
    return {
        type,
        configuredMax,
        observedMax,
        hasStoredScore,
        recovered,
        max: configuredMax > 0 ? configuredMax : (recovered ? Math.max(observedMax, 1) : 0)
    };
}

window.getVisibleScoreUnitIds = function(termUnits = []) {
    const allIds = termUnits.map(u => String(u.id));
    const key = window.getScoreUnitVisibilityKey();
    const raw = localStorage.getItem(key);
    if(raw === null) return allIds;
    try {
        const parsed = JSON.parse(raw);
        let visibleIds = [];
        let knownIds = [];
        if(Array.isArray(parsed)) {
            visibleIds = parsed.map(String);
            knownIds = parsed.map(String);
        } else if(parsed && Array.isArray(parsed.visible)) {
            visibleIds = parsed.visible.map(String);
            knownIds = Array.isArray(parsed.known) ? parsed.known.map(String) : visibleIds;
        }
        const newIds = allIds.filter(id => !knownIds.includes(id));
        return Array.from(new Set([...visibleIds.filter(id => allIds.includes(id)), ...newIds]));
    } catch(e) {}
    return allIds;
}

window.saveVisibleScoreUnitIds = function(ids = []) {
    const sd = window.getSubjectData();
    const classConfig = sd.classData[state.clsId] || {};
    const allIds = (classConfig.learningUnits||[])
        .filter(u => String(u.term) === String(state.term))
        .map(u => String(u.id));
    localStorage.setItem(window.getScoreUnitVisibilityKey(), JSON.stringify({
        visible: ids.map(String).filter(id => allIds.includes(id)),
        known: allIds
    }));
}

window.toggleScoreUnitVisibility = function(unitId, checked) {
    const sd = window.getSubjectData();
    const classConfig = sd.classData[state.clsId];
    const termUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term));
    const allIds = termUnits.map(u => String(u.id));
    const visibleSet = new Set(window.getVisibleScoreUnitIds(termUnits));
    if(checked) visibleSet.add(String(unitId));
    else visibleSet.delete(String(unitId));
    window.saveVisibleScoreUnitIds(allIds.filter(id => visibleSet.has(id)));
    window.t_renderScoreTable();
}

window.setAllScoreUnitVisibility = function(checked) {
    const sd = window.getSubjectData();
    const classConfig = sd.classData[state.clsId];
    const termUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term));
    window.saveVisibleScoreUnitIds(checked ? termUnits.map(u => String(u.id)) : []);
    window.t_renderScoreTable();
}

// Scores typed under an indicator id that this class's structure no longer has are still
// stored, but no column shows them and no total counts them - to a teacher they are simply
// gone. The grade sync overwriting whole structures left many classes like this. They are
// found here, among the class's current students, so the teacher can bring them back.
window.findHiddenScoreIndicators = function(clsId = state.clsId, term = String(state.term)) {
    const sd = window.getSubjectData();
    const here = new Set();
    window.termUnitsOfConfig(sd.classData[clsId], term).forEach(u => (u.indicators || []).forEach(i => here.add(String(i.id))));
    const roster = new Set((((DB.classes[clsId] || {}).students) || []).map(s => String(s.studentId)));
    const found = new Map();
    Object.entries((sd.scores || {})[clsId] || {}).forEach(([stuId, stuNode]) => {
        if(!roster.has(String(stuId)) || !stuNode || typeof stuNode !== 'object') return;
        let termNode = stuNode[term];
        if(stuNode.term !== undefined) termNode = String(stuNode.term) === term ? stuNode : null;
        Object.entries((termNode && termNode.indicators) || {}).forEach(([indId, vals]) => {
            if(here.has(String(indId)) || !vals || typeof vals !== 'object') return;
            const parts = ['k', 'p', 'a'].filter(t => window.normalizeScoreValue(vals[t], t) !== '');
            if(parts.length === 0) return;
            if(!found.has(indId)) found.set(indId, { id: indId, students: 0, seenMax: { k: 0, p: 0, a: 0 } });
            const entry = found.get(indId);
            entry.students++;
            parts.forEach(t => { entry.seenMax[t] = Math.max(entry.seenMax[t], Number(window.normalizeScoreValue(vals[t], t)) || 0); });
        });
    });
    if(found.size === 0) return [];
    // The indicator may still be defined somewhere in this subject - another class or term
    const defs = new Map();
    const remember = (units) => (units || []).forEach(u => (u.indicators || []).forEach(i => {
        if(found.has(String(i.id)) && !defs.has(String(i.id))) defs.set(String(i.id), { unit: u, indicator: i });
    }));
    Object.values(sd.classData || {}).forEach(cfg => remember(cfg && cfg.learningUnits));
    remember(sd.learningUnits);
    return Array.from(found.values()).map(entry => Object.assign(entry, { def: defs.get(String(entry.id)) || null }));
}

window.hiddenScoresIgnoreKey = function() {
    return [state.subjId, state.clsId, state.term].map(v => encodeURIComponent(String(v || ''))).join('|');
}

window.getIgnoredHiddenScoreIds = function() {
    try {
        const all = JSON.parse(localStorage.getItem('anpscore_hiddenScoresIgnored') || '{}');
        return new Set((all && all[window.hiddenScoresIgnoreKey()]) || []);
    } catch(e) { return new Set(); }
}

window.t_refreshHiddenScoresBanner = function() {
    const box = $('hidden-scores-banner');
    if(!box) return;
    const ignored = window.getIgnoredHiddenScoreIds();
    const hidden = window.findHiddenScoreIndicators().filter(h => !ignored.has(String(h.id)));
    if(hidden.length === 0) { box.innerHTML = ''; return; }
    const students = Math.max(...hidden.map(h => h.students));
    box.innerHTML = `
        <div class="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div class="flex items-start gap-3">
                <i class="ph ph-eye-slash text-2xl text-amber-600 mt-0.5"></i>
                <div>
                    <div class="font-extrabold text-amber-900">พบคะแนนที่กรอกไว้แล้วแต่ไม่แสดง ${hidden.length} ตัวชี้วัด (นักเรียนสูงสุด ${students} คน)</div>
                    <div class="text-xs font-medium text-amber-800 mt-0.5">คะแนนยังอยู่ครบในระบบ แต่ตัวชี้วัดเหล่านี้หายไปจากโครงสร้างคะแนนของห้องนี้ จึงไม่แสดงและไม่ถูกนับรวม</div>
                </div>
            </div>
            <div class="flex gap-2 shrink-0">
                <button data-score-write-action onclick="window.t_restoreHiddenScores()" class="tactile-btn bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm flex items-center"><i class="ph ph-arrow-counter-clockwise mr-1.5"></i> แสดงคะแนนเหล่านี้กลับมา</button>
                <button onclick="window.t_ignoreHiddenScores()" class="tactile-btn bg-white hover:bg-amber-100 border border-amber-200 text-amber-700 px-3 py-2 rounded-xl font-bold text-sm">ไม่ต้องแสดง</button>
            </div>
        </div>`;
}

window.t_ignoreHiddenScores = function() {
    try {
        const all = JSON.parse(localStorage.getItem('anpscore_hiddenScoresIgnored') || '{}') || {};
        all[window.hiddenScoresIgnoreKey()] = window.findHiddenScoreIndicators().map(h => String(h.id));
        localStorage.setItem('anpscore_hiddenScoresIgnored', JSON.stringify(all));
    } catch(e) {}
    window.t_refreshHiddenScoresBanner();
}

// Puts the hidden indicators back into this class's structure for this term - into their
// original unit when the subject still knows it, otherwise into a "คะแนนที่กู้คืน" unit with
// full marks set from the highest score found. Only this class changes; nothing is removed.
window.t_restoreHiddenScores = function() {
    if(!window.ensureCanEditScorebook()) return;
    const hidden = window.findHiddenScoreIndicators();
    if(hidden.length === 0) { window.t_refreshHiddenScoresBanner(); return; }
    const known = hidden.filter(h => h.def).length;
    window.showCustomConfirm('แสดงคะแนนที่ซ่อนอยู่กลับมา',
        `ระบบจะเพิ่มตัวชี้วัด ${hidden.length} รายการกลับเข้าโครงสร้างคะแนนของห้องนี้ คะแนนที่นักเรียนได้ไว้จะกลับมาแสดงและถูกนับรวมทันที` +
        (known < hidden.length ? `\n<span class="text-amber-700 font-bold">${hidden.length - known} รายการไม่พบชื่อเดิม จะอยู่ในหน่วย "คะแนนที่กู้คืน" และตั้งคะแนนเต็มจากคะแนนสูงสุดที่นักเรียนได้ ตรวจชื่อและคะแนนเต็มอีกครั้งที่ปุ่ม "โครงสร้างคะแนน"</span>` : '') +
        `\n<span class="text-slate-600 font-bold">ถ้าคะแนนรวมเกิน 100 ให้ลบตัวชี้วัดที่ยังไม่มีใครได้คะแนน</span>`,
        'primary', () => {
            const sd = window.getSubjectData();
            const config = sd.classData[state.clsId];
            const term = String(state.term);
            const fresh = window.findHiddenScoreIndicators();
            let recoveryUnit = null;
            const createdUnits = new Map();
            fresh.forEach(h => {
                let unit = null;
                let indicator = null;
                if(h.def) {
                    indicator = JSON.parse(JSON.stringify(h.def.indicator));
                    const defUnitId = String(h.def.unit.id);
                    unit = createdUnits.get(defUnitId)
                        || config.learningUnits.find(u => String(u.term) === term && String(u.id) === defUnitId);
                    if(!unit) {
                        // Unit ids must stay unique within the class - deleting a unit removes
                        // every unit with its id, whatever the term
                        const idTaken = config.learningUnits.some(u => String(u.id) === defUnitId);
                        unit = { id: idTaken ? generateId() : h.def.unit.id, name: h.def.unit.name, term, indicators: [] };
                        config.learningUnits.push(unit);
                        createdUnits.set(defUnitId, unit);
                    }
                } else {
                    if(!recoveryUnit) {
                        recoveryUnit = { id: generateId(), name: 'คะแนนที่กู้คืน', term, indicators: [] };
                        config.learningUnits.push(recoveryUnit);
                    }
                    unit = recoveryUnit;
                    indicator = { id: h.id, name: `ตัวชี้วัดที่กู้คืน ${unit.indicators.length + 1}`, max_k: h.seenMax.k, max_p: h.seenMax.p, max_a: h.seenMax.a };
                }
                if(!Array.isArray(unit.indicators)) unit.indicators = [];
                unit.indicators.push(indicator);
            });
            window.saveDBWithFeedback(`ตัวชี้วัดที่กู้คืน ${fresh.length} รายการ`);
            window.hideModal();
            window.t_renderScoreTable();
        },
        () => window.hideModal());
}

window.t_renderScoreTable = function() {
    let activeEl = document.activeElement;
    let activeId = activeEl && activeEl.tagName === 'INPUT' ? activeEl.id : null;
    window.t_refreshHiddenScoresBanner();

    const sd = window.getSubjectData();
    const classConfig = sd.classData[state.clsId];
    const cls = DB.classes[state.clsId];
    if(!cls || cls.students.length === 0) {
        $('score-table-container').innerHTML = `
        <div class="text-center p-20 text-slate-400 bg-slate-50 rounded-[2rem] border border-slate-200 border-dashed m-6">
            <div class="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm"><i class="ph ph-users-slash text-5xl text-slate-300"></i></div>
            <h3 class="text-xl font-extrabold text-slate-600 mb-2">ไม่มีนักเรียนในห้องนี้</h3>
            <p class="text-sm font-medium">กรุณาแจ้งผู้ดูแลระบบให้เพิ่มรายชื่อนักเรียนก่อนเริ่มกรอกคะแนน</p>
        </div>`;
        return;
    }

    let allTermUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term));
    const visibleUnitIds = window.getVisibleScoreUnitIds(allTermUnits);
    const visibleUnitSet = new Set(visibleUnitIds);
    let termUnits = allTermUnits.filter(u => visibleUnitSet.has(String(u.id)));
    let scStore = sd.scores[state.clsId] || {};
    const effectiveColumnMap = new Map();
    const recoveredUnitIds = new Set();
    let recoveredColumnCount = 0;
    allTermUnits.forEach(unit => {
        (unit.indicators || []).forEach(indicator => {
            ['k', 'p', 'a'].forEach(type => {
                const column = window.getEffectiveIndicatorColumn(indicator, type, scStore, state.term);
                effectiveColumnMap.set(`${indicator.id}|${type}`, column);
                if(column.recovered) {
                    recoveredUnitIds.add(String(unit.id));
                    recoveredColumnCount += 1;
                }
            });
        });
    });
    const getEffectiveColumn = (indicator, type) => effectiveColumnMap.get(`${indicator.id}|${type}`)
        || { type, configuredMax: 0, observedMax: 0, hasStoredScore: false, recovered: false, max: 0 };
    let ex = classConfig.examSettings ? classConfig.examSettings[state.term] : {mid:20, final:30};
    if(!ex) ex = {mid:20, final:30};

    let totalMaxScore = 0;
    allTermUnits.forEach(u => {
        if(u.indicators) u.indicators.forEach(i => {
            totalMaxScore += getEffectiveColumn(i, 'k').max + getEffectiveColumn(i, 'p').max + getEffectiveColumn(i, 'a').max;
        });
    });
    totalMaxScore += Number(ex.mid) + Number(ex.final);
    
    if(totalMaxScore > 100) {
        $('score-table-container').innerHTML = `
            <div class="text-center p-16 m-6 bg-rose-50 rounded-[2rem] border border-rose-200">
                <div class="w-24 h-24 bg-white text-rose-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><i class="ph ph-warning-circle text-6xl"></i></div>
                <h3 class="text-2xl font-black text-rose-800 mb-2 tracking-tight">โครงสร้างคะแนนเกิน 100 !</h3>
                <p class="text-rose-600 font-medium mb-6 text-lg">ปัจจุบันรวมได้ <span class="font-black">${totalMaxScore}</span> คะแนน กรุณาปรับให้พอดี 100</p>
                <button onclick="window.t_showUnitConfig()" class="tactile-btn bg-gradient-to-r from-rose-500 to-red-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-rose-200"><i class="ph ph-wrench mr-2 text-lg"></i> ไปแก้ไขโครงสร้างคะแนน</button>
            </div>`;
        return; 
    }

    let thTop = `<th rowspan="2" class="score-num-col score-sticky-num px-2 py-2 border-r border-slate-200 text-center bg-slate-50 backdrop-blur-xl bg-opacity-95 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">เลขที่</th>
                 <th rowspan="2" class="score-code-col score-sticky-code px-2 py-2 border-r border-slate-200 text-center bg-slate-50 backdrop-blur-xl bg-opacity-95 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">รหัส</th>
                 <th rowspan="2" class="score-name-col score-sticky-name px-3 py-2 border-r border-slate-200 bg-slate-50 backdrop-blur-xl bg-opacity-95 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] text-left">ชื่อ-สกุล</th>`;
    let thBot = ``;

    termUnits.forEach(u => {
        let cols = 0;
        if(u.indicators) {
            u.indicators.forEach(ind => {
                let subCols = 0;
                const colK = getEffectiveColumn(ind, 'k');
                const colP = getEffectiveColumn(ind, 'p');
                const colA = getEffectiveColumn(ind, 'a');
                if(colK.max > 0) { thBot += `<th class="score-mark-col px-1 py-1 border-r border-slate-200 text-center text-[11px] font-extrabold cursor-pointer hover:bg-indigo-100 transition-colors ${colK.recovered ? 'bg-amber-50 text-amber-800' : 'bg-white text-indigo-700'}" title="${colK.recovered ? 'กู้คืนช่องจากคะแนนเดิม • ' : ''}คลิกเพื่อเติมคะแนนให้ทุกคน (เต็ม ${colK.max})" onclick="window.t_fillAllCol('ind', '${ind.id}', 'k', ${colK.max})">K${colK.recovered ? '<i class="ph ph-warning-circle ml-0.5"></i>' : ''}<br><span class="text-[10px] opacity-60">(${colK.max})</span></th>`; subCols++; }
                if(colP.max > 0) { thBot += `<th class="score-mark-col px-1 py-1 border-r border-slate-200 text-center text-[11px] font-extrabold cursor-pointer hover:bg-purple-100 transition-colors ${colP.recovered ? 'bg-amber-50 text-amber-800' : 'bg-white text-purple-700'}" title="${colP.recovered ? 'กู้คืนช่องจากคะแนนเดิม • ' : ''}คลิกเพื่อเติมคะแนนให้ทุกคน (เต็ม ${colP.max})" onclick="window.t_fillAllCol('ind', '${ind.id}', 'p', ${colP.max})">P${colP.recovered ? '<i class="ph ph-warning-circle ml-0.5"></i>' : ''}<br><span class="text-[10px] opacity-60">(${colP.max})</span></th>`; subCols++; }
                if(colA.max > 0) { thBot += `<th class="score-mark-col px-1 py-1 border-r border-slate-200 text-center text-[11px] font-extrabold cursor-pointer hover:bg-amber-100 transition-colors ${colA.recovered ? 'bg-amber-50 text-amber-800' : 'bg-white text-amber-700'}" title="${colA.recovered ? 'กู้คืนช่องจากคะแนนเดิม • ' : ''}คลิกเพื่อเติมคะแนนให้ทุกคน (เต็ม ${colA.max})" onclick="window.t_fillAllCol('ind', '${ind.id}', 'a', ${colA.max})">A${colA.recovered ? '<i class="ph ph-warning-circle ml-0.5"></i>' : ''}<br><span class="text-[10px] opacity-60">(${colA.max})</span></th>`; subCols++; }
                cols += subCols;
            });
        }
        if(cols > 0) {
            thTop += `<th colspan="${cols}" class="px-2 py-1.5 border-r border-slate-200 border-b text-center bg-indigo-50/90 backdrop-blur-xl text-indigo-900 text-xs font-black uppercase tracking-wide" title="${u.name}"><span class="scorebook-unit-title">${u.name}</span></th>`;
        }
    });

    thTop += `<th rowspan="2" class="score-exam-col px-1 py-1 border-r border-slate-200 text-center bg-amber-50/90 backdrop-blur-xl text-amber-900 text-xs font-black cursor-pointer hover:bg-amber-100 transition-colors" title="คลิกเพื่อเติมคะแนนให้ทุกคน (เต็ม ${ex.mid})" onclick="window.t_fillAllCol('exam', null, 'midTermScore', ${ex.mid})">กลาง<br><span class="text-[10px] opacity-60">(${ex.mid})</span></th>
              <th rowspan="2" class="score-exam-col px-1 py-1 border-r border-slate-200 text-center bg-amber-50/90 backdrop-blur-xl text-amber-900 text-xs font-black cursor-pointer hover:bg-amber-100 transition-colors" title="คลิกเพื่อเติมคะแนนให้ทุกคน (เต็ม ${ex.final})" onclick="window.t_fillAllCol('exam', null, 'finalScore', ${ex.final})">ปลาย<br><span class="text-[10px] opacity-60">(${ex.final})</span></th>
              <th rowspan="2" class="score-total-col px-1 py-1 border-r border-slate-200 text-center bg-slate-100/90 backdrop-blur-xl text-slate-800 text-sm font-black shadow-inner">รวม</th>
              <th rowspan="2" class="score-grade-col px-1 py-1 text-center bg-slate-100/90 backdrop-blur-xl text-slate-800 text-sm font-black shadow-inner">เกรด</th>`;

    let tbody = ``;

    cls.students.forEach((stu, sidx) => {
        if(!scStore[stu.studentId]) scStore[stu.studentId] = {};
        let stuNode = scStore[stu.studentId];
        
        if(stuNode.term !== undefined) {
            let oldTerm = String(stuNode.term);
            let oldData = {
                indicators: stuNode.indicators || {},
                midTermScore: window.scoreDisplayValue(stuNode.midTermScore, '', 'midTermScore'),
                finalScore: window.scoreDisplayValue(stuNode.finalScore, '', 'finalScore')
            };
            scStore[stu.studentId] = {}; 
            scStore[stu.studentId][oldTerm] = oldData;
            stuNode = scStore[stu.studentId];
        }

        if(!stuNode[state.term]) stuNode[state.term] = { indicators: {}, midTermScore: '', finalScore: '' };
        let mySc = stuNode[state.term];
        if(!mySc.indicators) mySc.indicators = {};

        let tr = `<tr id="score-row-${stu.studentId}" class="hover:bg-indigo-50/40 transition-colors group">
            <td class="score-num-col score-sticky-num px-1 py-1 border-r border-b border-slate-100 text-center text-slate-500 font-medium bg-white group-hover:bg-indigo-50/90 transition-colors">${sidx+1}</td>
            <td class="score-code-col score-sticky-code px-1 py-1 border-r border-b border-slate-100 text-center font-mono text-[11px] text-slate-500 bg-white group-hover:bg-indigo-50/90 transition-colors overflow-hidden text-ellipsis">${stu.studentId || ''}</td>
            <td class="score-name-col score-sticky-name px-2 py-1 border-r border-b border-slate-100 bg-white group-hover:bg-indigo-50/90 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] whitespace-nowrap font-bold text-slate-700 transition-colors overflow-hidden text-ellipsis">${stu.name}</td>`;
        
        termUnits.forEach(u => {
            if(u.indicators) {
                u.indicators.forEach(ind => {
                    if(!mySc.indicators[ind.id]) mySc.indicators[ind.id] = {k:'', p:'', a:''}; 
                    let vals = mySc.indicators[ind.id];
                    const iId = ind.id; const sId = stu.studentId;
                    const colK = getEffectiveColumn(ind, 'k');
                    const colP = getEffectiveColumn(ind, 'p');
                    const colA = getEffectiveColumn(ind, 'a');
                    if(colK.max > 0) vals.k = window.recoverScoreCellIfMissing(state.subjId, state.clsId, sId, state.term, `indicators.${iId}.k`, vals.k, recovered => { vals.k = recovered; });
                    if(colP.max > 0) vals.p = window.recoverScoreCellIfMissing(state.subjId, state.clsId, sId, state.term, `indicators.${iId}.p`, vals.p, recovered => { vals.p = recovered; });
                    if(colA.max > 0) vals.a = window.recoverScoreCellIfMissing(state.subjId, state.clsId, sId, state.term, `indicators.${iId}.a`, vals.a, recovered => { vals.a = recovered; });
                    
                    if(colK.max > 0) tr += `<td class="score-mark-col p-0 border-r border-b border-slate-100 ${colK.recovered ? 'bg-amber-50/30' : 'bg-indigo-50/10'}"><input type="number" min="0" max="${colK.max}" id="inp-k-${sId}-${iId}" class="scorebook-input w-full text-center border-none focus:ring-2 inset-0 focus:ring-indigo-400 focus:bg-white bg-transparent font-bold text-indigo-900 transition-all placeholder-slate-300" placeholder="-" value="${window.scoreDisplayValue(vals.k, '', 'k')}" oninput="window.t_cacheSc('${sId}','${iId}','k',this.value, ${colK.max}, this)" onchange="window.t_saveSc('${sId}','${iId}','k',this.value, ${colK.max}, this)"></td>`;
                    if(colP.max > 0) tr += `<td class="score-mark-col p-0 border-r border-b border-slate-100 ${colP.recovered ? 'bg-amber-50/30' : 'bg-purple-50/10'}"><input type="number" min="0" max="${colP.max}" id="inp-p-${sId}-${iId}" class="scorebook-input w-full text-center border-none focus:ring-2 inset-0 focus:ring-purple-400 focus:bg-white bg-transparent font-bold text-purple-900 transition-all placeholder-slate-300" placeholder="-" value="${window.scoreDisplayValue(vals.p, '', 'p')}" oninput="window.t_cacheSc('${sId}','${iId}','p',this.value, ${colP.max}, this)" onchange="window.t_saveSc('${sId}','${iId}','p',this.value, ${colP.max}, this)"></td>`;
                    if(colA.max > 0) tr += `<td class="score-mark-col p-0 border-r border-b border-slate-100 ${colA.recovered ? 'bg-amber-50/30' : 'bg-amber-50/10'}"><input type="number" min="0" max="${colA.max}" id="inp-a-${sId}-${iId}" class="scorebook-input w-full text-center border-none focus:ring-2 inset-0 focus:ring-amber-400 focus:bg-white bg-transparent font-bold text-amber-900 transition-all placeholder-slate-300" placeholder="-" value="${window.scoreDisplayValue(vals.a, '', 'a')}" oninput="window.t_cacheSc('${sId}','${iId}','a',this.value, ${colA.max}, this)" onchange="window.t_saveSc('${sId}','${iId}','a',this.value, ${colA.max}, this)"></td>`;
                });
            }
        });

        mySc.midTermScore = window.recoverScoreCellIfMissing(state.subjId, state.clsId, stu.studentId, state.term, 'midTermScore', mySc.midTermScore, recovered => { mySc.midTermScore = recovered; });
        mySc.finalScore = window.recoverScoreCellIfMissing(state.subjId, state.clsId, stu.studentId, state.term, 'finalScore', mySc.finalScore, recovered => { mySc.finalScore = recovered; });

        let total = window.getStudentTotalScore(stu, state.subjId, state.clsId, state.term);
        let isOver100 = total > 100;
        let grade = isOver100 ? '!' : window.calculateGrade(total, DB.gradeSettings);
        let gradeColor = isOver100
            ? 'text-white bg-rose-600 shadow-sm animate-pulse'
            : (grade === '0' ? 'text-rose-600 bg-rose-50/50' : 'text-emerald-600 bg-emerald-50/50');
        let totalClass = isOver100
            ? 'score-total-col px-1 py-1 border-r border-b border-rose-300 text-center font-black text-rose-700 bg-rose-100 text-sm shadow-inner ring-2 ring-rose-500 animate-pulse'
            : 'score-total-col px-1 py-1 border-r border-b border-slate-100 text-center font-black text-indigo-700 bg-slate-50/80 text-sm';
        let totalTitle = isOver100 ? ` title="คะแนนรวม ${total} เกิน 100 คะแนน!"` : '';
        let gradeTitle = isOver100 ? ` title="คะแนนเกิน 100 (ได้ ${total}/100)"` : '';

        if(isOver100) {
            tr = tr.replace('hover:bg-indigo-50/40 transition-colors group', 'hover:bg-indigo-50/40 transition-colors group bg-rose-50/40 over-100-row');
        }

        tr += `
            <td class="score-exam-col p-0 border-r border-b border-slate-100 bg-amber-50/30"><input type="number" min="0" max="${ex.mid}" id="inp-mid-${stu.studentId}" class="scorebook-input w-full text-center border-none focus:ring-2 inset-0 focus:ring-amber-500 focus:bg-white bg-transparent font-bold text-amber-900 transition-all placeholder-slate-300" placeholder="-" value="${window.scoreDisplayValue(mySc.midTermScore, '', 'midTermScore')}" oninput="window.t_cacheExam('${stu.studentId}', 'midTermScore', this.value, ${ex.mid}, this)" onchange="window.t_saveExam('${stu.studentId}', 'midTermScore', this.value, ${ex.mid}, this)"></td>
            <td class="score-exam-col p-0 border-r border-b border-slate-100 bg-amber-50/30"><input type="number" min="0" max="${ex.final}" id="inp-fin-${stu.studentId}" class="scorebook-input w-full text-center border-none focus:ring-2 inset-0 focus:ring-amber-500 focus:bg-white bg-transparent font-bold text-amber-900 transition-all placeholder-slate-300" placeholder="-" value="${window.scoreDisplayValue(mySc.finalScore, '', 'finalScore')}" oninput="window.t_cacheExam('${stu.studentId}', 'finalScore', this.value, ${ex.final}, this)" onchange="window.t_saveExam('${stu.studentId}', 'finalScore', this.value, ${ex.final}, this)"></td>
            <td class="${totalClass}" id="tot-${stu.studentId}"${totalTitle}>${total}</td>
            <td class="score-grade-col px-1 py-1 border-b border-slate-100 text-center font-black text-sm ${gradeColor}" id="grd-${stu.studentId}"${gradeTitle}>${grade}</td>
        `;
        tr += `</tr>`;
        tbody += tr;
    });

    const scoreMarkColCount = (thBot.match(/score-mark-col/g) || []).length;
    const scoreColgroup = `
        <colgroup>
            <col class="score-num-col">
            <col class="score-code-col">
            <col class="score-name-col">
            ${'<col class="score-mark-col">'.repeat(scoreMarkColCount)}
            <col class="score-exam-col">
            <col class="score-exam-col">
            <col class="score-total-col">
            <col class="score-grade-col">
        </colgroup>
    `;
    const hiddenUnitCount = allTermUnits.length - termUnits.length;
    const unitFilterHtml = allTermUnits.length > 0 ? `
        <div class="mb-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
                <div class="flex items-center gap-2 text-slate-700 font-extrabold text-sm">
                    <i class="ph ph-funnel-simple text-indigo-500 text-lg"></i>
                    <span>เลือกหน่วยที่ต้องการแสดง/กรอก</span>
                    <span class="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">${termUnits.length}/${allTermUnits.length} หน่วย</span>
                    ${hiddenUnitCount > 0 ? `<span class="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">ซ่อน ${hiddenUnitCount} หน่วย</span>` : ''}
                    ${recoveredColumnCount > 0 ? `<span class="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg"><i class="ph ph-warning-circle mr-1"></i>กู้คืน ${recoveredColumnCount} ช่องจากคะแนนเดิม</span>` : ''}
                </div>
                <div class="flex gap-2 shrink-0">
                    <button type="button" onclick="window.setAllScoreUnitVisibility(true)" class="tactile-btn px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold">แสดงทั้งหมด</button>
                    <button type="button" onclick="window.setAllScoreUnitVisibility(false)" class="tactile-btn px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 text-xs font-bold">ซ่อนหน่วยทั้งหมด</button>
                </div>
            </div>
            <div class="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                ${allTermUnits.map((u, idx) => {
                    const checked = visibleUnitSet.has(String(u.id)) ? 'checked' : '';
                    const recoveredUnit = recoveredUnitIds.has(String(u.id));
                    const activeClass = recoveredUnit
                        ? (checked ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-amber-50 text-amber-700 border-amber-200 opacity-70')
                        : (checked ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200 opacity-70');
                    return `<label class="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${activeClass} text-xs font-bold cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors max-w-[260px]" title="${u.name}">
                        <input type="checkbox" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" ${checked} onchange="window.toggleScoreUnitVisibility('${u.id}', this.checked)">
                        <span class="text-indigo-500 font-black">${idx + 1}</span>
                        <span class="truncate">${u.name}</span>
                        ${recoveredUnit ? '<i class="ph ph-warning-circle text-amber-600" title="คะแนนเต็มเดิมหาย ระบบกำลังแสดงจากคะแนนนักเรียนที่ยังอยู่"></i>' : ''}
                    </label>`;
                }).join('')}
            </div>
            <div class="mt-2 text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                <i class="ph ph-info text-indigo-400"></i>
                ซ่อนเฉพาะช่องกรอกของหน่วยนั้น คะแนนรวมและเกรดยังคำนวณจากคะแนนทั้งหมด
            </div>
        </div>
    ` : '';

    $('score-table-container').innerHTML = `
        ${unitFilterHtml}
        <div class="mb-3 px-4 py-2 bg-indigo-50/50 rounded-lg text-xs font-bold text-indigo-600 flex items-center justify-between border border-indigo-100">
            <span class="flex items-center"><i class="ph ph-lightbulb mr-1.5 text-lg"></i> เคล็ดลับการกรอกเร็ว:</span>
            <span>คลิกที่ส่วนหัวคอลัมน์ (เช่น K, P, A หรือ กลางภาค) เพื่อ <strong class="bg-indigo-100 px-1.5 py-0.5 rounded">เติมคะแนนรวดเดียว</strong> ให้ทุกคนในห้อง</span>
        </div>
        <div class="scorebook-scroll custom-scrollbar rounded-xl border border-slate-200">
            <table class="scorebook-table">
                ${scoreColgroup}
                <thead class="sticky top-0 z-30 shadow-sm border-b border-slate-200">
                    <tr>${thTop}</tr>
                    <tr class="border-b border-slate-200">${thBot}</tr>
                </thead>
                <tbody class="divide-y divide-slate-100">${tbody}</tbody>
            </table>
        </div>
    `;
    window.refreshScoreLockBanner();
    if(typeof window.t_refreshOver100WarningBanner === 'function') {
        window.t_refreshOver100WarningBanner();
    }

    if (activeId) {
        setTimeout(() => {
            let el = document.getElementById(activeId);
            if (el) { el.focus(); }
        }, 10);
    }
}

window.t_updateScoreTableValues = function() {
    window.t_refreshHiddenScoresBanner();
    const sd = window.getSubjectData();
    const cls = DB.classes[state.clsId];
    if(!cls) return;

    let scStore = sd.scores[state.clsId] || {};

    cls.students.forEach(stu => {
        let stuNode = scStore[stu.studentId] || {};
        let mySc = stuNode[state.term] || { indicators: {}, midTermScore: '', finalScore: '' };
        if(!mySc.indicators) mySc.indicators = {};

        ['mid', 'fin'].forEach(type => {
            let dbKey = type === 'mid' ? 'midTermScore' : 'finalScore';
            mySc[dbKey] = window.recoverScoreCellIfMissing(state.subjId, state.clsId, stu.studentId, state.term, dbKey, mySc[dbKey], recovered => { mySc[dbKey] = recovered; });
            let inpEl = document.getElementById(`inp-${type}-${stu.studentId}`);
            if (inpEl && document.activeElement !== inpEl) {
                inpEl.value = window.scoreDisplayValue(mySc[dbKey], '', dbKey);
            }
        });

        let termUnits = (sd.classData[state.clsId].learningUnits||[]).filter(u => String(u.term) === String(state.term));
        termUnits.forEach(u => {
            if(u.indicators) {
                u.indicators.forEach(ind => {
                    ['k', 'p', 'a'].forEach(type => {
                        let inpEl = document.getElementById(`inp-${type}-${stu.studentId}-${ind.id}`);
                        if (inpEl && document.activeElement !== inpEl) {
                            if(!mySc.indicators[ind.id]) mySc.indicators[ind.id] = {};
                            let rawVal = mySc.indicators[ind.id][type];
                            rawVal = window.recoverScoreCellIfMissing(state.subjId, state.clsId, stu.studentId, state.term, `indicators.${ind.id}.${type}`, rawVal, recovered => { mySc.indicators[ind.id][type] = recovered; });
                            let val = window.scoreDisplayValue(rawVal, '', type);
                            inpEl.value = val;
                        }
                    });
                });
            }
        });

        window.updateRowTotal(stu.studentId);
    });
}

// คะแนนทุกช่องถูกส่งขึ้นคลาวด์ทันทีที่ครูออกจากช่องอยู่แล้ว แต่เดิมไม่มีอะไรบอกว่า
// ช่องไหนขึ้นไปสำเร็จแล้วบ้าง มีแต่ป้ายรวมป้ายเดียวบนหัวตาราง ครูจึงต้องเดาเอาเอง
// ทำเครื่องหมายเป็นรายช่องแทน: กำลังส่ง / ขึ้นคลาวด์แล้ว / ยังไม่ขึ้น
window.scoreCellElementId = function(sId, type, indId) {
    if(type === 'midTermScore') return `inp-mid-${sId}`;
    if(type === 'finalScore') return `inp-fin-${sId}`;
    return `inp-${type}-${sId}-${indId}`;
}

window.markScoreCellSyncState = function(elId, syncState) {
    const el = document.getElementById(elId);
    if(!el) return;
    const cell = el.closest('td') || el;
    cell.classList.remove('score-cell-syncing', 'score-cell-synced', 'score-cell-unsynced');
    if(syncState === 'syncing') {
        cell.classList.add('score-cell-syncing');
        cell.setAttribute('title', 'กำลังบันทึกขึ้นคลาวด์...');
    } else if(syncState === 'unsynced') {
        cell.classList.add('score-cell-unsynced');
        cell.setAttribute('title', 'ยังไม่ขึ้นคลาวด์ - บันทึกในเครื่องแล้ว ระบบกำลังลองส่งใหม่');
    } else if(syncState === 'synced') {
        cell.classList.add('score-cell-synced');
        cell.setAttribute('title', 'บันทึกขึ้นคลาวด์แล้ว');
        setTimeout(() => cell.classList.remove('score-cell-synced'), 1500);
    }
}

window.t_saveSc = function(sId, indId, type, val, max, inputEl = null) {
    if(!window.ensureCanEditScorebook()) return;
    let v = val === '' ? '' : Number(val);
    const targetEl = inputEl || document.getElementById(`inp-${type}-${sId}-${indId}`);
    if(v !== '' && v < 0) {
        v = 0;
        if(targetEl) targetEl.value = 0;
    }
    if(v !== '' && v > max) {
        v = max;
        if(targetEl) targetEl.value = max;
        if(typeof window.notify === 'function') {
            window.notify(`⚠️ คะแนนเต็ม ${max} คะแนน (ห้ามกรอกเกินเด็ดขาด! ปรับเป็น ${max} ให้อัตโนมัติ)`, true);
        }
    }
    
    let scStore = window.getSubjectData().scores[state.clsId];
    if(!scStore[sId]) scStore[sId] = {};
    if(!scStore[sId][state.term]) scStore[sId][state.term] = { indicators: {} };
    if(!scStore[sId][state.term].indicators) scStore[sId][state.term].indicators = {};
    if(!scStore[sId][state.term].indicators[indId]) scStore[sId][state.term].indicators[indId] = {};
    
    scStore[sId][state.term].indicators[indId][type] = v;
    window.rememberScoreSafetyValue(state.subjId, state.clsId, sId, state.term, `indicators.${indId}.${type}`, v);
    window.markScoreSubjectPending(state.subjId, state.clsId, sId);
    window.clearScoreAutoSave(state.subjId, state.clsId, sId, state.term, `indicators.${indId}.${type}`);
    window.registerPendingScoreWrite(state.subjId, state.clsId, sId, state.term, `indicators.${indId}.${type}`, v);
    // แคชคะแนนทั้งโรงเรียนลงเครื่องเป็นก้อนใหญ่ก้อนเดียว การเขียนทุกช่องที่กรอกจึงกิน
    // เวลาและเป็นตัวที่ทำให้พื้นที่เบราว์เซอร์เต็ม หน่วงไว้แล้วเขียนรวดเดียวแทน
    // ตัวที่กันคะแนนหายจริงคือคิวรายช่องด้านบน ซึ่งเล็กและยังเขียนทันทีเหมือนเดิม
    window.scheduleSubjectDataLocalSave();
    window.updateRowTotal(sId, true);
    if(typeof window.updateClassProgressSummaryLocal === 'function') {
        window.updateClassProgressSummaryLocal(state.subjId, state.clsId, state.term);
    }
    if(typeof window.firebaseScheduleProgressSummarySync === 'function') {
        window.firebaseScheduleProgressSummarySync(state.subjId, state.clsId, state.term);
    }

    const cellElId = window.scoreCellElementId(sId, type, indId);
    if (window.firebaseUpdateScore) {
        window.markScoreCellSyncState(cellElId, 'syncing');
        window.firebaseUpdateScore(state.subjId, state.clsId, sId, state.term, `indicators.${indId}.${type}`, v)
            .then(() => {
                window.resolvePendingScoreWrite(state.subjId, state.clsId, sId, state.term, `indicators.${indId}.${type}`);
                window.markScoreCellSyncState(cellElId, 'synced');
            })
            .catch(() => {
                window.markScoreCellSyncState(cellElId, 'unsynced');
                window.scheduleScoreAutoSave(state.subjId, state.clsId, sId, state.term, `indicators.${indId}.${type}`, v);
            });
    } else {
        window.saveDB();
    }
}

window.t_saveExam = function(sId, type, val, max, inputEl = null) {
    if(!window.ensureCanEditScorebook()) return;
    let v = val === '' ? '' : Number(val);
    const examLabel = type === 'midTermScore' ? 'กลางภาค' : 'ปลายภาค';
    const elId = type === 'midTermScore' ? `inp-mid-${sId}` : `inp-fin-${sId}`;
    const targetEl = inputEl || document.getElementById(elId);
    if(v !== '' && v < 0) {
        v = 0;
        if(targetEl) targetEl.value = 0;
    }
    if(v !== '' && v > max) {
        v = max;
        if(targetEl) targetEl.value = max;
        if(typeof window.notify === 'function') {
            window.notify(`⚠️ คะแนนสอบ${examLabel}เต็ม ${max} คะแนน (ห้ามกรอกเกินเด็ดขาด! ปรับเป็น ${max} ให้อัตโนมัติ)`, true);
        }
    }
    
    let scStore = window.getSubjectData().scores[state.clsId];
    if(!scStore[sId]) scStore[sId] = {};
    if(!scStore[sId][state.term]) scStore[sId][state.term] = { indicators: {} };

    scStore[sId][state.term][type] = v;
    window.rememberScoreSafetyValue(state.subjId, state.clsId, sId, state.term, type, v);
    window.markScoreSubjectPending(state.subjId, state.clsId, sId);
    window.clearScoreAutoSave(state.subjId, state.clsId, sId, state.term, type);
    window.registerPendingScoreWrite(state.subjId, state.clsId, sId, state.term, type, v);
    window.scheduleSubjectDataLocalSave();
    window.updateRowTotal(sId, true);
    if(typeof window.updateClassProgressSummaryLocal === 'function') {
        window.updateClassProgressSummaryLocal(state.subjId, state.clsId, state.term);
    }
    if(typeof window.firebaseScheduleProgressSummarySync === 'function') {
        window.firebaseScheduleProgressSummarySync(state.subjId, state.clsId, state.term);
    }

    const cellElId = window.scoreCellElementId(sId, type);
    if (window.firebaseUpdateScore) {
        window.markScoreCellSyncState(cellElId, 'syncing');
        window.firebaseUpdateScore(state.subjId, state.clsId, sId, state.term, type, v)
            .then(() => {
                window.resolvePendingScoreWrite(state.subjId, state.clsId, sId, state.term, type);
                window.markScoreCellSyncState(cellElId, 'synced');
            })
            .catch(() => {
                window.markScoreCellSyncState(cellElId, 'unsynced');
                window.scheduleScoreAutoSave(state.subjId, state.clsId, sId, state.term, type, v);
            });
    } else {
        window.saveDB();
    }
}

window.updateRowTotal = function(sId, shouldNotify = false) {
    let cls = DB.classes && DB.classes[state.clsId];
    if(!cls) return;
    let stu = cls.students ? cls.students.find(x => x.studentId === sId) : null;
    if(!stu) return;
    let total = window.getStudentTotalScore(stu, state.subjId, state.clsId, state.term);
    let isOver100 = total > 100;
    let grade = isOver100 ? '!' : window.calculateGrade(total, DB.gradeSettings);
    
    let elTot = $(`tot-${sId}`);
    let elGrd = $(`grd-${sId}`);
    let rowEl = $(`score-row-${sId}`) || (elTot ? elTot.closest('tr') : null);

    if(elTot) {
        elTot.innerText = total;
        if(isOver100) {
            elTot.className = 'score-total-col px-1 py-1 border-r border-b border-rose-300 text-center font-black text-rose-700 bg-rose-100 text-sm shadow-inner ring-2 ring-rose-500 animate-pulse';
            elTot.title = `คะแนนรวม ${total} เกิน 100 คะแนน!`;
        } else {
            elTot.className = 'score-total-col px-1 py-1 border-r border-b border-slate-100 text-center font-black text-indigo-700 bg-slate-50/80 text-sm';
            elTot.removeAttribute('title');
        }
    }
    if(elGrd) {
        elGrd.innerText = grade;
        if(isOver100) {
            elGrd.className = 'score-grade-col px-1 py-1 border-b border-rose-300 text-center font-black text-sm text-white bg-rose-600 shadow-sm animate-pulse';
            elGrd.title = `คะแนนเกิน 100 (ได้ ${total}/100)`;
        } else {
            elGrd.className = `score-grade-col px-1 py-1 border-b border-slate-100 text-center font-black text-sm ${grade === '0' ? 'text-rose-600 bg-rose-50/50' : 'text-emerald-600 bg-emerald-50/50'}`;
            elGrd.removeAttribute('title');
        }
    }
    if(rowEl) {
        if(isOver100) {
            rowEl.classList.add('bg-rose-50/40', 'over-100-row');
        } else {
            rowEl.classList.remove('bg-rose-50/40', 'over-100-row');
        }
    }

    if(typeof window.t_refreshOver100WarningBanner === 'function') {
        window.t_refreshOver100WarningBanner();
    }

    if(shouldNotify && isOver100) {
        window.notify(`⚠️ คะแนนรวมของ ${stu.name || 'นักเรียน'} รวมได้ ${total} คะแนน (เกิน 100 คะแนน) กรุณาตรวจสอบคะแนนที่กรอก`, true);
    }
};

window.t_refreshOver100WarningBanner = function() {
    const banner = document.getElementById('over-100-warning-banner-container');
    if(!banner) return;
    const overflows = typeof window.checkClassScoreOverflows === 'function'
        ? window.checkClassScoreOverflows()
        : (typeof window.checkClassOver100Scores === 'function' ? window.checkClassOver100Scores() : []);
    if(!overflows || overflows.length === 0) {
        banner.innerHTML = '';
        banner.classList.add('hidden');
        return;
    }
    
    const chips = overflows.map(s => {
        const issuesSummary = (s.issues || []).map(i => `${i.label} ${i.val}/${i.max}`).join(', ') || `รวม ${s.total} (+${s.excess})`;
        return `
            <button type="button" onclick="window.scrollToStudentScoreRow('${s.studentId}')" class="inline-flex items-center gap-1.5 px-3 py-1 bg-white/95 hover:bg-white text-rose-800 rounded-lg text-xs font-black shadow-sm border border-rose-200 hover:border-rose-400 transition-all cursor-pointer" title="${issuesSummary}">
                <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                <span>เลขที่ ${s.index} ${s.name}</span>
                <span class="px-1.5 py-0.5 rounded bg-rose-600 text-white font-extrabold text-[11px]">${issuesSummary}</span>
                <i class="ph ph-arrow-down text-rose-500"></i>
            </button>
        `;
    }).join('');

    banner.innerHTML = `
        <div class="mb-4 p-4 bg-gradient-to-r from-rose-50 via-rose-100 to-amber-50 rounded-2xl border-2 border-rose-300 shadow-md animate-fade-in-up">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="flex items-start md:items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-bounce">
                        <i class="ph ph-warning text-2xl font-bold"></i>
                    </div>
                    <div>
                        <h4 class="text-rose-900 font-black text-base flex items-center gap-2">
                            <span>แจ้งเตือน: ตรวจพบคะแนนเกินเกณฑ์ที่กำหนด! (กลางภาค / ปลายภาค / ตัวชี้วัด / รวมเกิน 100)</span>
                            <span class="px-2 py-0.5 bg-rose-600 text-white text-xs font-black rounded-full">${overflows.length} คน</span>
                        </h4>
                        <p class="text-rose-700 text-xs font-medium mt-0.5">
                            ห้ามกรอกคะแนนเกินเกณฑ์เต็มเด็ดขาด ท่านสามารถคลิกปุ่มเพื่อปรับลดคะแนนที่เกินให้เท่ากับคะแนนเต็มอัตโนมัติได้ทันที
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0 flex-wrap">
                    <button type="button" onclick="window.autoFixClassScoreOverflows('${state.subjId}', '${state.clsId}', '${state.term}')" class="tactile-btn px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer">
                        <i class="ph ph-lightning text-sm font-bold"></i>
                        <span>⚡ ปรับลดส่วนที่เกินให้พอดีคะแนนเต็ม</span>
                    </button>
                    <button type="button" onclick="window.scrollToStudentScoreRow('${overflows[0].studentId}')" class="tactile-btn px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer">
                        <i class="ph ph-magnifying-glass text-sm"></i>
                        <span>ไปยังคนแรกที่เกิน</span>
                    </button>
                </div>
            </div>
            <div class="mt-3 pt-3 border-t border-rose-200/80 flex flex-wrap items-center gap-2">
                <span class="text-xs font-bold text-rose-800">รายชื่อและรายการที่เกินเกณฑ์:</span>
                ${chips}
            </div>
        </div>
    `;
    banner.classList.remove('hidden');
};

window.scrollToStudentScoreRow = function(sId) {
    const row = document.getElementById(`score-row-${sId}`) || document.getElementById(`tot-${sId}`);
    if(!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('ring-4', 'ring-rose-500', 'bg-rose-100');
    const firstInp = row.querySelector('input');
    if(firstInp) firstInp.focus();
    setTimeout(() => {
        row.classList.remove('ring-4', 'ring-rose-500', 'bg-rose-100');
    }, 2500);
};

window.t_showPrintSelection = function() {
    const sd = window.getSubjectData();
    const classConfig = sd.classData[state.clsId];
    let termUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term));

    let unitCheckboxes = termUnits.map((u, i) => `
        <label class="flex items-center p-3 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50 transition-all shadow-sm">
            <input type="checkbox" name="print_unit" value="${u.id}" checked class="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mr-3">
            <span class="text-sm font-bold text-slate-700 truncate" title="${u.name}"><span class="text-indigo-500 mr-1 opacity-60 text-xs">หน่วยที่ ${i+1}</span> ${u.name}</span>
        </label>
    `).join('');

    if(termUnits.length === 0) {
        unitCheckboxes = `<div class="text-sm text-slate-400 font-medium italic col-span-2 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">ไม่พบโครงสร้างหน่วยการเรียนรู้ในเทอมนี้</div>`;
    }

    let html = `
        <div class="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
            <div>
                <h3 class="text-2xl font-extrabold text-slate-800 flex items-center"><div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mr-3 shadow-inner"><i class="ph ph-printer text-xl"></i></div> พิมพ์ ปพ. (รายวิชา)</h3>
                <p class="text-sm text-slate-500 font-medium mt-1">เลือกข้อมูลคอลัมน์ที่ต้องการให้ปรากฏบนเอกสารรายงาน</p>
            </div>
            <button onclick="window.hideModal()" class="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-10 h-10 flex items-center justify-center transition-colors"><i class="ph ph-x text-xl font-bold"></i></button>
        </div>
        
        <div class="mb-6">
            <div class="flex justify-between items-center mb-3">
                <p class="font-extrabold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg text-sm">1. เลือกหน่วยการเรียนรู้ (ผลคะแนนรวมต่อหน่วย)</p>
                <button type="button" onclick="document.querySelectorAll('input[name=print_unit]').forEach(cb => cb.checked = !cb.checked)" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded transition-colors">สลับการเลือก (Toggle)</button>
            </div>

            <label class="flex items-center mb-3 ml-1 cursor-pointer w-fit group">
                <input type="checkbox" id="print_kpa" class="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mr-2 transition-colors">
                <span class="text-sm font-bold text-indigo-700 group-hover:text-indigo-800 transition-colors">แสดงคะแนนแยกย่อยทุกตัวชี้วัด (K, P, A) ในแต่ละหน่วย</span>
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                ${unitCheckboxes}
            </div>
        </div>
        
        <div class="mb-8 p-5 rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm relative overflow-hidden">
            <div class="absolute -right-4 -bottom-4 text-amber-500 opacity-10 text-7xl"><i class="ph ph-table"></i></div>
            <p class="font-extrabold text-amber-900 mb-4 relative z-10 text-sm">2. แสดงคอลัมน์ประเมินผลพิเศษ:</p>
            <div class="flex flex-col sm:flex-row flex-wrap gap-4 relative z-10">
                <label class="flex items-center bg-white border border-amber-200 px-4 py-2.5 rounded-xl cursor-pointer hover:border-amber-400 transition-colors shadow-sm flex-1">
                    <input type="checkbox" id="print_mid" checked class="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 mr-3">
                    <span class="text-sm font-bold text-amber-800">คะแนนกลางภาค</span>
                </label>
                <label class="flex items-center bg-white border border-amber-200 px-4 py-2.5 rounded-xl cursor-pointer hover:border-amber-400 transition-colors shadow-sm flex-1">
                    <input type="checkbox" id="print_final" checked class="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300 mr-3">
                    <span class="text-sm font-bold text-amber-800">คะแนนปลายภาค</span>
                </label>
                <label class="flex items-center bg-indigo-600 text-white border border-transparent px-4 py-2.5 rounded-xl cursor-pointer shadow-md flex-1 md:col-span-2 shadow-indigo-200">
                    <input type="checkbox" id="print_total" checked class="w-5 h-5 rounded text-indigo-900 focus:ring-white border-none mr-3 bg-white">
                    <span class="text-sm font-extrabold">คะแนนรวม + เกรด</span>
                </label>
            </div>
        </div>
        
        <button onclick="window.t_generateSelectedPrint()" class="tactile-btn w-full bg-primary-gradient text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center text-lg tracking-wide">
            <i class="ph ph-printer mr-2 text-2xl"></i> สร้างเอกสารและสั่งพิมพ์
        </button>
    `;
    window.showModal(html);
}

window.t_generateSelectedPrint = function() {
    const selectedUnits = Array.from(document.querySelectorAll('input[name="print_unit"]:checked')).map(cb => cb.value);
    const printKpa = $('print_kpa').checked;
    const printMid = $('print_mid').checked;
    const printFinal = $('print_final').checked;
    const printTotal = $('print_total').checked;
    window.hideModal();

    const sub = DB.subjects.find(x => x.id === state.subjId);
    const cls = DB.classes[state.clsId];
    const sd = window.getSubjectData();
    const classConfig = sd.classData[state.clsId];
    
    let termUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term) && selectedUnits.includes(u.id));
    const printScoreStore = sd.scores[state.clsId] || {};
    const getPrintColumn = (indicator, type) => window.getEffectiveIndicatorColumn
        ? window.getEffectiveIndicatorColumn(indicator, type, printScoreStore, state.term)
        : { max: Number(indicator[`max_${type}`] || 0) };
    
    let hasAnyPrintedKpa = false;
    if (printKpa) {
        termUnits.forEach(u => {
            if(u.indicators) {
                u.indicators.forEach(ind => {
                    if (getPrintColumn(ind, 'k').max > 0 || getPrintColumn(ind, 'p').max > 0 || getPrintColumn(ind, 'a').max > 0) hasAnyPrintedKpa = true;
                });
            }
        });
    }
    let rowSpanAttr = hasAnyPrintedKpa ? 'rowspan="3"' : '';

    /* ปรับความกว้าง 3 คอลัมน์แรกให้เล็กลง */
    let thHtmlRow1 = `
        <th ${rowSpanAttr} class="print-num-col">เลขที่</th>
        <th ${rowSpanAttr} class="print-code-col">รหัส</th>
        <th ${rowSpanAttr} class="text-left print-name-col">ชื่อ-สกุล</th>
    `;
    let thHtmlRow2 = ``;
    let thHtmlRow3 = ``;

    termUnits.forEach(u => { 
        if (printKpa && hasAnyPrintedKpa) {
            let uCols = 0;
            let indRow2 = '';
            let indRow3 = '';
            if(u.indicators && u.indicators.length > 0) {
                u.indicators.forEach((ind, iIdx) => {
                    let kpaCols = 0;
                    let kpaRow3 = '';
                    if(getPrintColumn(ind, 'k').max > 0) { kpaRow3 += `<th>K</th>`; kpaCols++; }
                    if(getPrintColumn(ind, 'p').max > 0) { kpaRow3 += `<th>P</th>`; kpaCols++; }
                    if(getPrintColumn(ind, 'a').max > 0) { kpaRow3 += `<th>A</th>`; kpaCols++; }
                    
                    if(kpaCols > 0) {
                        indRow2 += `<th colspan="${kpaCols}" class="print-indicator-header" title="${ind.name}"><span>${ind.name}</span></th>`;
                        indRow3 += kpaRow3;
                        uCols += kpaCols;
                    }
                });
            }
            if (uCols === 0) {
                thHtmlRow1 += `<th ${rowSpanAttr} class="print-unit-header" title="${u.name}"><span>${u.name}</span></th>`;
            } else {
                thHtmlRow1 += `<th colspan="${uCols + 1}" class="print-unit-header" title="${u.name}"><span>${u.name}</span></th>`;
                thHtmlRow2 += indRow2 + `<th rowspan="2" class="align-middle">รวม</th>`;
                thHtmlRow3 += indRow3;
            }
        } else {
            thHtmlRow1 += `<th ${rowSpanAttr} class="print-unit-header" title="${u.name}"><span>${u.name}</span></th>`; 
        }
    });
    
    if(printMid) thHtmlRow1 += `<th ${rowSpanAttr} class="print-score-col">กลางภาค</th>`;
    if(printFinal) thHtmlRow1 += `<th ${rowSpanAttr} class="print-score-col">ปลายภาค</th>`;
    if(printTotal) thHtmlRow1 += `<th ${rowSpanAttr} class="font-bold print-score-col">รวม</th><th ${rowSpanAttr} class="font-bold print-score-col">เกรด</th>`;

    let tableHtml = `<table class="print-table mb-6"><thead><tr>${thHtmlRow1}</tr>`;
    if (printKpa && hasAnyPrintedKpa) {
        tableHtml += `<tr>${thHtmlRow2}</tr><tr>${thHtmlRow3}</tr>`;
    }
    tableHtml += `</thead><tbody>`;

    let sumGrade = 0, passCount = 0;

    cls.students.forEach((s, idx) => {
        let scStore = sd.scores[state.clsId] || {};
        let stuNode = scStore[s.studentId] || {};
        let mySc = stuNode[state.term] || { indicators: {}, midTermScore: '', finalScore: '' };

        let trHtml = `<tr><td>${idx+1}</td><td>${s.studentId}</td><td class="text-left font-medium">${s.name}</td>`;
        termUnits.forEach(u => {
            let uTotal = 0;
            if (printKpa && hasAnyPrintedKpa) {
                let hasInd = false;
                if(u.indicators && u.indicators.length > 0) {
                    u.indicators.forEach(ind => {
                        let kpaCols = 0;
                        if(getPrintColumn(ind, 'k').max > 0) kpaCols++;
                        if(getPrintColumn(ind, 'p').max > 0) kpaCols++;
                        if(getPrintColumn(ind, 'a').max > 0) kpaCols++;

                        if(kpaCols > 0) {
                            hasInd = true;
                            let vals = mySc.indicators ? mySc.indicators[ind.id] : null;
                            let vK = vals ? window.scoreDisplayValue(vals.k, '', 'k') : '';
                            let vP = vals ? window.scoreDisplayValue(vals.p, '', 'p') : '';
                            let vA = vals ? window.scoreDisplayValue(vals.a, '', 'a') : '';

                            if(getPrintColumn(ind, 'k').max > 0) { trHtml += `<td>${vK}</td>`; uTotal += Number(vK)||0; }
                            if(getPrintColumn(ind, 'p').max > 0) { trHtml += `<td>${vP}</td>`; uTotal += Number(vP)||0; }
                            if(getPrintColumn(ind, 'a').max > 0) { trHtml += `<td>${vA}</td>`; uTotal += Number(vA)||0; }
                        }
                    });
                }
                if (!hasInd) {
                    trHtml += `<td></td>`;
                } else {
                    trHtml += `<td class="font-bold bg-[#f8fafc] print:bg-transparent">${uTotal || ''}</td>`;
                }
            } else {
                if(u.indicators) {
                    u.indicators.forEach(ind => {
                        let vals = mySc.indicators ? mySc.indicators[ind.id] : null;
                        if(vals) {
                            uTotal += window.scoreNumber(vals.k, 'k') + window.scoreNumber(vals.p, 'p') + window.scoreNumber(vals.a, 'a');
                        }
                    });
                }
                trHtml += `<td>${uTotal || ''}</td>`;
            }
        });

        if(printMid) trHtml += `<td>${window.scoreDisplayValue(mySc.midTermScore, '', 'midTermScore')}</td>`;
        if(printFinal) trHtml += `<td>${window.scoreDisplayValue(mySc.finalScore, '', 'finalScore')}</td>`;

        if(printTotal) {
            let total = window.getStudentTotalScore(s, state.subjId, state.clsId, state.term);
            let grade = window.calculateGrade(total, DB.gradeSettings);
            sumGrade += Number(grade);
            if(total >= DB.gradeSettings.passThreshold) passCount++;
            trHtml += `<td class="font-bold">${total}</td><td class="font-bold">${grade}</td>`;
        }
        trHtml += `</tr>`;
        tableHtml += trHtml;
    });
    tableHtml += `</tbody></table>`;

    let avgGrade = cls.students.length && printTotal ? (sumGrade / cls.students.length).toFixed(2) : '0.00';
    let titleHtml = `
        <h3 class="text-lg mt-1 font-bold">รายงานผลการเรียน ภาคเรียนที่ ${state.term} ปีการศึกษา ${DB.schoolInfo.year}</h3>
        <p class="mt-1">วิชา ${sub.name} ${sub.code ? `รหัสวิชา ${sub.code}` : ''} ชั้น ${cls.name}</p>
    `;
    let reportHtml = window.generatePrintHTML(titleHtml, tableHtml, cls.students.length, printTotal ? passCount : '-', printTotal ? avgGrade : '-', sub, DB.teachers.find(x => x.id === state.user.id));
    window.openPrintWindow(reportHtml);
}

window.t_printAnnualReport = function() {
    const sub = DB.subjects.find(x => x.id === state.subjId);
    const cls = DB.classes[state.clsId];
    
    /* ปรับความกว้าง 3 คอลัมน์แรกให้เล็กลง */
    let tableHtml = `
    <table class="print-table mb-4">
        <thead>
            <tr>
                <th style="width: 4%">เลขที่</th>
                <th style="width: 8%">รหัส</th>
                <th class="text-left" style="width: 20%; min-width: 100px;">ชื่อ-สกุล</th>
                <th>เทอม 1</th>
                <th>เทอม 2</th>
                <th class="font-bold">รวมรายปี</th>
                <th class="font-bold">เกรด</th>
            </tr>
        </thead>
        <tbody>`;
    
    let sumGrade = 0, passCount = 0;
    
    cls.students.forEach((s, idx) => {
        let t1 = window.getStudentTotalScore(s, state.subjId, state.clsId, "1");
        let t2 = window.getStudentTotalScore(s, state.subjId, state.clsId, "2");
        let avg = Math.round((t1 + t2) / 2);
        let grade = window.calculateGrade(avg, DB.gradeSettings);
        
        sumGrade += Number(grade);
        if(avg >= DB.gradeSettings.passThreshold) passCount++;

        tableHtml += `
            <tr>
                <td>${idx+1}</td>
                <td>${s.studentId}</td>
                <td class="text-left font-medium">${s.name}</td>
                <td>${t1 || ''}</td>
                <td>${t2 || ''}</td>
                <td class="font-bold">${avg}</td>
                <td class="font-bold">${grade}</td>
            </tr>
        `;
    });
    tableHtml += `</tbody></table>`;

    let avgGrade = cls.students.length ? (sumGrade / cls.students.length).toFixed(2) : '0.00';
    let titleHtml = `
        <h3 class="text-lg mt-1 font-bold">รายงานสรุปผลการเรียน <span class="underline decoration-2">รวมเฉลี่ยรายปี</span> ปีการศึกษา ${DB.schoolInfo.year}</h3>
        <p class="mt-1">วิชา ${sub.name} ${sub.code ? `รหัสวิชา ${sub.code}` : ''} ชั้น ${cls.name}</p>
    `;
    let reportHtml = window.generatePrintHTML(titleHtml, tableHtml, cls.students.length, passCount, avgGrade, sub, DB.teachers.find(x => x.id === state.user.id));
    window.openPrintWindow(reportHtml);
}

window.openPrintWindow = function(html) {
    let printView = document.getElementById('print-view');
    printView.className = 'hidden fixed inset-0 bg-slate-800 z-[200] overflow-y-auto print:bg-white print:static';
    
    let toolbar = `
        <div class="no-print fixed top-0 left-0 w-full bg-slate-900/90 backdrop-blur-md p-4 flex justify-center gap-4 z-[210] shadow-lg border-b border-white/10">
            <button onclick="window.print()" class="tactile-btn bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl shadow-lg flex items-center font-bold tracking-wide"><i class="ph ph-printer mr-2 text-xl"></i> ยืนยันสั่งพิมพ์</button>
            <button onclick="window.closePrintWindow()" class="tactile-btn bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-xl transition-colors flex items-center font-bold border border-slate-600"><i class="ph ph-x mr-2 text-xl"></i> ปิด/ยกเลิก</button>
        </div>
    `;
    printView.innerHTML = `${toolbar}<div class="a4-preview-container mt-24 mb-12 print:mt-0 print:mb-0 print:p-0">${html}</div>`;
    printView.classList.remove('hidden'); document.getElementById('app-container').classList.add('hidden'); 
    setTimeout(() => window.print(), 800);
}

window.closePrintWindow = function() {
    let printView = document.getElementById('print-view');
    printView.classList.add('hidden'); printView.innerHTML = '';
    document.getElementById('app-container').classList.remove('hidden');
}

window.generatePrintHTML = function(titleHtml, tableHtml, clsStudentsCount, passCount, avgGrade, sub, teacher) {
    let logoHtml = DB.schoolInfo.logo ? `<img src="${DB.schoolInfo.logo}" class="print-logo">` : '';
    let schName = DB.schoolInfo.name.replace(/^โรงเรียน/, ''); 
    const teacherName = teacher ? teacher.name : '.........................';
    const headName = sub.headName || '.........................';

    return `
    <div class="print-area w-full mx-auto">
        <div class="print-header text-center mb-4">
            ${logoHtml}
            <h2 class="text-xl font-bold mt-2">โรงเรียน${schName}</h2>
            ${titleHtml}
        </div>
        ${tableHtml}
        
        <div class="break-inside-avoid mt-6">
            <div class="flex justify-between mt-4 text-sm mb-6 font-bold px-4 border border-gray-200 bg-gray-50 py-3 rounded-lg">
                <div>นักเรียนทั้งหมด: ${clsStudentsCount} คน</div>
                <div>สอบผ่านเกณฑ์: ${passCount} คน</div>
                <div>ระดับผลการเรียนเฉลี่ย: ${avgGrade}</div>
            </div>
            <div class="flex justify-between mb-8 px-4 md:px-16 text-sm mt-8">
                <div class="text-center w-1/2">( ${teacherName} )<br>ครูผู้สอน</div>
                <div class="text-center w-1/2">( ${headName} )<br>หัวหน้ากลุ่มสาระฯ</div>
            </div>
            <div class="flex justify-between px-4 md:px-16 text-sm pb-8 mt-10">
                <div class="text-center w-1/2">( ${DB.schoolInfo.academicHead || '.........................'} )<br>หัวหน้าฝ่ายวิชาการ</div>
                <div class="text-center w-1/2">( ${DB.schoolInfo.director || '.........................'} )<br>ผู้อำนวยการ</div>
            </div>
        </div>
    </div>
    `;
}

// Parent score reports read existing scores only and never write to the score database.
