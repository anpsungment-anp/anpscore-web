#!/usr/bin/env node
/* ============================================================================
   ANPSCORE — คัดลอกไลบรารีภายนอกมาเก็บไว้ในโปรเจกต์ (vendor/)

   เดิมหน้าเว็บโหลดไลบรารีจาก CDN ห้าเจ้า ถ้าเจ้าใดเจ้าหนึ่งล่มหรือถูกบล็อก
   ระบบจะใช้งานไม่ได้ทันที ทั้งที่โรงเรียนต้องใช้กรอกคะแนนทุกวัน

   สั่งด้วย   npm run vendor
   ========================================================================== */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const VENDOR = join(ROOT, 'vendor');

/* SheetJS ไม่ได้เผยแพร่บน npm อย่างเป็นทางการแล้ว ต้องดึงจาก CDN ของผู้พัฒนา
   ตรึงเลขเวอร์ชันไว้ เพื่อให้ได้ไฟล์เดิมทุกครั้งที่รัน */
const SHEETJS_VERSION = '0.20.3';
const SHEETJS_URL = `https://cdn.sheetjs.com/xlsx-${SHEETJS_VERSION}/package/dist/xlsx.full.min.js`;

const COPIES = [
    ['node_modules/chart.js/dist/chart.umd.js', 'vendor/chart.umd.js'],
    ['node_modules/html2canvas/dist/html2canvas.min.js', 'vendor/html2canvas.min.js'],
    ['node_modules/jspdf/dist/jspdf.umd.min.js', 'vendor/jspdf.umd.min.js'],
    ['node_modules/@phosphor-icons/web/src/regular/Phosphor.woff2', 'vendor/phosphor/Phosphor.woff2'],
    ['node_modules/@phosphor-icons/web/src/regular/Phosphor.woff', 'vendor/phosphor/Phosphor.woff'],
    ['node_modules/@phosphor-icons/web/src/regular/Phosphor.ttf', 'vendor/phosphor/Phosphor.ttf']
];

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

mkdirSync(join(VENDOR, 'phosphor'), { recursive: true });

for (const [from, to] of COPIES) {
    const src = join(ROOT, from);
    if (!existsSync(src)) {
        console.error(`ไม่พบ ${from} — สั่ง npm install ก่อน`);
        process.exit(1);
    }
    const dest = join(ROOT, to);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    console.log(`  ${to.padEnd(36)} ${kb(statSync(dest).size)}`);
}

/* ตัดรูปแบบ svg ออกจาก @font-face เพราะไฟล์ใหญ่ 2.9 MB
   และมีไว้รองรับเบราว์เซอร์รุ่นเก่ามากที่ไม่มีใครใช้แล้ว */
const phosphorCss = readFileSync(
    join(ROOT, 'node_modules/@phosphor-icons/web/src/regular/style.css'), 'utf8'
).replace(/,\s*\n?\s*url\("\.\/Phosphor\.svg#Phosphor"\) format\("svg"\)/, '');

writeFileSync(join(VENDOR, 'phosphor/style.css'), phosphorCss);
console.log(`  vendor/phosphor/style.css            ${kb(Buffer.byteLength(phosphorCss))}`);

/* SheetJS */
const sheetPath = join(VENDOR, 'xlsx.full.min.js');
if (existsSync(sheetPath)) {
    console.log(`  vendor/xlsx.full.min.js              ${kb(statSync(sheetPath).size)} (มีอยู่แล้ว ข้าม)`);
} else {
    console.log(`  กำลังดาวน์โหลด SheetJS ${SHEETJS_VERSION} ...`);
    const res = await fetch(SHEETJS_URL);
    if (!res.ok) {
        console.error(`ดาวน์โหลด SheetJS ไม่สำเร็จ (HTTP ${res.status})`);
        process.exit(1);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(sheetPath, buf);
    console.log(`  vendor/xlsx.full.min.js              ${kb(buf.length)}`);
}

/* ฟอนต์ Sarabun — ระบบเป็นภาษาไทย ถ้าโหลดฟอนต์ไม่ได้จะอ่านยากทั้งระบบ
   ดึงทั้งไฟล์ CSS และไฟล์ฟอนต์มาเก็บไว้ แล้วแก้ CSS ให้ชี้มาที่ไฟล์ในเครื่อง */
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap';
const MODERN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const fontDir = join(VENDOR, 'sarabun');
const fontCssPath = join(fontDir, 'sarabun.css');
mkdirSync(fontDir, { recursive: true });

if (existsSync(fontCssPath)) {
    console.log(`  vendor/sarabun/sarabun.css           ${kb(statSync(fontCssPath).size)} (มีอยู่แล้ว ข้าม)`);
} else {
    console.log('  กำลังดาวน์โหลดฟอนต์ Sarabun ...');
    const cssRes = await fetch(FONT_CSS_URL, { headers: { 'User-Agent': MODERN_UA } });
    if (!cssRes.ok) {
        console.error(`ดาวน์โหลด CSS ของฟอนต์ไม่สำเร็จ (HTTP ${cssRes.status})`);
        process.exit(1);
    }
    let css = await cssRes.text();

    const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2/g) || [])];
    let downloaded = 0;
    for (const url of urls) {
        const name = url.split('/').pop();
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`ดาวน์โหลด ${name} ไม่สำเร็จ (HTTP ${res.status})`);
            process.exit(1);
        }
        writeFileSync(join(fontDir, name), Buffer.from(await res.arrayBuffer()));
        css = css.split(url).join(`./${name}`);
        downloaded++;
    }

    writeFileSync(fontCssPath, css);
    console.log(`  vendor/sarabun/                      ${downloaded} ไฟล์ + CSS`);
}

console.log('\nคัดลอกไลบรารีเรียบร้อย หน้าเว็บไม่ต้องพึ่ง CDN ภายนอกอีกต่อไป');
