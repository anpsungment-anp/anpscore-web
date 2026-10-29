/* ANPSCORE — ค่าตั้งค่าโปรเจกต์ Firebase

   แยกออกมาจาก auth/session.js เพราะหน้าศูนย์รวมระบบ (portal.html) ต้องใช้ projectId
   กับ apiKey เพื่ออ่านรายการลิงก์ผ่าน REST โดยไม่ต้องโหลด Firebase SDK ทั้งก้อน
   ค่าพวกนี้เปิดเผยได้อยู่แล้ว ความปลอดภัยอยู่ที่ firestore.rules ไม่ใช่ที่กุญแจนี้

   scripts/bootstrap-project.mjs เขียนทับไฟล์นี้ให้เองตอนย้ายไปโปรเจกต์ใหม่ */

export const firebaseConfig = {
    apiKey: "AIzaSyDikjUzn25LbLBUAoSqNF4A1Q_HkQQk-dY",
    authDomain: "anpscore-system.firebaseapp.com",
    projectId: "anpscore-system",
    storageBucket: "anpscore-system.firebasestorage.app",
    messagingSenderId: "450492080942",
    appId: "1:450492080942:web:567bd09f160c2351f890bf"
};
