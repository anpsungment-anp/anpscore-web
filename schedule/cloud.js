/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — โรงเรียนอนุพงศ์พัชรินทร์
   ชั้นข้อมูล (Data layer) : เชื่อมต่อ Firestore ชุดเดียวกับระบบ ANPSCORE

   โครงสร้างที่ใช้
     anpscore/core_db                     อ่านอย่างเดียว  : ครู ห้องเรียน รายวิชา ข้อมูลโรงเรียน
     anpscore/data/timetable/{docId}      อ่าน–เขียน      : ข้อมูลของระบบตารางสอนทั้งหมด

   รหัสเอกสารในคอลเลกชัน timetable
     settings                     ตั้งค่าระบบ ปีการศึกษา คาบ วัน ห้อง สิทธิ์ผู้ใช้
     plan__<ปี>__<ภาค>            ตารางสอน (การจัดสรรวิชา + คาบที่จัดแล้ว)
     ops__<ปี>__<ภาค>             การลา คำขอสอนแทน การมอบหมาย การแจ้งเตือน
     ver__<ปี>__<ภาค>__<เวลา>     ตารางฉบับย้อนหลัง (เก็บไว้กู้คืน)
     log__<เวลา>__<สุ่ม>          ประวัติการใช้งานและการแก้ไขข้อมูล

   ทุกเอกสารเก็บข้อมูลจริงไว้ในฟิลด์ data เหมือนรูปแบบเดิมของ ANPSCORE
   จึงอ่านด้วยฟังก์ชัน readStored ตัวเดียวกันได้
   ========================================================================== */

import {
    doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot,
    collection, query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ใช้บัญชีชุดเดียวกับ index.html และบังคับให้ล็อกอินก่อนเข้าหน้านี้
import { db, requireStaff } from "../auth/session.js";

const coreRef = doc(db, 'anpscore', 'core_db');
const ttCol = collection(db, 'anpscore', 'data', 'timetable');

/* อ่านเอกสารให้รองรับทั้งรูปแบบใหม่ (data) และรูปแบบเดิม (jsonStr) */
const readStored = (raw) => {
    if (!raw) return null;
    if (raw.data && typeof raw.data === 'object') return raw.data;
    if (typeof raw.jsonStr === 'string' && raw.jsonStr.trim()) {
        try { return JSON.parse(raw.jsonStr); } catch (e) { console.warn('อ่าน jsonStr ไม่สำเร็จ', e); }
    }
    return null;
};

/* Firestore ไม่รับค่า undefined — ตัดออกก่อนบันทึกทุกครั้ง */
const clean = (value) => {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value)) return value.map(clean);
    if (typeof value === 'object') {
        const out = {};
        Object.keys(value).forEach(k => {
            if (value[k] === undefined) return;
            out[k] = clean(value[k]);
        });
        return out;
    }
    return value;
};

let signedIn = false;
let connecting = null;

/* สถานะการเชื่อมต่อ ให้หน้าจอเอาไปแสดงผลได้ */
const status = { online: false, lastError: '', lastSaveAt: 0, pendingWrites: 0 };

const fireStatus = () => {
    window.dispatchEvent(new CustomEvent('tt-cloud-status', { detail: Object.assign({}, status) }));
};

window.ttCloud = {
    status,

    /* รอให้ผ่านด่านตรวจสิทธิ์ ผู้ที่ยังไม่ล็อกอินจะถูกพากลับหน้าเข้าสู่ระบบ */
    async connect() {
        if (signedIn) return true;
        if (connecting) return connecting;
        connecting = (async () => {
            try {
                await sessionReady;
                signedIn = true;
                status.online = true;
                status.lastError = '';
            } catch (e) {
                status.online = false;
                status.lastError = e && e.message ? e.message : String(e);
                throw e;
            } finally {
                connecting = null;
                fireStatus();
            }
            return true;
        })();
        return connecting;
    },

    /* ข้อมูลหลักของโรงเรียนจากระบบคะแนน : ครู ห้องเรียน รายวิชา */
    async loadCore() {
        const snap = await getDoc(coreRef);
        const core = snap.exists() ? readStored(snap.data()) : null;
        return core || null;
    },

    /* อ่านเอกสารเดียวในคอลเลกชัน timetable */
    async load(docId) {
        const snap = await getDoc(doc(ttCol, docId));
        return snap.exists() ? readStored(snap.data()) : null;
    },

    /* บันทึกเอกสาร (เขียนทับทั้งก้อน เพราะข้อมูลตารางต้องสอดคล้องกันทั้งชุด) */
    async save(docId, data, meta) {
        status.pendingWrites++;
        fireStatus();
        try {
            await setDoc(doc(ttCol, docId), Object.assign({
                data: clean(data),
                updatedAt: serverTimestamp()
            }, meta || {}));
            status.online = true;
            status.lastError = '';
            status.lastSaveAt = Date.now();
            return true;
        } catch (e) {
            status.lastError = e && e.message ? e.message : String(e);
            status.online = false;
            throw e;
        } finally {
            status.pendingWrites--;
            fireStatus();
        }
    },

    async remove(docId) {
        await deleteDoc(doc(ttCol, docId));
        return true;
    },

    /* ติดตามการเปลี่ยนแปลงแบบเรียลไทม์ — ใช้กับตารางที่กำลังแก้ไขและการแจ้งเตือน */
    subscribe(docId, callback) {
        return onSnapshot(doc(ttCol, docId), (snap) => {
            status.online = true;
            callback(snap.exists() ? readStored(snap.data()) : null);
        }, (err) => {
            status.online = false;
            status.lastError = err && err.message ? err.message : String(err);
            fireStatus();
        });
    },

    /* ค้นเอกสารตามชนิด เช่น 'version' หรือ 'log' (เก็บชนิดไว้ในฟิลด์ kind) */
    async listByKind(kind, max) {
        const rows = [];
        try {
            const q = query(ttCol, where('kind', '==', kind), orderBy('sortKey', 'desc'), limit(max || 100));
            const snap = await getDocs(q);
            snap.forEach(d => rows.push(Object.assign({ _id: d.id }, d.data(), { data: readStored(d.data()) })));
        } catch (e) {
            /* ถ้ายังไม่ได้สร้างดัชนีผสม ให้ถอยไปอ่านทั้งคอลเลกชันแล้วกรองในเครื่อง */
            const snap = await getDocs(ttCol);
            snap.forEach(d => {
                const raw = d.data();
                if (raw && raw.kind === kind) rows.push(Object.assign({ _id: d.id }, raw, { data: readStored(raw) }));
            });
            rows.sort((a, b) => String(b.sortKey || '').localeCompare(String(a.sortKey || '')));
            if (max) rows.splice(max);
        }
        return rows;
    },

    /* อ่านทุกเอกสารในคอลเลกชัน — ใช้ตอนสำรองข้อมูล */
    async loadAll() {
        const out = {};
        const snap = await getDocs(ttCol);
        snap.forEach(d => { out[d.id] = readStored(d.data()); });
        return out;
    },

    /* บันทึกประวัติการใช้งาน (ไม่ต้องรอผล เพื่อไม่ให้หน้าจอสะดุด) */
    log(entry) {
        const ts = Date.now();
        const id = 'log__' + ts + '__' + Math.random().toString(36).slice(2, 8);
        const payload = Object.assign({ ts, at: new Date(ts).toISOString() }, entry || {});
        setDoc(doc(ttCol, id), {
            kind: 'log',
            sortKey: String(ts),
            data: clean(payload),
            updatedAt: serverTimestamp()
        }).catch(e => console.warn('บันทึกประวัติไม่สำเร็จ', e));
        return payload;
    },

    /* เก็บตารางฉบับก่อนหน้าไว้ย้อนดู/กู้คืน */
    async saveVersion(year, term, snapshotData, note, actor) {
        const ts = Date.now();
        const id = `ver__${year}__${term}__${ts}`;
        await setDoc(doc(ttCol, id), {
            kind: 'version',
            sortKey: String(ts),
            year: String(year),
            term: String(term),
            note: note || '',
            actor: actor || '',
            data: clean(snapshotData),
            updatedAt: serverTimestamp()
        });
        return id;
    },

    async listVersions(year, term) {
        const rows = await this.listByKind('version', 200);
        return rows.filter(r => String(r.year) === String(year) && String(r.term) === String(term));
    }
};

/* ระบบตารางสอนจะเริ่มทำงานหลังรู้ว่าใครเป็นผู้ใช้แล้วเท่านั้น
   ผู้ที่ยังไม่ล็อกอินจะถูก requireStaff พากลับไปหน้าเข้าสู่ระบบก่อนถึงบรรทัดนี้ */
const sessionReady = requireStaff({ redirectTo: 'index.html' });

sessionReady.then((session) => {
    window.ttSession = session;
    window.ttCloudReady = true;
    window.dispatchEvent(new CustomEvent('tt-cloud-ready'));
});
