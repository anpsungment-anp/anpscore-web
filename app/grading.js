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
    let totalConfiguredPoints = 0;
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
                totalConfiguredPoints += effectiveK + effectiveP + effectiveA;
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
    const midMax = Number(ex.mid || 0);
    const finMax = Number(ex.final || 0);
    totalConfiguredPoints += midMax + finMax;
    if(mid_filled) completedPoints += midMax;
    if(fin_filled) completedPoints += finMax;
    if(totalConfiguredPoints <= 0) return 0;
    const pct = Math.round((completedPoints / totalConfiguredPoints) * 100);
    return Math.max(0, Math.min(100, pct));
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
    const sd = window.DB_SubjectData && window.DB_SubjectData[subId];
    const summary = window.getClassProgressSummary(subId, cId, term);
    const isActivelyScoringThis = state.activePage === 'teacher_scoring' && state.subjId === subId && state.clsId === cId;
    const hasScoresLoaded = sd && sd.scores && sd.scores[cId] && Object.keys(sd.scores[cId]).length > 0;

    // Only update and re-sync summary from loaded scores if actively grading on teacher_scoring
    if(isActivelyScoringThis && hasScoresLoaded) {
        const calculated = window.calculateClassProgressFromScores(subId, cId, term);
        if(summary !== calculated) {
            window.updateClassProgressSummaryLocal(subId, cId, term);
            if(typeof window.firebaseScheduleProgressSummarySync === 'function') {
                window.firebaseScheduleProgressSummarySync(subId, cId, term);
            }
        }
        return calculated;
    }

    // On dashboard and overview: if we already have a valid summary from cloud/local, trust it!
    if(summary !== null) return summary;

    // Fallback if no summary exists yet
    if(hasScoresLoaded) {
        return window.calculateClassProgressFromScores(subId, cId, term);
    }
    return 0;
}

window.recalculateAllLoadedProgressSummaries = function() {
    let changed = false;
    if(!window.DB_SubjectData || typeof window.DB_SubjectData !== 'object') return false;
    Object.keys(window.DB_SubjectData).forEach(subId => {
        const sd = window.DB_SubjectData[subId];
        if(!sd || !sd.scores) return;
        ['1', '2'].forEach(term => {
            Object.keys(sd.scores).forEach(cId => {
                const scStore = sd.scores[cId];
                if(scStore && Object.keys(scStore).length > 0) {
                    const currentSummary = window.getClassProgressSummary(subId, cId, term);
                    // Only fill in if there is no current summary, so stale local cache never overwrites cloud summary
                    if(currentSummary === null) {
                        window.updateClassProgressSummaryLocal(subId, cId, term);
                        if(typeof window.firebaseScheduleProgressSummarySync === 'function') {
                            window.firebaseScheduleProgressSummarySync(subId, cId, term);
                        }
                        changed = true;
                    }
                }
            });
        });
    });
    return changed;
}

window.getAllAdminDashboardProgressPairs = function(term = state.term) {
    const pairMap = new Map();
    (DB.teachers || []).forEach(teacher => {
        const assignments = window.getTeacherAssignments(teacher, term) || {};
        Object.entries(assignments).forEach(([subId, classIds]) => {
            (Array.isArray(classIds) ? classIds : []).forEach(cId => {
                if(!DB.classes || !DB.classes[cId]) return;
                const key = `${subId}|${cId}`;
                pairMap.set(key, { subId, cId, term: String(term) });
            });
        });
    });
    return Array.from(pairMap.values());
}

window.resyncAllDashboardProgress = async function() {
    if(typeof window.firebaseBackfillDashboardProgress !== 'function') {
        window.notify('ไม่สามารถเชื่อมต่อคลาวด์ได้', true);
        return;
    }
    const pairs = window.getAllAdminDashboardProgressPairs(state.term);
    if(pairs.length === 0) {
        window.notify('ไม่พบภาระงานสอนในเทอมนี้');
        return;
    }
    window.notify('กำลังดึงคะแนนและคำนวณความคืบหน้าใหม่จากคลาวด์...');
    try {
        const res = await window.firebaseBackfillDashboardProgress(pairs);
        if(res && res.synced) {
            window.notify('อัปเดตความคืบหน้าครบทุกวิชาเรียบร้อยแล้ว');
        } else {
            window.notify('อัปเดตความคืบหน้าเสร็จสิ้น');
        }
        if(state.activePage === 'admin_dash') {
            window.renderAdminDash($('content-area'));
        }
    } catch(err) {
        console.error(err);
        window.notify('เกิดข้อผิดพลาดในการซิงก์ความคืบหน้า', true);
    }
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

window.ensureAdminDashboardProgressCurrent = function(term = state.term, force = false) {
    const missingPairs = window.getMissingAdminDashboardProgressPairs(term);
    const pairsToSync = force ? window.getAllAdminDashboardProgressPairs(term) : missingPairs;
    if(pairsToSync.length === 0) return Promise.resolve({ synced: true, count: 0 });
    if(adminDashboardProgressSyncPromise) return adminDashboardProgressSyncPromise;
    if(typeof window.firebaseBackfillDashboardProgress !== 'function') return Promise.resolve({ synced: false, count: 0 });
    if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) return Promise.resolve({ synced: false, count: 0 });
    if(!force && (Date.now() - adminDashboardProgressLastAttempt < 30000)) return Promise.resolve({ synced: false, count: 0 });

    adminDashboardProgressLastAttempt = Date.now();
    adminDashboardProgressSyncPromise = window.firebaseBackfillDashboardProgress(pairsToSync)
        .then(res => {
            if(res && res.synced) {
                if(typeof window.adminDashboardLastFullSyncAt !== 'undefined') window.adminDashboardLastFullSyncAt = Date.now();
            }
            return res;
        })
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

window.checkClassOver100Scores = function(subjId = state.subjId, clsId = state.clsId, term = state.term) {
    if(!clsId || !subjId || !DB || !DB.classes || !DB.classes[clsId]) return [];
    const cls = DB.classes[clsId];
    const students = cls.students || [];
    const over100List = [];
    students.forEach((stu, idx) => {
        const total = window.getStudentTotalScore(stu, subjId, clsId, term);
        if(total > 100) {
            over100List.push({
                index: idx + 1,
                studentId: stu.studentId,
                name: stu.name,
                total: total,
                excess: total - 100
            });
        }
    });
    return over100List;
};

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
        let initialUnits = [];
        let initialExam = { "1": {mid:20, final:30}, "2": {mid:20, final:30} };
        const cls = DB.classes && DB.classes[state.clsId];
        if(cls && cls.name) {
            const grade = cls.name.split('/')[0].trim();
            for(let [otherCId, otherCls] of Object.entries(DB.classes || {})) {
                if(otherCId !== state.clsId && otherCls.name && otherCls.name.split('/')[0].trim() === grade && sd.classData[otherCId]) {
                    const peerUnits = sd.classData[otherCId].learningUnits || [];
                    if(peerUnits.length > initialUnits.length) {
                        initialUnits = JSON.parse(JSON.stringify(peerUnits));
                        if(sd.classData[otherCId].examSettings) {
                            initialExam = JSON.parse(JSON.stringify(sd.classData[otherCId].examSettings));
                        }
                    }
                }
            }
        }
        if(initialUnits.length === 0 && sd.learningUnits) {
            initialUnits = JSON.parse(JSON.stringify(sd.learningUnits));
        }
        if(sd.examSettings && (!initialExam || Object.keys(initialExam).length === 0)) {
            initialExam = JSON.parse(JSON.stringify(sd.examSettings));
        }
        sd.classData[state.clsId] = {
            learningUnits: initialUnits,
            examSettings: initialExam
        };
    }
    // The admin's midterm/final import creates a class entry holding only examSettings. Every
    // structure edit then hit `learningUnits.push` on undefined and silently did nothing -
    // a class in that state could never get its first learning unit.
    if(state.clsId && sd.classData[state.clsId]) {
        const config = sd.classData[state.clsId];
        if(!Array.isArray(config.learningUnits)) config.learningUnits = [];
        if(!config.examSettings || typeof config.examSettings !== 'object') config.examSettings = {};
    }
    if(state.clsId && !sd.scores[state.clsId]) sd.scores[state.clsId] = {};
    return sd;
}

// Teachers assigned to teach a subject in a class for a term
window.teachersOfSubjectClass = function(subId, clsId, term) {
    return (DB.teachers || [])
        .filter(t => (window.getTeacherAssignments(t, term)[subId] || []).map(String).includes(String(clsId)))
        .map(t => String(t.id));
}

// Every score is stored under its indicator's id. When a class's structure loses an indicator
// id, that whole column of scores drops out of every screen and total - the numbers are still
// in the cloud, but nothing shows or counts them. The grade-level sync used to replace each
// same-grade class's units with a copy of the edited class's, and since it also began writing
// those classes to the cloud, one teacher adding a unit in one room wiped the columns (and so
// the visible scores) of every other room in the grade whose units had different ids.
// The helpers below are the only code that changes another class's structure, and they never
// drop an indicator id unless it was explicitly deleted and that class holds no score in it.

window.structureGradeOf = function(cls) {
    return String((cls && cls.name) || '').split('/')[0].trim();
}

// JSON with object keys sorted, so two copies that differ only in key order compare equal
window.canonicalJson = function(value) {
    const sortKeys = v => Array.isArray(v) ? v.map(sortKeys)
        : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {})
        : v;
    return JSON.stringify(sortKeys(value));
}

window.termUnitsOfConfig = function(config, term) {
    return ((config && config.learningUnits) || []).filter(u => u && String(u.term) === String(term));
}

// Indicator ids (from `indIds`) that at least one student of the class has a K/P/A score in
window.indicatorIdsWithScores = function(sd, clsId, term, indIds) {
    const wanted = new Set((indIds || []).map(String));
    const found = new Set();
    if(wanted.size === 0) return found;
    Object.values(((sd && sd.scores) || {})[clsId] || {}).forEach(stuNode => {
        if(!stuNode || typeof stuNode !== 'object') return;
        let termNode = stuNode[term];
        if(stuNode.term !== undefined) termNode = String(stuNode.term) === String(term) ? stuNode : null;
        const inds = (termNode && termNode.indicators) || {};
        wanted.forEach(id => {
            if(found.has(id)) return;
            const vals = inds[id] || {};
            if(['k', 'p', 'a'].some(t => window.normalizeScoreValue(vals[t], t) !== '')) found.add(id);
        });
    });
    return found;
}

// One term's units of `target` updated from `source`. Units and indicators the source has are
// copied over (names, full marks, order); ones only the target has stay where they are, unless
// their id is in `removable`. Nothing else is ever left out.
window.mergeTermUnitsSafely = function(targetUnits, sourceUnits, removable = new Set()) {
    const clone = v => JSON.parse(JSON.stringify(v));
    const targetById = new Map((targetUnits || []).map(u => [String(u.id), u]));
    const sourceUnitIds = new Set((sourceUnits || []).map(u => String(u.id)));
    const sourceIndIds = new Set();
    (sourceUnits || []).forEach(u => (u.indicators || []).forEach(i => sourceIndIds.add(String(i.id))));
    const keepFromTarget = ind => !sourceIndIds.has(String(ind.id)) && !removable.has(String(ind.id));

    // Items only the target has keep their place: each goes right after the item that
    // preceded it in the target, or first when nothing did
    const placeKept = (merged, targetList, keptItems) => {
        keptItems.forEach(item => {
            const at = targetList.findIndex(x => String(x.id) === String(item.id));
            let insertAt = 0;
            for(let k = at - 1; k >= 0; k--) {
                const pos = merged.findIndex(x => String(x.id) === String(targetList[k].id));
                if(pos >= 0) { insertAt = pos + 1; break; }
            }
            merged.splice(insertAt, 0, item);
        });
        return merged;
    };

    const result = (sourceUnits || []).map(su => {
        const copy = clone(su);
        copy.indicators = Array.isArray(copy.indicators) ? copy.indicators : [];
        const tu = targetById.get(String(su.id));
        if(tu) placeKept(copy.indicators, tu.indicators || [], (tu.indicators || []).filter(keepFromTarget).map(clone));
        return copy;
    });
    const keptUnits = [];
    (targetUnits || []).forEach(tu => {
        if(sourceUnitIds.has(String(tu.id))) return;
        const kept = (tu.indicators || []).filter(keepFromTarget).map(clone);
        if(removable.has(String(tu.id)) && kept.length === 0) return;
        keptUnits.push(Object.assign(clone(tu), { indicators: kept }));
    });
    return placeKept(result, targetUnits || [], keptUnits);
}

// Copies the open class's structure for the open term to the other classes of its grade.
// Only classes that share the structure are touched - ones with no units yet for the term, or
// with at least one unit id in common. A class whose teacher built its own structure (no ids
// in common) is left alone, unless `forceAll` (the explicit "sync to every room" button).
// `removedIds` are unit/indicator ids the teacher just deleted in the open class: they are
// removed from a sharing class too, but only where `peerScoresKnown` and that class has no
// score in them. Returns how many classes changed; details are left on
// window.lastStructureSync for the caller's message.
window.syncClassConfigToSameGrade = function(options = {}) {
    if(typeof options === 'boolean') options = { forceAll: options };
    const forceAll = !!options.forceAll;
    const removedIds = new Set((options.removedIds || []).map(String));
    const peerScoresKnown = !!options.peerScoresKnown;
    window.lastStructureSync = { changed: [], independent: [], keptDeleted: [] };
    window.lastStructureSyncSkipped = 0;

    let sd = window.getSubjectData(); if(!sd) return 0;
    let sourceCls = DB.classes[state.clsId]; if(!sourceCls) return 0;
    let gradeLevel = window.structureGradeOf(sourceCls);
    let sourceConfig = sd.classData && sd.classData[state.clsId]; if(!sourceConfig) return 0;
    const term = String(state.term);
    const sourceUnitsForTerm = window.termUnitsOfConfig(sourceConfig, term);
    const sourceExamForTerm = sourceConfig.examSettings ? sourceConfig.examSettings[term] : null;
    const sourceUnitIds = new Set(sourceUnitsForTerm.map(u => String(u.id)));
    removedIds.forEach(id => sourceUnitIds.add(id));
    let syncedCount = 0;

    Object.entries(DB.classes).forEach(([cId, cls]) => {
        if(cId === state.clsId || window.structureGradeOf(cls) !== gradeLevel) return;
        const peerConfig = sd.classData[cId] || { learningUnits: [], examSettings: {} };
        if(!Array.isArray(peerConfig.learningUnits)) peerConfig.learningUnits = [];
        if(!peerConfig.examSettings || typeof peerConfig.examSettings !== 'object') peerConfig.examSettings = {};
        const peerTermUnits = window.termUnitsOfConfig(peerConfig, term);
        const sharesStructure = peerTermUnits.length === 0 || peerTermUnits.some(u => sourceUnitIds.has(String(u.id)));
        if(!sharesStructure && !forceAll) {
            window.lastStructureSync.independent.push(cls.name);
            return;
        }

        // A deletion reaches this class only when its scores are known and none sit in the
        // deleted indicators; anything with a score here stays
        let removable = new Set();
        if(removedIds.size > 0 && sharesStructure && peerScoresKnown) {
            const peerIndIds = [];
            peerTermUnits.forEach(u => (u.indicators || []).forEach(i => {
                if(removedIds.has(String(i.id)) || removedIds.has(String(u.id))) peerIndIds.push(String(i.id));
            }));
            const scored = window.indicatorIdsWithScores(sd, cId, term, peerIndIds);
            removable = new Set(Array.from(removedIds).concat(peerIndIds).filter(id => !scored.has(id)));
            if(scored.size > 0) window.lastStructureSync.keptDeleted.push(cls.name);
        } else if(removedIds.size > 0 && peerTermUnits.some(u => removedIds.has(String(u.id)) || (u.indicators || []).some(i => removedIds.has(String(i.id))))) {
            window.lastStructureSync.keptDeleted.push(cls.name);
        }

        const before = window.canonicalJson({ u: peerTermUnits, e: peerConfig.examSettings[term] || null });
        const mergedTerm = window.mergeTermUnitsSafely(peerTermUnits, sourceUnitsForTerm, removable);
        const nextUnits = peerConfig.learningUnits.filter(u => !u || String(u.term) !== term).concat(mergedTerm);
        const nextExam = sourceExamForTerm ? JSON.parse(JSON.stringify(sourceExamForTerm)) : (peerConfig.examSettings[term] || null);
        // Nothing to write when only the key order differs (Firestore returns maps re-ordered)
        if(before === window.canonicalJson({ u: mergedTerm, e: nextExam })) return;

        // Removed ids are remembered so the cloud write does not put them back (see cloud.js)
        if(removable.size > 0 && typeof window.rememberStructureRemovals === 'function') {
            window.rememberStructureRemovals(state.subjId, cId, Array.from(removable));
        }
        peerConfig.learningUnits = nextUnits;
        if(nextExam) peerConfig.examSettings[term] = nextExam;
        sd.classData[cId] = peerConfig;
        // This class's structure changed too, so it has to go up with the save
        if(typeof window.markStructureClassDirty === 'function') window.markStructureClassDirty(state.subjId, cId);
        window.lastStructureSync.changed.push(cls.name);
        syncedCount++;
    });
    window.lastStructureSyncSkipped = window.lastStructureSync.independent.length;
    return syncedCount;
}

// The ids of the cloud's copy of a class structure that this device's copy no longer has, put
// back into this device's copy - except ids deleted on purpose (`removable`). Run on every
// structure write, so no stale or partial copy can take a column away from the cloud.
// Returns how many indicators were put back.
window.restoreMissingStructureItems = function(localConfig, cloudConfig, removable = new Set()) {
    if(!localConfig || !cloudConfig || !Array.isArray(cloudConfig.learningUnits)) return 0;
    if(!Array.isArray(localConfig.learningUnits)) localConfig.learningUnits = [];
    const clone = v => JSON.parse(JSON.stringify(v));
    const localUnitById = new Map(localConfig.learningUnits.map(u => [String(u.id), u]));
    const localIndIds = new Set();
    localConfig.learningUnits.forEach(u => (u.indicators || []).forEach(i => localIndIds.add(String(i.id))));
    let restored = 0;
    cloudConfig.learningUnits.forEach(cu => {
        if(!cu || !cu.id) return;
        const missing = (cu.indicators || []).filter(ci => ci && ci.id && !localIndIds.has(String(ci.id)) && !removable.has(String(ci.id)));
        const lu = localUnitById.get(String(cu.id));
        if(lu) {
            if(!Array.isArray(lu.indicators)) lu.indicators = [];
            missing.forEach(ci => { lu.indicators.push(clone(ci)); localIndIds.add(String(ci.id)); restored++; });
            return;
        }
        // A whole unit missing here: put it back unless it was deleted on purpose and nothing
        // in it is left to keep
        if(removable.has(String(cu.id)) && missing.length === 0) return;
        if(missing.length === 0 && (cu.indicators || []).length > 0) return;
        const unit = Object.assign(clone(cu), { indicators: missing.map(clone) });
        localConfig.learningUnits.push(unit);
        localUnitById.set(String(cu.id), unit);
        missing.forEach(ci => localIndIds.add(String(ci.id)));
        restored += missing.length;
    });
    return restored;
}
