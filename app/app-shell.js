/* ANPSCORE — เข้าออกระบบ เมนู ธีม และกล่องข้อความ
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

window.initializeAppUI = function() {
    state.term = DB.schoolInfo.term || "1";
    $('global-term-select').value = state.term;
    if(window.recalculateAllLoadedProgressSummaries) window.recalculateAllLoadedProgressSummaries();
    if(window.applyThemeMode) window.applyThemeMode();
    $('loading-screen').classList.add('opacity-0', 'scale-105');
    setTimeout(() => $('loading-screen').classList.add('hidden'), 700);

    // state.user มาจากสถานะล็อกอินจริงของ Firebase Auth
    // ไม่ได้อ่านจาก sessionStorage ที่ผู้ใช้แก้เองได้อีกต่อไป
    if(state.user) {
        let recordLogin = !!window.pendingLoginRecord;
        window.pendingLoginRecord = false;
        // ครูที่ล็อกอินจากหน้าศูนย์รวมระบบ (portal.html) แล้วเปิดระบบคะแนนต่อ ก็นับเป็นการเข้าใช้งานใหม่
        try {
            if(sessionStorage.getItem('anpscore_pending_login_record')) {
                sessionStorage.removeItem('anpscore_pending_login_record');
                recordLogin = true;
            }
        } catch(e) {}
        if(state.user.role === 'teacher') window.persistTeacherActivity(state.user.id, true, recordLogin);
        if(state.user.role === 'admin') window.persistAdminActivity(true);
        $('login-screen').classList.add('hidden', 'opacity-0');
        $('app-container').classList.remove('hidden', 'opacity-0');
        window.buildSidebar(); window.updateLogoAndHeader();
        window.navigate(state.user.role === 'admin' ? 'admin_dash' : 'teacher_dash');
    } else {
        window.showLoginScreen();
    }
};

window.showLoginScreen = function() {
    $('loading-screen').classList.add('opacity-0', 'scale-105');
    setTimeout(() => $('loading-screen').classList.add('hidden'), 700);
    $('app-container').classList.add('hidden', 'opacity-0');
    $('login-screen').classList.remove('hidden', 'scale-105');
    setTimeout(() => $('login-screen').classList.remove('opacity-0'), 50);
    window.populateTeacherLoginSelect();
};

window.requestCurrentViewRefresh = function(options = {}) {
    if(refreshViewTimer) clearTimeout(refreshViewTimer);
    refreshViewTimer = setTimeout(() => {
        refreshViewTimer = null;
        window.refreshCurrentView(options);
    }, options.delay || 600);
};

window.refreshCurrentView = function(options = {}) {
    window.updateLogoAndHeader();
    if (!$('login-screen').classList.contains('hidden')) window.populateTeacherLoginSelect();
    if (!state.user || !state.activePage) return;

    const activeEl = document.activeElement;
    const isEditing = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
    const modalOpen = !$('modal-container').classList.contains('hidden');
    const isRecentInteraction = Date.now() - lastUserInteractionAt < 900;

    if(!options.force && isRecentInteraction) {
        window.requestCurrentViewRefresh(Object.assign({}, options, { delay: 1000 }));
        return;
    }

    if(state.activePage === 'teacher_scoring') {
        if(typeof window.t_updateScoreTableValues === 'function') window.t_updateScoreTableValues();
        if(typeof window.refreshScoreLockBanner === 'function') window.refreshScoreLockBanner();
        return;
    }

    if(options.soft) {
        if(typeof window.updateActiveUsersUI === 'function') window.updateActiveUsersUI();
        return;
    }

    if(!isEditing && !modalOpen) {
        window.buildSidebar();
        window.navigate(state.activePage);
    }
};

const $ = id => document.getElementById(id);

window.notify = function(msg, isError = false) {
    const t = $('toast');
    const icon = $('toast-icon');
    $('toast-msg').innerText = msg;
    t.classList.remove('translate-y-24', 'opacity-0');
    if(isError) { 
        t.className = "fixed bottom-6 right-6 z-[110] text-white px-6 py-4 rounded-2xl shadow-2xl transform transition-all duration-400 flex items-center gap-3 backdrop-blur-md font-medium border border-rose-400 bg-rose-600/90";
        icon.className = "ph ph-warning-circle text-2xl drop-shadow";
    } else {
        t.className = "fixed bottom-6 right-6 z-[110] text-white px-6 py-4 rounded-2xl shadow-2xl transform transition-all duration-400 flex items-center gap-3 backdrop-blur-md font-medium border border-emerald-400 bg-emerald-600/90";
        icon.className = "ph ph-check-circle text-2xl drop-shadow";
    }
    setTimeout(() => t.classList.add('translate-y-24', 'opacity-0'), 3500);
};

const generateId = () => 'id_' + Math.random().toString(36).substr(2, 9);

window.escapeHtml = function(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

window.getThemeMode = function() {
    try {
        const saved = localStorage.getItem('anpscore_theme');
        if(saved === 'dark' || saved === 'light') return saved;
    } catch(e) {}
    const mode = DB.schoolInfo && DB.schoolInfo.themeMode;
    return mode === 'dark' ? 'dark' : 'light';
}

window.updateThemeToggleUI = function() {
    const btn = $('theme-toggle-btn');
    if(!btn) return;
    const isDark = document.documentElement.classList.contains('dark-mode');
    btn.className = `animate-fade-in-up stagger-1 flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-bold border shadow-sm backdrop-blur-md transition-colors ${isDark ? 'bg-amber-100/15 text-amber-100 border-amber-300/30 hover:bg-amber-100/25' : 'bg-slate-100/80 text-slate-700 border-slate-200/70 hover:bg-slate-200'}`;
    btn.title = isDark ? 'สลับเป็น Light mode' : 'สลับเป็น Dark mode';
    const icon = $('theme-toggle-icon');
    const label = $('theme-toggle-label');
    if(icon) icon.className = `ph ${isDark ? 'ph-sun' : 'ph-moon'} text-lg`;
    if(label) label.innerText = isDark ? 'สว่าง' : 'กลางคืน';
}

window.applyThemeMode = function(mode = null) {
    const nextMode = mode === 'dark' || mode === 'light' ? mode : window.getThemeMode();
    document.documentElement.classList.toggle('dark-mode', nextMode === 'dark');
    try { localStorage.setItem('anpscore_theme', nextMode); } catch(e) {}
    window.updateThemeToggleUI();
}

window.toggleThemeMode = function() {
    const nextMode = document.documentElement.classList.contains('dark-mode') ? 'light' : 'dark';
    window.applyThemeMode(nextMode);
    window.notify(nextMode === 'dark' ? 'เปิดโหมดกลางคืนแล้ว' : 'เปิดโหมดสว่างแล้ว');
}

window.normalizeScoreEntryPolicy = function(policy = null) {
    const src = policy && typeof policy === 'object' ? policy : {};
    const validModes = ['always', 'scheduled', 'closed'];
    const mode = validModes.includes(src.mode) ? src.mode : 'always';
    return {
        mode,
        startDate: typeof src.startDate === 'string' ? src.startDate : '',
        endDate: typeof src.endDate === 'string' ? src.endDate : '',
        notice: typeof src.notice === 'string' ? src.notice : ''
    };
}

window.formatThaiDate = function(dateStr) {
    if(!dateStr) return '';
    const d = new Date(`${dateStr}T00:00:00`);
    if(Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

window.getScoreEntryStatus = function() {
    const policy = window.normalizeScoreEntryPolicy(DB.schoolInfo && DB.schoolInfo.scoreEntryPolicy);
    const notice = policy.notice.trim();
    const noticeSuffix = notice ? ` • ${notice}` : '';

    if(policy.mode === 'closed') {
        return {
            allowed: false,
            severity: 'closed',
            title: 'ปิดการลงคะแนน',
            message: notice || 'ผู้ดูแลระบบปิดการลงคะแนนชั่วคราว'
        };
    }

    if(policy.mode === 'scheduled') {
        if(!policy.startDate || !policy.endDate) {
            return {
                allowed: false,
                severity: 'closed',
                title: 'ยังไม่ได้กำหนดช่วงวันลงคะแนนครบถ้วน',
                message: 'กรุณาแจ้งผู้ดูแลระบบให้กำหนดวันเริ่มต้นและวันสิ้นสุดก่อนลงคะแนน'
            };
        }

        const now = new Date();
        const start = new Date(`${policy.startDate}T00:00:00`);
        const end = new Date(`${policy.endDate}T23:59:59`);
        const rangeText = `${window.formatThaiDate(policy.startDate)} ถึง ${window.formatThaiDate(policy.endDate)}`;

        if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
            return {
                allowed: false,
                severity: 'closed',
                title: 'ช่วงวันลงคะแนนไม่ถูกต้อง',
                message: 'กรุณาแจ้งผู้ดูแลระบบให้ตรวจสอบวันที่เปิดและปิดการลงคะแนน'
            };
        }

        if(now < start) {
            return {
                allowed: false,
                severity: 'upcoming',
                title: 'ยังไม่ถึงเวลาเปิดลงคะแนน',
                message: `ระบบจะเปิดให้ลงคะแนนวันที่ ${rangeText}${noticeSuffix}`
            };
        }

        if(now > end) {
            return {
                allowed: false,
                severity: 'expired',
                title: 'หมดเวลาลงคะแนน',
                message: `ระบบปิดการลงคะแนนแล้ว ช่วงที่กำหนดคือ ${rangeText}${noticeSuffix}`
            };
        }

        return {
            allowed: true,
            severity: 'open',
            title: 'เปิดลงคะแนนอยู่',
            message: `สามารถลงคะแนนได้ถึงวันที่ ${window.formatThaiDate(policy.endDate)}${noticeSuffix}`
        };
    }

    return {
        allowed: true,
        severity: 'always',
        title: 'เปิดลงคะแนนตลอดเวลา',
        message: notice || 'ครูสามารถลงคะแนนได้ตามปกติ'
    };
}

window.renderScoreEntryStatusBanner = function(compact = false) {
    const status = window.getScoreEntryStatus();
    const palettes = {
        always: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800', sub: 'text-emerald-700', icon: 'ph-lock-key-open' },
        open: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800', sub: 'text-emerald-700', icon: 'ph-calendar-check' },
        upcoming: { wrap: 'border-amber-200 bg-amber-50 text-amber-800', sub: 'text-amber-700', icon: 'ph-calendar-plus' },
        expired: { wrap: 'border-rose-200 bg-rose-50 text-rose-800', sub: 'text-rose-700', icon: 'ph-calendar-x' },
        closed: { wrap: 'border-rose-200 bg-rose-50 text-rose-800', sub: 'text-rose-700', icon: 'ph-lock-key' }
    };
    const palette = palettes[status.severity] || palettes.always;
    const padding = compact ? 'p-4' : 'p-4 md:p-5';
    return `
        <div id="score-entry-status-banner" class="mb-4 ${padding} rounded-2xl border ${palette.wrap} font-bold flex items-start gap-3 shadow-sm">
            <i class="ph ${palette.icon} text-2xl mt-0.5 shrink-0"></i>
            <div class="min-w-0">
                <div>${window.escapeHtml(status.title)}</div>
                <div class="text-xs md:text-sm font-medium ${palette.sub} mt-0.5 leading-relaxed">${window.escapeHtml(status.message)}</div>
            </div>
        </div>
    `;
}
 
setInterval(() => {
    if(state.user && state.user.role === 'teacher') {
        window.persistTeacherActivity(state.user.id, true, false);
    } else if(state.user && state.user.role === 'admin') {
        window.persistAdminActivity(true);
    } else {
        window.updateActiveUsersUI();
    }
    if(state.activePage === 'teacher_scoring') {
        window.acquireScoreLock(true);
    } else {
        window.refreshScoreLockBanner();
    }
}, 60000);

window.showModal = function(html, widthClass = 'max-w-lg') {
    const mc = $('modal-content');
    mc.className = `bg-white rounded-[2rem] shadow-2xl p-8 w-full ${widthClass} max-h-[90vh] overflow-y-auto mx-4 transform transition-all duration-300 scale-95 opacity-0 custom-scrollbar`;
    mc.innerHTML = html;
    $('modal-container').classList.remove('hidden');
    requestAnimationFrame(() => {
        mc.classList.remove('scale-95', 'opacity-0');
        mc.classList.add('scale-100', 'opacity-100');
    });
}

window.hideModal = function() {
    const mc = $('modal-content');
    mc.classList.remove('scale-100', 'opacity-100');
    mc.classList.add('scale-95', 'opacity-0');
    setTimeout(() => $('modal-container').classList.add('hidden'), 300);
}

$('modal-container').addEventListener('click', (e) => {
    if(e.target === $('modal-container')) window.hideModal();
});

window.showCustomConfirm = function(title, message, type, confirmCallback, cancelCallback) {
    let iconHtml = '', confirmBtnClass = '', bgLight = '';
    if (type === 'danger') {
        bgLight = 'bg-rose-50';
        iconHtml = `<div class="w-20 h-20 bg-white text-rose-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 shadow-xl shadow-rose-200 border border-rose-100 transform -translate-y-4"><i class="ph ph-warning-octagon text-5xl"></i></div>`;
        confirmBtnClass = 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-lg shadow-rose-200';
    } else if (type === 'warning') {
        bgLight = 'bg-amber-50';
        iconHtml = `<div class="w-20 h-20 bg-white text-amber-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 shadow-xl shadow-amber-200 border border-amber-100 transform -translate-y-4"><i class="ph ph-warning text-5xl"></i></div>`;
        confirmBtnClass = 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-lg shadow-amber-200';
    } else {
        bgLight = 'bg-indigo-50';
        iconHtml = `<div class="w-20 h-20 bg-white text-indigo-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 shadow-xl shadow-indigo-200 border border-indigo-100 transform -translate-y-4"><i class="ph ph-question text-5xl"></i></div>`;
        confirmBtnClass = 'bg-primary-gradient text-white shadow-lg shadow-indigo-200';
    }

    window._currentConfirmCallback = confirmCallback;
    window._currentCancelCallback = cancelCallback;

    let html = `
        <div class="${bgLight} -mx-8 -mt-8 p-8 pb-10 rounded-t-[2rem] text-center border-b border-gray-100">
            ${iconHtml}
            <h3 class="text-2xl font-extrabold text-gray-800 mb-2">${title}</h3>
        </div>
        <div class="text-center p-6 pb-2">
            <p class="text-base text-gray-600 mb-8 whitespace-pre-line leading-relaxed font-medium">${message}</p>
            <div class="flex gap-4 justify-center">
                <button type="button" onclick="window.executeCustomCancel()" class="tactile-btn flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl border border-gray-200">ยกเลิก</button>
                <button type="button" onclick="window.executeCustomConfirm()" class="tactile-btn flex-1 ${confirmBtnClass} font-bold py-3.5 rounded-xl text-lg tracking-wide">ยืนยัน</button>
            </div>
        </div>
    `;
    window.showModal(html, 'max-w-md');
}

window.executeCustomConfirm = function() {
    window.hideModal();
    if(typeof window._currentConfirmCallback === 'function') window._currentConfirmCallback();
    window._currentConfirmCallback = null; window._currentCancelCallback = null;
}

window.executeCustomCancel = function() {
    window.hideModal();
    if(typeof window._currentCancelCallback === 'function') window._currentCancelCallback();
    window._currentConfirmCallback = null; window._currentCancelCallback = null;
}

let currentLoginTab = 'teacher';
window.switchLoginTab = function(tab) {
    currentLoginTab = tab;
    if(tab === 'teacher') {
        $('tab-teacher').className = "flex-1 py-2.5 rounded-xl bg-white shadow-sm text-indigo-600 font-bold text-sm transition-all duration-300";
        $('tab-admin').className = "flex-1 py-2.5 rounded-xl text-gray-500 font-bold text-sm transition-all duration-300 hover:text-gray-700";
        $('form-teacher-login').classList.remove('hidden'); $('form-admin-login').classList.add('hidden');
        window.populateTeacherLoginSelect();
    } else {
        $('tab-admin').className = "flex-1 py-2.5 rounded-xl bg-white shadow-sm text-indigo-600 font-bold text-sm transition-all duration-300";
        $('tab-teacher').className = "flex-1 py-2.5 rounded-xl text-gray-500 font-bold text-sm transition-all duration-300 hover:text-gray-700";
        $('form-admin-login').classList.remove('hidden'); $('form-teacher-login').classList.add('hidden');
    }
}

window.populateTeacherLoginSelect = function() {
    const sel = $('login-teacher-sel');
    const prevVal = sel.value; 
    // ก่อนล็อกอินจะอ่าน DB.teachers ไม่ได้แล้ว
    // จึงใช้รายชื่อสาธารณะที่มีแค่รหัสกับชื่อครู ไม่มีรหัสผ่าน
    const roster = (Array.isArray(window.PUBLIC_TEACHERS) && window.PUBLIC_TEACHERS.length)
        ? window.PUBLIC_TEACHERS
        : DB.teachers;
    sel.innerHTML = '<option value="">-- เลือกบัญชีของคุณ --</option>';
    roster.forEach(t => { sel.innerHTML += `<option value="${window.escapeHtml(t.id)}">${window.escapeHtml(t.name)}</option>`; });
    if(prevVal) sel.value = prevVal;

    if(DB.schoolInfo.logo) {
        $('login-logo-container').innerHTML = `<img src="${DB.schoolInfo.logo}" class="w-24 h-24 object-contain mb-2 rounded-2xl shadow-xl bg-white p-2">`;
    } else {
        $('login-logo-container').innerHTML = `<div class="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl transform hover:scale-105 transition-transform duration-300"><i class="ph ph-graduation-cap text-5xl"></i></div>`;
    }
}

// รหัสผ่านไม่ถูกเทียบในเบราว์เซอร์อีกต่อไป ส่งให้ Firebase Auth ตรวจแทน
// โค้ดหน้าเว็บจึงไม่มีรหัสผ่านของใครอยู่เลย
window.doLogin = async function(role) {
    const form = $(role === 'admin' ? 'form-admin-login' : 'form-teacher-login');
    const btn = form ? form.querySelector('button[type="submit"]') : null;
    const setBusy = (busy) => {
        if(!btn) return;
        btn.disabled = busy;
        btn.classList.toggle('opacity-60', busy);
        btn.classList.toggle('cursor-not-allowed', busy);
    };

    if(!window.anpAuth) return window.notify('ระบบยังเชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', true);

    try {
        setBusy(true);
        if(role === 'admin') {
            const pwd = $('login-admin-pwd').value;
            if(!pwd) return window.notify('กรุณากรอกรหัสผ่าน', true);
            await window.anpAuth.signInAdmin(pwd);
        } else {
            const id = $('login-teacher-sel').value;
            const pwd = $('login-teacher-pwd').value;
            if(!id) return window.notify('กรุณาเลือกบัญชีผู้ใช้', true);
            if(!pwd) return window.notify('กรุณากรอกรหัสผ่าน', true);
            await window.anpAuth.signInTeacher(id, pwd);
        }
        // ให้บันทึกประวัติการเข้าใช้งานเฉพาะการล็อกอินครั้งใหม่
        window.pendingLoginRecord = true;
        $('login-admin-pwd').value = '';
        $('login-teacher-pwd').value = '';
        // จากนี้ onSession ใน auth/session.js จะพาเข้าสู่ระบบให้เอง
    } catch(err) {
        window.notify(window.anpAuth.describeAuthError(err), true);
    } finally {
        setBusy(false);
    }
}

window.doLogout = function() {
    if(state.activePage === 'teacher_scoring') {
        window.releaseScoreLock();
        if(typeof window.unsubscribeActiveScoreSubject === 'function') window.unsubscribeActiveScoreSubject();
    }
    if(state.user && state.user.role === 'teacher') {
        window.persistTeacherActivity(state.user.id, false, false);
    } else if(state.user && state.user.role === 'admin') {
        window.persistAdminActivity(false);
    }
    state.user = null;
    state.subjId = ''; state.clsId = '';
    // ต้องออกจากระบบที่ Firebase ด้วย ไม่ใช่แค่ซ่อนหน้าจอ
    if(window.anpAuth) window.anpAuth.signOutNow().catch(() => {});
    $('app-container').classList.add('opacity-0');
    setTimeout(() => {
        $('app-container').classList.add('hidden');
        $('login-screen').classList.remove('hidden', 'scale-105');
        setTimeout(() => $('login-screen').classList.remove('opacity-0'), 50);
        $('login-admin-pwd').value = ''; $('login-teacher-pwd').value = '';
        window.switchLoginTab('teacher');
    }, 500);
}

window.changeGlobalTerm = function() {
    state.term = String($('global-term-select').value);
    // The school's current term is a school setting, owned by the admin. A teacher switching
    // term only changes what their own screen shows - saving it used to change the default
    // term for every teacher in the school the next time they opened the system.
    if(state.user && state.user.role === 'admin') {
        DB.schoolInfo.term = state.term;
        window.saveDB();
    }
    window.updateLogoAndHeader(); window.navigate(state.activePage);
    window.notify(`เปลี่ยนเป็นภาคเรียนที่ ${state.term} สำเร็จ`);
}

window.updateLogoAndHeader = function() {
    if(DB.schoolInfo.logo) {
        $('sidebar-logo').src = DB.schoolInfo.logo;
        $('sidebar-logo').classList.remove('hidden'); $('sidebar-logo-icon').classList.add('hidden');
    } else {
        $('sidebar-logo').classList.add('hidden'); $('sidebar-logo-icon').classList.remove('hidden');
    }
    
    $('header-term-display').innerHTML = `
        <span class="relative flex h-2.5 w-2.5 mr-1">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
        </span>กำลังใช้งาน: เทอม ${state.term}`;

    if(state.user) {
        if(state.user.role === 'admin') {
            $('user-avatar').innerHTML = '<i class="ph ph-shield-star"></i>';
            $('user-avatar').className = "w-11 h-11 rounded-xl bg-gradient-to-br from-gray-800 to-black text-white flex items-center justify-center text-xl mr-3 shadow-lg shadow-gray-300 shrink-0";
            $('user-name').innerText = 'ผู้ดูแลระบบสูงสุด'; $('user-role').innerText = 'Administrator';
        } else {
            const t = DB.teachers.find(x => x.id === state.user.id);
            if (t && t.picUrl) {
                $('user-avatar').innerHTML = `<img src="${window.formatImgUrl(t.picUrl)}" class="w-full h-full object-cover rounded-xl" onerror="this.onerror=null; this.outerHTML='<div class=\\'w-full h-full flex items-center justify-center text-xl font-bold bg-indigo-100 text-indigo-600\\'>${t.name.charAt(0)}</div>'">`;
                $('user-avatar').className = "w-11 h-11 rounded-xl mr-3 shadow-lg shadow-indigo-200 border border-slate-200 bg-white shrink-0 overflow-hidden";
            } else {
                $('user-avatar').innerHTML = t ? t.name.charAt(0) : 'T';
                $('user-avatar').className = "w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center text-xl font-bold mr-3 shadow-lg shadow-indigo-200 shrink-0";
            }
            $('user-name').innerText = t ? t.name : 'คุณครู'; $('user-role').innerText = 'Teacher';
        }
    }
    window.updateActiveUsersUI();
    if(window.updateThemeToggleUI) window.updateThemeToggleUI();
}

const menuItems = {
    admin: [
        { id: 'admin_dash', icon: 'ph-squares-four', label: 'แดชบอร์ดภาพรวม' },
        { id: 'admin_score_report', icon: 'ph-chart-polar', label: 'ตรวจสอบผลการเรียน' },
        { id: 'admin_scoring', icon: 'ph-pencil-line', label: 'ลงคะแนนทุกวิชา' },
        { id: 'guardian_reports', icon: 'ph-file-text', label: 'รายงานแจ้งผู้ปกครอง' },
        { id: 'admin_teachers', icon: 'ph-users-three', label: 'จัดการครูผู้สอน' },
        { id: 'admin_classes', icon: 'ph-student', label: 'จัดการห้องเรียน' },
        { id: 'admin_subjects', icon: 'ph-books', label: 'จัดการรายวิชา' },
        { id: 'admin_settings', icon: 'ph-sliders-horizontal', label: 'ตั้งค่าและสำรองข้อมูล' },
        { id: 'pp1_system', icon: 'ph-certificate', label: 'ระบบ ปพ.1 (งานทะเบียน)', href: 'pp1.html' },
        { id: 'schedule_system', icon: 'ph-calendar-check', label: 'ตารางสอนและครูสอนแทน', href: 'schedule.html' },
        { id: 'portal_hub', icon: 'ph-grid-four', label: 'ศูนย์รวมระบบโรงเรียน', href: 'portal.html' }
    ],
    teacher: [
        { id: 'teacher_dash', icon: 'ph-squares-four', label: 'ภาพรวมการสอน' },
        { id: 'teacher_classes', icon: 'ph-chalkboard-teacher', label: 'ห้องเรียนของฉัน' },
        { id: 'guardian_reports', icon: 'ph-file-text', label: 'รายงานแจ้งผู้ปกครอง' },
        { id: 'schedule_system', icon: 'ph-calendar-check', label: 'ตารางสอนและครูสอนแทน', href: 'schedule.html' },
        { id: 'portal_hub', icon: 'ph-grid-four', label: 'ศูนย์รวมระบบโรงเรียน', href: 'portal.html' },
        { id: 'teacher_profile', icon: 'ph-user-circle-gear', label: 'ตั้งค่าโปรไฟล์' }
    ]
};

window.buildSidebar = function() {
    const nav = $('nav-menu'); nav.innerHTML = '';
    menuItems[state.user.role].forEach(item => {
        const btn = document.createElement('button');
        btn.className = `w-full flex items-center px-4 py-3.5 mb-1.5 rounded-xl text-left font-semibold transition-all duration-300 group text-slate-500 hover:bg-white hover:text-indigo-600 hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:translate-x-1 border border-transparent hover:border-slate-100`;
        btn.innerHTML = `<i class="ph ${item.icon} text-[22px] mr-3 group-hover:scale-110 transition-transform duration-300"></i> <span class="tracking-wide">${item.label}</span>`;
        btn.id = `nav-btn-${item.id}`;
        // เมนูที่มี href จะเปิดเป็นหน้าเว็บแยก (ระบบ ปพ.1) ไม่ผ่าน router ภายใน
        btn.onclick = item.href ? (() => { window.location.href = item.href; }) : (() => window.navigate(item.id));
        nav.appendChild(btn);
    });
}

window.navigate = function(pageId) {
    // ป้องกันครูเข้าถึงหน้าของผู้ดูแลระบบ (แอดมิน)
    if(pageId && pageId.startsWith('admin_') && (!state.user || state.user.role !== 'admin')) {
        if(window.notify) window.notify('เฉพาะผู้ดูแลระบบ (แอดมิน) เท่านั้นที่มีสิทธิ์เข้าถึงหน้านี้', true);
        window.navigate('teacher_dash');
        return;
    }

    if(state.activePage === 'teacher_scoring' && pageId !== 'teacher_scoring') {
        window.releaseScoreLock();
        if(typeof window.unsubscribeActiveScoreSubject === 'function') window.unsubscribeActiveScoreSubject();
    }
    state.activePage = pageId;
    if (pageId !== 'teacher_scoring') {
        state.subjId = ''; state.clsId = '';
    }
    document.querySelectorAll('#nav-menu button').forEach(btn => {
        btn.className = `w-full flex items-center px-4 py-3.5 mb-1.5 rounded-xl text-left font-semibold transition-all duration-300 group text-slate-500 hover:bg-white hover:text-indigo-600 hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:translate-x-1 border border-transparent hover:border-slate-100`;
    });
    const activeBtn = $(`nav-btn-${pageId}`);
    if(activeBtn) {
        activeBtn.className = `w-full flex items-center px-4 py-3.5 mb-1.5 rounded-xl text-left font-bold transition-all duration-300 group text-white bg-primary-gradient shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-200 border border-transparent`;
    }

    const content = $('content-area');
    content.innerHTML = `<div id="content-wrapper" class="animate-fade-in-up w-full h-full"></div>`;
    const wrapper = $('content-wrapper');

    switch(pageId) {
        case 'admin_dash': window.renderAdminDash(wrapper); break;
        case 'admin_score_report': window.renderAdminScoreReport(wrapper); break;
        case 'admin_scoring': window.renderAdminScoringHub(wrapper); break;
        case 'guardian_reports': window.renderGuardianReports(wrapper); break;
        case 'admin_teachers': window.renderAdminTeachers(wrapper); break;
        case 'admin_classes': window.renderAdminClasses(wrapper); break;
        case 'admin_subjects': window.renderAdminSubjects(wrapper); break;
        case 'admin_settings': window.renderAdminSettings(wrapper); break;
        
        case 'teacher_dash': window.renderTeacherDash(wrapper); break;
        case 'teacher_classes': window.renderTeacherClasses(wrapper); break;
        case 'teacher_scoring': window.renderTeacherScoring(wrapper); break;
        case 'teacher_profile': window.renderTeacherProfile(wrapper); break;
    }
}
