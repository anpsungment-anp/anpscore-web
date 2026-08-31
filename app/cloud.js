/* ANPSCORE — ชั้นข้อมูลคลาวด์ ซิงก์กับ Firestore
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

import { doc, setDoc, onSnapshot, collection, deleteDoc, updateDoc, getDoc, getDocs, query, where, serverTimestamp, FieldPath, arrayUnion, runTransaction, deleteField, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// การตั้งค่า Firebase และการยืนยันตัวตนทั้งหมดย้ายไปอยู่ที่ auth/session.js
// เพื่อให้ index.html, pp1.html และ schedule.html ใช้บัญชีชุดเดียวกัน
import {
    auth, db, onSession, signInTeacher, signInAdmin, signOutNow,
    loadPublicDirectory, writePublicDirectory, describeAuthError,
    changeOwnPassword, createAccount, lookupAccountUid, generatePassword,
    teacherEmail, writeRole, readRole, setRoleActive, ADMIN_EMAIL, MIN_PASSWORD_LENGTH
} from "../auth/session.js";

if (auth && db) {

    let isAppStarted = false;
    let dbLoaded = false;
    let subjLoaded = false;
    let scoreEntriesLoaded = true;
    const sessionId = sessionStorage.getItem('anpscore_session_id') || (crypto.randomUUID ? crypto.randomUUID() : 'sess_' + Math.random().toString(36).slice(2));
    sessionStorage.setItem('anpscore_session_id', sessionId);

    const clone = (obj) => {
        if(obj === undefined) return undefined;
        if(obj === null) return null;
        if(typeof obj !== 'object') return obj;
        return JSON.parse(JSON.stringify(obj));
    };
    const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
    const deepMerge = (base, override) => {
        if(Array.isArray(override)) return clone(override);
        if(!isPlainObject(override)) return override !== undefined ? override : clone(base);

        const output = isPlainObject(base) ? clone(base) : {};
        Object.entries(override).forEach(([key, value]) => {
            if(value === undefined) return;
            output[key] = isPlainObject(value) && isPlainObject(output[key])
                ? deepMerge(output[key], value)
                : clone(value);
        });
        return output;
    };
    const pruneEmptyScorePayload = (node) => {
        if(Array.isArray(node)) return node.length > 0 ? clone(node) : undefined;
        if(isPlainObject(node)) {
            const output = {};
            Object.entries(node).forEach(([key, value]) => {
                const pruned = pruneEmptyScorePayload(value);
                if(pruned === undefined) return;
                if(isPlainObject(pruned) && Object.keys(pruned).length === 0) return;
                output[key] = pruned;
            });
            return Object.keys(output).length > 0 ? output : undefined;
        }
        if(node === '' || node === null || node === undefined) return undefined;
        return node;
    };
    const defaultDb = () => clone(window.DEFAULT_DB || {
        schoolInfo: { name: "", logo: "", director: "", academicHead: "", term: "1", year: "2566", themeMode: "light", scoreEntryPolicy: { mode: "always", startDate: "", endDate: "", notice: "" } },
        gradeSettings: { "4.0": 80, "3.5": 75, "3.0": 70, "2.5": 65, "2.0": 60, "1.5": 55, "1.0": 50, "passThreshold": 50 },
        teachers: [],
        classes: {},
        subjects: []
    });
    const emptySubject = () => ({ classData: {}, scores: {} });
    const readStoredData = (raw, fallbackFactory) => {
        let legacyData = null;
        if(raw && typeof raw.jsonStr === 'string' && raw.jsonStr.trim()) {
            try { legacyData = JSON.parse(raw.jsonStr); } catch(e) { console.error("Could not parse Firestore jsonStr:", e); }
        }
        if(raw && raw.data && typeof raw.data === 'object') {
            return legacyData ? deepMerge(legacyData, raw.data) : clone(raw.data);
        }
        return legacyData || fallbackFactory();
    };
    const normalizeDb = (incoming) => {
        const base = defaultDb();
        const data = incoming && typeof incoming === 'object' ? incoming : {};
        base.schoolInfo = Object.assign(base.schoolInfo, data.schoolInfo || {});
        base.gradeSettings = Object.assign(base.gradeSettings, data.gradeSettings || {});
        base.teachers = Array.isArray(data.teachers) ? data.teachers : [];
        base.classes = data.classes && typeof data.classes === 'object' ? data.classes : {};
        base.subjects = Array.isArray(data.subjects) ? data.subjects : [];
        return base;
    };
    const normalizeSubject = (incoming) => {
        const data = incoming && typeof incoming === 'object' ? clone(incoming) : emptySubject();
        if(!data.classData || typeof data.classData !== 'object') data.classData = {};
        if(!data.scores || typeof data.scores !== 'object') data.scores = {};
        if(window.normalizeSubjectScores) window.normalizeSubjectScores(data);
        return data;
    };
    const stripSubjectScores = (incoming) => {
        const data = normalizeSubject(incoming);
        const output = clone(data);
        output.scores = {};
        return output;
    };
    const scoreEntryDocId = (subId, clsId, stuId) => {
        return [subId, clsId, stuId].map(v => encodeURIComponent(String(v || ''))).join('__');
    };
    const ensureSubjectScoreSlot = (subId, clsId, stuId) => {
        if(!window.DB_SubjectData[subId]) window.DB_SubjectData[subId] = { classData: {}, scores: {} };
        if(!window.DB_SubjectData[subId].scores) window.DB_SubjectData[subId].scores = {};
        if(!window.DB_SubjectData[subId].scores[clsId]) window.DB_SubjectData[subId].scores[clsId] = {};
        if(!window.DB_SubjectData[subId].scores[clsId][stuId]) window.DB_SubjectData[subId].scores[clsId][stuId] = {};
        return window.DB_SubjectData[subId].scores[clsId][stuId];
    };
    const shouldRepairSubjectDoc = (raw) => {
        if(!raw || typeof raw !== 'object') return false;
        if(!raw.data || typeof raw.data !== 'object') return true;
        if(!raw.data.classData || typeof raw.data.classData !== 'object') return true;
        if(!raw.data.scores || typeof raw.data.scores !== 'object') return true;
        if(typeof raw.jsonStr !== 'string' || !raw.jsonStr.trim()) return false;
        try {
            const legacy = JSON.parse(raw.jsonStr);
            const legacyClassCount = legacy && legacy.classData ? Object.keys(legacy.classData).length : 0;
            const dataClassCount = raw.data.classData ? Object.keys(raw.data.classData).length : 0;
            const legacyScoreCount = legacy && legacy.scores ? Object.keys(legacy.scores).length : 0;
            const dataScoreCount = raw.data.scores ? Object.keys(raw.data.scores).length : 0;
            return legacyClassCount > dataClassCount || legacyScoreCount > dataScoreCount;
        } catch(e) {
            return false;
        }
    };
    const repairSubjectDoc = (subjectsColRef, subId, subjData) => {
        const normalized = stripSubjectScores(subjData);
        return setDoc(doc(subjectsColRef, subId), {
            data: normalized,
            updatedAt: serverTimestamp()
        });
    };
    const markCloudOk = () => window.setCloudSyncState({ mode: 'cloud', connected: true, lastError: '' });
    const markCloudError = (err) => {
        if(window.isCloudQuotaError && window.isCloudQuotaError(err)) {
            window.activateCloudQuotaBackoff(err);
            return;
        }
        console.error(err);
        window.setCloudSyncState({ mode: 'local', connected: false, lastError: err?.message || String(err) });
    };

    const startLocalMode = (err = null) => {
        if(err) markCloudError(err);
        else window.setCloudSyncState({ mode: 'local', connected: false, lastError: '' });
        if(!isAppStarted) {
            isAppStarted = true;
            if(window.initializeAppUI) window.initializeAppUI();
        }
    };

    // ชั้นข้อมูลคลาวด์จะเริ่มทำงานหลังล็อกอินสำเร็จเท่านั้น
    // เดิมเริ่มทันทีที่เปิดหน้าเว็บด้วยบัญชีนิรนาม ข้อมูลนักเรียนจึงหลุดถึงคนนอก
    let cloudLayerStarted = false;

    const startCloudLayer = () => {
        if(cloudLayerStarted) return;
        cloudLayerStarted = true;
        {
            const docRefDb = doc(db, 'anpscore', 'core_db');
            const subjectsColRef = collection(db, 'anpscore', 'data', 'subjects');
            const scoreEntriesColRef = collection(db, 'anpscore', 'data', 'scoreEntries');
            const presenceColRef = collection(db, 'anpscore', 'data', 'presence');
            const scoreLocksColRef = collection(db, 'anpscore', 'data', 'scoreLocks');
            const archivesColRef = collection(db, 'anpscore', 'data', 'archives');

            // ---- คลังข้อมูลรายปีการศึกษา ----------------------------------
            // ระบบเก็บคะแนนสดได้ปีเดียว จึงต้อง snapshot ไว้ก่อนขึ้นปีใหม่
            // เก็บเป็น "ข้อมูลพร้อมออกรายงาน" แยกเอกสารต่อ ปี/ภาคเรียน/ห้อง
            // ทำให้แต่ละเอกสารเล็ก ไม่ชนเพดาน 1MB ของ Firestore
            const archiveDocId = (year, term, clsId) =>
                [year, term, clsId].map(v => encodeURIComponent(String(v || ''))).join('__');

            window.firebaseSaveYearArchive = async (year, snapshot) => {
                if(!auth.currentUser) throw new Error('ยังไม่ได้เชื่อมต่อคลาวด์');
                const entries = snapshot.entries || [];
                for(let i = 0; i < entries.length; i += 100) {
                    const batch = writeBatch(db);
                    entries.slice(i, i + 100).forEach(entry => {
                        batch.set(doc(archivesColRef, archiveDocId(year, entry.term, entry.classId)), {
                            year: String(year), term: String(entry.term), classId: String(entry.classId),
                            payload: JSON.stringify(entry.payload),
                            updatedAt: serverTimestamp()
                        });
                    });
                    await batch.commit();
                }
                await setDoc(doc(archivesColRef, `_index__${encodeURIComponent(String(year))}`), {
                    isIndex: true, year: String(year),
                    terms: Array.from(new Set(entries.map(e => String(e.term)))).sort(),
                    classCount: new Set(entries.map(e => String(e.classId))).size,
                    schoolName: (DB.schoolInfo && DB.schoolInfo.name) || '',
                    createdAt: new Date().toISOString(),
                    createdBy: (state.user && state.user.name) || 'ผู้ดูแลระบบ'
                });
                return entries.length;
            };

            window.firebaseListArchiveYears = async () => {
                if(!auth.currentUser) return [];
                const snap = await getDocs(query(archivesColRef, where('isIndex', '==', true)));
                const years = [];
                snap.forEach(d => years.push(d.data()));
                return years.sort((a, b) => String(b.year).localeCompare(String(a.year), 'th', { numeric: true }));
            };

            window.firebaseLoadArchiveClass = async (year, term, clsId) => {
                if(!auth.currentUser) return null;
                const snap = await getDoc(doc(archivesColRef, archiveDocId(year, term, clsId)));
                if(!snap.exists()) return null;
                try { return JSON.parse(snap.data().payload || 'null'); }
                catch(e) { console.warn('อ่านคลังข้อมูลไม่สำเร็จ:', e); return null; }
            };

            window.firebaseListArchiveClasses = async (year, term) => {
                if(!auth.currentUser) return [];
                const snap = await getDocs(query(archivesColRef,
                    where('year', '==', String(year)), where('term', '==', String(term))));
                const list = [];
                snap.forEach(d => { const x = d.data(); if(!x.isIndex) list.push({ classId: x.classId }); });
                return list;
            };

            let saveTimeout = null;
            if (!window.dirtySubjects) window.dirtySubjects = new Set();
            const pendingSubjectRepairs = new Set();
            let activeSubjectUnsubscribe = null;
            let activeScoreEntryUnsubscribes = [];
            let activeSubjectKey = '';
            let activeScoreLockUnsubscribe = null;
            let activeScoreLockKey = '';
            let scoreWriteQueue = Promise.resolve();
            const progressSummaryWriteTimers = new Map();
            const progressSummaryWriteChains = new Map();
            const progressSummaryDirtyKeys = new Map();

            const enqueueScoreWrite = (runWrite) => {
                const queued = scoreWriteQueue.catch(() => {}).then(runWrite);
                scoreWriteQueue = queued.catch(() => {});
                return queued;
            };

            const applyCloudSubjectDoc = (subId, rawSubjectDoc) => {
                const hasDirtySubject = window.dirtySubjects && window.dirtySubjects.has(subId) && window.DB_SubjectData && window.DB_SubjectData[subId];
                const hasUnsyncedLocalSubject = hasDirtySubject;
                if(hasUnsyncedLocalSubject) {
                    if(hasDirtySubject && typeof window.firebaseSaveFn === 'function') window.firebaseSaveFn();
                    return false;
                }

                try {
                    const loadedSubject = readStoredData(rawSubjectDoc, emptySubject);
                    const scoreValuesNeedRepair = window.subjectScoresNeedRepair ? window.subjectScoresNeedRepair(loadedSubject) : false;
                    const existingScores = clone((window.DB_SubjectData[subId] && window.DB_SubjectData[subId].scores) || {});
                    const normalizedSubject = normalizeSubject(loadedSubject);
                    normalizedSubject.scores = deepMerge(normalizedSubject.scores || {}, existingScores);
                    window.DB_SubjectData[subId] = normalizedSubject;
                    if((shouldRepairSubjectDoc(rawSubjectDoc) || scoreValuesNeedRepair) && !pendingSubjectRepairs.has(subId)) {
                        pendingSubjectRepairs.add(subId);
                        writeSubjectMetaDoc(subId, window.DB_SubjectData[subId])
                            .then(markCloudOk)
                            .catch(markCloudError)
                            .finally(() => pendingSubjectRepairs.delete(subId));
                    }
                    return true;
                } catch(e) {
                    console.error(e);
                    return false;
                }
            };

            const persistSubjectCacheAndRefresh = (subId = '') => {
                if(window.scheduleSubjectDataLocalSave) window.scheduleSubjectDataLocalSave(1200);
                else localStorage.setItem('anpscore_subjectData', JSON.stringify(window.DB_SubjectData));
                if(subId && isAppStarted && state.activePage === 'teacher_scoring' && state.subjId === subId) {
                    if(window.requestScoreTableDataRefresh) window.requestScoreTableDataRefresh();
                    else {
                        const activeEl = document.activeElement;
                        const isScoreInput = activeEl && activeEl.tagName === 'INPUT' && activeEl.id && activeEl.id.startsWith('inp-');
                        if(isScoreInput && typeof window.t_updateScoreTableValues === 'function') window.t_updateScoreTableValues();
                        else window.t_renderScoreTable();
                    }
                }
            };

            const writeSubjectMetaDoc = (subId, subjData) => {
                return setDoc(doc(subjectsColRef, subId), {
                    data: stripSubjectScores(subjData),
                    updatedAt: serverTimestamp()
                });
            };

            const markProgressSummaryDirty = (subId, clsId, term) => {
                if(!subId || !clsId || !term) return;
                const summary = window.DB_SubjectData[subId] && window.DB_SubjectData[subId].progressSummary
                    && window.DB_SubjectData[subId].progressSummary[String(term)]
                    ? window.DB_SubjectData[subId].progressSummary[String(term)][String(clsId)]
                    : null;
                if(!summary) return;
                if(!progressSummaryDirtyKeys.has(subId)) progressSummaryDirtyKeys.set(subId, new Map());
                const key = `${encodeURIComponent(String(term))}|${encodeURIComponent(String(clsId))}`;
                progressSummaryDirtyKeys.get(subId).set(key, Number(summary.updatedAt || Date.now()));
            };

            window.firebaseSyncProgressSummaryNow = (subId, clsId = '', term = '') => {
                if(!auth.currentUser || !subId || !window.DB_SubjectData[subId]) return Promise.resolve(false);
                if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) return Promise.resolve(false);
                markProgressSummaryDirty(subId, clsId, term);
                if(progressSummaryWriteTimers.has(subId)) {
                    clearTimeout(progressSummaryWriteTimers.get(subId));
                    progressSummaryWriteTimers.delete(subId);
                }

                const previous = progressSummaryWriteChains.get(subId) || Promise.resolve();
                const queued = previous.catch(() => {}).then(async () => {
                    const dirtyMap = progressSummaryDirtyKeys.get(subId);
                    if(!dirtyMap || dirtyMap.size === 0) return false;
                    const dirtySnapshot = new Map(dirtyMap);
                    const updateArgs = [];
                    const fallbackProgressSummary = {};
                    dirtySnapshot.forEach((version, encodedKey) => {
                        const [encodedTerm, encodedClass] = String(encodedKey).split('|');
                        const targetTerm = decodeURIComponent(encodedTerm || '');
                        const targetClass = decodeURIComponent(encodedClass || '');
                        const summary = window.DB_SubjectData[subId] && window.DB_SubjectData[subId].progressSummary
                            && window.DB_SubjectData[subId].progressSummary[targetTerm]
                            ? window.DB_SubjectData[subId].progressSummary[targetTerm][targetClass]
                            : null;
                        if(!summary) return;
                        updateArgs.push(new FieldPath('data', 'progressSummary', targetTerm, targetClass), clone(summary));
                        if(!fallbackProgressSummary[targetTerm]) fallbackProgressSummary[targetTerm] = {};
                        fallbackProgressSummary[targetTerm][targetClass] = clone(summary);
                    });
                    if(updateArgs.length === 0) return false;
                    const subjectRef = doc(subjectsColRef, subId);
                    try {
                        await updateDoc(subjectRef, ...updateArgs, 'updatedAt', serverTimestamp());
                    } catch(err) {
                        if(String(err && err.code || '').includes('not-found')) {
                            await setDoc(subjectRef, { data: { progressSummary: fallbackProgressSummary }, updatedAt: serverTimestamp() }, { merge: true });
                        } else {
                            throw err;
                        }
                    }
                    dirtySnapshot.forEach((version, key) => {
                        if(dirtyMap.get(key) === version) dirtyMap.delete(key);
                    });
                    if(dirtyMap.size === 0) progressSummaryDirtyKeys.delete(subId);
                    markCloudOk();
                    return true;
                });
                progressSummaryWriteChains.set(subId, queued);
                return queued.catch(err => {
                    markCloudError(err);
                    throw err;
                }).finally(() => {
                    if(progressSummaryWriteChains.get(subId) === queued) progressSummaryWriteChains.delete(subId);
                });
            };

            window.firebaseScheduleProgressSummarySync = (subId, clsId = '', term = '', delay = 2500) => {
                if(!subId || !window.DB_SubjectData[subId]) return;
                markProgressSummaryDirty(subId, clsId, term);
                if(progressSummaryWriteTimers.has(subId)) clearTimeout(progressSummaryWriteTimers.get(subId));
                progressSummaryWriteTimers.set(subId, setTimeout(() => {
                    progressSummaryWriteTimers.delete(subId);
                    window.firebaseSyncProgressSummaryNow(subId).catch(() => {});
                }, Math.max(500, Number(delay) || 2500)));
            };

            window.firebaseBackfillDashboardProgress = async (pairs = []) => {
                if(!auth.currentUser || !Array.isArray(pairs) || pairs.length === 0) return { synced: true, count: 0 };
                const grouped = new Map();
                pairs.forEach(pair => {
                    if(!pair || !pair.subId || !pair.cId) return;
                    if(!grouped.has(pair.subId)) grouped.set(pair.subId, { term: String(pair.term || state.term), classIds: new Set() });
                    grouped.get(pair.subId).classIds.add(String(pair.cId));
                });

                let completed = 0;
                for(const [subId, request] of grouped.entries()) {
                    if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) break;
                    const classIds = request.classIds;
                    const scoreSnapshot = await getDocs(query(scoreEntriesColRef, where('subId', '==', String(subId))));
                    scoreSnapshot.forEach(scoreDoc => {
                        const entryData = scoreDoc.data();
                        if(entryData && classIds.has(String(entryData.clsId || ''))) mergeScoreEntryData(entryData);
                    });
                    classIds.forEach(cId => {
                        window.updateClassProgressSummaryLocal(subId, cId, request.term);
                        window.firebaseScheduleProgressSummarySync(subId, cId, request.term, 60000);
                        completed++;
                    });
                    persistSubjectCacheAndRefresh(subId);
                    await window.firebaseSyncProgressSummaryNow(subId);
                }
                return { synced: completed === pairs.length, count: completed };
            };

            window.firebaseLoadScoresForSubjectsBulk = async (subIds = []) => {
                if(!auth.currentUser) return { attempted: false, failed: 0 };
                const uniqueSubIds = Array.from(new Set((subIds || []).filter(Boolean).map(String)));
                if(!uniqueSubIds.length) return { attempted: false, failed: 0 };
                let failed = 0;
                let changed = false;
                for(const subId of uniqueSubIds) {
                    if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) { failed++; continue; }
                    try {
                        const scoreSnapshot = await getDocs(query(scoreEntriesColRef, where('subId', '==', subId)));
                        scoreSnapshot.forEach(scoreDoc => {
                            const entryData = scoreDoc.data();
                            if(entryData && mergeScoreEntryData(entryData)) changed = true;
                        });
                        persistSubjectCacheAndRefresh(subId);
                        markCloudOk();
                    } catch(err) {
                        if(window.isCloudQuotaError && window.isCloudQuotaError(err)) window.activateCloudQuotaBackoff(err);
                        console.warn('Bulk subject score load failed:', subId, err);
                        failed++;
                    }
                }
                return { attempted: true, failed, changed };
            };

            const getScoreUpdatedBy = () => {
                const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : {};
                return {
                    id: String(actor.actorId || ''),
                    name: String(actor.displayName || ''),
                    role: String(actor.role || ''),
                    sessionId
                };
            };

            const writeStudentScoreDocNow = (subId, clsId, stuId, scoresNode, options = {}) => {
                const scorePayload = options.includeEmptyScores
                    ? clone(scoresNode || {})
                    : (pruneEmptyScorePayload(scoresNode || {}) || {});
                if(!options.includeEmptyScores && Object.keys(scorePayload).length === 0) return Promise.resolve(false);
                return setDoc(doc(scoreEntriesColRef, scoreEntryDocId(subId, clsId, stuId)), {
                    subId: String(subId),
                    clsId: String(clsId),
                    stuId: String(stuId),
                    scores: scorePayload,
                    updatedBy: getScoreUpdatedBy(),
                    updatedAt: serverTimestamp()
                }, { merge: true });
            };

            // The cloud keeps one document per student, and every single-document write goes
            // through enqueueScoreWrite - one global sequential queue. Saving a class one
            // student at a time therefore costs one full round trip each, so a 40-student
            // class takes tens of seconds on school wifi with the save button spinning the
            // whole time. A batch commit persists up to 400 student documents per round trip.
            // Batches deliberately stay outside enqueueScoreWrite: their payload is read from
            // local data, which always holds the newest value, so whichever order a batch and
            // a queued single-cell write settle in, both carry the same value.
            const commitScoreEntryBatches = async (entries = [], options = {}) => {
                const list = (entries || []).filter(entry => entry && entry.subId && entry.clsId && entry.stuId);
                if(!list.length) return { attempted: false, failed: 0, total: 0 };
                const skipEmpty = options.skipEmpty === true;
                const chunkSize = 400;
                let failed = 0;
                for(let i = 0; i < list.length; i += chunkSize) {
                    if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) {
                        failed += list.length - i;
                        break;
                    }
                    const chunk = list.slice(i, i + chunkSize);
                    try {
                        const batch = writeBatch(db);
                        const updatedBy = getScoreUpdatedBy();
                        let queuedWrites = 0;
                        chunk.forEach(({ subId, clsId, stuId, scoresNode }) => {
                            const source = scoresNode || (((window.DB_SubjectData[subId] || {}).scores || {})[clsId] || {})[stuId] || {};
                            const scorePayload = pruneEmptyScorePayload(source) || {};
                            if(skipEmpty && Object.keys(scorePayload).length === 0) return;
                            queuedWrites++;
                            batch.set(doc(scoreEntriesColRef, scoreEntryDocId(subId, clsId, stuId)), {
                                subId: String(subId),
                                clsId: String(clsId),
                                stuId: String(stuId),
                                scores: scorePayload,
                                updatedBy,
                                updatedAt: serverTimestamp()
                            }, { merge: true });
                        });
                        if(queuedWrites === 0) continue;
                        // A Firestore write promise only settles once the backend acknowledges
                        // it. On a stalled connection the SDK queues the write and the promise
                        // stays pending forever - never resolving, never rejecting - which used
                        // to leave the save spinner running with no way out. Give up waiting
                        // after a while and report it as unacknowledged: the write is still
                        // queued in the SDK and the caller's own retry path takes over, and a
                        // repeated merge write of the same values is harmless either way.
                        await window.withCloudWriteTimeout(batch.commit(), 20000, 'batch score write');
                        markCloudOk();
                    } catch(err) {
                        if(window.isCloudQuotaError && window.isCloudQuotaError(err)) window.activateCloudQuotaBackoff(err);
                        console.warn('Batch score write failed:', err);
                        failed += chunk.length;
                    }
                }
                return { attempted: true, failed, total: list.length };
            };

            window.firebaseBatchWriteScoreNodes = async (targets = []) => {
                if(!auth.currentUser) return { attempted: false, failed: (targets || []).length, total: (targets || []).length };
                const seen = new Set();
                const uniqueTargets = (targets || []).filter(t => {
                    if(!t || !t.subId || !t.clsId || !t.stuId) return false;
                    const key = `${t.subId}|${t.clsId}|${t.stuId}`;
                    if(seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                return commitScoreEntryBatches(uniqueTargets);
            };

            const writeSubjectScoreDocs = async (subId, subjData, classIdSet = null) => {
                const scores = (subjData && subjData.scores) || {};
                const entries = [];
                Object.entries(scores).forEach(([clsId, classScores]) => {
                    if(!classScores || typeof classScores !== 'object') return;
                    if(classIdSet && !classIdSet.has(String(clsId))) return;
                    Object.entries(classScores).forEach(([stuId, scoresNode]) => {
                        entries.push({ subId, clsId, stuId, scoresNode });
                    });
                });
                // Students with nothing filled in are skipped, matching what the per-student
                // write path did - writeStudentScoreDocNow refuses an empty score payload.
                await commitScoreEntryBatches(entries, { skipEmpty: true });
            };

            const writeSubjectBundle = async (subId, subjData) => {
                const normalized = normalizeSubject(subjData);
                await writeSubjectMetaDoc(subId, normalized);
                await writeSubjectScoreDocs(subId, normalized);
            };

            const firestoreTimestampToMillis = (value) => {
                if(!value) return 0;
                if(typeof value.toMillis === 'function') return value.toMillis();
                if(typeof value.seconds === 'number') return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
                if(typeof value === 'number') return value;
                return 0;
            };

            const walkScoreLeaves = (node, path = [], output = []) => {
                if(!node || typeof node !== 'object') return output;
                Object.entries(node).forEach(([key, value]) => {
                    const nextPath = path.concat(String(key));
                    if(isPlainObject(value)) walkScoreLeaves(value, nextPath, output);
                    else if(nextPath.length >= 2) output.push({ term: nextPath[0], type: nextPath.slice(1).join('.'), value });
                });
                return output;
            };

            const cloudScoreEntryLooksOlderThanLocal = (subId, clsId, stuId, entryData) => {
                if(!window.getScoreSafetyRecord || !entryData || !entryData.scores) return false;
                const cloudUpdatedAt = firestoreTimestampToMillis(entryData.updatedAt);
                const recentWindowMs = 5 * 60 * 1000;
                return walkScoreLeaves(entryData.scores).some(cell => {
                    const record = window.getScoreSafetyRecord(subId, clsId, stuId, cell.term, cell.type);
                    if(!record || !record.savedAt) return false;
                    const leaf = window.scoreSafetyLeafKey ? window.scoreSafetyLeafKey(cell.type) : '';
                    const cloudVal = window.normalizeScoreValue ? window.normalizeScoreValue(cell.value, leaf) : cell.value;
                    const localVal = record.cleared ? '' : (window.normalizeScoreValue ? window.normalizeScoreValue(record.val, leaf) : record.val);
                    if(String(cloudVal) === String(localVal)) return false;
                    if(cloudUpdatedAt && cloudUpdatedAt + 1500 < Number(record.savedAt)) return true;
                    return !cloudUpdatedAt && Date.now() - Number(record.savedAt) < recentWindowMs;
                });
            };

            const mergeScoreEntryData = (entryData) => {
                if(!entryData || typeof entryData !== 'object') return false;
                const subId = String(entryData.subId || '');
                const clsId = String(entryData.clsId || '');
                const stuId = String(entryData.stuId || '');
                if(!subId || !clsId || !stuId) return false;
                if(window.hasFreshPendingScoreEntry && window.hasFreshPendingScoreEntry(subId, clsId, stuId)) return false;
                if(cloudScoreEntryLooksOlderThanLocal(subId, clsId, stuId, entryData)) return false;
                const target = ensureSubjectScoreSlot(subId, clsId, stuId);
                window.DB_SubjectData[subId].scores[clsId][stuId] = deepMerge(target, entryData.scores || {});
                if(window.normalizeSubjectScores) window.normalizeSubjectScores(window.DB_SubjectData[subId]);
                if(window.rememberScoreNodeInSafetyLog) window.rememberScoreNodeInSafetyLog(subId, clsId, stuId, entryData.scores || {}, { skipEmpty: true, persistDelay: 1200 });
                return true;
            };

            window.firebaseLoadClassScores = async (subId, clsId, studentIds = [], options = {}) => {
                if(!auth.currentUser || !subId || !clsId) return false;
                if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) return false;
                const ids = Array.from(new Set((studentIds || []).filter(Boolean).map(id => String(id))));
                if(ids.length === 0) return false;
                let changed = false;
                try {
                    for(let i = 0; i < ids.length; i += 40) {
                        const chunk = ids.slice(i, i + 40);
                        await Promise.all(chunk.map(async stuId => {
                            const scoreSnapshot = await getDoc(doc(scoreEntriesColRef, scoreEntryDocId(subId, clsId, stuId)));
                            if(scoreSnapshot.exists() && mergeScoreEntryData(scoreSnapshot.data())) {
                                changed = true;
                            }
                        }));
                    }
                    if(changed && options.refresh !== false) persistSubjectCacheAndRefresh(subId);
                    markCloudOk();
                    return changed;
                } catch(err) {
                    console.warn('Class score preload failed:', err);
                    markCloudError(err);
                    throw err;
                }
            };

            window.firebaseLoadSubjectClassScores = async (subId, classIds = []) => {
                if(!auth.currentUser || !subId) return false;
                if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) return false;
                const ids = Array.from(new Set((classIds || []).filter(Boolean).map(id => String(id))));
                let changed = false;
                for(const clsId of ids) {
                    const cls = window.DB && window.DB.classes ? window.DB.classes[clsId] : null;
                    const studentIds = cls && Array.isArray(cls.students) ? cls.students.map(stu => stu.studentId).filter(Boolean) : [];
                    if(studentIds.length === 0) continue;
                    const classChanged = await window.firebaseLoadClassScores(subId, clsId, studentIds, { refresh: false });
                    if(classChanged) changed = true;
                }
                if(changed) persistSubjectCacheAndRefresh(subId);
                return changed;
            };

            window.unsubscribeActiveScoreSubject = () => {
                if(activeSubjectUnsubscribe) {
                    activeSubjectUnsubscribe();
                    activeSubjectUnsubscribe = null;
                }
                activeScoreEntryUnsubscribes.forEach(unsub => {
                    try { if(typeof unsub === 'function') unsub(); } catch(e) {}
                });
                activeScoreEntryUnsubscribes = [];
                activeSubjectKey = '';
                if(typeof window.unsubscribeActiveScoreLock === 'function') window.unsubscribeActiveScoreLock();
            };

            window.unsubscribeActiveScoreLock = () => {
                if(activeScoreLockUnsubscribe) {
                    try { activeScoreLockUnsubscribe(); } catch(e) {}
                    activeScoreLockUnsubscribe = null;
                }
                activeScoreLockKey = '';
            };

            window.subscribeActiveScoreLock = (lockKey = window.getScoreLockKey ? window.getScoreLockKey() : '') => {
                if(!auth.currentUser || !lockKey || window.isCloudQuotaBackoffActive?.()) return;
                if(activeScoreLockKey === lockKey && activeScoreLockUnsubscribe) return;
                window.unsubscribeActiveScoreLock();
                activeScoreLockKey = lockKey;
                activeScoreLockUnsubscribe = onSnapshot(doc(scoreLocksColRef, lockKey), (snapshot) => {
                    if(activeScoreLockKey !== lockKey) return;
                    if(snapshot.exists()) window.scoreLocks[lockKey] = snapshot.data() || {};
                    else delete window.scoreLocks[lockKey];
                    if(state.activePage === 'teacher_scoring' && lockKey === (window.getScoreLockKey ? window.getScoreLockKey() : '')) {
                        window.refreshScoreLockBanner();
                    }
                    markCloudOk();
                }, (err) => {
                    if(window.isCloudQuotaError && window.isCloudQuotaError(err)) {
                        window.activateCloudQuotaBackoff(err);
                        window.unsubscribeActiveScoreLock();
                    } else {
                        console.warn("Score lock sync failed:", err);
                    }
                });
            };

            window.subscribeActiveScoreSubject = (subId = state.subjId, clsId = state.clsId, term = state.term) => {
                if(!auth.currentUser || !subId || state.activePage !== 'teacher_scoring') return;
                if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) return;
                const key = [subId, clsId || '', term || ''].join('|');
                if(activeSubjectKey === key && activeSubjectUnsubscribe) return;

                window.unsubscribeActiveScoreSubject();
                activeSubjectKey = key;
                if(typeof window.subscribeActiveScoreLock === 'function') window.subscribeActiveScoreLock(window.getScoreLockKey(subId, clsId, term));
                activeSubjectUnsubscribe = onSnapshot(doc(subjectsColRef, subId), (subjectSnapshot) => {
                    if(activeSubjectKey !== key || state.activePage !== 'teacher_scoring' || state.subjId !== subId) return;
                    if(isRestoringBackup) {
                        markCloudOk();
                        return;
                    }

                    if(subjectSnapshot.exists()) {
                        const changed = applyCloudSubjectDoc(subId, subjectSnapshot.data());
                        if(changed) persistSubjectCacheAndRefresh(subId);
                    } else if(window.DB_SubjectData && window.DB_SubjectData[subId] && !window.hasPendingScoreSubject(subId)) {
                        window.markSubjectDirty(subId);
                        if(window.firebaseSaveFn) window.firebaseSaveFn();
                    }
                    markCloudOk();
                }, (err) => {
                    if(window.isCloudQuotaError && window.isCloudQuotaError(err)) {
                        window.activateCloudQuotaBackoff(err);
                        window.unsubscribeActiveScoreSubject();
                    } else {
                        console.warn("Active subject sync failed:", err);
                        markCloudError(err);
                    }
                });

                const cls = window.DB && window.DB.classes ? window.DB.classes[clsId] : null;
                const students = cls && Array.isArray(cls.students) ? cls.students : [];
                activeScoreEntryUnsubscribes = students
                    .filter(stu => stu && stu.studentId)
                    .map(stu => onSnapshot(doc(scoreEntriesColRef, scoreEntryDocId(subId, clsId, stu.studentId)), (scoreSnapshot) => {
                        if(activeSubjectKey !== key || state.activePage !== 'teacher_scoring' || state.subjId !== subId || state.clsId !== clsId) return;
                        if(scoreSnapshot.exists() && mergeScoreEntryData(scoreSnapshot.data())) {
                            persistSubjectCacheAndRefresh(subId);
                        }
                        markCloudOk();
                    }, (err) => {
                        if(window.isCloudQuotaError && window.isCloudQuotaError(err)) {
                            window.activateCloudQuotaBackoff(err);
                            window.unsubscribeActiveScoreSubject();
                        } else {
                            console.warn("Active score entry sync failed:", err);
                        }
                    }));
            };

            const runFirebaseSave = async () => {
                if(!auth.currentUser) throw new Error('cloud auth is not ready');
                if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) throw new Error('cloud quota backoff active');
                const coreData = normalizeDb(window.DB || {});
                if(window.compressSchoolLogo) await window.compressSchoolLogo(coreData);
                if(window.DB && window.DB.schoolInfo) {
                    window.DB.schoolInfo.logo = coreData.schoolInfo.logo || '';
                    localStorage.setItem('anpscore_db', JSON.stringify(window.DB));
                }
                await setDoc(docRefDb, {
                    data: coreData,
                    jsonStr: deleteField(),
                    updatedAt: serverTimestamp()
                }, { merge: true });

                const dirtyIds = Array.from(window.dirtySubjects);
                const dirtyClassKeys = Array.from(scoreBundleDirtyClasses || []);
                await Promise.all(dirtyIds.map(async subId => {
                    const subjData = normalizeSubject(window.DB_SubjectData[subId]);
                    await writeSubjectMetaDoc(subId, subjData);
                    const dirtyClassIds = dirtyClassKeys
                        .map(key => String(key).split('|'))
                        .filter(parts => parts[0] === encodeURIComponent(String(subId)))
                        .map(parts => decodeURIComponent(parts[1] || ''))
                        .filter(Boolean);
                    if(dirtyClassIds.length > 0) {
                        await writeSubjectScoreDocs(subId, subjData, new Set(dirtyClassIds));
                    }
                }));
                dirtyIds.forEach(subId => {
                    window.dirtySubjects.delete(subId);
                    dirtyClassKeys.forEach(key => {
                        if(String(key).startsWith(`${encodeURIComponent(String(subId))}|`)) scoreBundleDirtyClasses.delete(key);
                    });
                    if(typeof pendingScoreSubjects !== 'undefined' && !Array.from(pendingScoreEntries || []).some(key => key.startsWith(`${subId}|`))) pendingScoreSubjects.delete(subId);
                });
                if(typeof window.persistDirtySubjects === 'function') window.persistDirtySubjects();
                if(typeof window.persistScoreBundleDirtyClasses === 'function') window.persistScoreBundleDirtyClasses();
                if(typeof window.persistPendingScoreSubjects === 'function') window.persistPendingScoreSubjects();
                markCloudOk();
            };

            window.firebaseSaveNowFn = async () => {
                if(!auth.currentUser) {
                    const err = new Error('cloud auth is not ready');
                    markCloudError(err);
                    throw err;
                }
                if(saveTimeout) {
                    clearTimeout(saveTimeout);
                    saveTimeout = null;
                }
                try {
                    await runFirebaseSave();
                } catch(err) {
                    markCloudError(err);
                    throw err;
                }
            };

            window.firebaseSaveFn = () => {
                if(!auth.currentUser) {
                    const err = new Error('cloud auth is not ready');
                    markCloudError(err);
                    if(window.requestDirtyCloudFlush) window.requestDirtyCloudFlush(5000);
                    return;
                }
                if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) {
                    if(saveTimeout) clearTimeout(saveTimeout);
                    const retryDelay = Math.min(Math.max(window.getCloudQuotaBackoffRemaining(), 30000), 5 * 60 * 1000);
                    saveTimeout = setTimeout(() => {
                        saveTimeout = null;
                        window.firebaseSaveFn();
                    }, retryDelay);
                    return;
                }
                if(saveTimeout) clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                    try {
                        await runFirebaseSave();
                    } catch(err) {
                        markCloudError(err);
                    }
                }, 1200); 
            };

            window.firebaseDeleteSubj = (subId) => {
                if(!auth.currentUser) return;
                deleteDoc(doc(subjectsColRef, subId))
                    .then(() => getDocs(scoreEntriesColRef))
                    .then(snapshot => Promise.all(snapshot.docs
                        .filter(scoreDoc => (scoreDoc.data() || {}).subId === String(subId))
                        .map(scoreDoc => deleteDoc(scoreDoc.ref))))
                    .then(markCloudOk)
                    .catch(markCloudError);
            };

            window.firebasePatchExamSettings = (subId, clsId, term, patch = {}) => {
                if(!auth.currentUser) return Promise.reject(new Error('cloud auth is not ready'));
                if(!subId || !clsId || !term) return Promise.reject(new Error('exam settings target is incomplete'));
                if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) {
                    return Promise.reject(new Error('cloud quota backoff active'));
                }

                const cleanPatch = {};
                ['mid', 'final'].forEach(field => {
                    const value = Number(patch[field]);
                    if(Number.isFinite(value) && value > 0) cleanPatch[field] = value;
                });
                if(Object.keys(cleanPatch).length === 0) return Promise.resolve(false);

                const subjectRef = doc(subjectsColRef, String(subId));
                const updateArgs = [];
                Object.entries(cleanPatch).forEach(([field, value]) => {
                    updateArgs.push(new FieldPath('data', 'classData', String(clsId), 'examSettings', String(term), field), value);
                });
                return enqueueScoreWrite(() => updateDoc(subjectRef, ...updateArgs, 'updatedAt', serverTimestamp())
                    .catch(err => {
                        const isMissing = err && (err.code === 'not-found' || String(err.message || '').includes('No document to update'));
                        if(!isMissing) throw err;
                        const payload = {
                            data: { classData: { [String(clsId)]: { examSettings: { [String(term)]: cleanPatch } } } },
                            updatedAt: serverTimestamp()
                        };
                        const mergeFields = Object.keys(cleanPatch).map(field => new FieldPath('data', 'classData', String(clsId), 'examSettings', String(term), field));
                        mergeFields.push('updatedAt');
                        return setDoc(subjectRef, payload, { mergeFields });
                    })
                    .then(() => { markCloudOk(); return true; })
                    .catch(err => { markCloudError(err); throw err; }));
            };

            window.firebaseUpdateScore = (subId, clsId, stuId, term, type, val) => {
                  if(!auth.currentUser) {
                     const err = new Error('cloud auth is not ready');
                     markCloudError(err);
                     return Promise.reject(err);
                  }
                  if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) {
                     return Promise.reject(new Error('cloud quota backoff active'));
                  }
                  const docRef = doc(scoreEntriesColRef, scoreEntryDocId(subId, clsId, stuId));
                  const typeParts = String(type).split('.').filter(Boolean);
                  const scoreLeaf = typeParts[typeParts.length - 1] || '';
                  const shouldNormalizeScoreValue = ['midTermScore', 'finalScore', 'k', 'p', 'a'].includes(scoreLeaf);
                  const cleanVal = shouldNormalizeScoreValue && window.normalizeScoreValue ? window.normalizeScoreValue(val, scoreLeaf) : val;
                  const fieldPath = new FieldPath('scores', String(term), ...typeParts);
                  return enqueueScoreWrite(() => updateDoc(
                          docRef,
                          fieldPath, cleanVal,
                          'subId', String(subId),
                          'clsId', String(clsId),
                          'stuId', String(stuId),
                          'updatedBy', getScoreUpdatedBy(),
                          'updatedAt', serverTimestamp()
                      )
                      .then(markCloudOk)
                      .catch((err) => {
                          if(window.isCloudQuotaError && window.isCloudQuotaError(err)) throw err;
                          const scoreNode = (((window.DB_SubjectData[subId] || {}).scores || {})[clsId] || {})[stuId] || {};
                          return writeStudentScoreDocNow(subId, clsId, stuId, scoreNode)
                              .then(markCloudOk)
                              .catch(err => { markCloudError(err); throw err; });
                      }));
             }

            window.firebaseDeleteScoreEntry = (subId, clsId, stuId) => {
                if(!auth.currentUser || !subId || !clsId || !stuId) return Promise.resolve();
                return enqueueScoreWrite(() => deleteDoc(doc(scoreEntriesColRef, scoreEntryDocId(subId, clsId, stuId))))
                    .then(markCloudOk)
                    .catch(err => { markCloudError(err); throw err; });
            };

            window.firebaseDeleteScoreTerm = (subId, clsId, stuId, term) => {
                if(!auth.currentUser || !subId || !clsId || !stuId || !term) return Promise.resolve();
                const docRef = doc(scoreEntriesColRef, scoreEntryDocId(subId, clsId, stuId));
                return enqueueScoreWrite(() => updateDoc(
                        docRef,
                        new FieldPath('scores', String(term)), deleteField(),
                        'updatedBy', getScoreUpdatedBy(),
                        'updatedAt', serverTimestamp()
                    )
                    .then(markCloudOk)
                    .catch(err => {
                        if(err && (err.code === 'not-found' || String(err.message || '').includes('No document to update'))) {
                            markCloudOk();
                            return;
                        }
                        markCloudError(err);
                        throw err;
                    }));
            };

            window.firebaseUpdatePresence = (actorId, isActive = true, recordLogin = false, meta = {}) => {
                if(!auth.currentUser || !actorId) return;
                const now = Date.now();
                const payload = {
                    actorId,
                    teacherId: meta.role === 'teacher' ? actorId : null,
                    role: meta.role || (actorId === 'admin' ? 'admin' : 'teacher'),
                    displayName: meta.displayName || (actorId === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน'),
                    sessionId,
                    online: !!isActive,
                    lastActive: isActive ? now : 0,
                    updatedAt: serverTimestamp()
                };
                if(recordLogin) payload.loginHistory = arrayUnion({ time: now });
                setDoc(doc(presenceColRef, actorId), payload, { merge: true }).then(markCloudOk).catch(markCloudError);
            };

            const isCloudScoreLockActive = (lock) => {
                if(!lock || lock.active === false) return false;
                const lastActive = Number(lock.lastActive || 0);
                const timeoutMs = window.SCORE_LOCK_TIMEOUT_MS || 120000;
                return !!lastActive && (Date.now() - lastActive <= timeoutMs);
            };

            window.firebaseAcquireScoreLock = async (lockKey, payload) => {
                if(!auth.currentUser || !lockKey) return { ok: true, lock: payload };
                if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) return { ok: true, lock: payload, localOnly: true };
                const lockRef = doc(scoreLocksColRef, lockKey);
                try {
                    const result = await runTransaction(db, async (transaction) => {
                        const snapshot = await transaction.get(lockRef);
                        const existing = snapshot.exists() ? snapshot.data() : null;
                        if(isCloudScoreLockActive(existing) && existing.sessionId !== payload.sessionId) {
                            return { ok: false, lock: existing };
                        }

                        const lockData = Object.assign({}, payload, {
                            active: true,
                            lastActive: Date.now(),
                            updatedAt: serverTimestamp()
                        });
                        transaction.set(lockRef, lockData, { merge: true });
                        return { ok: true, lock: lockData };
                    });
                    markCloudOk();
                    return result;
                } catch(err) {
                    markCloudError(err);
                    throw err;
                }
            };

            window.firebaseUpdateScoreLock = (lockKey, payload) => {
                if(!auth.currentUser || !lockKey) return;
                if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) return;
                setDoc(doc(scoreLocksColRef, lockKey), Object.assign({}, payload, {
                    updatedAt: serverTimestamp()
                }), { merge: true }).then(markCloudOk).catch(markCloudError);
            };

            window.firebaseReleaseScoreLock = (lockKey, payload) => {
                if(!auth.currentUser || !lockKey) return;
                if(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive()) return;
                setDoc(doc(scoreLocksColRef, lockKey), Object.assign({}, payload, {
                    active: false,
                    lastActive: Date.now(),
                    updatedAt: serverTimestamp()
                }), { merge: true }).then(markCloudOk).catch(markCloudError);
            };

            onSnapshot(docRefDb, (snapshot) => {
                dbLoaded = true;
                if(isRestoringBackup) {
                    markCloudOk();
                    checkStart();
                    return;
                }
                if(snapshot.exists()) {
                    try {
                        window.DB = normalizeDb(readStoredData(snapshot.data(), defaultDb));
                        DB = window.DB;
                        localStorage.setItem('anpscore_db', JSON.stringify(window.DB));
                    } catch(e) { console.error(e); }
                } else {
                    if(window.firebaseSaveFn) window.firebaseSaveFn();
                }
                markCloudOk();
                checkStart();
            }, (err) => {
                if(window.isCloudQuotaError && window.isCloudQuotaError(err)) window.activateCloudQuotaBackoff(err);
                startLocalMode(err);
            });

            const loadSubjectsOnce = (snapshot) => {
                subjLoaded = true;
                if(isRestoringBackup) {
                    markCloudOk();
                    checkStart();
                    return;
                }
                let changed = false;
                const changedSubjectIds = new Set();
                snapshot.docChanges().forEach((change) => {
                    const subId = change.doc.id;
                    if (change.type === "added" || change.type === "modified") {
                        if(applyCloudSubjectDoc(subId, change.doc.data())) {
                            changed = true;
                            changedSubjectIds.add(subId);
                        }
                    }
                    if (change.type === "removed") {
                        delete window.DB_SubjectData[subId];
                        changed = true;
                        changedSubjectIds.add(subId);
                    }
                });

                if (changed) {
                    persistSubjectCacheAndRefresh(changedSubjectIds.has(state.subjId) ? state.subjId : '');
                }
                
                if(snapshot.empty && Object.keys(window.DB_SubjectData).length > 0) {
                    Object.keys(window.DB_SubjectData).forEach(id => window.markSubjectDirty(id));
                    if(window.firebaseSaveFn) window.firebaseSaveFn();
                }

                markCloudOk();
                checkStart();
            };

            getDocs(subjectsColRef)
                .then(loadSubjectsOnce)
                .catch(err => {
                    if(window.isCloudQuotaError && window.isCloudQuotaError(err)) window.activateCloudQuotaBackoff(err);
                    startLocalMode(err);
                });

            scoreEntriesLoaded = true;
            checkStart();

            onSnapshot(presenceColRef, (snapshot) => {
                let changed = false;
                snapshot.docChanges().forEach((change) => {
                    const actorId = change.doc.id;
                    const t = (window.DB.teachers || []).find(x => x.id === actorId);

                    if(change.type === "removed") {
                        if(t) t.lastActive = 0;
                        delete window.presenceUsers[actorId];
                        changed = true;
                        return;
                    }

                    const presence = change.doc.data() || {};
                    const role = presence.role || (actorId === 'admin' ? 'admin' : 'teacher');
                    const lastActive = presence.online ? Number(presence.lastActive || Date.now()) : 0;
                    window.presenceUsers[actorId] = {
                        actorId,
                        teacherId: role === 'teacher' ? actorId : null,
                        role,
                        displayName: presence.displayName || (t ? t.name : (role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน')),
                        online: !!presence.online,
                        lastActive
                    };

                    if(t) {
                        t.lastActive = lastActive;
                    }
                    if(t && Array.isArray(presence.loginHistory)) {
                        t.loginHistory = presence.loginHistory
                            .filter(item => item && item.time)
                            .sort((a, b) => b.time - a.time)
                            .slice(0, 50);
                    }
                    changed = true;
                });

                if(changed) {
                    window.updateActiveUsersUI();
                }
            }, (err) => {
                if(window.isCloudQuotaError && window.isCloudQuotaError(err)) window.activateCloudQuotaBackoff(err);
                else console.warn("Presence sync failed:", err);
            });

            if(state.activePage === 'teacher_scoring' && state.subjId) {
                window.subscribeActiveScoreSubject(state.subjId, state.clsId, state.term);
            }
        }

        // ถ้าคลาวด์เงียบเกินไป ให้เปิดระบบจากข้อมูลที่เก็บไว้ในเครื่องก่อน
        // ผู้ใช้จะได้ไม่ค้างอยู่ที่หน้ากำลังโหลด
        setTimeout(() => { if(!isAppStarted) startLocalMode(); }, 15000);
    };

    function checkStart() {
        if(dbLoaded && subjLoaded && scoreEntriesLoaded) {
            if(!isAppStarted) {
                isAppStarted = true;
                if(window.initializeAppUI) window.initializeAppUI();
            } else {
                if(window.requestCurrentViewRefresh) window.requestCurrentViewRefresh({ soft: true, delay: 1200 });
            }
            if(window.retryPendingScoreAutoSaves) window.retryPendingScoreAutoSaves();
            if(window.requestDirtyCloudFlush) window.requestDirtyCloudFlush();
        }
    }

    // เปิดให้สคริปต์หลัก (ที่ไม่ใช่ module) เรียกใช้ฟังก์ชันยืนยันตัวตนได้
    window.anpAuth = {
        signInTeacher, signInAdmin, signOutNow, describeAuthError,
        changeOwnPassword, createAccount, lookupAccountUid, generatePassword,
        teacherEmail, writeRole, readRole, setRoleActive, writePublicDirectory,
        ADMIN_EMAIL, MIN_PASSWORD_LENGTH
    };

    // รายชื่อครูสำหรับหน้าล็อกอิน อ่านได้ก่อนล็อกอิน แต่มีแค่รหัสกับชื่อ
    loadPublicDirectory().then(list => {
        window.PUBLIC_TEACHERS = list;
        if(window.populateTeacherLoginSelect) window.populateTeacherLoginSelect();
    });

    onSession(async (session) => {
        window.ANP_SESSION = session;
        // อ่านแคชคะแนนจาก IndexedDB ให้เสร็จก่อนวาดหน้าจอแรก และย้ายของเดิมที่ยังค้าง
        // อยู่ใน localStorage เข้ามาให้ครั้งเดียว รอตรงนี้จุดเดียวพอ ไม่ต้องแก้ทั้งระบบ
        if(typeof window.loadLocalCachesFromIndexedDB === 'function') {
            try { await window.loadLocalCachesFromIndexedDB(); }
            catch(err) { console.warn('เตรียมที่เก็บข้อมูลในเครื่องไม่สำเร็จ', err); }
        }
        if(session) {
            state.user = {
                role: session.role,
                id: session.role === 'admin' ? 'admin' : session.teacherId
            };
            if(cloudLayerStarted && isAppStarted) {
                if(window.initializeAppUI) window.initializeAppUI();
            } else {
                startCloudLayer();
            }
        } else {
            state.user = null;
            if(window.showLoginScreen) window.showLoginScreen();
        }
    });
} else {
    setTimeout(() => { if(window.initializeAppUI) window.initializeAppUI(); }, 500); 
}
