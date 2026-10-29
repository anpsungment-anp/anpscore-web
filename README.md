# ANPSCORE

ระบบบริหารจัดการผลการเรียน (student grade / score management system) — a single-page web app for teachers and admins to record, manage, and report student scores.

## โครงสร้างโปรเจกต์

| ที่อยู่ | หน้าที่ |
|---|---|
| `index.html` | โครงหน้าของระบบคะแนนหลัก (เดิม 10,541 บรรทัด ตอนนี้เหลือโครง HTML ล้วน) |
| `app/` | โค้ดของระบบคะแนน แยกตามหน้าที่ |
| `auth/session.js` | การยืนยันตัวตนที่ทุกหน้าใช้ร่วมกัน |
| `auth/firebase-config.js` | ค่าตั้งค่าโปรเจกต์ Firebase แยกไว้ต่างหาก หน้าศูนย์รวมระบบจึงอ่านได้โดยไม่ต้องโหลด SDK |
| `portal.html` + `portal/` | ศูนย์รวมระบบโรงเรียน รวมลิงก์ทุกระบบไว้หน้าเดียว ผู้ดูแลระบบแก้ไขรายการได้จากหน้าเว็บ (เปิดที่ `/portal`) |
| `pp1.html` | ระบบ ปพ.1 งานทะเบียน |
| `schedule.html` + `schedule/` | ตารางสอนและครูสอนแทน |
| `vendor/` | ไลบรารีภายนอกที่เก็บไว้ในโปรเจกต์ ไม่พึ่ง CDN |
| `tools/anpscore-admin.mjs` | เครื่องมือผู้ดูแลระบบ (จัดการบัญชีผู้ใช้) |
| `firestore.rules` | กฎความปลอดภัยของฐานข้อมูล |

### ไฟล์ใน `app/`

โหลดเรียงตามลำดับนี้ ไฟล์หลังใช้ตัวแปรจากไฟล์หน้าได้

| ไฟล์ | หน้าที่ |
|---|---|
| `state.js` | ตัวแปรกลาง ฐานข้อมูลในเครื่อง |
| `utils.js` | ตัวช่วยทั่วไป รูปภาพ การแปลงค่าคะแนน |
| `storage.js` | บันทึกลงเครื่อง ติดตามข้อมูลค้าง กันคะแนนหาย |
| `cloud-status.js` | สถานะคลาวด์ ผู้ใช้ออนไลน์ การจองสิทธิ์แก้คะแนน |
| `app-shell.js` | เข้าออกระบบ เมนู ธีม กล่องข้อความ |
| `grading.js` | คำนวณคะแนนรวม เกรด ความคืบหน้า |
| `admin-scoring.js` | หน้าผู้ดูแลระบบ นำเข้าส่งออกคะแนนสอบ |
| `teacher-scoring.js` | หน้าครู ตารางกรอกคะแนน พิมพ์รายงาน |
| `guardian-reports.js` | รายงานแจ้งผู้ปกครอง คลังข้อมูลรายปี |
| `admin-manage.js` | จัดการบุคลากร ห้องเรียน รายวิชา ตั้งค่า |
| `a11y.js` | การใช้งานด้วยแป้นพิมพ์และโปรแกรมอ่านหน้าจอ |
| `cloud.js` | ซิงก์ข้อมูลกับ Firestore (ES module) |

## Tech stack

- Plain HTML/JS — ไม่มี framework ไม่มี bundler
- [Tailwind CSS](https://tailwindcss.com/) — build ล่วงหน้าเป็น `app/tailwind.css`
- [Chart.js](https://www.chartjs.org/), [SheetJS](https://sheetjs.com/), [jsPDF](https://github.com/parallax/jsPDF), [html2canvas](https://html2canvas.hertzen.com/), [Phosphor Icons](https://phosphoricons.com/) — เก็บไว้ใน `vendor/`
- [Firebase](https://firebase.google.com/) (Auth + Firestore) และ Firebase Hosting

## Authentication

ผู้ใช้ทุกคนมีบัญชี Firebase Auth ของตัวเอง สิทธิ์เก็บอยู่ใน Firestore ที่
`/userRoles/{uid}` ซึ่งเขียนได้เฉพาะผู้ดูแลระบบ

**การติดตั้งครั้งแรกต้องทำตาม [`docs/security-setup.md`](docs/security-setup.md) ให้ครบก่อน deploy**

```bash
node tools/anpscore-admin.mjs list
```

## Development

```bash
npm install
```

```bash
npm run build
```

`npm run build` ทำสามอย่าง — build Tailwind เป็น `app/tailwind.css`, คัดลอกไลบรารีเข้า `vendor/` และสร้าง `portal/icons.css` (ชุดไอคอนเฉพาะที่หน้าศูนย์รวมระบบใช้ สั่งแยกด้วย `npm run icons` ก็ได้)
ทั้งสองโฟลเดอร์ถูก commit เข้า git ด้วย เพื่อให้ `firebase deploy` ทำงานได้โดยไม่ต้อง build ก่อน

แก้ไข CSS ระหว่างพัฒนา:

```bash
npm run watch:css
```

เปิดเซิร์ฟเวอร์ทดสอบ (ต้องเปิดผ่าน http ไม่ใช่เปิดไฟล์ตรง ๆ เพราะใช้ ES module):

```bash
python -m http.server 5599
```

## Deployment

```bash
firebase deploy --only firestore:rules,hosting
```

Deployment targets the Firebase project configured in `.firebaserc`.
