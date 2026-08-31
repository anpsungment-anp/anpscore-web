/* ============================================================================
   ANPSCORE — ชั้นการยืนยันตัวตน (Authentication layer)
   ใช้ร่วมกันทั้ง index.html, pp1.html และ schedule.html

   เดิมระบบใช้ signInAnonymously แล้วเทียบรหัสผ่านในเบราว์เซอร์
   ใครเปิดหน้าเว็บก็อ่านข้อมูลนักเรียนและรหัสผ่านครูได้ทั้งหมด
   ชุดนี้เปลี่ยนไปใช้บัญชี Firebase Auth จริง โดย

     - ครูแต่ละคนมีบัญชีของตัวเอง   id_xxxxx@anpscore.local
     - ผู้ดูแลระบบใช้บัญชี          admin@anpscore.local
     - สิทธิ์อยู่ใน /userRoles/{uid} ซึ่งเขียนได้เฉพาะผู้ดูแลระบบ
       เบราว์เซอร์จึงแก้สิทธิ์ตัวเองไม่ได้ ต่อให้แก้โค้ดหน้าเว็บ

   อายุการล็อกอินผูกกับแท็บ (browserSessionPersistence)
   ปิดแท็บแล้วต้องล็อกอินใหม่ เหมาะกับเครื่องที่ใช้ร่วมกันในโรงเรียน
   ========================================================================== */

import { initializeApp, deleteApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth, setPersistence, browserSessionPersistence,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signOut, onAuthStateChanged, updatePassword,
    EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "AIzaSyDikjUzn25LbLBUAoSqNF4A1Q_HkQQk-dY",
    authDomain: "anpscore-system.firebaseapp.com",
    projectId: "anpscore-system",
    storageBucket: "anpscore-system.firebasestorage.app",
    messagingSenderId: "450492080942",
    appId: "1:450492080942:web:567bd09f160c2351f890bf"
};

/* โดเมนสมมติสำหรับสร้างบัญชี Firebase Auth
   ครูไม่ต้องมีอีเมลจริง ระบบประกอบอีเมลจากรหัสประจำตัวครูให้เอง */
export const ACCOUNT_DOMAIN = 'anpscore.local';
export const ADMIN_EMAIL = `admin@${ACCOUNT_DOMAIN}`;
export const ADMIN_ACTOR_ID = 'admin';

/* Firebase บังคับรหัสผ่านอย่างน้อย 6 ตัวอักษร */
export const MIN_PASSWORD_LENGTH = 6;

export const teacherEmail = (teacherId) => `${String(teacherId || '').trim()}@${ACCOUNT_DOMAIN}`;

/* ใช้แอปเดิมถ้ามีอยู่แล้ว กัน initializeApp ซ้ำเมื่อหลายสคริปต์เรียกโมดูลนี้ */
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const persistenceReady = setPersistence(auth, browserSessionPersistence)
    .catch(err => console.warn('ตั้งค่าอายุการล็อกอินไม่สำเร็จ ใช้ค่าเริ่มต้นแทน', err));

/* ---------------------------------------------------------------------------
   เส้นทางเอกสาร
   --------------------------------------------------------------------------- */
export const userRoleRef = (uid) => doc(db, 'userRoles', uid);
export const publicDirectoryRef = () => doc(db, 'anpscore', 'public_directory');

/* ---------------------------------------------------------------------------
   รายชื่อครูสำหรับหน้าล็อกอิน
   เก็บแค่รหัสกับชื่อ ไม่มีรหัสผ่านและไม่มีข้อมูลนักเรียน
   จึงเปิดให้อ่านก่อนล็อกอินได้ เพื่อให้เลือกบัญชีจากรายการแบบเดิม
   --------------------------------------------------------------------------- */
export async function loadPublicDirectory() {
    try {
        const snap = await getDoc(publicDirectoryRef());
        if (!snap.exists()) return [];
        const list = snap.data().teachers;
        return Array.isArray(list) ? list : [];
    } catch (err) {
        console.warn('อ่านรายชื่อครูไม่สำเร็จ', err);
        return [];
    }
}

/* เรียกทุกครั้งที่ผู้ดูแลระบบเพิ่ม แก้ หรือลบครู เพื่อให้หน้าล็อกอินตรงกับข้อมูลจริง */
export async function writePublicDirectory(teachers = []) {
    const entries = (Array.isArray(teachers) ? teachers : [])
        .filter(t => t && t.id && t.name)
        .map(t => ({ id: String(t.id), name: String(t.name) }));
    await setDoc(publicDirectoryRef(), { teachers: entries, updatedAt: serverTimestamp() });
    return entries.length;
}

/* ---------------------------------------------------------------------------
   สิทธิ์ผู้ใช้
   --------------------------------------------------------------------------- */
export async function readRole(uid) {
    if (!uid) return null;
    const snap = await getDoc(userRoleRef(uid));
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    if (data.active === false) return null;
    return {
        uid,
        role: data.role === 'admin' ? 'admin' : 'teacher',
        teacherId: data.teacherId || null,
        displayName: data.displayName || ''
    };
}

export async function writeRole(uid, { role, teacherId = null, displayName = '' }) {
    await setDoc(userRoleRef(uid), {
        role: role === 'admin' ? 'admin' : 'teacher',
        teacherId: teacherId ? String(teacherId) : null,
        displayName: String(displayName || ''),
        active: true,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

export async function setRoleActive(uid, active) {
    await setDoc(userRoleRef(uid), { active: !!active, updatedAt: serverTimestamp() }, { merge: true });
}

/* ---------------------------------------------------------------------------
   เข้าและออกจากระบบ
   --------------------------------------------------------------------------- */
async function signInAs(email, password) {
    await persistenceReady;
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const role = await readRole(cred.user.uid);
    if (!role) {
        await signOut(auth).catch(() => {});
        const err = new Error('บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
        err.code = 'anpscore/no-role';
        throw err;
    }
    return role;
}

export function signInTeacher(teacherId, password) {
    return signInAs(teacherEmail(teacherId), password);
}

export function signInAdmin(password) {
    return signInAs(ADMIN_EMAIL, password);
}

export function signOutNow() {
    return signOut(auth);
}

export function onSession(callback) {
    return onAuthStateChanged(auth, async (user) => {
        if (!user) return callback(null);
        try {
            const role = await readRole(user.uid);
            if (!role) {
                // เครื่องที่เคยใช้ระบบเดิมจะมีบัญชีนิรนามค้างอยู่
                // ล้างทิ้งเสียเลย จะได้ไม่มี token ที่ไม่มีสิทธิ์ค้างในเบราว์เซอร์
                await signOut(auth).catch(() => {});
                return callback(null);
            }
            callback(role);
        } catch (err) {
            console.warn('อ่านสิทธิ์ผู้ใช้ไม่สำเร็จ', err);
            callback(null);
        }
    });
}

/* แปลงรหัสข้อผิดพลาดของ Firebase เป็นข้อความภาษาไทย
   ไม่บอกว่าบัญชีมีอยู่จริงหรือไม่ เพื่อไม่ให้ใช้หน้าล็อกอินไล่เดารายชื่อบัญชี */
export function describeAuthError(err) {
    const code = (err && err.code) || '';
    if (code === 'anpscore/no-role') return err.message;
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-email':
            return 'บัญชีผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        case 'auth/too-many-requests':
            return 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
        case 'auth/user-disabled':
            return 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
        case 'auth/network-request-failed':
            return 'เชื่อมต่อเครือข่ายไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต';
        case 'auth/weak-password':
            return `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`;
        case 'auth/requires-recent-login':
            return 'เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่ก่อนเปลี่ยนรหัสผ่าน';
        default:
            return (err && err.message) || 'เข้าสู่ระบบไม่สำเร็จ';
    }
}

/* ---------------------------------------------------------------------------
   เปลี่ยนรหัสผ่านของตัวเอง
   ต้องยืนยันรหัสผ่านเดิมก่อน กันกรณีลืมล็อกเอาต์แล้วมีคนมาเปลี่ยนรหัสทิ้งไว้
   --------------------------------------------------------------------------- */
export async function changeOwnPassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
    if (String(newPassword || '').length < MIN_PASSWORD_LENGTH) {
        const err = new Error(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
        err.code = 'auth/weak-password';
        throw err;
    }
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
}

/* ---------------------------------------------------------------------------
   สร้างบัญชีให้ครู (ใช้ตอนย้ายข้อมูลและตอนเพิ่มครูใหม่)

   createUserWithEmailAndPassword จะสลับผู้ใช้ปัจจุบันไปเป็นบัญชีที่เพิ่งสร้าง
   จึงต้องสร้างผ่านแอปสำรอง เพื่อไม่ให้ผู้ดูแลระบบหลุดจากระบบกลางคัน
   --------------------------------------------------------------------------- */
export async function createAccount(email, password) {
    const secondary = initializeApp(firebaseConfig, `provisioner-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const secondaryAuth = getAuth(secondary);
    try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        return cred.user.uid;
    } finally {
        await signOut(secondaryAuth).catch(() => {});
        await deleteApp(secondary).catch(() => {});
    }
}

/* ใช้ตอนย้ายข้อมูล เพื่อหา uid ของบัญชีที่สร้างไว้แล้วในรอบก่อน
   ทำให้กดย้ายข้อมูลซ้ำได้โดยไม่พัง */
export async function lookupAccountUid(email, password) {
    const secondary = initializeApp(firebaseConfig, `lookup-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const secondaryAuth = getAuth(secondary);
    try {
        const cred = await signInWithEmailAndPassword(secondaryAuth, email, password);
        return cred.user.uid;
    } finally {
        await signOut(secondaryAuth).catch(() => {});
        await deleteApp(secondary).catch(() => {});
    }
}

/* รหัสผ่านเดิมบางคนสั้นกว่าที่ Firebase ยอมรับ
   กรณีนั้นระบบจะสุ่มรหัสใหม่ให้ แล้วแสดงให้ผู้ดูแลระบบจดไปแจ้งครูครั้งเดียว */
export function generatePassword(length = 8) {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

/* ---------------------------------------------------------------------------
   ด่านตรวจสำหรับหน้าอื่น (pp1.html, schedule.html)
   เดิมสองหน้านี้เปิด URL ตรงก็เข้าได้เลยโดยไม่ต้องล็อกอิน
   --------------------------------------------------------------------------- */
export function requireStaff({ redirectTo = 'index.html', allowRoles = ['admin', 'teacher'] } = {}) {
    return new Promise((resolve) => {
        const unsubscribe = onSession((session) => {
            unsubscribe();
            if (session && allowRoles.includes(session.role)) return resolve(session);
            window.location.replace(redirectTo);
        });
    });
}
