/* สร้าง portal/icons.css — ชุด CSS ไอคอนเฉพาะที่หน้าศูนย์รวมระบบใช้จริง
   ของเดิม vendor/phosphor/style.css มีไอคอนพันกว่าตัว (ราว 76 KB) ซึ่งบล็อกการวาดหน้าจอ
   ไฟล์ที่สร้างจากสคริปต์นี้เหลือเฉพาะที่ใช้ ราว 6 KB โดยยังใช้ไฟล์ฟอนต์ตัวเดียวกับหน้าอื่น

   สั่งใหม่ทุกครั้งที่เพิ่มไอคอนใน portal/defaults.js หรือ portal/portal.js
       node scripts/portal-icons.mjs        (npm run build เรียกให้อยู่แล้ว) */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

/* ---- 1. ไอคอนที่หน้านี้ใช้ ---- */
const defaults = read('portal', 'defaults.js');
const script = read('portal', 'portal.js');
const page = read('portal.html');

const used = new Set();
const collect = (text, pattern, group = 1) => {
    for (const m of text.matchAll(pattern)) used.add(m[group]);
};
// รายการไอคอนที่ให้ผู้ดูแลระบบเลือก และไอคอนของลิงก์เริ่มต้น
collect(defaults, /'([a-z0-9-]+)'/g);
// ไอคอนที่เรียกตรง ๆ ในโค้ด เช่น icon('trash') หรือ safeIcon(x, 'folder-open')
collect(script, /\bicon\('([a-z0-9-]+)'/g);
collect(script, /safeIcon\([^,)]+,\s*'([a-z0-9-]+)'\)/g);
collect(page, /\bph-([a-z0-9-]+)\b/g);

/* ---- 2. อ่านของจริงจากชุดไอคอนใน vendor ---- */
const source = read('vendor', 'phosphor', 'style.css');
const firstIcon = source.indexOf('.ph.ph-');
const base = source
    .slice(0, firstIcon)
    .replace(/url\("\.\//g, 'url("../vendor/phosphor/')
    .trimEnd();

const codes = new Map();
for (const m of source.matchAll(/\.ph\.ph-([a-z0-9-]+):before\s*\{\s*content:\s*"([^"]+)";?\s*\}/g)) {
    codes.set(m[1], m[2]);
}

const wanted = [...used].filter(name => codes.has(name)).sort();
const rules = wanted.map(name => `.ph.ph-${name}:before { content: "${codes.get(name)}"; }`).join('\n');

/* ---- 3. เขียนไฟล์ ---- */
const out = `/* ไฟล์นี้สร้างจาก scripts/portal-icons.mjs — อย่าแก้ด้วยมือ
   ไอคอน ${wanted.length} ตัวที่หน้า portal.html ใช้ คัดมาจาก vendor/phosphor/style.css
   สร้างใหม่ด้วย  npm run icons  (หรือ npm run build) */

${base}

${rules}
`;
writeFileSync(join(ROOT, 'portal', 'icons.css'), out);

const size = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
console.log(`portal/icons.css : ไอคอน ${wanted.length} ตัว  ${size(out)}  (ของเดิม ${size(source)})`);
