/* ANPSCORE — สถานะคลาวด์ โควตา ผู้ใช้ออนไลน์ และการจองสิทธิ์แก้คะแนน
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

window.setCloudSyncState = function(nextState = {}) {
    cloudSyncState = Object.assign(cloudSyncState, nextState);
    window.cloudSyncState = cloudSyncState;
    if(typeof window.updateActiveUsersUI === 'function') window.updateActiveUsersUI();
}

window.isCloudQuotaError = function(err) {
    const code = String((err && err.code) || '').toLowerCase();
    const message = String((err && err.message) || err || '').toLowerCase();
    return code.includes('resource-exhausted') || message.includes('resource-exhausted') || message.includes('quota exceeded') || message.includes('quota backoff') || message.includes('429');
}

window.activateCloudQuotaBackoff = function(err, durationMs = 5 * 60 * 1000) {
    cloudQuotaBackoffUntil = Math.max(cloudQuotaBackoffUntil || 0, Date.now() + durationMs);
    const message = 'Firestore quota exceeded - local save active, cloud sync paused briefly';
    window.setCloudSyncState({ mode: 'local', connected: false, lastError: message });
    if(Date.now() - lastCloudQuotaNoticeAt > 60000) {
        lastCloudQuotaNoticeAt = Date.now();
        console.warn(message, err);
        if(typeof window.notify === 'function') window.notify('คลาวด์ใช้งานเกินโควตาชั่วคราว: บันทึกในเครื่องแล้ว จะซิงก์ใหม่ภายหลัง', true);
    }
    if(cloudQuotaResumeTimer) clearTimeout(cloudQuotaResumeTimer);
    cloudQuotaResumeTimer = setTimeout(() => {
        cloudQuotaResumeTimer = null;
        if(state.activePage === 'teacher_scoring' && typeof window.subscribeActiveScoreSubject === 'function') {
            window.subscribeActiveScoreSubject(state.subjId, state.clsId, state.term);
        }
        if(typeof window.retryPendingScoreAutoSaves === 'function') window.retryPendingScoreAutoSaves(800);
        if(typeof window.requestDirtyCloudFlush === 'function') window.requestDirtyCloudFlush(1200);
    }, Math.min(Math.max(window.getCloudQuotaBackoffRemaining(), 30000), 5 * 60 * 1000) + 1000);
}

window.getCloudQuotaBackoffRemaining = function() {
    return Math.max(0, Number(cloudQuotaBackoffUntil || 0) - Date.now());
}

window.isCloudQuotaBackoffActive = function() {
    return window.getCloudQuotaBackoffRemaining() > 0;
}

window.getPresenceDisplayName = function(user) {
    if(!user) return 'ไม่ทราบชื่อ';
    if(user.displayName) return user.displayName;
    if(user.role === 'admin') return 'ผู้ดูแลระบบ';
    const teacherId = user.teacherId || user.actorId || user.id;
    const t = DB.teachers.find(x => x.id === teacherId);
    return t ? t.name : 'ครูผู้สอน';
}

window.getActiveUsers = function() {
    const now = Date.now();
    const usersById = {};

    Object.entries(window.presenceUsers || {}).forEach(([id, user]) => {
        const lastActive = Number(user.lastActive || 0);
        if(!user.online || !lastActive || now - lastActive > ACTIVE_USER_WINDOW_MS) return;
        usersById[id] = {
            actorId: id,
            role: user.role || (id === 'admin' ? 'admin' : 'teacher'),
            displayName: window.getPresenceDisplayName(user),
            lastActive
        };
    });

    (DB.teachers || []).forEach(t => {
        const lastActive = Number(t.lastActive || 0);
        if(lastActive && now - lastActive <= ACTIVE_USER_WINDOW_MS && !usersById[t.id]) {
            usersById[t.id] = {
                actorId: t.id,
                role: 'teacher',
                displayName: t.name,
                lastActive
            };
        }
    });

    if(state.user && state.user.role === 'admin' && !usersById.admin) {
        usersById.admin = {
            actorId: 'admin',
            role: 'admin',
            displayName: 'ผู้ดูแลระบบ',
            lastActive: now
        };
    }

    return Object.values(usersById).sort((a, b) => {
        if(a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        return b.lastActive - a.lastActive;
    });
}

window.formatActiveAgo = function(ts) {
    const diff = Math.max(0, Date.now() - Number(ts || 0));
    if(diff < 60000) return 'เมื่อสักครู่';
    const mins = Math.floor(diff / 60000);
    return `${mins} นาทีที่แล้ว`;
}

window.renderActiveUsersPanel = function(compact = false) {
    const users = window.getActiveUsers();
    const count = users.length;
    const currentActor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { actorId: '' };
    const cloudOk = window.cloudSyncState && window.cloudSyncState.connected;
    const statusText = cloudOk ? 'ซิงก์คลาวด์พร้อมใช้งาน' : 'กำลังใช้ข้อมูลในเครื่อง/รอคลาวด์';
    const statusClass = cloudOk ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100';
    const maxRows = compact ? 5 : 12;
    const rows = users.slice(0, maxRows).map(user => {
        const isSelf = user.actorId === currentActor.actorId;
        const isAdmin = user.role === 'admin';
        const roleText = isAdmin ? 'แอดมิน' : 'ครูผู้สอน';
        const roleClass = isAdmin ? 'bg-slate-900 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-100';
        
        // รูปโปรไฟล์ครู ถ้ามี ให้แสดงรูปเพื่อความจำง่าย
        const t = (window.DB && Array.isArray(window.DB.teachers)) ? window.DB.teachers.find(x => x.id === user.actorId) : null;
        let avatarInnerHtml = '';
        if(isAdmin) {
            avatarInnerHtml = `<i class="ph ph-shield-star text-2xl text-amber-500"></i>`;
        } else if(t && t.picUrl) {
            avatarInnerHtml = `<img src="${window.formatImgUrl(t.picUrl)}" class="w-full h-full object-cover rounded-xl" onerror="this.onerror=null; this.outerHTML='<span class=\\'font-black text-indigo-600 text-sm\\'>${window.escapeHtml(user.displayName.charAt(0))}</span>'">`;
        } else {
            avatarInnerHtml = `<span class="font-black text-emerald-700 text-sm">${window.escapeHtml(user.displayName.charAt(0))}</span>`;
        }

        const chatActionHtml = isSelf
            ? `<span class="text-xs px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 font-bold shrink-0">คุณ</span>`
            : `<button onclick="event.stopPropagation(); window.openChatWith('${user.actorId}', '${window.escapeHtml(user.displayName)}', '${user.role}'); if(typeof window.hideModal === 'function') window.hideModal();" class="tactile-btn flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 active:scale-95 transition-all shrink-0" title="เริ่มสนทนาหรือส่งข้อความสอบถาม">
                <i class="ph ph-chat-circle-dots text-base"></i>
                <span>ทักแชท</span>
               </button>`;
        return `
            <div class="flex items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all hover:shadow-md">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="relative w-11 h-11 rounded-xl ${isAdmin ? 'bg-slate-900 text-white' : 'bg-emerald-50'} flex items-center justify-center shrink-0 border border-slate-200/60 shadow-inner overflow-hidden">
                        <span class="absolute -right-0.5 -top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm z-10"></span>
                        ${avatarInnerHtml}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <span class="font-extrabold text-slate-800 text-sm md:text-base leading-snug truncate" title="${window.escapeHtml(user.displayName)}">${window.escapeHtml(user.displayName)}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded-md font-bold ${roleClass} shrink-0">${roleText}</span>
                        </div>
                        <div class="text-xs text-slate-400 font-medium whitespace-nowrap mt-0.5 flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span>${window.formatActiveAgo(user.lastActive)}</span>
                        </div>
                    </div>
                </div>
                <div class="shrink-0 flex items-center pl-1">
                    ${chatActionHtml}
                </div>
            </div>`;
    }).join('');

    return `
        <div class="modern-card p-5 border-l-8 border-emerald-400 bg-white">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                        <i class="ph ph-broadcast text-2xl"></i>
                    </div>
                    <div>
                        <div class="text-xs uppercase tracking-wider text-slate-400 font-black">Online Monitor</div>
                        <h3 class="text-xl font-extrabold text-slate-800">กำลังใช้งาน ${count} คน</h3>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="window.openChatRoom('all');" class="tactile-btn flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl border border-indigo-100 text-xs font-bold transition-all shadow-sm">
                        <i class="ph ph-chat-teardrop-dots text-base"></i>
                        <span>ห้องแชทรวม</span>
                    </button>
                    <div class="text-xs px-3 py-2 rounded-xl border font-bold ${statusClass}">${statusText}</div>
                </div>
            </div>
            <div class="grid grid-cols-1 ${compact ? 'md:grid-cols-1' : 'sm:grid-cols-2 2xl:grid-cols-3'} gap-3">
                ${rows || '<div class="col-span-full text-center text-slate-400 font-medium p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">ยังไม่มีผู้ใช้งานออนไลน์ในช่วง 3 นาทีล่าสุด</div>'}
            </div>
            ${users.length > maxRows ? `<div class="mt-3 text-xs text-slate-500 font-bold text-right">และอีก ${users.length - maxRows} คน</div>` : ''}
        </div>
    `;
}

window.showActiveUsersModal = function() {
    window.showModal(`
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
            <div>
                <h3 class="text-2xl font-extrabold text-slate-800">ผู้ที่กำลังล็อกอินอยู่</h3>
                <p class="text-sm text-slate-500 font-medium mt-1">นับจากผู้ใช้ที่ยังส่งสถานะภายใน 3 นาทีล่าสุด (สามารถคลิก "ทักแชท" เพื่อสอบถามได้ทันที)</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="window.openChatRoom('all'); window.hideModal();" class="tactile-btn flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-all shrink-0">
                    <i class="ph ph-chat-teardrop-dots text-base"></i>
                    <span>ห้องแชทรวมโรงเรียน</span>
                </button>
                <button onclick="window.hideModal()" class="text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full w-10 h-10 flex items-center justify-center transition-colors shrink-0"><i class="ph ph-x text-lg"></i></button>
            </div>
        </div>
        ${window.renderActiveUsersPanel(false)}
    `, 'max-w-4xl');
}

window.updateActiveUsersUI = function() {
    const el = $('active-users-pill');
    if(!el) return;
    const users = window.getActiveUsers();
    const count = users.length;
    const names = users.slice(0, 3).map(u => u.displayName).join(', ');
    const cloudOk = window.cloudSyncState && window.cloudSyncState.connected;
    const baseClass = `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border shadow-sm backdrop-blur-md transition-colors ${cloudOk ? 'bg-emerald-50/80 text-emerald-700 border-emerald-100/70' : 'bg-amber-50/80 text-amber-700 border-amber-100/70'}`;
    if(el.className !== baseClass) el.className = baseClass;
    const newHtml = `
        <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${cloudOk ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 ${cloudOk ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
        </span>
        <span>ออนไลน์ ${count} คน</span>
        ${names ? `<span class="hidden xl:inline text-xs opacity-75 max-w-[16rem] truncate">(${names})</span>` : ''}
    `;
    if(el.dataset.cacheHtml !== newHtml) {
        el.dataset.cacheHtml = newHtml;
        el.innerHTML = newHtml;
    }
}

window.getCurrentActorInfo = function() {
    if(!state.user) return { actorId: browserSessionId, role: 'guest', displayName: 'ผู้ใช้งาน' };
    if(state.user.role === 'admin') return { actorId: 'admin', role: 'admin', displayName: 'ผู้ดูแลระบบ' };
    const t = DB.teachers.find(x => x.id === state.user.id);
    return { actorId: state.user.id, role: 'teacher', displayName: t ? t.name : 'ครูผู้สอน' };
}

window.getScoreLockKey = function(subId = state.subjId, clsId = state.clsId, term = state.term) {
    if(!subId || !clsId || !term) return '';
    return [subId, clsId, term].map(x => encodeURIComponent(String(x))).join('__');
}

window.isScoreLockActive = function(lock) {
    if(!lock || lock.active === false) return false;
    const lastActive = Number(lock.lastActive || 0);
    return !!lastActive && (Date.now() - lastActive <= SCORE_LOCK_TIMEOUT_MS);
}

window.getCurrentScoreLock = function() {
    const key = window.getScoreLockKey();
    return key ? window.scoreLocks[key] : null;
}

window.isCurrentScoreLockMine = function() {
    const lock = window.getCurrentScoreLock();
    return !!(lock && window.isScoreLockActive(lock) && lock.sessionId === browserSessionId);
}

window.canEditCurrentScorebook = function() {
    if(state.activePage !== 'teacher_scoring') return true;
    const scoreEntryStatus = window.getScoreEntryStatus ? window.getScoreEntryStatus() : { allowed: true };
    if(!scoreEntryStatus.allowed) return false;
    if(scoreLockStatus.pending && scoreLockStatus.key === window.getScoreLockKey()) return false;
    const lock = window.getCurrentScoreLock();
    return !window.isScoreLockActive(lock) || lock.sessionId === browserSessionId;
}

window.getScoreLockOwnerText = function(lock = window.getCurrentScoreLock()) {
    if(!lock) return '';
    return lock.displayName || (lock.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน');
}

window.renderScoreLockBannerHtml = function() {
    const key = window.getScoreLockKey();
    const lock = window.getCurrentScoreLock();
    const pending = scoreLockStatus.pending && scoreLockStatus.key === key;
    const scoreEntryStatus = window.getScoreEntryStatus ? window.getScoreEntryStatus() : { allowed: true };
    if(!scoreEntryStatus.allowed) {
        return `<div id="score-lock-banner" class="mb-4 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 font-bold flex items-center gap-3 shadow-sm"><i class="ph ph-lock-key text-2xl"></i><div><div>ระบบปิดช่องกรอกคะแนนไว้</div><div class="text-xs font-medium text-rose-700 mt-0.5">${window.escapeHtml(scoreEntryStatus.message)}</div></div></div>`;
    }
    const canEdit = window.canEditCurrentScorebook();
    if(pending) {
        return `<div id="score-lock-banner" class="mb-4 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 font-bold flex items-center gap-3 shadow-sm"><i class="ph ph-lock-key-open text-2xl"></i><div><div>กำลังตรวจสอบสิทธิ์แก้ไขสมุดคะแนน...</div><div class="text-xs font-medium text-amber-700 mt-0.5">ระบบกำลังกันไม่ให้มีการบันทึกทับกันในวิชา/ห้อง/เทอมเดียวกัน</div></div></div>`;
    }
    if(canEdit) {
        const actor = window.getCurrentActorInfo();
        return `<div id="score-lock-banner" class="mb-4 p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold flex items-center gap-3 shadow-sm"><i class="ph ph-shield-check text-2xl"></i><div><div>คุณกำลังแก้ไขสมุดคะแนนนี้อยู่</div><div class="text-xs font-medium text-emerald-700 mt-0.5">ล็อกโดย ${actor.displayName} เพื่อป้องกันข้อมูลถูกบันทึกทับกัน</div></div></div>`;
    }
    const owner = window.getScoreLockOwnerText(lock);
    return `<div id="score-lock-banner" class="mb-4 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 font-bold flex items-center gap-3 shadow-sm"><i class="ph ph-lock-key text-2xl"></i><div><div>${owner} กำลังแก้ไขสมุดคะแนนนี้อยู่</div><div class="text-xs font-medium text-rose-700 mt-0.5">ระบบปิดช่องกรอกไว้ชั่วคราวเพื่อป้องกันข้อมูลทับกัน กรุณารอหรือกลับมาใหม่ภายหลัง</div></div></div>`;
}

window.refreshScoreLockBanner = function() {
    const statusEl = $('score-entry-status-banner');
    if(statusEl) statusEl.outerHTML = window.renderScoreEntryStatusBanner(state.activePage !== 'teacher_scoring');
    const el = $('score-lock-banner');
    if(el) el.outerHTML = window.renderScoreLockBannerHtml();
    const canEdit = window.canEditCurrentScorebook();
    const scoreEntryStatus = window.getScoreEntryStatus ? window.getScoreEntryStatus() : { allowed: true, message: '' };
    const disabledTitle = !scoreEntryStatus.allowed ? scoreEntryStatus.message : 'มีผู้ใช้อื่นกำลังแก้ไขสมุดคะแนนนี้อยู่';
    document.querySelectorAll('#score-table-container input').forEach(input => {
        input.disabled = !canEdit;
        input.classList.toggle('opacity-50', !canEdit);
        input.classList.toggle('cursor-not-allowed', !canEdit);
        input.title = canEdit ? '' : disabledTitle;
    });
    document.querySelectorAll('[data-score-write-action]').forEach(btn => {
        btn.classList.toggle('opacity-50', !canEdit);
        btn.classList.toggle('cursor-not-allowed', !canEdit);
        if(btn.tagName === 'BUTTON') btn.disabled = !canEdit;
        btn.querySelectorAll('input[type="file"]').forEach(input => { input.disabled = !canEdit; });
    });
}

window.ensureCanEditScorebook = function() {
    if(window.canEditCurrentScorebook()) return true;
    const scoreEntryStatus = window.getScoreEntryStatus ? window.getScoreEntryStatus() : { allowed: true };
    if(!scoreEntryStatus.allowed) {
        window.notify(scoreEntryStatus.message, true);
        window.refreshScoreLockBanner();
        return false;
    }
    const lock = window.getCurrentScoreLock();
    const owner = window.getScoreLockOwnerText(lock);
    const msg = scoreLockStatus.pending ? 'ระบบกำลังตรวจสอบสิทธิ์แก้ไข กรุณารอสักครู่' : `${owner} กำลังแก้ไขสมุดคะแนนนี้อยู่`;
    window.notify(msg, true);
    window.refreshScoreLockBanner();
    return false;
}

window.acquireScoreLock = function(silent = false) {
    const key = window.getScoreLockKey();
    if(!key) return false;
    const scoreEntryStatus = window.getScoreEntryStatus ? window.getScoreEntryStatus() : { allowed: true };
    if(state.activePage === 'teacher_scoring' && !scoreEntryStatus.allowed) {
        scoreLockStatus = { key, pending: false };
        window.refreshScoreLockBanner();
        return false;
    }
    const existing = window.scoreLocks[key];
    if(window.isScoreLockActive(existing) && existing.sessionId !== browserSessionId) {
        if(!silent) window.notify(`${window.getScoreLockOwnerText(existing)} กำลังแก้ไขสมุดคะแนนนี้อยู่`, true);
        scoreLockStatus = { key, pending: false };
        window.refreshScoreLockBanner();
        return false;
    }

    const actor = window.getCurrentActorInfo();
    const payload = {
        key,
        subId: state.subjId,
        clsId: state.clsId,
        term: state.term,
        actorId: actor.actorId,
        role: actor.role,
        displayName: actor.displayName,
        sessionId: browserSessionId,
        active: true,
        lastActive: Date.now()
    };
    if(window.isScoreLockActive(existing) && existing.sessionId === browserSessionId) {
        scoreLockStatus = { key, pending: false };
        window.scoreLocks[key] = payload;
        if(typeof window.firebaseUpdateScoreLock === 'function') window.firebaseUpdateScoreLock(key, payload);
        window.refreshScoreLockBanner();
        return true;
    }
    const hasCloudLock = typeof window.firebaseAcquireScoreLock === 'function' && !(window.isCloudQuotaBackoffActive && window.isCloudQuotaBackoffActive());
    scoreLockStatus = { key, pending: hasCloudLock };
    window.scoreLocks[key] = payload;
    window.refreshScoreLockBanner();

    if(hasCloudLock) {
        window.firebaseAcquireScoreLock(key, payload).then(result => {
            if(result && result.ok) {
                window.scoreLocks[key] = result.lock || payload;
                scoreLockStatus = { key, pending: false };
            } else if(result && result.lock) {
                window.scoreLocks[key] = result.lock;
                scoreLockStatus = { key, pending: false };
                if(!silent) window.notify(`${window.getScoreLockOwnerText(result.lock)} กำลังแก้ไขสมุดคะแนนนี้อยู่`, true);
            }
            window.refreshScoreLockBanner();
        }).catch(err => {
            console.error(err);
            scoreLockStatus = { key, pending: false };
            window.refreshScoreLockBanner();
        });
    } else if(typeof window.firebaseUpdateScoreLock === 'function') {
        window.firebaseUpdateScoreLock(key, payload);
    }
    return !hasCloudLock;
}

window.releaseScoreLock = function() {
    const key = scoreLockStatus.key || window.getScoreLockKey();
    const lock = key ? window.scoreLocks[key] : null;
    if(!key || !lock || lock.sessionId !== browserSessionId) return;
    const released = Object.assign({}, lock, { active: false, lastActive: Date.now() });
    window.scoreLocks[key] = released;
    scoreLockStatus = { key: '', pending: false };
    if(typeof window.firebaseReleaseScoreLock === 'function') window.firebaseReleaseScoreLock(key, released);
    window.refreshScoreLockBanner();
}

window.persistTeacherActivity = function(teacherId, isActive = true, recordLogin = false) {
    const t = DB.teachers.find(x => x.id === teacherId);
    const now = Date.now();
    if(t) {
        if(recordLogin) {
            if(!t.loginHistory) t.loginHistory = [];
            t.loginHistory.unshift({ time: now });
            if(t.loginHistory.length > 50) t.loginHistory.pop();
        }
        t.lastActive = isActive ? now : 0;
        window.saveLocalDB();
    }

    window.presenceUsers[teacherId] = {
        actorId: teacherId,
        teacherId,
        role: 'teacher',
        displayName: t ? t.name : 'ครูผู้สอน',
        online: !!isActive,
        lastActive: isActive ? now : 0
    };
    window.updateActiveUsersUI();

    if(typeof window.firebaseUpdatePresence === 'function') {
        window.firebaseUpdatePresence(teacherId, isActive, recordLogin, { role: 'teacher', displayName: t ? t.name : 'ครูผู้สอน' });
    } else if(t) {
        window.saveDB();
    }
}

window.persistAdminActivity = function(isActive = true) {
    const now = Date.now();
    window.presenceUsers.admin = {
        actorId: 'admin',
        role: 'admin',
        displayName: 'ผู้ดูแลระบบ',
        online: !!isActive,
        lastActive: isActive ? now : 0
    };
    window.updateActiveUsersUI();
    if(typeof window.firebaseUpdatePresence === 'function') {
        window.firebaseUpdatePresence('admin', isActive, false, { role: 'admin', displayName: 'ผู้ดูแลระบบ' });
    }
}

window.forceSyncToCloud = function() {
    window.showCustomConfirm(
        'บังคับซิงค์ข้อมูลขึ้นคลาวด์',
        'คำเตือน: การกระทำนี้จะนำข้อมูลในเครื่องปัจจุบันของคุณ ไปเขียนทับข้อมูลบนระบบคลาวด์ (Firebase) ทันที!\n\nยืนยันหรือไม่?',
        'warning',
        () => {
            let localDbStr = localStorage.getItem('anpscore_db');
            let localSubjStr = localStorage.getItem('anpscore_subjectData');
            if(localDbStr) { try { DB = JSON.parse(localDbStr); } catch(e){} }
            if(localSubjStr) { try { DB_SubjectData = JSON.parse(localSubjStr); } catch(e){} }

            if(typeof window.firebaseSaveFn === 'function') {
                // This device's copy is meant to win here, so write every document whole
                if(typeof window.requestFullCloudSync === 'function') window.requestFullCloudSync();
                if (!window.dirtySubjects) window.dirtySubjects = new Set();
                Object.keys(DB_SubjectData).forEach(id => {
                    window.markSubjectDirty(id);
                    if(window.markAllScoreClassesDirty) window.markAllScoreClassesDirty(id);
                });
                window.firebaseSaveFn();
                window.notify('กำลังอัปโหลดข้อมูลจากเครื่องขึ้นคลาวด์...');
            } else {
                window.notify('ระบบคลาวด์ยังไม่พร้อมทำงาน หรือการตั้งค่า Firebase ผิดพลาด', true);
            }
        }
    );
}
