/* ศูนย์รวมระบบโรงเรียน — รายการเริ่มต้น
   ใช้แสดงผลจนกว่าผู้ดูแลระบบจะแก้ไขครั้งแรกจากหน้า portal.html
   หลังจากนั้นรายการจริงอยู่ใน Firestore (/anpscore/portal_public และ /anpscore/portal_staff)
   แก้ไฟล์นี้จะไม่มีผลกับรายการที่บันทึกไปแล้ว */

export const DEFAULT_PORTAL = {
    page: {
        schoolName: 'โรงเรียนอนุพงศ์พัชรินทร์',
        subtitle: 'ศูนย์รวมระบบและลิงก์ของโรงเรียน',
        logo: ''
    },
    categories: [
        { id: 'systems',  name: 'ระบบงานของโรงเรียน',   icon: 'squares-four' },
        { id: 'docs',     name: 'เอกสารและแบบฟอร์ม',    icon: 'folder-open' },
        { id: 'agencies', name: 'หน่วยงานและเครือข่าย', icon: 'buildings' }
    ],
    links: [
        {
            id: 'anpscore', category: 'systems',
            title: 'ANPSCORE ระบบผลการเรียน',
            description: 'บันทึกคะแนน ตัดเกรด และพิมพ์รายงานแจ้งผู้ปกครอง',
            url: 'index.html', icon: 'graduation-cap', tone: 'indigo', login: true
        },
        {
            id: 'pp1', category: 'systems',
            title: 'ระบบ ปพ.1 งานทะเบียน',
            description: 'ระเบียนแสดงผลการเรียน (ปพ.1) และใบรับรองผลการศึกษา (ปพ.7)',
            url: 'pp1.html', icon: 'certificate', tone: 'violet', login: true
        },
        {
            id: 'schedule', category: 'systems',
            title: 'ตารางสอนและครูสอนแทน',
            description: 'จัดตารางสอนรายห้อง รายครู และจัดครูสอนแทนเมื่อมีครูลา',
            url: 'schedule.html', icon: 'calendar-check', tone: 'blue', login: true
        },
        {
            id: 'survey', category: 'systems',
            title: 'ระบบจัดการข้อมูลนักเรียน',
            description: 'ข้อมูลส่วนตัวนักเรียนและผู้ปกครอง (แบบสำรวจ 2569)',
            url: 'https://school-survey-2569.web.app/', icon: 'identification-card', tone: 'teal', login: false
        },
        {
            id: 'opec', category: 'agencies',
            title: 'สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน (สช.)',
            description: 'ข่าว ประกาศ และหนังสือราชการจากต้นสังกัด',
            url: 'https://www.opec.go.th/', icon: 'bank', tone: 'amber', login: false
        },
        {
            id: 'phrae-network', category: 'agencies',
            title: 'โรงเรียนเอกชนจังหวัดแพร่',
            description: 'ตราสัญลักษณ์โรงเรียนเอกชนในจังหวัดแพร่ ภายใต้ สช.',
            url: 'logos.html', icon: 'circles-three-plus', tone: 'emerald', login: false
        }
    ]
};

/* ไอคอนที่ให้เลือกในหน้าจัดการ (ชื่อตาม Phosphor Icons ไม่ต้องใส่ ph-) */
export const ICONS = [
    'graduation-cap', 'certificate', 'calendar-check', 'calendar', 'clipboard-text', 'list-checks',
    'exam', 'chart-bar', 'identification-card', 'student', 'users-three', 'chalkboard-teacher',
    'book-open', 'books', 'notebook', 'file-text', 'files', 'folder-open',
    'file-pdf', 'microsoft-excel-logo', 'google-drive-logo', 'google-logo', 'megaphone', 'newspaper',
    'envelope', 'chat-circle-dots', 'phone', 'video-camera', 'youtube-logo', 'facebook-logo',
    'tiktok-logo', 'instagram-logo', 'bank', 'buildings', 'house', 'globe',
    'map-pin', 'circles-three-plus', 'squares-four', 'wallet', 'heartbeat', 'first-aid',
    'trophy', 'medal', 'camera', 'image', 'music-notes', 'soccer-ball',
    'bus', 'bowl-food', 'shield-check', 'lock-simple', 'desktop', 'printer',
    'wifi-high', 'lightbulb', 'flask', 'calculator', 'translate', 'palette',
    'hand-heart', 'link'
];

/* โทนสีของไอคอน ค่าสีจริงอยู่ใน portal/portal.css */
export const TONES = ['indigo', 'blue', 'sky', 'teal', 'emerald', 'amber', 'orange', 'rose', 'violet', 'slate'];
