/* ตรวจขนาดข้อมูลที่ระบบต้องเก็บลง localStorage ของเบราว์เซอร์
   อ่านอย่างเดียว ไม่แก้ไขอะไรทั้งสิ้น รายงานเฉพาะขนาดและจำนวน ไม่แสดงข้อมูลส่วนบุคคล */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const kb = (bytes) => (bytes / 1024).toFixed(0) + ' KB';
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';
const sizeOf = (value) => Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');

const coreSnap = await db.doc('anpscore/core_db').get();
const core = coreSnap.exists ? (coreSnap.data().data || {}) : {};
const coreBytes = sizeOf(core);
const logoBytes = sizeOf((core.schoolInfo || {}).logo || '');

console.log('=== anpscore_db (ฐานข้อมูลหลัก) ===');
console.log('  ทั้งก้อน          :', kb(coreBytes));
console.log('  เฉพาะโลโก้โรงเรียน :', kb(logoBytes), logoBytes > 100 * 1024 ? '  <-- ใหญ่ผิดปกติ' : '');
console.log('  ครู', (core.teachers || []).length, 'คน / ห้อง', Object.keys(core.classes || {}).length, 'ห้อง / วิชา', (core.subjects || []).length, 'วิชา');
const studentCount = Object.values(core.classes || {}).reduce((sum, c) => sum + ((c && c.students) || []).length, 0);
console.log('  นักเรียนรวม      :', studentCount, 'คน');

const subjectsSnap = await db.collection('anpscore/data/subjects').get().catch(() => null);
let subjectMetaBytes = 0;
if (subjectsSnap) {
    subjectsSnap.forEach(d => { subjectMetaBytes += sizeOf(d.data()); });
    console.log('\n=== โครงสร้างรายวิชา ===');
    console.log('  เอกสาร', subjectsSnap.size, 'ชิ้น รวม', kb(subjectMetaBytes));
}

const scoresSnap = await db.collection('anpscore/data/scoreEntries').get();
let scoreBytes = 0;
const perSubject = new Map();
scoresSnap.forEach(d => {
    const data = d.data();
    const bytes = sizeOf(data.scores || {});
    scoreBytes += bytes;
    const key = String(data.subId || '?');
    perSubject.set(key, (perSubject.get(key) || 0) + bytes);
});

console.log('\n=== คะแนน (scoreEntries) ===');
console.log('  เอกสาร', scoresSnap.size, 'ชิ้น (1 ชิ้น = นักเรียน 1 คนต่อวิชาต่อห้อง)');
console.log('  ขนาดรวม         :', mb(scoreBytes));
console.log('  เฉลี่ยต่อเอกสาร   :', scoresSnap.size ? kb(scoreBytes / scoresSnap.size) : '-');

const total = coreBytes + subjectMetaBytes + scoreBytes;
console.log('\n=== รวมที่ต้องเก็บลงเบราว์เซอร์ ===');
console.log('  รวมทั้งหมด       :', mb(total));
console.log('  เพดาน localStorage:  ~5.00 MB');
console.log('  สถานะ            :', total > 5 * 1024 * 1024 ? 'เกินเพดานแล้ว' : 'ยังไม่เกิน แต่โตขึ้นทุกเทอม');
console.log('  ประมาณการสิ้นปี   :', mb(total * (scoresSnap.size ? 2 : 1)), '(ถ้ากรอกครบ 2 เทอม)');
