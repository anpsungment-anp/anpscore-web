#!/usr/bin/env node
/* ============================================================================
   ANPSCORE — ตั้งค่าโปรเจกต์ Firebase ใหม่ตั้งแต่ต้นจนพร้อมใช้

   ทำแทนได้ทุกขั้นที่ Firebase CLI ทำได้ เหลือสองขั้นที่ต้องกดเองในคอนโซล
   เพราะ CLI ทำไม่ได้ (บอกไว้ตอนจบการทำงาน)

   วิธีใช้
     node scripts/bootstrap-project.mjs <projectId> [--location asia-southeast1]
     node scripts/bootstrap-project.mjs <projectId> --skip-create   (โปรเจกต์มีอยู่แล้ว)

   ทุกขั้นข้ามได้ถ้าทำไปแล้ว จึงรันซ้ำได้เมื่อติดขัดกลางทาง
   ========================================================================== */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const args = process.argv.slice(2);
const projectId = args.find(a => !a.startsWith('--'));
const locationArg = args.indexOf('--location');
const LOCATION = locationArg >= 0 ? args[locationArg + 1] : 'asia-southeast1';
const SKIP_CREATE = args.includes('--skip-create');

if (!projectId) {
    console.error('ต้องระบุ projectId เช่น  node scripts/bootstrap-project.mjs anpscore-2569');
    process.exit(1);
}

const isWindows = process.platform === 'win32';

/* Node รุ่นใหม่เรียกไฟล์ .cmd ผ่าน execFileSync ตรง ๆ ไม่ได้แล้ว
   จึงต้องผ่าน shell และใส่เครื่องหมายคำพูดให้อาร์กิวเมนต์เอง */
function quote(arg) {
    const text = String(arg);
    if (isWindows) return /[\s()&^|<>"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    return /[^A-Za-z0-9_@%+=:,./-]/.test(text) ? `'${text.replace(/'/g, `'\\''`)}'` : text;
}

function run(cliArgs, { allowFail = false, quiet = false } = {}) {
    const command = ['firebase', ...cliArgs].map(quote).join(' ');
    try {
        const out = execFileSync(command, {
            cwd: ROOT, encoding: 'utf8', shell: true,
            stdio: quiet ? 'pipe' : ['ignore', 'pipe', 'pipe'],
            maxBuffer: 20 * 1024 * 1024
        });
        return { ok: true, out };
    } catch (err) {
        const text = `${err.stdout || ''}${err.stderr || ''}`;
        if (!allowFail) {
            console.error('\nคำสั่งล้มเหลว: ' + command);
            console.error(text.trim().split('\n').slice(-8).join('\n'));
            process.exit(1);
        }
        return { ok: false, out: text };
    }
}

const step = (n, text) => console.log(`\n[${n}] ${text}`);

/* ---------------------------------------------------------------- 1. โปรเจกต์ */
if (SKIP_CREATE) {
    step(1, `ข้ามการสร้างโปรเจกต์ ใช้ ${projectId} ที่มีอยู่แล้ว`);
} else {
    step(1, `สร้างโปรเจกต์ ${projectId}`);
    const created = run(['projects:create', projectId, '--display-name', 'ANPSCORE 2569'], { allowFail: true });
    if (created.ok) {
        console.log('    สร้างเรียบร้อย');
    } else if (/already exists|already in use/i.test(created.out)) {
        console.log('    มีโปรเจกต์นี้อยู่แล้ว ใช้ตัวเดิมต่อ');
    } else if (/quota/i.test(created.out)) {
        console.error('    สร้างไม่ได้ เพราะบัญชี Google เต็มโควตาโปรเจกต์แล้ว');
        console.error('    ขอเพิ่มโควตาที่ https://support.google.com/code/contact/project_quota_increase');
        console.error('    หรือใช้โปรเจกต์ที่มีอยู่แล้วด้วย --skip-create');
        process.exit(1);
    } else {
        console.error(created.out.trim().split('\n').slice(-6).join('\n'));
        process.exit(1);
    }
}

/* ---------------------------------------------------------------- 2. Firestore */
step(2, `สร้างฐานข้อมูล Firestore ที่ ${LOCATION}`);
const dbCreated = run(['firestore:databases:create', '(default)', '--location', LOCATION, '--project', projectId], { allowFail: true });
if (dbCreated.ok) console.log('    สร้างเรียบร้อย');
else if (/already exists/i.test(dbCreated.out)) console.log('    มีฐานข้อมูลอยู่แล้ว ใช้ตัวเดิมต่อ');
else if (/has not been used in project|is disabled|SERVICE_DISABLED|403/i.test(dbCreated.out)) {
    /* โปรเจกต์ที่ยังไม่เคยใช้ Firestore ต้องเปิดใช้บริการก่อน
       CLI เปิดให้ไม่ได้ ต้องกดในคอนโซลครั้งเดียว */
    console.error('    ยังไม่ได้เปิดใช้ Cloud Firestore ในโปรเจกต์นี้');
    console.error('');
    console.error('    เปิดที่คอนโซล Firebase แล้วกด Create database');
    console.error(`      https://console.firebase.google.com/project/${projectId}/firestore`);
    console.error(`      เลือกที่ตั้ง ${LOCATION} (สิงคโปร์) และเลือกโหมด Production`);
    console.error('');
    console.error('    เสร็จแล้วรันคำสั่งเดิมซ้ำอีกครั้ง สคริปต์จะข้ามขั้นนี้ให้เอง');
    process.exit(1);
} else {
    console.error(dbCreated.out.trim().split('\n').slice(-6).join('\n'));
    process.exit(1);
}

/* ---------------------------------------------------------------- 3. เว็บแอป */
step(3, 'ลงทะเบียนเว็บแอป');
let appId = '';
const listed = run(['apps:list', 'WEB', '--project', projectId, '--json'], { allowFail: true, quiet: true });
if (listed.ok) {
    try {
        const parsed = JSON.parse(listed.out);
        const apps = (parsed.result || []).filter(a => a.platform === 'WEB');
        if (apps.length) {
            appId = apps[0].appId;
            console.log(`    มีเว็บแอปอยู่แล้ว ${appId}`);
        }
    } catch (e) { /* ไม่ใช่ JSON ก็ถือว่ายังไม่มีแอป */ }
}
if (!appId) {
    run(['apps:create', 'WEB', 'ANPSCORE', '--project', projectId], { quiet: true });
    const again = run(['apps:list', 'WEB', '--project', projectId, '--json'], { quiet: true });
    const apps = (JSON.parse(again.out).result || []).filter(a => a.platform === 'WEB');
    if (!apps.length) { console.error('สร้างเว็บแอปแล้วแต่หาไม่เจอ'); process.exit(1); }
    appId = apps[0].appId;
    console.log(`    สร้างเรียบร้อย ${appId}`);
}

/* ---------------------------------------------------------------- 4. ค่าตั้งต้น */
step(4, 'ดึงค่าตั้งค่าของแอปมาใส่ auth/firebase-config.js');
const sdk = run(['apps:sdkconfig', 'WEB', appId, '--project', projectId, '--json'], { quiet: true });

let config = null;
try {
    const parsed = JSON.parse(sdk.out);
    config = (parsed.result && (parsed.result.sdkConfig || parsed.result)) || null;
} catch (e) {
    const match = sdk.out.match(/\{[\s\S]*\}/);
    if (match) { try { config = JSON.parse(match[0]); } catch (e2) { /* ปล่อยให้แจ้งด้านล่าง */ } }
}
if (!config || !config.apiKey) {
    console.error('อ่านค่าตั้งค่าของแอปไม่สำเร็จ ลองสั่งเองด้วย');
    console.error(`  firebase apps:sdkconfig WEB ${appId} --project ${projectId}`);
    process.exit(1);
}

const configPath = join(ROOT, 'auth', 'firebase-config.js');
let configFile = readFileSync(configPath, 'utf8');
const block = `export const firebaseConfig = {
    apiKey: "${config.apiKey}",
    authDomain: "${config.authDomain}",
    projectId: "${config.projectId}",
    storageBucket: "${config.storageBucket}",
    messagingSenderId: "${config.messagingSenderId}",
    appId: "${config.appId}"
};`;

const replaced = configFile.replace(/export const firebaseConfig = \{[\s\S]*?\};/, block);
if (replaced === configFile) {
    console.error('หาบล็อก firebaseConfig ใน auth/firebase-config.js ไม่เจอ แก้เองก่อน');
    process.exit(1);
}
writeFileSync(configPath, replaced);
console.log(`    เขียนค่าของ ${config.projectId} ลง auth/firebase-config.js แล้ว`);

/* ---------------------------------------------------------------- 5. .firebaserc */
step(5, 'ตั้งโปรเจกต์เริ่มต้นใน .firebaserc');
writeFileSync(join(ROOT, '.firebaserc'),
    JSON.stringify({ projects: { default: projectId } }, null, 2) + '\n');
console.log(`    default = ${projectId}`);

/* ---------------------------------------------------------------- 6. deploy */
step(6, 'deploy กฎความปลอดภัยและหน้าเว็บ');
run(['deploy', '--only', 'firestore:rules,firestore:indexes,hosting', '--project', projectId]);
console.log('    deploy เรียบร้อย');

/* ---------------------------------------------------------------- สรุป */
console.log(`
============================================================
โปรเจกต์ ${projectId} พร้อมใช้งานแล้ว
เว็บอยู่ที่  https://${projectId}.web.app

เหลืออีกสองขั้นที่ต้องกดเองในคอนโซล เพราะ CLI ทำแทนไม่ได้

  1. เปิดการเข้าสู่ระบบด้วยอีเมล
     https://console.firebase.google.com/project/${projectId}/authentication/providers
     -> Email/Password -> Enable -> Save

  2. ดาวน์โหลดกุญแจสำหรับเครื่องมือผู้ดูแลระบบ
     https://console.firebase.google.com/project/${projectId}/settings/serviceaccounts/adminsdk
     -> Generate new private key   (เก็บไว้นอกโฟลเดอร์โปรเจกต์)

จากนั้นย้ายข้อมูลและสร้างบัญชีผู้ใช้

  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\\path\\to\\key.json"
  node tools/migrate-project.mjs export
  node tools/migrate-project.mjs import ${projectId}
  node tools/anpscore-admin.mjs create-admin <รหัสผ่านใหม่>
============================================================`);
