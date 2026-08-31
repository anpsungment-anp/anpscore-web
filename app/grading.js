/* ANPSCORE — คำนวณคะแนนรวม เกรด และความคืบหน้า
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

window.getTeacherAssignments = function(teacherObj, term) {
    if (!teacherObj || !teacherObj.assignments) return {};
    if (teacherObj.assignments["1"] !== undefined || teacherObj.assignments["2"] !== undefined) {
        return teacherObj.assignments[term] || {};
    }
    return teacherObj.assignments; 
}

window.getTeacherHomeroomClasses = function(teacherObj, term) {
    if(!teacherObj || !teacherObj.homeroomClasses) return [];
    if(Array.isArray(teacherObj.homeroomClasses)) return teacherObj.homeroomClasses;
    const termClasses = teacherObj.homeroomClasses[term];
    return Array.isArray(termClasses) ? termClasses : [];
}

window.calculateClassProgressFromScores = function(subId, cId, term) {
    let sd = DB_SubjectData[subId]; if(!sd) return 0;
    let classConfig = (sd.classData && sd.classData[cId]) ? sd.classData[cId] : sd;
    let termUnits = (classConfig.learningUnits||[]).filter(u => String(u.term) === String(term));
    let ex = classConfig.examSettings ? classConfig.examSettings[term] : {mid:20, final:30};
    if(!ex) ex = {mid:20, final:30};

    let scStore = sd.scores ? sd.scores[cId] : null; if(!scStore) return 0;
    let cls = DB.classes[cId]; if(!cls || cls.students.length === 0) return 0;

    let completedPoints = 0;
    termUnits.forEach(u => {
        if(u.indicators) {
            u.indicators.forEach(ind => {
                let k_filled = false, p_filled = false, a_filled = false;
                cls.students.forEach(stu => {
                    let sId = stu.studentId; let stuNode = scStore[sId];
                    if(stuNode) {
                        let mySc = stuNode[term]; if(!mySc && stuNode.term !== undefined && String(stuNode.term) === String(term)) mySc = stuNode;
                        if(mySc && mySc.indicators && mySc.indicators[ind.id]) {
                            if(window.normalizeScoreValue(mySc.indicators[ind.id].k, 'k') !== '') k_filled = true;
                            if(window.normalizeScoreValue(mySc.indicators[ind.id].p, 'p') !== '') p_filled = true;
                            if(window.normalizeScoreValue(mySc.indicators[ind.id].a, 'a') !== '') a_filled = true;
                        }
                    }
                });
                const effectiveK = window.getEffectiveIndicatorColumn ? window.getEffectiveIndicatorColumn(ind, 'k', scStore, term).max : Number(ind.max_k || 0);
                const effectiveP = window.getEffectiveIndicatorColumn ? window.getEffectiveIndicatorColumn(ind, 'p', scStore, term).max : Number(ind.max_p || 0);
                const effectiveA = window.getEffectiveIndicatorColumn ? window.getEffectiveIndicatorColumn(ind, 'a', scStore, term).max : Number(ind.max_a || 0);
                if(k_filled) completedPoints += effectiveK;
                if(p_filled) completedPoints += effectiveP;
                if(a_filled) completedPoints += effectiveA;
            });
        }
    });

    let mid_filled = false, fin_filled = false;
    cls.students.forEach(stu => {
        let sId = stu.studentId; let stuNode = scStore[sId];
        if(stuNode) {
            let mySc = stuNode[term]; if(!mySc && stuNode.term !== undefined && String(stuNode.term) === String(term)) mySc = stuNode;
            if(mySc) {
                if(window.normalizeScoreValue(mySc.midTermScore, 'midTermScore') !== '') mid_filled = true;
                if(window.normalizeScoreValue(mySc.finalScore, 'finalScore') !== '') fin_filled = true;
            }
        }
    });
    if(mid_filled) completedPoints += Number(ex.mid || 0);
    if(fin_filled) completedPoints += Number(ex.final || 0);
    return Math.min(100, Math.round(completedPoints));
}

window.getClassProgressSummary = function(subId, cId, term) {
    const sd = DB_SubjectData[subId];
    const summary = sd && sd.progressSummary && sd.progressSummary[String(term)]
        ? sd.progressSummary[String(term)][String(cId)]
        : null;
    if(typeof summary === 'number' && Number.isFinite(summary)) return Math.max(0, Math.min(100, Math.round(summary)));
    if(summary && Number.isFinite(Number(summary.percent))) return Math.max(0, Math.min(100, Math.round(Number(summary.percent))));
    return null;
}

window.updateClassProgressSummaryLocal = function(subId, cId, term) {
    const sd = DB_SubjectData[subId];
    if(!sd || !cId || !term) return null;
    const percent = window.calculateClassProgressFromScores(subId, cId, term);
    if(!sd.progressSummary || typeof sd.progressSummary !== 'object') sd.progressSummary = {};
    if(!sd.progressSummary[String(term)] || typeof sd.progressSummary[String(term)] !== 'object') sd.progressSummary[String(term)] = {};
    const cls = DB.classes && DB.classes[cId];
    sd.progressSummary[String(term)][String(cId)] = {
        percent,
        studentCount: cls && Array.isArray(cls.students) ? cls.students.length : 0,
        updatedAt: Date.now()
    };
    return percent;
}

window.calculateClassProgress = function(subId, cId, term) {
    const summary = window.getClassProgressSummary(subId, cId, term);
    if(summary !== null) return summary;
    return window.calculateClassProgressFromScores(subId, cId, term);
}

window.getMissingAdminDashboardProgressPairs = function(term = state.term) {
    const pairMap = new Map();
    (DB.teachers || []).forEach(teacher => {
        const assignments = window.getTeacherAssignments(teacher, term) || {};
        Object.entries(assignments).forEach(([subId, classIds]) => {
            (Array.isArray(classIds) ? classIds : []).forEach(cId => {
                if(!DB.classes || !DB.classes[cId]) return;
                const key = `${subId}|${cId}`;
                if(window.getClassProgressSummary(subId, cId, term) === null) pairMap.set(key, { subId, cId, term: String(term) });
            });
        });
    });
    return Array.from(pairMap.values());
}

window.ensureAdminDashboardProgressCurrent = function(term = state.term) {
    const missingPairs = window.getMissingAdminDashboardProgressPairs(term);
    if(missingPairs.length === 0) return Promise.resolve({ synced: true, count: 0 });
    if(adminDashboardProgressSyncPromise) return adminDashboardProgressSyncPromise;
    if(typeof window.firebaseBackfillDashboardProgress !== 'function') return Promise.resolve({ synced: false, count: 0 });
    if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) return Promise.resolve({ synced: false, count: 0 });
    if(Date.now() - adminDashboardProgressLastAttempt < 30000) return Promise.resolve({ synced: false, count: 0 });

    adminDashboardProgressLastAttempt = Date.now();
    adminDashboardProgressSyncPromise = window.firebaseBackfillDashboardProgress(missingPairs)
        .catch(err => {
            console.warn('Dashboard progress sync failed:', err);
            return { synced: false, count: 0 };
        })
        .finally(() => { adminDashboardProgressSyncPromise = null; });
    return adminDashboardProgressSyncPromise;
}

window.getStudentTotalScore = function(student, subId, cId, termToCalculate = null) {
    let term = termToCalculate ? String(termToCalculate) : String(state.term);
    let sd = DB_SubjectData[subId];
    if(!sd || !sd.scores || !sd.scores[cId] || !sd.scores[cId][student.studentId]) return 0;
    
    let stuNode = sd.scores[cId][student.studentId];
    let sc = stuNode[term]; 
    if(stuNode.term !== undefined) { if (String(stuNode.term) === term) { sc = stuNode; } else { return 0; } }
    if(!sc) return 0;

    let total = 0;
    let units = (sd.classData && sd.classData[cId]) ? sd.classData[cId].learningUnits : sd.learningUnits;
    if(units) {
        units.forEach(u => {
            if(String(u.term) === term && u.indicators) {
                u.indicators.forEach(i => {
                    let val = sc.indicators ? sc.indicators[i.id] : null;
                    if(val) total += window.scoreNumber(val.k, 'k') + window.scoreNumber(val.p, 'p') + window.scoreNumber(val.a, 'a');
                });
            }
        });
    }
    total += window.scoreNumber(sc.midTermScore, 'midTermScore') + window.scoreNumber(sc.finalScore, 'finalScore');
    return total;
}

window.calculateGrade = function(score, settings) {
    let s = parseFloat(score); let gKeys = ['4.0', '3.5', '3.0', '2.5', '2.0', '1.5', '1.0'];
    for(let g of gKeys) { if(s >= settings[g]) return g; }
    return '0';
}

window.getSubjectData = function() {
    if(!DB_SubjectData[state.subjId]) DB_SubjectData[state.subjId] = { classData: {}, scores: {} };
    let sd = DB_SubjectData[state.subjId];
    if(!sd.classData) sd.classData = {};
    if(!sd.scores) sd.scores = {};
    
    if(state.clsId && !sd.classData[state.clsId]) {
        sd.classData[state.clsId] = {
            learningUnits: sd.learningUnits ? JSON.parse(JSON.stringify(sd.learningUnits)) : [],
            examSettings: sd.examSettings ? JSON.parse(JSON.stringify(sd.examSettings)) : { "1": {mid:20, final:30}, "2": {mid:20, final:30} }
        };
    }
    if(state.clsId && !sd.scores[state.clsId]) sd.scores[state.clsId] = {};
    return sd;
}

window.syncClassConfigToSameGrade = function() {
    let sd = window.getSubjectData(); let sourceCls = DB.classes[state.clsId]; if(!sourceCls) return 0;
    let gradeLevel = sourceCls.name.split('/')[0].trim(); let sourceConfig = sd.classData[state.clsId]; if(!sourceConfig) return 0;
    let sourceUnitsForTerm = (sourceConfig.learningUnits||[]).filter(u => String(u.term) === String(state.term));
    let sourceExamForTerm = sourceConfig.examSettings ? sourceConfig.examSettings[state.term] : null;
    let syncedCount = 0;

    Object.entries(DB.classes).forEach(([cId, cls]) => {
        if(cId === state.clsId) return;
        let targetGrade = cls.name.split('/')[0].trim();
        if(targetGrade === gradeLevel) {
            if(!sd.classData[cId]) sd.classData[cId] = { learningUnits: [], examSettings: {} };
            sd.classData[cId].learningUnits = (sd.classData[cId].learningUnits||[]).filter(u => String(u.term) !== String(state.term));
            sd.classData[cId].learningUnits.push(...JSON.parse(JSON.stringify(sourceUnitsForTerm)));
            if(!sd.classData[cId].examSettings) sd.classData[cId].examSettings = {};
            if(sourceExamForTerm) sd.classData[cId].examSettings[state.term] = JSON.parse(JSON.stringify(sourceExamForTerm));
            syncedCount++;
        }
    });
    return syncedCount;
}
