#!/usr/bin/env node
/* ============================================================================
   ANPSCORE — ย้ายข้อมูลจากโปรเจกต์เดิมไปโปรเจกต์ใหม่

   แบ่งเป็นสองขั้น เพื่อให้ตรวจไฟล์ระหว่างทางได้ก่อนเขียนของจริง

     1) export  อ่านจากโปรเจกต์เดิมแบบอ่านอย่างเดียว ไม่แตะข้อมูลเดิมเลย
                ใช้การเข้าระบบแบบไม่ระบุตัวตน ซึ่งโปรเจกต์เดิมเปิดอยู่แล้ว
                จึงไม่ต้องขอกุญแจของโปรเจกต์เดิม

     2) import  เขียนลงโปรเจกต์ใหม่ด้วย Admin SDK แล้วสร้างบัญชีให้ครูทุกคน
                ขั้นนี้ต้องใช้กุญแจ (service account key) ของโปรเจกต์ใหม่

   วิธีใช้
     node tools/migrate-project.mjs export
     node tools/migrate-project.mjs import <projectId ใหม่>

   ไฟล์ที่ได้จากขั้น export มีรหัสผ่านครูแบบข้อความธรรมดาอยู่ด้วย
   ถือเป็นไฟล์ลับ อย่า commit และลบทิ้งเมื่อย้ายเสร็จ
   ========================================================================== */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, '.migration');
const OUT_FILE = join(OUT_DIR, 'anpscore-export.json');

/* โปรเจกต์ต้นทาง — ค่าเดียวกับที่หน้าเว็บเดิมใช้ */
const SOURCE_CONFIG = {
    apiKey: "AIzaSyDikjUzn25LbLBUAoSqNF4A1Q_HkQQk-dY",
    authDomain: "anpscore-system.firebaseapp.com",
    projectId: "anpscore-system",
    storageBucket: "anpscore-system.firebasestorage.app",
    messagingSenderId: "450492080942",
    appId: "1:450492080942:web:567bd09f160c2351f890bf"
};

const COLLECTIONS = ['subjects', 'scoreEntries', 'archives', 'timetable'];
const ACCOUNT_DOMAIN = 'anpscore.local';
const MIN_PASSWORD_LENGTH = 6;

/* ------------------------------------------------------------------ export */

async function runExport() {
    const { initializeApp } = await import('firebase/app');
    const { getAuth, signInAnonymously } = await import('firebase/auth');
    const { getFirestore, doc, getDoc, collection, getDocs } = await import('firebase/firestore');

    console.log(`อ่านข้อมูลจากโปรเจกต์ ${SOURCE_CONFIG.projectId} (อ่านอย่างเดียว)\n`);

    const app = initializeApp(SOURCE_CONFIG);
    const auth = getAuth(app);
    const db = getFirestore(app);

    await signInAnonymously(auth);

    const snap = await getDoc(doc(db, 'anpscore', 'core_db'));
    if (!snap.exists()) throw new Error('ไม่พบเอกสาร anpscore/core_db ในโปรเจกต์ต้นทาง');

    const payload = { exportedAt: new Date().toISOString(), source: SOURCE_CONFIG.projectId };
    payload.core_db = snap.data();

    const core = payload.core_db.data || {};
    console.log(`  core_db        ครู ${(core.teachers || []).length} คน` +
                `  ห้องเรียน ${Object.keys(core.classes || {}).length} ห้อง` +
                `  รายวิชา ${(core.subjects || []).length} วิชา`);

    for (const name of COLLECTIONS) {
        const docs = {};
        const result = await getDocs(collection(db, 'anpscore', 'data', name));
        result.forEach(d => { docs[d.id] = d.data(); });
        payload[name] = docs;
        console.log(`  ${name.padEnd(14)} ${Object.keys(docs).length} เอกสาร`);
    }

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT_FILE, JSON.stringify(payload, null, 1));

    const withPassword = (core.teachers || []).filter(t => t.password).length;
    console.log(`\nบันทึกไว้ที่ ${OUT_FILE}`);
    if (withPassword) {
        console.log(`คำเตือน: ไฟล์นี้มีรหัสผ่านครู ${withPassword} คนแบบข้อความธรรมดา ถือเป็นไฟล์ลับ`);
    }
    process.exit(0);
}

/* ------------------------------------------------------------------ import */

function randomPassword(length = 8) {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
}

/* โหมดซ้อม — ตรวจไฟล์และคำนวณทุกอย่างที่ import จะทำ แต่ไม่เขียนอะไรเลย
   ใช้ตรวจก่อนย้ายของจริง จะได้ไม่พังกลางทางตอนเขียนไปแล้วครึ่งหนึ่ง
   ไม่ต้องมีกุญแจของโปรเจกต์ปลายทาง */
function runImportDryRun(targetProject) {
    if (!existsSync(OUT_FILE)) throw new Error(`ไม่พบ ${OUT_FILE} — สั่ง export ก่อน`);

    const payload = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
    const problems = [];

    if (targetProject && payload.source === targetProject) {
        problems.push('ต้นทางและปลายทางเป็นโปรเจกต์เดียวกัน');
    }

    const core = (payload.core_db && payload.core_db.data) || null;
    if (!core) problems.push('ไฟล์ export ไม่มี core_db.data');

    const teachers = (core && core.teachers) || [];
    console.log(`โหมดซ้อม — ไม่มีการเขียนข้อมูลใด ๆ`);
    console.log(`ต้นทาง ${payload.source}  ->  ปลายทาง ${targetProject || '(ยังไม่ระบุ)'}`);
    console.log(`ดึงข้อมูลไว้เมื่อ ${payload.exportedAt}\n`);

    /* ตรวจบัญชีครู */
    const seenEmail = new Map();
    let reuseLegacy = 0, willGenerate = 0;

    for (const teacher of teachers) {
        if (!teacher || !teacher.id) { problems.push(`มีรายการครูที่ไม่มีรหัสประจำตัว`); continue; }
        if (!teacher.name) problems.push(`ครูรหัส ${teacher.id} ไม่มีชื่อ`);

        const email = `${teacher.id}@${ACCOUNT_DOMAIN}`;
        if (seenEmail.has(email)) problems.push(`รหัสครูซ้ำกัน: ${teacher.id}`);
        seenEmail.set(email, true);

        if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(email)) {
            problems.push(`รหัสครู ${teacher.id} ประกอบเป็นอีเมลไม่ได้`);
        }

        if (String(teacher.password || '').length >= MIN_PASSWORD_LENGTH) reuseLegacy++;
        else willGenerate++;
    }

    console.log('บัญชีที่จะสร้าง');
    console.log(`  ครูทั้งหมด                 ${teachers.length} คน`);
    console.log(`  ใช้รหัสผ่านเดิมได้          ${reuseLegacy} คน`);
    console.log(`  ต้องสุ่มรหัสใหม่ให้         ${willGenerate} คน`);

    /* ตรวจเอกสารที่จะเขียน */
    console.log('\nเอกสารที่จะเขียน');
    console.log(`  anpscore/core_db           1`);
    console.log(`  anpscore/public_directory  1  (ครู ${teachers.filter(t => t && t.id && t.name).length} คน)`);

    let totalDocs = 2;
    let totalBatches = 0;
    for (const name of COLLECTIONS) {
        const ids = Object.keys(payload[name] || {});
        const batches = Math.ceil(ids.length / 400);
        totalDocs += ids.length;
        totalBatches += batches;
        console.log(`  anpscore/data/${name.padEnd(13)} ${String(ids.length).padStart(5)}  (${batches} ชุด)`);

        for (const id of ids) {
            if (id.length > 1500) problems.push(`รหัสเอกสารยาวเกินกำหนดใน ${name}: ${id.slice(0, 40)}…`);
            if (id.includes('/')) problems.push(`รหัสเอกสารมีเครื่องหมาย / ใน ${name}: ${id.slice(0, 40)}…`);
        }
    }
    console.log(`  รวม                        ${totalDocs} เอกสาร (${totalBatches} ชุด + 2 ครั้งเดี่ยว)`);

    /* ขนาดเอกสาร core_db ต้องไม่เกินเพดาน 1MB ของ Firestore */
    const coreBytes = Buffer.byteLength(JSON.stringify(core || {}), 'utf8');
    console.log(`\nขนาด core_db ${(coreBytes / 1024).toFixed(0)} KB (เพดานของ Firestore คือ 1 MB)`);
    if (coreBytes > 1000000) problems.push('core_db ใหญ่เกิน 1 MB เขียนลง Firestore ไม่ได้');

    if (problems.length) {
        console.log(`\nพบปัญหา ${problems.length} รายการ`);
        problems.forEach(p => console.log('  - ' + p));
        process.exit(1);
    }

    console.log('\nตรวจแล้วไม่พบปัญหา พร้อมย้ายของจริง');
    console.log(`  node tools/migrate-project.mjs import ${targetProject || '<projectId>'}`);
    process.exit(0);
}

async function runImport(targetProject) {
    if (!targetProject) throw new Error('ต้องระบุ projectId ของโปรเจกต์ปลายทาง');
    if (!existsSync(OUT_FILE)) throw new Error(`ไม่พบ ${OUT_FILE} — สั่ง export ก่อน`);
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_APPLICATION_CREDENTIALS ให้ชี้ไปที่กุญแจของโปรเจกต์ปลายทาง');
    }

    const { initializeApp, applicationDefault } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

    const payload = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
    if (payload.source === targetProject) throw new Error('ต้นทางและปลายทางเป็นโปรเจกต์เดียวกัน');

    initializeApp({ credential: applicationDefault(), projectId: targetProject });
    const auth = getAuth();
    const db = getFirestore();

    console.log(`เขียนข้อมูลลงโปรเจกต์ ${targetProject}\n`);

    /* ---- ข้อมูลหลัก ---- */
    const core = payload.core_db.data || {};
    const teachers = core.teachers || [];

    /* ---- สร้างบัญชีให้ครู ---- */
    const generated = [];
    const failed = [];

    for (const teacher of teachers) {
        if (!teacher || !teacher.id) continue;
        const email = `${teacher.id}@${ACCOUNT_DOMAIN}`;
        const legacy = String(teacher.password || '');
        const useGenerated = legacy.length < MIN_PASSWORD_LENGTH;
        const password = useGenerated ? randomPassword() : legacy;

        try {
            let user;
            try {
                user = await auth.createUser({ email, password, displayName: teacher.name });
            } catch (err) {
                if (err.code !== 'auth/email-already-exists') throw err;
                user = await auth.getUserByEmail(email);
                await auth.updateUser(user.uid, { password });
            }

            await db.doc(`userRoles/${user.uid}`).set({
                role: 'teacher',
                teacherId: String(teacher.id),
                displayName: String(teacher.name || ''),
                active: true,
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            teacher.authUid = user.uid;
            delete teacher.password;
            if (useGenerated) generated.push({ ครู: teacher.name, รหัสผ่านใหม่: password });
            console.log(`  บัญชี  ${teacher.name}`);
        } catch (err) {
            failed.push({ ครู: teacher.name, สาเหตุ: err.message || String(err) });
            console.log(`  พลาด   ${teacher.name} — ${err.message || err}`);
        }
    }

    /* ---- เขียน core_db หลังลบรหัสผ่านออกแล้ว ---- */
    await db.doc('anpscore/core_db').set({ data: core, updatedAt: FieldValue.serverTimestamp() });
    console.log(`\n  core_db        เขียนแล้ว`);

    /* ---- รายชื่อสำหรับหน้าเข้าสู่ระบบ ---- */
    await db.doc('anpscore/public_directory').set({
        teachers: teachers.filter(t => t && t.id && t.name).map(t => ({ id: String(t.id), name: String(t.name) })),
        updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`  public_directory เขียนแล้ว`);

    /* ---- คอลเลกชันที่เหลือ เขียนเป็นชุดละ 400 เอกสาร ---- */
    for (const name of COLLECTIONS) {
        const docs = payload[name] || {};
        const ids = Object.keys(docs);
        for (let i = 0; i < ids.length; i += 400) {
            const batch = db.batch();
            ids.slice(i, i + 400).forEach(id => {
                batch.set(db.doc(`anpscore/data/${name}/${id}`), docs[id]);
            });
            await batch.commit();
        }
        console.log(`  ${name.padEnd(14)} ${ids.length} เอกสาร`);
    }

    if (generated.length) {
        console.log('\nรหัสผ่านใหม่ที่ต้องแจ้งครู (รหัสเดิมสั้นกว่า 6 ตัวอักษร) — แสดงครั้งเดียว');
        console.table(generated);
    }
    if (failed.length) {
        console.log('\nรายชื่อที่ยังไม่สำเร็จ รันคำสั่งนี้ซ้ำได้');
        console.table(failed);
    }

    console.log('\nย้ายข้อมูลเสร็จแล้ว');
    console.log('อย่าลืมสร้างบัญชีผู้ดูแลระบบด้วย:');
    console.log(`  node tools/anpscore-admin.mjs create-admin <รหัสผ่าน>`);
    console.log(`และลบไฟล์ ${OUT_FILE} ทิ้งเมื่อตรวจสอบเรียบร้อยแล้ว`);
    process.exit(0);
}

/* -------------------------------------------------------------------------- */

const [command, ...args] = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter(a => !a.startsWith('--'));

try {
    if (command === 'export') await runExport();
    else if (command === 'import' && dryRun) runImportDryRun(positional[0]);
    else if (command === 'import') await runImport(positional[0]);
    else {
        console.log('วิธีใช้:');
        console.log('  node tools/migrate-project.mjs export');
        console.log('  node tools/migrate-project.mjs import <projectId ใหม่> --dry-run   ตรวจอย่างเดียว');
        console.log('  node tools/migrate-project.mjs import <projectId ใหม่>             ย้ายของจริง');
        process.exit(command ? 1 : 0);
    }
} catch (err) {
    console.error('ผิดพลาด:', err.message || err);
    process.exit(1);
}
