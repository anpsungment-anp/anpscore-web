#!/usr/bin/env node
/* ============================================================================
   ANPSCORE — เครื่องมือผู้ดูแลระบบ (รันบนเครื่อง ไม่ใช่บนเว็บ)

   บางอย่างทำจากเบราว์เซอร์ไม่ได้ เพราะ Firebase ตั้งใจไม่ให้ทำ
   เช่น ตั้งรหัสผ่านให้บัญชีคนอื่น หรือลบบัญชีทิ้ง
   งานพวกนี้ต้องใช้ Admin SDK ซึ่งต้องมีกุญแจของโปรเจกต์

   วิธีเตรียม
     1. คอนโซล Firebase -> Project settings -> Service accounts
        -> Generate new private key  จะได้ไฟล์ .json มา
     2. เก็บไฟล์นั้นไว้นอกโฟลเดอร์โปรเจกต์ อย่า commit เข้า git เด็ดขาด
     3. ติดตั้งไลบรารี   cd tools && npm install
     4. ชี้ตัวแปรแวดล้อมไปที่ไฟล์กุญแจ
        Windows PowerShell : $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\key.json"
        macOS / Linux      : export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

   คำสั่งที่ใช้ได้
     node anpscore-admin.mjs list
         แสดงบัญชีทั้งหมดพร้อมสิทธิ์ที่ผูกไว้

     node anpscore-admin.mjs create-admin <รหัสผ่าน>
         สร้างบัญชีผู้ดูแลระบบครั้งแรก พร้อมให้สิทธิ์ admin
         ใช้ตอนติดตั้งระบบครั้งแรกเท่านั้น

     node anpscore-admin.mjs provision-teachers
         สร้างบัญชีให้ครูทุกคนที่ยังไม่มี โดยใช้รหัสผ่านเดิมของแต่ละคน
         ใครที่รหัสเดิมสั้นกว่า 6 ตัวจะได้รหัสใหม่ที่ระบบสุ่มให้ และพิมพ์ออกมาให้จด
         เสร็จแล้วจะลบรหัสผ่านเดิมออกจากฐานข้อมูลให้ด้วย
         ควรรันคำสั่งนี้ก่อน deploy เพื่อไม่ให้มีช่วงที่ครูเข้าระบบไม่ได้

     node anpscore-admin.mjs reset-password <teacherId|admin> <รหัสผ่านใหม่>
         ตั้งรหัสผ่านใหม่ให้ครูที่ลืมรหัส

     node anpscore-admin.mjs disable <teacherId>   /   enable <teacherId>
         ระงับหรือคืนสิทธิ์การใช้งาน

     node anpscore-admin.mjs sync-directory
         สร้างรายชื่อครูสำหรับหน้าเข้าสู่ระบบใหม่จากฐานข้อมูลจริง
   ========================================================================== */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const ACCOUNT_DOMAIN = 'anpscore.local';
const ADMIN_ACTOR_ID = 'admin';
const teacherEmail = (id) => `${id}@${ACCOUNT_DOMAIN}`;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('ยังไม่ได้ตั้งค่า GOOGLE_APPLICATION_CREDENTIALS ให้ชี้ไปที่ไฟล์กุญแจของโปรเจกต์');
    process.exit(1);
}

/* อ่านรหัสโปรเจกต์จาก .firebaserc เพื่อไม่ต้องแก้หลายที่เวลาย้ายโปรเจกต์
   สั่งทับได้ด้วย ANPSCORE_PROJECT=... ตอนต้องการชี้ไปที่อื่นชั่วคราว */
function resolveProjectId() {
    if (process.env.ANPSCORE_PROJECT) return process.env.ANPSCORE_PROJECT;
    try {
        const rc = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'));
        const id = rc && rc.projects && rc.projects.default;
        if (id) return id;
    } catch (err) {
        // ไม่มีไฟล์ก็ไม่เป็นไร ตกไปที่ข้อความแจ้งด้านล่าง
    }
    console.error('หารหัสโปรเจกต์ไม่เจอ ตั้งค่า ANPSCORE_PROJECT หรือแก้ .firebaserc ก่อน');
    process.exit(1);
}

const PROJECT_ID = resolveProjectId();
initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

console.log(`โปรเจกต์: ${PROJECT_ID}\n`);

const coreRef = db.doc('anpscore/core_db');
const directoryRef = db.doc('anpscore/public_directory');
const roleRef = (uid) => db.doc(`userRoles/${uid}`);

/* อ่านฐานข้อมูลหลัก รองรับทั้งรูปแบบ data และ jsonStr แบบเดิม */
async function readCore() {
    const snap = await coreRef.get();
    if (!snap.exists) return null;
    const raw = snap.data() || {};
    if (raw.data && typeof raw.data === 'object') return raw.data;
    if (typeof raw.jsonStr === 'string' && raw.jsonStr.trim()) {
        try { return JSON.parse(raw.jsonStr); } catch { return null; }
    }
    return null;
}

async function findTeacher(teacherId) {
    const core = await readCore();
    const teachers = (core && core.teachers) || [];
    const teacher = teachers.find(t => String(t.id) === String(teacherId));
    if (!teacher) throw new Error(`ไม่พบครูรหัส ${teacherId} ในฐานข้อมูล`);
    return teacher;
}

async function resolveUid(actorId) {
    const email = actorId === ADMIN_ACTOR_ID ? `admin@${ACCOUNT_DOMAIN}` : teacherEmail(actorId);
    const user = await auth.getUserByEmail(email);
    return user.uid;
}

/* -------------------------------------------------------------------------- */

async function cmdList() {
    const core = await readCore();
    const teachers = (core && core.teachers) || [];
    const byId = new Map(teachers.map(t => [String(t.id), t]));

    const rows = [];
    let pageToken;
    do {
        const page = await auth.listUsers(1000, pageToken);
        for (const user of page.users) {
            if (!user.email || !user.email.endsWith(`@${ACCOUNT_DOMAIN}`)) continue;
            const actorId = user.email.split('@')[0];
            const roleSnap = await roleRef(user.uid).get();
            const role = roleSnap.exists ? roleSnap.data() : null;
            rows.push({
                บัญชี: user.email,
                ชื่อ: (byId.get(actorId) || {}).name || (role && role.displayName) || '-',
                สิทธิ์: role ? role.role : 'ไม่มีสิทธิ์',
                ใช้งาน: role ? (role.active === false ? 'ระงับ' : 'ปกติ') : '-',
                'ระงับที่ Auth': user.disabled ? 'ใช่' : 'ไม่'
            });
        }
        pageToken = page.pageToken;
    } while (pageToken);

    console.table(rows);

    const missing = teachers.filter(t => !t.authUid);
    if (missing.length) {
        console.log(`\nครูที่ยังไม่มีบัญชี ${missing.length} คน:`);
        missing.forEach(t => console.log(`  - ${t.name} (${t.id})`));
        console.log('สร้างได้จากหน้าเว็บ: ตั้งค่าและสำรองข้อมูล -> สร้างบัญชีให้ครูที่ยังไม่มี');
    }
}

async function cmdCreateAdmin(password) {
    if (!password || password.length < 6) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
    const email = `admin@${ACCOUNT_DOMAIN}`;

    let user;
    try {
        user = await auth.getUserByEmail(email);
        await auth.updateUser(user.uid, { password });
        console.log('มีบัญชีผู้ดูแลระบบอยู่แล้ว ตั้งรหัสผ่านใหม่ให้เรียบร้อย');
    } catch (err) {
        if (err.code !== 'auth/user-not-found') throw err;
        user = await auth.createUser({ email, password, displayName: 'ผู้ดูแลระบบ' });
        console.log('สร้างบัญชีผู้ดูแลระบบแล้ว');
    }

    await roleRef(user.uid).set({
        role: 'admin',
        teacherId: null,
        displayName: 'ผู้ดูแลระบบ',
        active: true,
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`  บัญชี : ${email}`);
    console.log(`  uid   : ${user.uid}`);
}

/* สร้างบัญชีให้ครูทุกคนที่ยังไม่มี แล้วลบรหัสผ่านเดิมออกจากฐานข้อมูล
   คนที่ล้มเหลวจะยังเก็บรหัสเดิมไว้ เพื่อให้กลับมารันซ้ำได้ */
async function cmdProvisionTeachers() {
    const core = await readCore();
    if (!core) throw new Error('อ่านฐานข้อมูลหลักไม่สำเร็จ');

    const teachers = core.teachers || [];
    const pending = teachers.filter(t => t && t.id && !t.authUid);
    if (!pending.length) {
        console.log('ครูทุกคนมีบัญชีเข้าใช้งานแล้ว');
        return;
    }

    console.log(`กำลังสร้างบัญชีให้ครู ${pending.length} คน\n`);
    const generated = [];
    const failed = [];

    for (const teacher of pending) {
        const email = teacherEmail(teacher.id);
        const legacy = String(teacher.password || '');
        const useGenerated = legacy.length < 6;
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

            await roleRef(user.uid).set({
                role: 'teacher',
                teacherId: String(teacher.id),
                displayName: String(teacher.name || ''),
                active: true,
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });

            teacher.authUid = user.uid;
            delete teacher.password;
            if (useGenerated) generated.push({ name: teacher.name, password });
            console.log(`  สำเร็จ  ${teacher.name}`);
        } catch (err) {
            failed.push({ name: teacher.name, message: err.message || String(err) });
            console.log(`  ล้มเหลว ${teacher.name} — ${err.message || err}`);
        }
    }

    await coreRef.set({ data: core, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await cmdSyncDirectory();

    if (generated.length) {
        console.log('\nรหัสผ่านใหม่ที่ต้องแจ้งครู (รหัสเดิมสั้นเกินกว่าที่ Firebase ยอมรับ)');
        console.log('แสดงเพียงครั้งเดียว กรุณาจดไว้ก่อนปิดหน้าจอ\n');
        console.table(generated);
    }

    if (failed.length) {
        console.log('\nรายชื่อที่ยังไม่สำเร็จ รันคำสั่งนี้ซ้ำได้');
        console.table(failed);
    }
}

function randomPassword(length = 8) {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
}

async function cmdResetPassword(actorId, password) {
    if (!actorId) throw new Error('ต้องระบุรหัสครู หรือใช้คำว่า admin');
    if (!password || password.length < 6) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');

    const uid = await resolveUid(actorId);
    await auth.updateUser(uid, { password });

    const label = actorId === ADMIN_ACTOR_ID ? 'ผู้ดูแลระบบ' : (await findTeacher(actorId)).name;
    console.log(`ตั้งรหัสผ่านใหม่ให้ ${label} เรียบร้อยแล้ว`);
    console.log('แจ้งรหัสนี้ให้เจ้าตัว แล้วให้เปลี่ยนเองที่หน้าตั้งค่าโปรไฟล์');
}

async function cmdSetActive(teacherId, active) {
    const uid = await resolveUid(teacherId);
    await roleRef(uid).set({ active, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await auth.updateUser(uid, { disabled: !active });
    console.log(`${active ? 'คืนสิทธิ์' : 'ระงับสิทธิ์'} ${teacherId} เรียบร้อยแล้ว`);
}

async function cmdSyncDirectory() {
    const core = await readCore();
    const teachers = ((core && core.teachers) || [])
        .filter(t => t && t.id && t.name)
        .map(t => ({ id: String(t.id), name: String(t.name) }));

    await directoryRef.set({ teachers, updatedAt: FieldValue.serverTimestamp() });
    console.log(`อัปเดตรายชื่อสำหรับหน้าเข้าสู่ระบบแล้ว ${teachers.length} คน`);
}

/* -------------------------------------------------------------------------- */

const [command, ...args] = process.argv.slice(2);

const commands = {
    'list': () => cmdList(),
    'create-admin': () => cmdCreateAdmin(args[0]),
    'provision-teachers': () => cmdProvisionTeachers(),
    'reset-password': () => cmdResetPassword(args[0], args[1]),
    'disable': () => cmdSetActive(args[0], false),
    'enable': () => cmdSetActive(args[0], true),
    'sync-directory': () => cmdSyncDirectory()
};

if (!command || !commands[command]) {
    console.log('คำสั่งที่ใช้ได้: ' + Object.keys(commands).join(', '));
    console.log('ดูรายละเอียดได้ที่หัวไฟล์ tools/anpscore-admin.mjs');
    process.exit(command ? 1 : 0);
}

try {
    await commands[command]();
} catch (err) {
    console.error('ผิดพลาด:', err.message || err);
    process.exit(1);
}
