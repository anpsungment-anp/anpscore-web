/* ANPSCORE — ตัวแปรกลาง ฐานข้อมูลในเครื่อง และตัวแทนฟังก์ชันคลาวด์
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

// --- 1. Database & State Initialization ---
var DEFAULT_DB = {
    schoolInfo: {
        name: "",
        logo: "",
        director: "",
        academicHead: "",
        term: "1",
        year: "2566",
        themeMode: "light",
        scoreEntryPolicy: { mode: "always", startDate: "", endDate: "", notice: "" }
    },
    gradeSettings: { "4.0": 80, "3.5": 75, "3.0": 70, "2.5": 65, "2.0": 60, "1.5": 55, "1.0": 50, "passThreshold": 50 },
    teachers: [], 
    classes: {}, 
    subjects: [] 
};

var DB = JSON.parse(localStorage.getItem('anpscore_db')) || JSON.parse(JSON.stringify(DEFAULT_DB));
var DB_SubjectData = JSON.parse(localStorage.getItem('anpscore_subjectData')) || {}; 
var firebaseSaveFn = null; 
var persistedDirtySubjects = [];
try { persistedDirtySubjects = JSON.parse(localStorage.getItem('anpscore_dirtySubjects') || '[]'); } catch(e) { persistedDirtySubjects = []; }
var dirtySubjects = new Set(Array.isArray(persistedDirtySubjects) ? persistedDirtySubjects : []);

window.DB = DB;
window.DB_SubjectData = DB_SubjectData;
window.dirtySubjects = dirtySubjects;

var state = { user: null, term: "1", activePage: '', subjId: '', clsId: '' };
var cloudSyncState = { mode: 'local', connected: false, lastError: '' };
var presenceUsers = {};
var ACTIVE_USER_WINDOW_MS = 3 * 60 * 1000;
var SCORE_LOCK_TIMEOUT_MS = 2 * 60 * 1000;
var browserSessionId = sessionStorage.getItem('anpscore_session_id') || (crypto.randomUUID ? crypto.randomUUID() : 'sess_' + Math.random().toString(36).slice(2));
var scoreLocks = {};
var scoreLockStatus = { key: '', pending: false };
var scoreAutoSaveTimers = {};
var scoreAutoSavePending = {};
try {
    const persistedPendingCells = JSON.parse(localStorage.getItem('anpscore_pendingScoreCells') || '{}');
    if(persistedPendingCells && typeof persistedPendingCells === 'object' && !Array.isArray(persistedPendingCells)) {
        scoreAutoSavePending = persistedPendingCells;
    }
} catch(e) { scoreAutoSavePending = {}; }
var localSubjectSaveTimer = null;
var activeUsersUiTimer = null;
var lastActiveUsersUiAt = 0;
var scoreTableRefreshTimer = null;
var cloudDirtyFlushTimer = null;
var adminDashboardProgressSyncPromise = null;
var adminDashboardProgressLastAttempt = 0;
var cloudQuotaBackoffUntil = 0;
var lastCloudQuotaNoticeAt = 0;
var cloudQuotaResumeTimer = null;
try { localStorage.removeItem('anpscore_pendingScoreSubjects'); } catch(e) {}
var pendingScoreSubjects = new Set();
var pendingScoreEntries = new Set();
var persistedDirtyScoreClasses = [];
try { persistedDirtyScoreClasses = JSON.parse(localStorage.getItem('anpscore_dirtyScoreClasses') || '[]'); } catch(e) { persistedDirtyScoreClasses = []; }
var scoreBundleDirtyClasses = new Set(Array.isArray(persistedDirtyScoreClasses) ? persistedDirtyScoreClasses : []);
var SCORE_SAFETY_LOG_KEY = 'anpscore_scoreSafetyLog';
var SCORE_SAFETY_LOG_LIMIT = 12000;
var scoreSafetyLog = {};
var scoreSafetyPersistTimer = null;
var scoreSafetyRecoveryKeys = new Set();
try {
    const persistedScoreSafetyLog = JSON.parse(localStorage.getItem(SCORE_SAFETY_LOG_KEY) || '{}');
    if(persistedScoreSafetyLog && typeof persistedScoreSafetyLog === 'object' && !Array.isArray(persistedScoreSafetyLog)) {
        scoreSafetyLog = persistedScoreSafetyLog;
    }
} catch(e) { scoreSafetyLog = {}; }
var refreshViewTimer = null;
var lastUserInteractionAt = 0;
var isRestoringBackup = false;
sessionStorage.setItem('anpscore_session_id', browserSessionId);
window.cloudSyncState = cloudSyncState;
window.presenceUsers = presenceUsers;
window.scoreLocks = scoreLocks;
window.scoreSafetyLog = scoreSafetyLog;
window.SCORE_LOCK_TIMEOUT_MS = SCORE_LOCK_TIMEOUT_MS;
window.subscribeActiveScoreSubject = function() {};
window.unsubscribeActiveScoreSubject = function() {};
window.firebaseLoadClassScores = async function() { return false; };
window.firebaseLoadSubjectClassScores = async function() { return false; };
window.firebaseLoadScoresForSubjectsBulk = async function() { return false; };
window.firebaseBatchWriteScoreNodes = async function() { return { attempted: false, failed: 0, total: 0 }; };
// ค่าเริ่มต้นสำหรับโหมดออฟไลน์ จะถูกแทนที่เมื่อเชื่อมต่อคลาวด์สำเร็จ
window.firebaseSaveYearArchive = async function() { throw new Error('ยังไม่ได้เชื่อมต่อคลาวด์'); };
window.firebaseListArchiveYears = async function() { return []; };
window.firebaseLoadArchiveClass = async function() { return null; };
window.firebaseListArchiveClasses = async function() { return []; };

// --- Helper Function for Drive Image URLs ---
