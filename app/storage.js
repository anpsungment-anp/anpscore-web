/* ANPSCORE — บันทึกลงเครื่อง ติดตามข้อมูลค้าง และกันคะแนนหาย
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

if(window.repairAllSubjectScoreValues()) {
    localStorage.setItem('anpscore_subjectData', JSON.stringify(window.DB_SubjectData));
}

['pointerdown', 'keydown', 'wheel'].forEach(evtName => {
    document.addEventListener(evtName, () => { lastUserInteractionAt = Date.now(); }, { capture: true, passive: true });
});

// แคชลงเครื่องต้องไม่ทำให้การเซฟขึ้นคลาวด์ล้มตาม ถ้า localStorage เต็ม
// การโยน error ที่นี่จะทำให้ firebaseSaveFn() ใน saveDB() ไม่ได้ทำงาน
// แล้วคะแนนที่เพิ่งกรอกจะไม่ถูกบันทึกทั้งในเครื่องและบนคลาวด์
window.notifyLocalStorageFull = function(err) {
    console.warn('บันทึกแคชลงเครื่องไม่สำเร็จ', err);
    const now = Date.now();
    if(window._lastStorageWarnAt && now - window._lastStorageWarnAt < 60000) return;
    window._lastStorageWarnAt = now;
    if(window.notify) window.notify('พื้นที่จัดเก็บของเบราว์เซอร์เต็ม — คะแนนยังถูกบันทึกขึ้นคลาวด์ตามปกติ', 'error');
}
// เมื่อพื้นที่เต็ม ให้ทิ้งของที่สำคัญน้อยที่สุดก่อน แล้วค่อยลองเขียนใหม่
// เรียงจากทิ้งได้ง่ายสุดไปหาสำคัญสุด - ไม่แตะแคชคะแนนกับคิวที่รอส่งขึ้นคลาวด์
window.freeLocalStorageSpace = function() {
    let freedSomething = false;
    try {
        const moveKey = 'anpscore_student_move_backups';
        const raw = localStorage.getItem(moveKey);
        if(raw && raw.length > 0) {
            let backups = [];
            try { backups = JSON.parse(raw) || []; } catch(e) { backups = []; }
            if(backups.length > 3) {
                localStorage.setItem(moveKey, JSON.stringify(backups.slice(0, 3)));
                freedSomething = true;
            } else if(!backups.length) {
                localStorage.removeItem(moveKey);
                freedSomething = true;
            }
        }
    } catch(e) {}
    try {
        // เมื่อบันทึกกันคะแนนหายย้ายไปอยู่ IndexedDB แล้ว การตัดทิ้งไม่ได้คืนพื้นที่
        // localStorage อีกต่อไป จึงลบคีย์เก่าที่อาจตกค้างจากรุ่นก่อนแทน
        if(window.ANP_LOCAL_BLOB_READY) {
            if(localStorage.getItem(SCORE_SAFETY_LOG_KEY) !== null) {
                localStorage.removeItem(SCORE_SAFETY_LOG_KEY);
                freedSomething = true;
            }
        } else {
            const entries = Object.entries(scoreSafetyLog || {});
            if(entries.length > 2000) {
                entries.sort((a, b) => Number((b[1] || {}).savedAt || 0) - Number((a[1] || {}).savedAt || 0));
                scoreSafetyLog = Object.fromEntries(entries.slice(0, 2000));
                window.scoreSafetyLog = scoreSafetyLog;
                localStorage.setItem(SCORE_SAFETY_LOG_KEY, JSON.stringify(scoreSafetyLog));
                freedSomething = true;
            }
        }
    } catch(e) {}
    return freedSomething;
}

// เขียนลง localStorage แบบยอมล้างที่ว่างแล้วลองใหม่หนึ่งครั้ง
window.setLocalStorageItemSafely = function(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch(e) {
        if(window.freeLocalStorageSpace()) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch(inner) { return false; }
        }
        return false;
    }
}

window.saveLocalDB = function() {
    if(window.repairAllSubjectScoreValues) window.repairAllSubjectScoreValues();
    try {
        const okDb = window.setLocalStorageItemSafely('anpscore_db', JSON.stringify(window.DB));
        const okSubjects = window.setLocalStorageItemSafely('anpscore_subjectData', JSON.stringify(window.DB_SubjectData));
        if(!okDb || !okSubjects) window.notifyLocalStorageFull(new Error('localStorage quota exceeded'));
    } catch(e) { window.notifyLocalStorageFull(e); }
}

window.saveSubjectDataLocalNow = function(repair = false) {
    if(localSubjectSaveTimer) {
        clearTimeout(localSubjectSaveTimer);
        localSubjectSaveTimer = null;
    }
    if(repair && window.repairAllSubjectScoreValues) window.repairAllSubjectScoreValues();
    // แคชคะแนนทั้งโรงเรียนโตเกินเพดาน localStorage ไปแล้ว จึงเก็บลง IndexedDB แทน
    // ที่นั่นพื้นที่ระดับ GB และไม่ต้องแปลงเป็นข้อความก่อนเขียน
    if(window.ANP_LOCAL_BLOB_READY && typeof window.localBlobSet === 'function') {
        window.localBlobSet(window.ANP_SUBJECT_DATA_KEY, window.DB_SubjectData)
            .catch(err => console.warn('เขียนแคชคะแนนลง IndexedDB ไม่สำเร็จ', err));
        return;
    }
    try {
        if(!window.setLocalStorageItemSafely('anpscore_subjectData', JSON.stringify(window.DB_SubjectData))) {
            window.notifyLocalStorageFull(new Error('localStorage quota exceeded'));
        }
    } catch(e) { window.notifyLocalStorageFull(e); }
}

window.scheduleSubjectDataLocalSave = function(delay = 900) {
    if(localSubjectSaveTimer) clearTimeout(localSubjectSaveTimer);
    localSubjectSaveTimer = setTimeout(() => {
        localSubjectSaveTimer = null;
        window.saveSubjectDataLocalNow();
    }, delay);
}

window.persistPendingScoreSubjects = function() {
    try { localStorage.removeItem('anpscore_pendingScoreSubjects'); } catch(e) {}
}

window.scorePendingEntryKey = function(subId, clsId, stuId) {
    if(!subId || !clsId || !stuId) return '';
    return [subId, clsId, stuId].map(v => String(v || '').replace(/\|/g, '_')).join('|');
}

window.markScoreSubjectPending = function(subId = null, clsId = null, stuId = null) {
    const id = subId || state.subjId;
    if(!id) return;
    pendingScoreSubjects.add(id);
    const entryKey = window.scorePendingEntryKey(id, clsId || state.clsId, stuId);
    if(entryKey) pendingScoreEntries.add(entryKey);
    window.persistPendingScoreSubjects();
}

window.clearScoreSubjectPendingIfDone = function(subId = null, clsId = null, stuId = null) {
    const id = subId || state.subjId;
    if(!id) return;
    const entryKey = window.scorePendingEntryKey(id, clsId || state.clsId, stuId);
    if(entryKey) {
        const hasPendingEntry = Object.values(scoreAutoSavePending || {}).some(item => item && item.subId === id && item.clsId === (clsId || state.clsId) && item.stuId === stuId);
        if(!hasPendingEntry) pendingScoreEntries.delete(entryKey);
    }
    const hasPendingSubject = Object.values(scoreAutoSavePending || {}).some(item => item && item.subId === id) || Array.from(pendingScoreEntries).some(key => key.startsWith(`${id}|`));
    if(!hasPendingSubject) {
        pendingScoreSubjects.delete(id);
        window.persistPendingScoreSubjects();
    }
}

window.hasPendingScoreSubject = function(subId = null) {
    const id = subId || state.subjId;
    if(!id) return false;
    return pendingScoreSubjects.has(id) || Array.from(pendingScoreEntries).some(key => key.startsWith(`${id}|`)) || Object.values(scoreAutoSavePending || {}).some(item => item && item.subId === id);
}

window.hasPendingScoreEntry = function(subId = null, clsId = null, stuId = null) {
    const entryKey = window.scorePendingEntryKey(subId || state.subjId, clsId || state.clsId, stuId);
    if(!entryKey) return false;
    return pendingScoreEntries.has(entryKey) || Object.values(scoreAutoSavePending || {}).some(item => item && window.scorePendingEntryKey(item.subId, item.clsId, item.stuId) === entryKey);
}

// A pending autosave should only block an incoming cloud read for a short window -
// it exists to stop a stale cloud read from clobbering an edit that's still in flight.
// Entries that failed to sync long ago (or predate this timestamp field entirely) must
// not shadow fresh cloud data forever, or a permanently-failed old write silently hides
// real data that later syncs successfully (including re-imports) from ever showing up.
window.hasFreshPendingScoreEntry = function(subId = null, clsId = null, stuId = null, maxAgeMs = 10 * 60 * 1000) {
    const id = subId || state.subjId;
    const cId = clsId || state.clsId;
    if(!id || !cId || !stuId) return false;
    // The interactive scoring table writes directly (t_saveExam / t_saveIndicator) and
    // marks the cell pending via markScoreSubjectPending *before* awaiting the Firestore
    // call - it only falls back to the debounced scoreAutoSavePending queue if that direct
    // write fails. So a direct write still in flight only shows up in pendingScoreEntries,
    // never in scoreAutoSavePending. It's cleared the moment the write settles (success or
    // handed off to the retry queue), so it's safe to always treat it as fresh - unlike
    // scoreAutoSavePending, it can't get stuck.
    const entryKey = window.scorePendingEntryKey(id, cId, stuId);
    if(entryKey && pendingScoreEntries.has(entryKey)) return true;
    const now = Date.now();
    return Object.values(scoreAutoSavePending || {}).some(item => {
        if(!item || item.subId !== id || item.clsId !== cId || item.stuId !== stuId) return false;
        const since = Number(item.pendingSince || 0);
        if(!since) return false;
        return (now - since) < maxAgeMs;
    });
}

window.scoreClassDirtyKey = function(subId, clsId) {
    if(!subId || !clsId) return '';
    return [subId, clsId].map(v => encodeURIComponent(String(v || ''))).join('|');
}

window.persistScoreBundleDirtyClasses = function() {
    try {
        const keys = Array.from(scoreBundleDirtyClasses || []).filter(Boolean);
        if(keys.length > 0) localStorage.setItem('anpscore_dirtyScoreClasses', JSON.stringify(keys));
        else localStorage.removeItem('anpscore_dirtyScoreClasses');
    } catch(e) {}
}

window.markScoreClassBundleDirty = function(subId = null, clsId = null) {
    const sId = subId || state.subjId;
    const cId = clsId || state.clsId;
    if(!sId || !cId) return;
    scoreBundleDirtyClasses.add(window.scoreClassDirtyKey(sId, cId));
    window.persistScoreBundleDirtyClasses();
    if(typeof window.updateClassProgressSummaryLocal === 'function') {
        window.updateClassProgressSummaryLocal(sId, cId, state.term);
    }
    if(typeof window.firebaseScheduleProgressSummarySync === 'function') {
        window.firebaseScheduleProgressSummarySync(sId, cId, state.term);
    }
    window.markSubjectDirty(sId);
}

window.markAllScoreClassesDirty = function(subId = null) {
    const sId = subId || state.subjId;
    if(!sId) return;
    const subjectData = window.DB_SubjectData && window.DB_SubjectData[sId];
    const scores = (subjectData && subjectData.scores) || {};
    const classIds = Object.keys(scores);
    if(classIds.length === 0) {
        window.markSubjectDirty(sId);
        return;
    }
    classIds.forEach(clsId => window.markScoreClassBundleDirty(sId, clsId));
}

window.requestDirtyCloudFlush = function(delay = 1500) {
    if(cloudDirtyFlushTimer || typeof window.firebaseSaveFn !== 'function') return;
    const hasDirtyScoreClasses = scoreBundleDirtyClasses && scoreBundleDirtyClasses.size > 0;
    const hasDirtySubjects = window.dirtySubjects && window.dirtySubjects.size > 0;
    if(!hasDirtyScoreClasses && !hasDirtySubjects) return;

    cloudDirtyFlushTimer = setTimeout(() => {
        cloudDirtyFlushTimer = null;
        if(scoreBundleDirtyClasses && scoreBundleDirtyClasses.size > 0) {
            Array.from(scoreBundleDirtyClasses).forEach(key => {
                const subId = decodeURIComponent(String(key).split('|')[0] || '');
                if(subId) window.markSubjectDirty(subId);
            });
        }
        if(typeof window.firebaseSaveFn === 'function' && window.dirtySubjects && window.dirtySubjects.size > 0) {
            window.firebaseSaveFn();
        }
    }, delay);
}

window.requestScoreTableDataRefresh = function() {
    if(scoreTableRefreshTimer) clearTimeout(scoreTableRefreshTimer);
    scoreTableRefreshTimer = setTimeout(() => {
        scoreTableRefreshTimer = null;
        if(state.activePage !== 'teacher_scoring') return;
        const activeEl = document.activeElement;
        const isScoreInput = activeEl && activeEl.tagName === 'INPUT' && activeEl.id && activeEl.id.startsWith('inp-');
        if(isScoreInput && typeof window.t_updateScoreTableValues === 'function') window.t_updateScoreTableValues();
        else if(typeof window.t_renderScoreTable === 'function') window.t_renderScoreTable();
    }, 350);
}

window.persistDirtySubjects = function() {
    const ids = Array.from(window.dirtySubjects || []).filter(Boolean);
    if(ids.length > 0) localStorage.setItem('anpscore_dirtySubjects', JSON.stringify(ids));
    else localStorage.removeItem('anpscore_dirtySubjects');
}

window.markSubjectDirty = function(subId = null) {
    const id = subId || state.subjId;
    if(!id) return;
    if(!window.dirtySubjects) window.dirtySubjects = new Set();
    window.dirtySubjects.add(id);
    window.persistDirtySubjects();
}

pendingScoreSubjects.clear();
pendingScoreEntries.clear();
window.persistPendingScoreSubjects();

window.saveDB = function(targetSubjId = null) {
    window.DB = DB;
    window.DB_SubjectData = DB_SubjectData;
    window.saveLocalDB();
    
    window.markSubjectDirty(targetSubjId || state.subjId);

    if(typeof window.firebaseSaveFn === 'function') window.firebaseSaveFn();
}

// saveDB() ข้างบนเป็นแบบยิงแล้วจบ - หน่วงรอ 1.2 วินาทีแล้วค่อยส่งขึ้นคลาวด์ ไม่มีใครรู้ผล
// การแก้โครงสร้างคะแนน (หน่วย ตัวชี้วัด คะแนนสอบ) จึงเงียบสนิททั้งตอนสำเร็จและตอนล้มเหลว
// ตัวนี้บันทึกทันทีแล้วรายงานผลจริงกลับมาเป็น popup ใช้กับงานที่ทำไม่บ่อยแต่ต้องรู้ผลแน่ๆ
window.saveDBWithFeedback = async function(label, targetSubjId = null) {
    window.DB = DB;
    window.DB_SubjectData = DB_SubjectData;
    window.saveLocalDB();
    window.markSubjectDirty(targetSubjId || state.subjId);

    if(typeof window.firebaseSaveNowFn !== 'function') {
        if(typeof window.firebaseSaveFn === 'function') window.firebaseSaveFn();
        window.notify(`บันทึก${label}ในเครื่องแล้ว รอเชื่อมต่อคลาวด์`, true);
        return false;
    }
    try {
        await window.withCloudWriteTimeout(window.firebaseSaveNowFn(), 30000, 'structure save');
        window.notify(`บันทึก${label}สำเร็จ`);
        return true;
    } catch(err) {
        console.error(`บันทึก${label}ขึ้นคลาวด์ไม่สำเร็จ:`, err);
        if(typeof window.requestDirtyCloudFlush === 'function') window.requestDirtyCloudFlush(15000);
        window.notify(`บันทึก${label}ขึ้นคลาวด์ไม่สำเร็จ — เก็บในเครื่องแล้ว ระบบจะลองส่งใหม่อัตโนมัติ`, true);
        return false;
    }
}

window.scoreSafetyKey = function(subId, clsId, stuId, term, type) {
    return [subId, clsId, stuId, term, type].map(v => String(v || '').replace(/\|/g, '_')).join('|');
}

window.scoreSafetyLeafKey = function(type) {
    const parts = String(type || '').split('.').filter(Boolean);
    return parts[parts.length - 1] || '';
}

window.persistScoreSafetyLogNow = function(limit = SCORE_SAFETY_LOG_LIMIT) {
    if(scoreSafetyPersistTimer) {
        clearTimeout(scoreSafetyPersistTimer);
        scoreSafetyPersistTimer = null;
    }
    try {
        let entries = Object.entries(scoreSafetyLog || {});
        if(entries.length > limit) {
            entries.sort((a, b) => Number((b[1] || {}).savedAt || 0) - Number((a[1] || {}).savedAt || 0));
            scoreSafetyLog = Object.fromEntries(entries.slice(0, limit));
            window.scoreSafetyLog = scoreSafetyLog;
            entries = Object.entries(scoreSafetyLog);
        }
        // บันทึกกันคะแนนหายเก็บได้ถึง 12,000 รายการ ประมาณ 1 MB ซึ่งกินเพดาน
        // localStorage ไปมาก ย้ายมาไว้ IndexedDB เหมือนแคชคะแนน
        if(window.ANP_LOCAL_BLOB_READY && typeof window.localBlobSet === 'function') {
            const write = entries.length > 0
                ? window.localBlobSet(SCORE_SAFETY_LOG_KEY, scoreSafetyLog)
                : window.localBlobDelete(SCORE_SAFETY_LOG_KEY);
            write.catch(err => console.warn('เขียนบันทึกกันคะแนนหายลง IndexedDB ไม่สำเร็จ', err));
            return;
        }
        if(entries.length > 0) localStorage.setItem(SCORE_SAFETY_LOG_KEY, JSON.stringify(scoreSafetyLog));
        else localStorage.removeItem(SCORE_SAFETY_LOG_KEY);
    } catch(e) {
        try {
            const fallbackLimit = Math.max(500, Math.floor(limit / 2));
            const trimmed = Object.entries(scoreSafetyLog || {})
                .sort((a, b) => Number((b[1] || {}).savedAt || 0) - Number((a[1] || {}).savedAt || 0))
                .slice(0, fallbackLimit);
            scoreSafetyLog = Object.fromEntries(trimmed);
            window.scoreSafetyLog = scoreSafetyLog;
            localStorage.setItem(SCORE_SAFETY_LOG_KEY, JSON.stringify(scoreSafetyLog));
        } catch(inner) {
            console.warn('Score safety log could not be persisted:', inner);
        }
    }
}

window.scheduleScoreSafetyLogPersist = function(delay = 250) {
    if(scoreSafetyPersistTimer) clearTimeout(scoreSafetyPersistTimer);
    scoreSafetyPersistTimer = setTimeout(() => window.persistScoreSafetyLogNow(), delay);
}

window.rememberScoreSafetyValue = function(subId, clsId, stuId, term, type, val, options = {}) {
    if(!subId || !clsId || !stuId || !term || !type) return;
    const leaf = window.scoreSafetyLeafKey(type);
    const normalized = window.normalizeScoreValue ? window.normalizeScoreValue(val, leaf) : val;
    const isEmpty = normalized === '' || normalized === null || normalized === undefined;
    if(isEmpty && options.skipEmpty) return;
    const key = window.scoreSafetyKey(subId, clsId, stuId, term, type);
    scoreSafetyLog[key] = {
        subId: String(subId),
        clsId: String(clsId),
        stuId: String(stuId),
        term: String(term),
        type: String(type),
        val: isEmpty ? '' : normalized,
        cleared: !!isEmpty,
        savedAt: Date.now()
    };
    window.scoreSafetyLog = scoreSafetyLog;
    window.scheduleScoreSafetyLogPersist(options.persistDelay || 250);
}

window.getScoreSafetyRecord = function(subId, clsId, stuId, term, type) {
    const key = window.scoreSafetyKey(subId, clsId, stuId, term, type);
    return (scoreSafetyLog || {})[key] || null;
}

window.rememberScoreNodeInSafetyLog = function(subId, clsId, stuId, scoresNode, options = {}) {
    if(!scoresNode || typeof scoresNode !== 'object') return;
    Object.entries(scoresNode).forEach(([term, termNode]) => {
        if(!termNode || typeof termNode !== 'object') return;
        if(termNode.indicators && typeof termNode.indicators === 'object') {
            Object.entries(termNode.indicators).forEach(([indId, indScores]) => {
                if(!indScores || typeof indScores !== 'object') return;
                ['k', 'p', 'a'].forEach(type => {
                    if(indScores[type] !== undefined) {
                        window.rememberScoreSafetyValue(subId, clsId, stuId, term, `indicators.${indId}.${type}`, indScores[type], Object.assign({ skipEmpty: true, persistDelay: 900 }, options));
                    }
                });
            });
        }
        ['midTermScore', 'finalScore'].forEach(type => {
            if(termNode[type] !== undefined) {
                window.rememberScoreSafetyValue(subId, clsId, stuId, term, type, termNode[type], Object.assign({ skipEmpty: true, persistDelay: 900 }, options));
            }
        });
    });
}

window.markScoreStructureClearedInSafetyLog = function(subId, clsId, stuId, term, classConfig = {}) {
    const termUnits = (classConfig.learningUnits || []).filter(u => String(u.term) === String(term));
    termUnits.forEach(u => {
        (u.indicators || []).forEach(ind => {
            if(Number(ind.max_k || 0) > 0) window.rememberScoreSafetyValue(subId, clsId, stuId, term, `indicators.${ind.id}.k`, '', { persistDelay: 900 });
            if(Number(ind.max_p || 0) > 0) window.rememberScoreSafetyValue(subId, clsId, stuId, term, `indicators.${ind.id}.p`, '', { persistDelay: 900 });
            if(Number(ind.max_a || 0) > 0) window.rememberScoreSafetyValue(subId, clsId, stuId, term, `indicators.${ind.id}.a`, '', { persistDelay: 900 });
        });
    });
    const ex = classConfig.examSettings ? (classConfig.examSettings[term] || { mid: 20, final: 30 }) : { mid: 20, final: 30 };
    if(Number(ex.mid || 0) > 0) window.rememberScoreSafetyValue(subId, clsId, stuId, term, 'midTermScore', '', { persistDelay: 900 });
    if(Number(ex.final || 0) > 0) window.rememberScoreSafetyValue(subId, clsId, stuId, term, 'finalScore', '', { persistDelay: 900 });
}

window.recoverScoreCellIfMissing = function(subId, clsId, stuId, term, type, currentValue, applyValue = null) {
    const leaf = window.scoreSafetyLeafKey(type);
    const normalizedCurrent = window.normalizeScoreValue ? window.normalizeScoreValue(currentValue, leaf) : currentValue;
    if(normalizedCurrent !== '' && normalizedCurrent !== null && normalizedCurrent !== undefined) {
        window.rememberScoreSafetyValue(subId, clsId, stuId, term, type, normalizedCurrent, { skipEmpty: true, persistDelay: 900 });
        return normalizedCurrent;
    }

    const record = window.getScoreSafetyRecord(subId, clsId, stuId, term, type);
    if(!record || record.cleared) return currentValue;
    const recovered = window.normalizeScoreValue ? window.normalizeScoreValue(record.val, leaf) : record.val;
    if(recovered === '' || recovered === null || recovered === undefined) return currentValue;

    if(typeof applyValue === 'function') applyValue(recovered);
    const recoveryKey = window.scoreSafetyKey(subId, clsId, stuId, term, type);
    if(!scoreSafetyRecoveryKeys.has(recoveryKey)) {
        scoreSafetyRecoveryKeys.add(recoveryKey);
        window.scheduleScoreAutoSave(subId, clsId, stuId, term, type, recovered);
        window.saveSubjectDataLocalNow();
        console.warn('Recovered missing score cell from local safety log', { subId, clsId, stuId, term, type });
    }
    return recovered;
}

window.scoreAutoSaveKey = function(subId, clsId, stuId, term, type) {
    return [subId, clsId, stuId, term, type].map(v => String(v || '').replace(/\|/g, '_')).join('|');
}

// คิวคะแนนที่รอส่งขึ้นคลาวด์คือเกราะกันคะแนนหายตอนรีเฟรช/ปิดหน้าเว็บกลางคัน
// เดิมที่นี่กลืน error เงียบ ๆ พอ localStorage เต็ม คิวจะไม่ถูกเขียนลงเครื่องเลย
// โดยไม่มีสัญญาณอะไรบอก แล้วคะแนนที่ยังส่งไม่เสร็จก็หายไปพร้อมการรีเฟรช
// ซึ่งเป็นอาการคะแนนหายที่ตามหากันมานาน จึงต้องล้างที่ว่างแล้วลองใหม่
// และถ้ายังไม่สำเร็จต้องเตือนให้ชัด ไม่ใช่เงียบ
window.persistScoreAutoSavePending = function() {
    const keys = Object.keys(scoreAutoSavePending || {});
    if(keys.length === 0) {
        try { localStorage.removeItem('anpscore_pendingScoreCells'); } catch(e) {}
        return true;
    }
    if(window.setLocalStorageItemSafely('anpscore_pendingScoreCells', JSON.stringify(scoreAutoSavePending))) return true;
    window.notifyPendingQueueAtRisk(keys.length);
    return false;
}

window.notifyPendingQueueAtRisk = function(pendingCount) {
    console.warn('เขียนคิวคะแนนที่รอส่งขึ้นคลาวด์ลงเครื่องไม่สำเร็จ', pendingCount);
    const now = Date.now();
    if(window._lastPendingQueueWarnAt && now - window._lastPendingQueueWarnAt < 60000) return;
    window._lastPendingQueueWarnAt = now;
    if(window.notify) {
        window.notify(`พื้นที่จัดเก็บเต็ม — คะแนน ${pendingCount} ช่องที่รอส่งขึ้นคลาวด์จะหายถ้าปิดหรือรีเฟรชตอนนี้ กรุณากดบันทึกและรอจนขึ้นว่าสำเร็จก่อน`, true);
    }
}

window.setScoreAutoSaveStatus = function(status, message) {
    const el = document.getElementById('score-autosave-status');
    if(!el) return;
    const classes = {
        idle: 'bg-slate-50 text-slate-500 border-slate-200',
        pending: 'bg-amber-50 text-amber-700 border-amber-200',
        saved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        error: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    el.className = `px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 ${classes[status] || classes.idle}`;
    const icon = status === 'pending' ? 'ph-spinner-gap animate-spin' : (status === 'saved' ? 'ph-check-circle' : (status === 'error' ? 'ph-warning-circle' : 'ph-floppy-disk'));
    el.innerHTML = `<i class="ph ${icon} text-base"></i><span>${message}</span>`;
}

window.clearScoreAutoSave = function(subId, clsId, stuId, term, type) {
    const key = window.scoreAutoSaveKey(subId, clsId, stuId, term, type);
    if(scoreAutoSaveTimers[key]) clearTimeout(scoreAutoSaveTimers[key]);
    delete scoreAutoSaveTimers[key];
    delete scoreAutoSavePending[key];
    window.persistScoreAutoSavePending();
}

// A Firestore write promise only settles once the backend acknowledges the write. On a
// stalled connection the SDK keeps the write queued and the promise never settles - it
// neither resolves nor rejects - so anything awaiting it waits forever. Every cloud write
// the UI blocks on goes through this, so a silent stall surfaces as a normal sync failure
// (local save is already done, and the pending-cell queue retries) instead of a spinner
// that never stops.
window.withCloudWriteTimeout = function(promise, ms = 20000, label = 'write') {
    let timer = null;
    return Promise.race([
        Promise.resolve(promise).finally(() => { if(timer) clearTimeout(timer); }),
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                const err = new Error(`cloud ${label} was not acknowledged within ${Math.round(ms / 1000)}s`);
                err.isCloudWriteTimeout = true;
                reject(err);
            }, ms);
        })
    ]);
}

window.flushScoreAutoSave = async function(key) {
    const item = scoreAutoSavePending[key];
    if(!item) return;
    if(scoreAutoSaveTimers[key]) clearTimeout(scoreAutoSaveTimers[key]);
    if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) {
        const retryDelay = Math.min(Math.max(window.getCloudQuotaBackoffRemaining(), 30000), 5 * 60 * 1000);
        scoreAutoSaveTimers[key] = setTimeout(() => window.flushScoreAutoSave(key), retryDelay);
        window.markScoreSubjectPending(item.subId, item.clsId, item.stuId);
        window.setScoreAutoSaveStatus('error', 'บันทึกในเครื่องแล้ว รอคลาวด์ว่าง');
        return;
    }
    delete scoreAutoSaveTimers[key];
    delete scoreAutoSavePending[key];
    window.persistScoreAutoSavePending();

    try {
        if(typeof window.firebaseUpdateScore !== 'function' && typeof window.firebaseSaveFn !== 'function') {
            throw new Error('cloud score writer is not ready');
        }
        if(typeof window.firebaseUpdateScore === 'function') {
            await window.withCloudWriteTimeout(
                window.firebaseUpdateScore(item.subId, item.clsId, item.stuId, item.term, item.type, item.val),
                20000,
                'score cell write'
            );
        } else if(typeof window.firebaseSaveFn === 'function') {
            window.firebaseSaveFn();
        }
        window.clearScoreSubjectPendingIfDone(item.subId, item.clsId, item.stuId);
        window.setScoreAutoSaveStatus('saved', 'บันทึกอัตโนมัติแล้ว');
    } catch(err) {
        const quotaErr = window.isCloudQuotaError && window.isCloudQuotaError(err);
        if(!quotaErr) console.error('Score autosave failed:', err);
        if(quotaErr && window.activateCloudQuotaBackoff) {
            window.activateCloudQuotaBackoff(err);
        }
        const retryCount = Number(item.retryCount || 0) + 1;
        item.retryCount = retryCount;
        scoreAutoSavePending[key] = item;
        window.persistScoreAutoSavePending();
        const quotaDelay = window.getCloudQuotaBackoffRemaining ? window.getCloudQuotaBackoffRemaining() : 0;
        const retryDelay = quotaDelay > 0 ? Math.min(Math.max(quotaDelay, 30000), 5 * 60 * 1000) : Math.min(30000, 4000 * retryCount);
        if(retryCount <= 6) {
            scoreAutoSaveTimers[key] = setTimeout(() => window.flushScoreAutoSave(key), retryDelay);
            window.markScoreSubjectPending(item.subId, item.clsId, item.stuId);
            window.setScoreAutoSaveStatus('error', 'บันทึกในเครื่องแล้ว กำลังลองซิงก์อีกครั้ง');
        } else {
            window.markScoreSubjectPending(item.subId, item.clsId, item.stuId);
            window.setScoreAutoSaveStatus('error', 'บันทึกในเครื่องแล้ว รอเชื่อมต่อคลาวด์');
        }
    }
}

window.flushPendingScoreAutoSaves = async function(onProgress = null) {
    window.saveSubjectDataLocalNow();
    window.persistScoreSafetyLogNow();
    const keys = Object.keys(scoreAutoSavePending);
    const subjectIds = Array.from(new Set(keys.map(key => (scoreAutoSavePending[key] || {}).subId).filter(Boolean)));

    // Every pending entry is a single cell, but the cloud stores one document per student
    // and each per-cell write costs its own round trip through the sequential write queue.
    // Flushing a fully filled class one cell at a time is hundreds of round trips - minutes
    // of spinner. The values are all in the local score node already, so one batched write
    // per student document persists the whole lot. Cells being *cleared* still go through
    // the per-cell path: a batch write merges the pruned score node, which leaves the old
    // cloud value in place for a leaf that is now empty.
    const batchedItems = new Map();
    const perCellKeys = [];
    keys.forEach(key => {
        const item = scoreAutoSavePending[key];
        if(!item) return;
        const isEmptyValue = item.val === '' || item.val === null || item.val === undefined;
        if(isEmptyValue) perCellKeys.push(key);
        else batchedItems.set(key, item);
    });
    const batchedKeys = Array.from(batchedItems.keys());

    let batchedTargets = [];
    if(batchedKeys.length > 1 && typeof window.firebaseBatchWriteScoreNodes === 'function') {
        const seen = new Set();
        batchedItems.forEach(item => {
            const targetKey = window.scorePendingEntryKey(item.subId, item.clsId, item.stuId);
            if(!targetKey || seen.has(targetKey)) return;
            seen.add(targetKey);
            batchedTargets.push({ subId: item.subId, clsId: item.clsId, stuId: item.stuId });
        });
    }

    let flushedByBatch = false;
    if(batchedTargets.length > 0) {
        if(typeof onProgress === 'function') onProgress(0, batchedKeys.length + perCellKeys.length);
        try {
            const result = await window.firebaseBatchWriteScoreNodes(batchedTargets);
            flushedByBatch = !!(result && result.attempted && result.failed === 0);
        } catch(err) {
            console.warn('Batched pending score flush failed, falling back to per-cell writes:', err);
        }
    }

    if(flushedByBatch) {
        batchedItems.forEach((item, key) => {
            // A cell retyped while the batch was in flight has a fresh pending record with a
            // newer value and its own write already on the way - leave that one alone.
            if(scoreAutoSavePending[key] !== item) return;
            if(scoreAutoSaveTimers[key]) { clearTimeout(scoreAutoSaveTimers[key]); delete scoreAutoSaveTimers[key]; }
            delete scoreAutoSavePending[key];
        });
        window.persistScoreAutoSavePending();
        batchedTargets.forEach(t => window.clearScoreSubjectPendingIfDone(t.subId, t.clsId, t.stuId));
        if(typeof onProgress === 'function') onProgress(batchedKeys.length, batchedKeys.length + perCellKeys.length);
    }

    const remainingKeys = flushedByBatch ? perCellKeys : keys;
    let done = flushedByBatch ? batchedKeys.length : 0;
    const total = keys.length;
    await Promise.all(remainingKeys.map(async key => {
        await window.flushScoreAutoSave(key);
        done++;
        if(typeof onProgress === 'function') onProgress(done, total);
    }));

    if(typeof window.firebaseSyncProgressSummaryNow === 'function') {
        await Promise.all(subjectIds.map(subId => window.firebaseSyncProgressSummaryNow(subId)));
    }
}

window.scheduleScoreAutoSave = function(subId, clsId, stuId, term, type, val) {
    if(!subId || !clsId || !stuId || !term || !type) return;
    window.rememberScoreSafetyValue(subId, clsId, stuId, term, type, val);
    window.markScoreSubjectPending(subId, clsId, stuId);
    if(typeof window.updateClassProgressSummaryLocal === 'function') {
        window.updateClassProgressSummaryLocal(subId, clsId, term);
    }
    if(typeof window.firebaseScheduleProgressSummarySync === 'function') {
        window.firebaseScheduleProgressSummarySync(subId, clsId, term);
    }
    window.scheduleSubjectDataLocalSave();
    window.setScoreAutoSaveStatus('pending', 'กำลังบันทึกอัตโนมัติ...');

    const key = window.scoreAutoSaveKey(subId, clsId, stuId, term, type);
    scoreAutoSavePending[key] = { subId, clsId, stuId, term, type, val, pendingSince: Date.now() };
    window.persistScoreAutoSavePending();
    if(scoreAutoSaveTimers[key]) clearTimeout(scoreAutoSaveTimers[key]);
    scoreAutoSaveTimers[key] = setTimeout(() => window.flushScoreAutoSave(key), 900);
}

// The interactive scoring table (t_saveExam/t_saveSc) writes directly instead of going
// through the debounced scheduleScoreAutoSave queue above, for instant feedback. But every
// write - direct or debounced - still funnels through one global sequential Firestore queue
// (enqueueScoreWrite), so with many cells edited in quick succession a write can sit queued
// for a while before its turn comes up. That queue lives only in memory: if the page is
// refreshed or closed before a queued write's turn arrives, it is silently dropped - nothing
// was ever marked as failed, so nothing would have retried it, and nothing was protecting it
// from being overwritten by a stale cloud read on the next load. Registering a persisted
// pending record up front (mirroring scheduleScoreAutoSave's bookkeeping, minus the 900ms
// debounce timer since the direct call already fires immediately) closes that gap: the
// record survives a refresh, restorePendingScoreAutosaves() retries it on the next load, and
// hasFreshPendingScoreEntry keeps protecting it from a stale cloud read in the meantime.
window.registerPendingScoreWrite = function(subId, clsId, stuId, term, type, val) {
    if(!subId || !clsId || !stuId || !term || !type) return;
    const key = window.scoreAutoSaveKey(subId, clsId, stuId, term, type);
    scoreAutoSavePending[key] = { subId, clsId, stuId, term, type, val, pendingSince: Date.now() };
    window.persistScoreAutoSavePending();
}

window.resolvePendingScoreWrite = function(subId, clsId, stuId, term, type) {
    const key = window.scoreAutoSaveKey(subId, clsId, stuId, term, type);
    if(scoreAutoSaveTimers[key]) { clearTimeout(scoreAutoSaveTimers[key]); delete scoreAutoSaveTimers[key]; }
    delete scoreAutoSavePending[key];
    window.persistScoreAutoSavePending();
    window.clearScoreSubjectPendingIfDone(subId, clsId, stuId);
}

window.restorePendingScoreAutosaves = function() {
    let hasRestored = false;
    Object.keys(scoreAutoSavePending || {}).forEach(key => {
        const item = scoreAutoSavePending[key];
        if(!item || !item.subId || !item.clsId || !item.stuId || !item.term || !item.type) {
            delete scoreAutoSavePending[key];
            return;
        }
        window.markScoreSubjectPending(item.subId, item.clsId, item.stuId);
        hasRestored = true;
    });
    window.persistScoreAutoSavePending();
    // Marking pending status alone doesn't push anything to the cloud - a score that was
    // still queued for its cloud write when the page closed (refresh, tab close, crash)
    // would otherwise sit here forever with nothing actively retrying it. Kick off a retry
    // for everything restored so an interrupted save actually finishes on the next load.
    if(hasRestored && typeof window.retryPendingScoreAutoSaves === 'function') {
        window.retryPendingScoreAutoSaves(1200);
    }
}

window.getPendingScoreCellCount = function() {
    return Object.keys(scoreAutoSavePending || {}).length;
}

window.retryPendingScoreAutoSaves = function(delay = 1800) {
    Object.keys(scoreAutoSavePending || {}).forEach(key => {
        if(scoreAutoSaveTimers[key]) return;
        scoreAutoSaveTimers[key] = setTimeout(() => window.flushScoreAutoSave(key), delay);
    });
}

window.restorePendingScoreAutosaves();

document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden' && Object.keys(scoreAutoSavePending).length > 0) {
        window.saveSubjectDataLocalNow();
        window.persistScoreSafetyLogNow();
        window.flushPendingScoreAutoSaves();
    }
});

window.addEventListener('beforeunload', () => {
    if(Object.keys(scoreAutoSavePending).length > 0) {
        window.saveSubjectDataLocalNow();
    }
    window.persistScoreSafetyLogNow();
});
