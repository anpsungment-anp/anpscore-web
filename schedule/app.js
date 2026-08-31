/* ============================================================================
   ระบบจัดตารางสอนและครูสอนแทน — ตัวควบคุมหน้าจอหลัก (App shell)

   ดูแลการเข้าสู่ระบบ เมนูตามสิทธิ์ การสลับหน้า ปีการศึกษา/ภาคเรียน
   การแจ้งเตือน และการออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน
   ========================================================================== */

(function () {
    'use strict';

    const TT = window.TT;
    const UI = window.TTUI;
    const App = window.TTApp = {};
    const $ = (id) => document.getElementById(id);

    /* --------------------------------------------------------------- รายการเมนู */

    /* need = ความสามารถที่ต้องมีจึงจะเห็นเมนูนี้ (ว่าง = ทุกคนเห็น)
       mobile = แสดงบนแถบล่างของมือถือด้วย */
    const MENU = [
        { id: 'dashboard', icon: 'ph-squares-four', label: 'แดชบอร์ด', mobile: true },
        { id: 'timetable', icon: 'ph-calendar-blank', label: 'ตารางสอน', mobile: true },
        { id: 'editor', icon: 'ph-squares-four', label: 'จัดตารางสอน', need: 'schedule', icon2: 'ph-pencil-ruler', mobile: true },
        { id: 'allocation', icon: 'ph-list-checks', label: 'จัดสรรวิชาและคาบ', need: 'schedule' },
        { id: 'teachers', icon: 'ph-users-three', label: 'ข้อมูลครู', need: 'viewAll' },
        { id: 'classes', icon: 'ph-student', label: 'ระดับชั้นและห้องเรียน', need: 'viewAll' },
        { id: 'subjects', icon: 'ph-books', label: 'รายวิชา', need: 'viewAll' },
        { id: 'rooms', icon: 'ph-door-open', label: 'ห้องเรียนและห้องพิเศษ', need: 'viewAll' },
        { id: 'freeslots', icon: 'ph-magnifying-glass', label: 'ค้นหาคาบว่าง' },
        { id: 'leaves', icon: 'ph-user-minus', label: 'ครูขาดและการลา', mobile: true },
        { id: 'substitutes', icon: 'ph-arrows-left-right', label: 'จัดครูสอนแทน', mobile: true },
        { id: 'workload', icon: 'ph-chart-bar', label: 'ภาระงานครู' },
        { id: 'reports', icon: 'ph-file-text', label: 'รายงาน' },
        { id: 'users', icon: 'ph-shield-check', label: 'ผู้ใช้งานและสิทธิ์', need: 'manageUsers' },
        { id: 'settings', icon: 'ph-sliders-horizontal', label: 'ตั้งค่าระบบ', need: 'settings' }
    ];

    const visibleMenu = () => MENU.filter(m => !m.need || TT.can(m.need));

    /* หน้าที่แต่ละหน้าใช้แสดงผล — ประกาศไว้ในไฟล์ pages-*.js */
    const ROUTES = {
        dashboard: () => TTPages.dashboard,
        timetable: () => TTPages.timetable,
        editor: () => TTPages.editor,
        allocation: () => TTPages.allocation,
        teachers: () => TTPages.teachers,
        classes: () => TTPages.classes,
        subjects: () => TTPages.subjects,
        rooms: () => TTPages.rooms,
        freeslots: () => TTPages.freeslots,
        leaves: () => TTPages.leaves,
        substitutes: () => TTPages.substitutes,
        workload: () => TTPages.workload,
        reports: () => TTPages.reports,
        users: () => TTPages.users,
        settings: () => TTPages.settings
    };

    /* -------------------------------------------------------------- เข้าสู่ระบบ */

    App.logout = function () {
        UI.confirm('ออกจากระบบ', 'ต้องการออกจากระบบตารางสอนหรือไม่?', 'warn', () => {
            location.href = 'index.html';
        }, 'ออกจากระบบ');
    };

    /* -------------------------------------------------------------- เมนู/เส้นทาง */

    const buildMenus = function () {
        const items = visibleMenu();

        const nav = $('nav-menu');
        const mnav = $('mobile-nav-menu');
        nav.innerHTML = '';
        mnav.innerHTML = '';
        items.forEach(item => {
            [nav, mnav].forEach((host, i) => {
                const btn = document.createElement('button');
                btn.className = 'nav-btn';
                btn.id = (i ? 'mnav-' : 'nav-') + item.id;
                btn.innerHTML = `<i class="ph ${item.icon}"></i><span>${item.label}</span>`;
                btn.onclick = () => { if (i) App.toggleMobileMenu(); App.go(item.id); };
                host.appendChild(btn);
            });
        });

        /* แถบล่างของมือถือ : เลือกเมนูหลัก 5 รายการที่ใช้บ่อย */
        const bottom = $('bottom-nav');
        bottom.innerHTML = '';
        const mobileItems = items.filter(m => m.mobile).slice(0, 4);
        mobileItems.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'bottom-nav-btn';
            btn.id = 'bnav-' + item.id;
            btn.innerHTML = `<i class="ph ${item.icon}"></i><span>${item.label}</span>`;
            btn.onclick = () => App.go(item.id);
            bottom.appendChild(btn);
        });
        const more = document.createElement('button');
        more.className = 'bottom-nav-btn';
        more.innerHTML = `<i class="ph ph-dots-three-circle"></i><span>เมนูอื่น</span>`;
        more.onclick = () => App.toggleMobileMenu();
        bottom.appendChild(more);
    };

    App.toggleMobileMenu = function () {
        $('mobile-menu').classList.toggle('hidden');
    };

    App.go = function (pageId) {
        const item = visibleMenu().find(m => m.id === pageId) || visibleMenu()[0];
        if (!item) return;
        TT.state.page = item.id;

        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        ['nav-', 'mnav-', 'bnav-'].forEach(p => {
            const b = $(p + item.id);
            if (b) b.classList.add('active');
        });
        document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
        const bb = $('bnav-' + item.id);
        if (bb) bb.classList.add('active');

        $('page-title').innerText = item.label;
        updateContext();

        const area = $('content-area');
        area.innerHTML = `<div id="page-root" class="animate-fade-in-up"></div>`;
        const root = $('page-root');
        const fn = ROUTES[item.id] && ROUTES[item.id]();
        if (typeof fn === 'function') {
            try {
                fn(root);
            } catch (e) {
                console.error(e);
                root.innerHTML = `<div class="modern-card p-8 text-center text-rose-600 font-bold">
                    เกิดข้อผิดพลาดในการแสดงหน้านี้<br><span class="text-sm font-medium text-slate-500">${UI.esc(e.message || e)}</span></div>`;
            }
        } else {
            root.innerHTML = UI.empty('ยังไม่มีหน้านี้');
        }
        App.wireTermBar();      // หน้าไหนที่ใส่แถบเลือกปี/ภาคไว้ จะทำงานทันที
        window.scrollTo(0, 0);
    };

    App.refresh = function () { App.go(TT.state.page); };

    const updateContext = function () {
        const s = TT.state.settings;
        const plan = TT.state.plan || {};
        const statusText = plan.status === 'published' ? 'ประกาศใช้แล้ว' : 'ฉบับร่าง';
        $('page-context').innerText =
            'ปีการศึกษา ' + s.activeYear + ' · ภาคเรียนที่ ' + s.activeTerm + ' · ตาราง' + statusText;
    };
    App.updateContext = updateContext;

    /* ------------------------------------------------- ตัวเลือกปีการศึกษา/ภาคเรียน */

    /* แถบเลือกปี/ภาค ใช้ซ้ำได้ทุกหน้า — เรียกจาก TTApp.termBar() */
    App.termBar = function (extraHtml) {
        const s = TT.state.settings;
        const years = (s.years || []).map(y => y.year);
        if (!years.includes(s.activeYear)) years.unshift(s.activeYear);
        return `
        <div class="modern-card p-3 md:p-4 mb-5 flex flex-wrap items-center gap-3 no-print">
            <div class="flex items-center gap-2">
                <i class="ph ph-calendar text-blue-600 text-xl"></i>
                <span class="font-bold text-slate-700 text-sm">ปีการศึกษา</span>
                <select id="sel-year" class="border border-slate-200 rounded-xl px-3 py-2 font-bold focus-ring">
                    ${years.map(y => `<option value="${UI.esc(y)}" ${y === s.activeYear ? 'selected' : ''}>${UI.esc(y)}</option>`).join('')}
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="font-bold text-slate-700 text-sm">ภาคเรียนที่</span>
                <select id="sel-term" class="border border-slate-200 rounded-xl px-3 py-2 font-bold focus-ring">
                    <option value="1" ${s.activeTerm === '1' ? 'selected' : ''}>1</option>
                    <option value="2" ${s.activeTerm === '2' ? 'selected' : ''}>2</option>
                </select>
            </div>
            <div class="flex-1"></div>
            ${extraHtml || ''}
        </div>`;
    };

    /* ต้องเรียกหลังใส่ termBar ลงหน้า เพื่อผูกเหตุการณ์ */
    App.wireTermBar = function () {
        const y = $('sel-year'), t = $('sel-term');
        if (!y || !t) return;
        const change = async () => {
            TT.state.settings.activeYear = y.value;
            TT.state.settings.activeTerm = t.value;
            $('content-area').innerHTML = UI.loading('กำลังโหลดข้อมูลภาคเรียน...');
            try {
                await TT.saveSettingsNow();
                await TT.loadTermData();
                App.refresh();
            } catch (e) {
                console.error(e);
                UI.notify('โหลดข้อมูลภาคเรียนไม่สำเร็จ', 'error');
            }
        };
        y.onchange = change;
        t.onchange = change;
    };

    /* ------------------------------------------------------------- การแจ้งเตือน */

    App.updateNotifBadge = function () {
        const unread = TT.myNotifications().filter(n => !n.read).length;
        const dot = $('notif-dot');
        dot.classList.toggle('hidden', unread === 0);
        dot.innerText = unread > 99 ? '99+' : String(unread);
    };

    App.openNotifications = function () {
        const list = TT.myNotifications();
        const body = list.length ? `<div class="space-y-2">` + list.slice(0, 60).map(n => `
            <div class="p-3 rounded-xl border ${n.read ? 'bg-white border-slate-100' : 'bg-blue-50/70 border-blue-100'}">
                <div class="flex items-start gap-2">
                    <i class="ph ${n.read ? 'ph-envelope-open' : 'ph-envelope'} text-blue-600 text-lg mt-0.5"></i>
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-slate-800 text-sm">${UI.esc(n.title)}</div>
                        <div class="text-slate-600 text-sm">${UI.esc(n.message)}</div>
                        <div class="text-[11px] text-slate-400 mt-1">${TT.thaiDateTime(n.at)}</div>
                    </div>
                    ${n.link ? `<button onclick="TTUI.closeModal(); TTApp.go('${n.link}')" class="text-blue-600 font-bold text-xs shrink-0">เปิดดู</button>` : ''}
                </div>
            </div>`).join('') + `</div>` : UI.empty('ยังไม่มีการแจ้งเตือน', 'ph-bell-slash');

        UI.modal('การแจ้งเตือน', body, {
            width: 'max-w-xl',
            footer: list.length ? `<button id="btn-read-all" class="tactile-btn px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700">อ่านทั้งหมดแล้ว</button>` : '',
            onOpen: () => {
                const b = $('btn-read-all');
                if (b) b.onclick = () => {
                    const mine = TT.state.user.role === 'admin' ? 'admin' : String(TT.state.user.id);
                    (TT.state.ops.notifications || []).forEach(n => {
                        if (String(n.to) === mine || n.to === 'all') n.read = true;
                    });
                    TT.saveOps(200);
                    App.updateNotifBadge();
                    UI.closeModal();
                };
            }
        });
    };

    /* ------------------------------------------------- ออกจากระบบอัตโนมัติ */

    let idleTimer = null;
    const resetIdle = function () {
        if (idleTimer) clearTimeout(idleTimer);
        const minutes = Number((TT.state.settings && TT.state.settings.sessionTimeoutMin) || 60);
        if (!minutes) return;
        idleTimer = setTimeout(() => {
            try { sessionStorage.removeItem('anpscore_user'); } catch (e) { }
            alert('ไม่มีการใช้งานเป็นเวลา ' + minutes + ' นาที ระบบออกจากระบบให้อัตโนมัติเพื่อความปลอดภัย');
            location.reload();
        }, minutes * 60000);
    };

    /* --------------------------------------------------------------- เริ่มระบบ */

    const startApp = function () {
        $('boot-screen').classList.add('hidden');
        $('app-shell').classList.remove('hidden');

        const u = TT.state.user;
        $('user-name').innerText = u.name || (u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน');
        $('user-role').innerText = TT.roleLabel();
        const t = u.role === 'teacher' ? TT.teacher(u.id) : null;
        if (t && t.picUrl) {
            $('user-avatar').innerHTML = `<img src="${UI.esc(t.picUrl)}" class="w-9 h-9 rounded-xl object-cover" alt="">`;
        }

        buildMenus();
        App.updateNotifBadge();
        App.go(visibleMenu()[0].id);

        if (TT.state.demo) {
            /* แถบเตือนว่ากำลังใช้ข้อมูลตัวอย่าง ไม่ใช่ข้อมูลจริงของโรงเรียน */
            const bar = document.createElement('div');
            bar.className = 'bg-amber-400 text-amber-950 px-4 py-2 text-sm font-extrabold flex items-center justify-center gap-3 no-print';
            bar.innerHTML = `<i class="ph ph-flask text-lg"></i> กำลังใช้ข้อมูลตัวอย่างสำหรับทดสอบระบบ (ไม่กระทบข้อมูลจริง)
                <button onclick="TTSeed.disable()" class="underline">ออกจากโหมดตัวอย่าง</button>`;
            document.querySelector('#app-shell > div').prepend(bar);
        } else {
            /* ติดตามการเปลี่ยนแปลงของงานสอนแทน/การลา เพื่อให้ทุกเครื่องเห็นตรงกัน */
            window.ttCloud.subscribe(TT.docIdOps(), (data) => {
                if (!data) return;
                const mineBefore = TT.myNotifications().filter(n => !n.read).length;
                TT.state.ops = data;
                App.updateNotifBadge();
                const mineAfter = TT.myNotifications().filter(n => !n.read).length;
                if (mineAfter > mineBefore) UI.notify('มีการแจ้งเตือนใหม่', 'info');
                if (['leaves', 'substitutes', 'dashboard'].includes(TT.state.page)) App.refresh();
            });
        }

        ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));
        resetIdle();
    };

    const boot = async function () {
        try {
            await TT.loadAll();
        } catch (e) {
            console.error(e);
            const cache = TT.readLocalCache();
            if (cache && cache.settings) {
                /* ใช้ข้อมูลสำรองในเครื่องต่อได้ แต่แจ้งให้ผู้ใช้ทราบ */
                TT.state.settings = cache.settings;
                TT.state.plan = cache.plan;
                TT.state.ops = cache.ops;
                TT.state.core = TT.state.core || { teachers: [], classes: {}, subjects: [] };
                UI.notify('เชื่อมต่อคลาวด์ไม่ได้ กำลังใช้ข้อมูลสำรองในเครื่อง', 'warn');
            } else {
                $('boot-error').classList.remove('hidden');
                $('boot-error').innerText = 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ : ' + (e.message || e);
                return;
            }
        }

        /* สิทธิ์มาจากบัญชีที่ล็อกอินไว้แล้วในระบบคะแนน */
        const session = window.ttSession;
        if (session && session.role === 'admin') {
            TT.state.user = { role: 'admin', id: 'admin', name: 'ผู้ดูแลระบบ' };
            startApp();
            return;
        }
        if (session && session.role === 'teacher') {
            const t = TT.teacher(session.teacherId);
            if (t) {
                TT.state.user = { role: 'teacher', id: t.id, name: t.name };
                startApp();
                return;
            }
        }

        /* ล็อกอินแล้วแต่หาบัญชีครูในระบบคะแนนไม่เจอ */
        $('boot-screen').classList.add('hidden');
        $('boot-error').classList.remove('hidden');
        $('boot-error').innerText = 'บัญชีนี้ยังไม่ได้ผูกกับข้อมูลครูในระบบคะแนน กรุณาติดต่อผู้ดูแลระบบ';
    };

    window.addEventListener('tt-cloud-ready', boot);
    if (window.ttCloudReady) boot();
})();
