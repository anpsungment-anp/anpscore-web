/* ANPSCORE — ที่เก็บข้อมูลก้อนใหญ่ในเครื่อง (IndexedDB)

   ทำไมต้องมีไฟล์นี้
     localStorage มีเพดานประมาณ 5 MB ต่อเว็บหนึ่งเว็บ และนับเป็นตัวอักษรแบบ 2 ไบต์
     ข้อมูลจริงของโรงเรียนตอนนี้คือคะแนน 8,532 รายการ รวม 2.23 MB บวกโครงสร้างรายวิชา
     อีก 213 KB ซึ่งชนเพดานพอดีตั้งแต่เทอมแรก พอขึ้นเทอม 2 จะเกินแน่นอน
     อาการคือเขียนลงเครื่องไม่ได้เงียบ ๆ แล้วคะแนนที่ยังส่งไม่เสร็จก็หายไปตอนรีเฟรช

   แบ่งหน้าที่กันแบบนี้
     IndexedDB   - ก้อนใหญ่ที่เป็นแคช (คะแนนทั้งโรงเรียน บันทึกกันคะแนนหาย) พื้นที่ระดับ GB
     localStorage - ของเล็กที่ต้องอ่านได้ทันทีตอนเปิดเว็บ และต้องเขียนให้ทันตอนปิดหน้าต่าง
                    โดยเฉพาะคิวคะแนนที่รอส่งขึ้นคลาวด์ ซึ่งเป็นตัวกันคะแนนหายตัวจริง
                    IndexedDB เขียนแบบไม่พร้อมรอ จึงไม่เหมาะกับงานที่ต้องเสร็จก่อนปิดหน้า */

(function() {
    const DB_NAME = 'anpscore_local';
    const DB_VERSION = 1;
    const STORE_NAME = 'blobs';
    let dbPromise = null;

    const openDb = () => {
        if(dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if(!window.indexedDB) { reject(new Error('เบราว์เซอร์นี้ไม่รองรับ IndexedDB')); return; }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('เปิด IndexedDB ไม่สำเร็จ'));
            request.onblocked = () => reject(new Error('IndexedDB ถูกล็อกโดยแท็บอื่น'));
        });
        dbPromise.catch(() => { dbPromise = null; });
        return dbPromise;
    };

    const runTransaction = (mode, work) => openDb().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let result;
        try { result = work(store); } catch(err) { reject(err); return; }
        tx.oncomplete = () => resolve(result && typeof result.then === 'function' ? result : (result && 'result' in result ? result.result : result));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('ธุรกรรม IndexedDB ถูกยกเลิก'));
    }));

    window.localBlobGet = function(key) {
        return runTransaction('readonly', store => store.get(key));
    };

    window.localBlobSet = function(key, value) {
        return runTransaction('readwrite', store => store.put(value, key));
    };

    window.localBlobDelete = function(key) {
        return runTransaction('readwrite', store => store.delete(key));
    };

    window.isLocalBlobStoreReady = function() {
        return openDb().then(() => true).catch(() => false);
    };
})();

window.ANP_SUBJECT_DATA_KEY = 'anpscore_subjectData';
window.ANP_SAFETY_LOG_KEY = 'anpscore_scoreSafetyLog';

/* ย้ายของเดิมที่ค้างอยู่ใน localStorage เข้ามาครั้งเดียว แล้วลบต้นทางทิ้งเพื่อคืนพื้นที่
   ถ้าย้ายไม่สำเร็จจะไม่ลบอะไรทั้งนั้น ระบบยังอ่านจาก localStorage ได้เหมือนเดิม */
window.migrateLocalStorageBlob = async function(key) {
    let raw = null;
    try { raw = localStorage.getItem(key); } catch(e) { return null; }
    if(raw === null || raw === '') return null;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(e) { return null; }
    if(!parsed || typeof parsed !== 'object') return null;
    try {
        await window.localBlobSet(key, parsed);
        localStorage.removeItem(key);
        console.info(`ย้าย ${key} ไป IndexedDB แล้ว คืนพื้นที่ ${Math.round(raw.length / 1024)} KB`);
        return parsed;
    } catch(err) {
        console.warn(`ย้าย ${key} ไป IndexedDB ไม่สำเร็จ ใช้ localStorage ต่อไป`, err);
        return null;
    }
}

/* เรียกครั้งเดียวตอนเปิดระบบ ก่อนวาดหน้าจอแรก
   อ่านแคชคะแนนและบันทึกกันคะแนนหายจาก IndexedDB เข้าหน่วยความจำ
   ถ้าเครื่องไหนใช้ IndexedDB ไม่ได้ จะตกกลับไปอ่านจาก localStorage แบบเดิมทั้งหมด */
window.loadLocalCachesFromIndexedDB = async function() {
    const ready = await window.isLocalBlobStoreReady();
    if(!ready) {
        console.warn('ใช้ IndexedDB ไม่ได้ ระบบจะเก็บลง localStorage แบบเดิม');
        window.ANP_LOCAL_BLOB_READY = false;
        return false;
    }
    window.ANP_LOCAL_BLOB_READY = true;

    try {
        const migrated = await window.migrateLocalStorageBlob(window.ANP_SUBJECT_DATA_KEY);
        const stored = migrated || await window.localBlobGet(window.ANP_SUBJECT_DATA_KEY);
        if(stored && typeof stored === 'object') {
            window.DB_SubjectData = stored;
            if(typeof window.setSubjectDataReference === 'function') window.setSubjectDataReference(stored);
            if(typeof window.repairAllSubjectScoreValues === 'function') window.repairAllSubjectScoreValues();
        }
    } catch(err) {
        console.warn('อ่านแคชคะแนนจาก IndexedDB ไม่สำเร็จ', err);
    }

    try {
        const migratedLog = await window.migrateLocalStorageBlob(window.ANP_SAFETY_LOG_KEY);
        const storedLog = migratedLog || await window.localBlobGet(window.ANP_SAFETY_LOG_KEY);
        if(storedLog && typeof storedLog === 'object' && typeof window.setScoreSafetyLog === 'function') {
            window.setScoreSafetyLog(storedLog);
        }
    } catch(err) {
        console.warn('อ่านบันทึกกันคะแนนหายจาก IndexedDB ไม่สำเร็จ', err);
    }

    return true;
}
