/** @type {import('tailwindcss').Config} */
/* ANPSCORE — ตั้งค่า Tailwind สำหรับ build ล่วงหน้า
   เดิมใช้ cdn.tailwindcss.com ซึ่งคอมไพล์ CSS ใหม่ทุกครั้งที่เปิดหน้าเว็บ
   และจะพังทั้งระบบถ้า CDN ล่ม */
module.exports = {
    content: [
        './index.html',
        './pp1.html',
        './schedule.html',
        './app/*.js',
        './auth/*.js',
        './schedule/*.js'
    ],
    theme: {
        extend: {}
    },
    plugins: []
};
