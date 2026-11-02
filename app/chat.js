/* ANPSCORE — ระบบสนทนาและสอบถามแบบเรียลไทม์ (Real-time Messaging & Inquiry)
   เชื่อมต่อกับ Firestore ใน anpscore/data/messages เพื่อให้ครูและแอดมินสามารถ
   ทักแชทสอบถามกันได้แบบเรียลไทม์ ทั้งแบบตัวต่อตัวและห้องรวมโรงเรียน */

(function() {
    'use strict';

    // สถานะระบบแชท
    const chatState = {
        isOpen: false,
        isMinimized: false,
        viewMode: 'directory', // 'directory' หรือ 'conversation'
        directoryTab: 'direct', // 'direct' (แชทส่วนตัว), 'public' (ห้องรวม), 'admin_all' (แชททั้งหมดในระบบ)
        activeChannel: 'all',  // 'all' หรือ peer actorId (เช่น 'T01', 'admin')
        activePeer: null,      // { actorId, displayName, role }
        soundEnabled: localStorage.getItem('anpscore_chat_sound') !== 'false',
        searchQuery: '',
        messages: [],
        unreadCounts: {},      // channelKey -> count
        totalUnread: 0,
        lastReadTimestamps: {} // channelKey -> timestamp
    };

    window.switchChatTab = function(tabName) {
        chatState.directoryTab = tabName || 'direct';
        renderChatDirectory();
    };

    window.switchChatTabAndGo = function(tabName) {
        chatState.directoryTab = tabName || 'direct';
        window.backToChatDirectory();
    };

    let sessionStartTime = Date.now();
    let toastTimeout = null;
    const sentMsgReadState = new Map(); // msg.id -> boolean (was read previously)
    let isInitialMessagesLoad = true;
    let currentTrackingActorId = null;
    const markingReadIdsInProgress = new Set();

    // โหลดประวัติเวลาที่อ่านล่าสุดจาก localStorage
    function loadLastReadTimestamps() {
        try {
            const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : null;
            const actorId = actor ? actor.actorId : 'guest';
            const raw = localStorage.getItem(`anpscore_chat_last_read_${actorId}`);
            if(raw) chatState.lastReadTimestamps = JSON.parse(raw);
            else chatState.lastReadTimestamps = {};
        } catch(e) {
            chatState.lastReadTimestamps = {};
        }
    }

    function saveLastReadTimestamp(channelKey, timestamp = Date.now()) {
        try {
            const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : null;
            const actorId = actor ? actor.actorId : 'guest';
            chatState.lastReadTimestamps[channelKey] = timestamp;
            localStorage.setItem(`anpscore_chat_last_read_${actorId}`, JSON.stringify(chatState.lastReadTimestamps));
        } catch(e) {}
    }

    // ทำเครื่องหมายว่าเปิดอ่านข้อความในห้องปัจจุบันแล้ว
    function markCurrentChannelAsRead() {
        if(!chatState.isOpen || chatState.isMinimized || chatState.viewMode !== 'conversation') return;
        const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : null;
        if(!actor || !actor.actorId) return;
        const myId = actor.actorId;
        const activeChannel = chatState.activeChannel;
        if(!activeChannel) return;

        const unreadMsgIds = [];
        chatState.messages.forEach(msg => {
            if(!msg || !msg.id || msg.senderId === myId) return;
            if(markingReadIdsInProgress.has(msg.id)) return;

            if(activeChannel === 'all') {
                if(msg.recipientId === 'all') {
                    const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
                    if(!readBy.includes(myId)) {
                        unreadMsgIds.push(msg.id);
                    }
                }
            } else {
                // ตัวต่อตัว: ข้อความที่ส่งมาจากคู่สนทนาคนนี้มาหาเรา
                if(msg.senderId === activeChannel && (msg.recipientId === myId || msg.recipientId === 'all')) {
                    if(!msg.read) {
                        unreadMsgIds.push(msg.id);
                    }
                }
            }
        });

        if(unreadMsgIds.length > 0 && typeof window.firebaseMarkMessagesAsRead === 'function') {
            unreadMsgIds.forEach(id => markingReadIdsInProgress.add(id));
            window.firebaseMarkMessagesAsRead(unreadMsgIds, myId).catch(err => {
                console.warn('Failed to mark messages as read:', err);
            }).finally(() => {
                setTimeout(() => {
                    unreadMsgIds.forEach(id => markingReadIdsInProgress.delete(id));
                }, 3000);
            });
        }
    }

    // เสียงแจ้งเตือนผ่าน Web Audio API
    function playChatChime() {
        if(!chatState.soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if(!AudioContext) return;
            const ctx = new AudioContext();
            if(ctx.state === 'suspended') ctx.resume();
            const t = ctx.currentTime;
            
            // โน้ตที่ 1: D5 (587.33 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, t);
            gain1.gain.setValueAtTime(0.12, t);
            gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(t);
            osc1.stop(t + 0.16);

            // โน้ตที่ 2: A5 (880 Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, t + 0.08);
            gain2.gain.setValueAtTime(0.18, t + 0.08);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(t + 0.08);
            osc2.stop(t + 0.38);
        } catch(e) {}
    }

    // เสียงแจ้งเตือนเมื่อมีคนเปิดอ่านข้อความที่เราส่งไป (Read Receipt Sound)
    function playMessageReadChime() {
        if(!chatState.soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if(!AudioContext) return;
            const ctx = new AudioContext();
            if(ctx.state === 'suspended') ctx.resume();
            const t = ctx.currentTime;
            
            // โน้ตที่ 1: C6 (1046.5 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1046.5, t);
            gain1.gain.setValueAtTime(0.07, t);
            gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(t);
            osc1.stop(t + 0.05);

            // โน้ตที่ 2: E6 (1318.5 Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1318.5, t + 0.04);
            gain2.gain.setValueAtTime(0.1, t + 0.04);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(t + 0.04);
            osc2.stop(t + 0.22);
        } catch(e) {}
    }

    // สลับเปิด/ปิดเสียง
    window.toggleChatSound = function() {
        chatState.soundEnabled = !chatState.soundEnabled;
        localStorage.setItem('anpscore_chat_sound', chatState.soundEnabled ? 'true' : 'false');
        if(chatState.soundEnabled) playChatChime();
        renderChatHeaderControls();
        if(window.notify) window.notify(chatState.soundEnabled ? 'เปิดเสียงแจ้งเตือนข้อความแล้ว' : 'ปิดเสียงแจ้งเตือนข้อความแล้ว');
    };

    window.testPlayMessageReadChime = playMessageReadChime;
    window.testPlayChatChime = playChatChime;

    // คำนวณ channelKey สำหรับการสนทนา
    function getChannelKey(peerId) {
        if(!peerId || peerId === 'all') return 'all';
        const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { actorId: '' };
        return [actor.actorId, peerId].sort().join('__');
    }

    // จัดกลุ่มและคำนวณข้อความที่ยังไม่ได้อ่าน
    function recalculateUnread() {
        loadLastReadTimestamps();
        const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { actorId: '' };
        const myId = actor.actorId;
        const unreadCounts = { all: 0 };
        let total = 0;

        chatState.messages.forEach(msg => {
            // ไม่นับข้อความที่ตัวเองส่ง
            if(msg.senderId === myId) return;

            // ตรวจว่าข้อความนี้ส่งถึงใคร
            let channelKey = '';
            let isRelevant = false;

            if(msg.recipientId === 'all') {
                channelKey = 'all';
                isRelevant = true;
            } else if(msg.recipientId === myId) {
                // ส่งมาหาเราโดยตรง
                channelKey = msg.senderId;
                isRelevant = true;
            }

            if(!isRelevant) return;

            const lastRead = Number(chatState.lastReadTimestamps[channelKey] || 0);
            const msgTime = Number(msg.clientTimestamp || 0);

            // ถ้ากำลังเปิดแชทห้องนี้อยู่ ไม่นับเป็น unread
            const isCurrentlyViewing = chatState.isOpen && !chatState.isMinimized &&
                chatState.viewMode === 'conversation' &&
                (chatState.activeChannel === channelKey);

            if(msgTime > lastRead && !isCurrentlyViewing) {
                unreadCounts[channelKey] = (unreadCounts[channelKey] || 0) + 1;
                total++;
            }
        });

        chatState.unreadCounts = unreadCounts;
        chatState.totalUnread = total;
        updateUnreadBadges();
    }

    // อัปเดตตัวเลขแจ้งเตือนบน UI
    function updateUnreadBadges() {
        // บน Header
        const headerBadge = document.getElementById('chat-unread-badge');
        if(headerBadge) {
            if(chatState.totalUnread > 0) {
                headerBadge.innerText = chatState.totalUnread > 99 ? '99+' : chatState.totalUnread;
                headerBadge.classList.remove('hidden');
            } else {
                headerBadge.classList.add('hidden');
            }
        }

        // บน Floating Launcher Button
        const floatBadge = document.getElementById('floating-chat-unread-badge');
        if(floatBadge) {
            if(chatState.totalUnread > 0) {
                floatBadge.innerText = chatState.totalUnread > 99 ? '99+' : chatState.totalUnread;
                floatBadge.classList.remove('hidden');
            } else {
                floatBadge.classList.add('hidden');
            }
        }

        // บน Minimized Bar
        const minBadge = document.getElementById('chat-minimized-badge');
        if(minBadge) {
            if(chatState.totalUnread > 0) {
                minBadge.innerText = chatState.totalUnread > 99 ? '99+' : chatState.totalUnread;
                minBadge.classList.remove('hidden');
            } else {
                minBadge.classList.add('hidden');
            }
        }
    }

    // ฟังก์ชันรับข้อความใหม่จาก Cloud Listener
    window.handleIncomingCloudMessages = function(messages = [], docChanges = []) {
        chatState.messages = messages;
        const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { actorId: '' };
        const myId = actor.actorId;

        // ถ้าเปลี่ยนผู้ใช้ (เช่น สลับล็อกอิน) ให้รีเซ็ตประวัติการติดตาม
        if(myId !== currentTrackingActorId) {
            currentTrackingActorId = myId;
            sentMsgReadState.clear();
            isInitialMessagesLoad = true;
        }

        // ตรวจสอบว่ามีข้อความที่เราส่งไป แล้วมีคนเพิ่งเปิดอ่านหรือไม่ (Read Receipt Sound)
        let hasMsgJustBeenRead = false;
        if(myId) {
            messages.forEach(msg => {
                if(msg.senderId === myId) {
                    const readByList = Array.isArray(msg.readBy) ? msg.readBy.filter(id => id !== myId) : [];
                    const isNowRead = !!(msg.read || readByList.length > 0);

                    if(!isInitialMessagesLoad && sentMsgReadState.has(msg.id)) {
                        const wasRead = sentMsgReadState.get(msg.id);
                        if(wasRead === false && isNowRead === true) {
                            hasMsgJustBeenRead = true;
                        }
                    }
                    sentMsgReadState.set(msg.id, isNowRead);
                }
            });
        }

        // ตรวจสอบว่ามีข้อความใหม่ที่เพิ่งส่งเข้ามาหรือไม่
        let hasNewIncoming = false;
        let lastIncomingMsg = null;

        if(docChanges && docChanges.length > 0) {
            docChanges.forEach(change => {
                if(change.type === 'added') {
                    const data = change.doc.data();
                    const clientTs = Number(data.clientTimestamp || 0);
                    // ถ้าข้อความส่งมาหลังจากเริ่มเซสชัน และไม่ได้ส่งโดยตัวเอง
                    if(clientTs > sessionStartTime && data.senderId !== myId) {
                        // และเป็นข้อความที่ส่งถึงเรา หรือห้องรวม
                        if(data.recipientId === 'all' || data.recipientId === myId) {
                            hasNewIncoming = true;
                            lastIncomingMsg = data;
                        }
                    }
                }
            });
        }

        recalculateUnread();

        // เล่นเสียงและแสดงแจ้งเตือนถ้ามีข้อความใหม่
        if(hasNewIncoming && lastIncomingMsg) {
            playChatChime();
            // ถ้าหน้าต่างปิดอยู่ หรือย่ออยู่ หรือเปิดห้องอื่นอยู่ ให้แจ้งเตือน Pop-up
            const isViewingThisChannel = chatState.isOpen && !chatState.isMinimized &&
                chatState.viewMode === 'conversation' &&
                (chatState.activeChannel === (lastIncomingMsg.recipientId === 'all' ? 'all' : lastIncomingMsg.senderId));

            if(!isViewingThisChannel) {
                showChatToast(lastIncomingMsg);
            }
        }

        // เล่นเสียงเมื่อมีคนเปิดอ่านข้อความที่เราส่งไป (Read Confirmation Chime)
        if(hasMsgJustBeenRead) {
            playMessageReadChime();
        }

        isInitialMessagesLoad = false;

        // ถ้ากำลังเปิดหน้าต่างแชทห้องนี้อยู่ ให้มาร์กข้อความที่เพิ่งเข้ามาว่าอ่านแล้ว
        if(chatState.isOpen && !chatState.isMinimized && chatState.viewMode === 'conversation') {
            markCurrentChannelAsRead();
        }

        // ถ้าหน้าต่างแชทเปิดอยู่ ให้วาดเนื้อหาใหม่
        if(chatState.isOpen) {
            if(chatState.viewMode === 'conversation') {
                renderMessagesStream(hasNewIncoming);
            } else {
                renderChatDirectory();
            }
        }
    };

    // แสดง Toast แจ้งเตือนข้อความใหม่
    function showChatToast(msg) {
        const toastEl = document.getElementById('chat-notification-toast');
        if(!toastEl) return;

        const senderName = window.escapeHtml ? window.escapeHtml(msg.senderName) : (msg.senderName || 'ผู้ใช้');
        const text = window.escapeHtml ? window.escapeHtml(msg.text) : (msg.text || '');
        const isGeneral = msg.recipientId === 'all';
        const label = isGeneral ? `ห้องรวม: ${senderName}` : senderName;

        toastEl.innerHTML = `
            <div onclick="window.openChatFromToast('${msg.recipientId === 'all' ? 'all' : msg.senderId}', '${window.escapeHtml(msg.senderName)}', '${msg.senderRole || ''}')" class="flex items-center gap-3 cursor-pointer group flex-1 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                    <i class="ph ph-chat-teardrop-dots text-xl"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black text-indigo-200 uppercase tracking-wider">${label}</span>
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    </div>
                    <div class="text-sm font-bold text-white truncate">${text}</div>
                </div>
            </div>
            <button onclick="window.dismissChatToast(event)" class="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0">
                <i class="ph ph-x text-base"></i>
            </button>
        `;

        toastEl.classList.remove('hidden', 'translate-y-8', 'opacity-0');
        toastEl.classList.add('translate-y-0', 'opacity-100');

        if(toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            window.dismissChatToast();
        }, 7000);
    }

    window.dismissChatToast = function(e) {
        if(e) e.stopPropagation();
        const toastEl = document.getElementById('chat-notification-toast');
        if(!toastEl) return;
        toastEl.classList.add('translate-y-8', 'opacity-0');
        setTimeout(() => toastEl.classList.add('hidden'), 300);
    };

    window.openChatFromToast = function(targetId, targetName, targetRole) {
        window.dismissChatToast();
        if(targetId === 'all') {
            window.openChatRoom('all');
        } else {
            window.openChatWith(targetId, targetName, targetRole);
        }
    };

    // ฟอร์แมตเวลา
    function formatChatTime(ts) {
        if(!ts) return '';
        const date = new Date(Number(ts));
        const hours = String(date.getHours()).padStart(2, '0');
        const mins = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${mins} น.`;
    }

    // ฟอร์แมตวันที่สำหรับ Divider
    function formatChatDate(ts) {
        if(!ts) return '';
        const d = new Date(Number(ts));
        const today = new Date();
        if(d.toDateString() === today.toDateString()) return 'วันนี้';

        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        if(d.toDateString() === yesterday.toDateString()) return 'เมื่อวานนี้';

        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const year = d.getFullYear() + 543;
        return `${d.getDate()} ${months[d.getMonth()]} ${year}`;
    }

    // สร้าง DOM หลักของ Widget
    function ensureChatWidgetDOM() {
        if(document.getElementById('anpscore-chat-widget')) return;

        // Container หลักของวิดเจ็ต
        const container = document.createElement('div');
        container.id = 'anpscore-chat-widget-root';
        container.className = 'no-print';
        container.innerHTML = `
            <!-- Floating Notification Toast -->
            <div id="chat-notification-toast" class="hidden fixed bottom-24 right-5 z-[130] max-w-sm w-[calc(100vw-2.5rem)] bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 backdrop-blur-md flex items-center justify-between gap-3 transform translate-y-8 opacity-0 transition-all duration-300">
            </div>

            <!-- Floating Launcher Button -->
            <button id="chat-floating-btn" onclick="window.toggleChatWidget()" class="fixed bottom-5 right-5 z-[120] w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-xl shadow-indigo-300/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-white/20" title="แชทและสอบถามแบบเรียลไทม์">
                <i class="ph ph-chat-circle-dots text-2xl"></i>
                <span id="floating-chat-unread-badge" class="hidden absolute -top-1.5 -right-1.5 min-w-[1.35rem] h-5 px-1 bg-rose-500 text-white text-[11px] font-black rounded-full flex items-center justify-center border-2 border-white animate-pulse shadow-sm">0</span>
            </button>

            <!-- Floating Chat Window -->
            <div id="anpscore-chat-widget" class="hidden fixed bottom-5 right-5 z-[125] w-[400px] max-w-[calc(100vw-1.5rem)] h-[570px] max-h-[calc(100vh-5rem)] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden transform scale-95 opacity-0 transition-all duration-200 origin-bottom-right">
                
                <!-- Chat Window Header -->
                <div id="chat-widget-header" class="h-16 px-4 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
                    <div id="chat-header-title-box" class="flex items-center gap-3 min-w-0">
                        <!-- จะถูกเติมแบบไดนามิกตาม viewMode -->
                    </div>
                    <div id="chat-header-controls" class="flex items-center gap-1 shrink-0">
                        <!-- ปุ่มควบคุม: เสียง, ย่อ, ปิด -->
                    </div>
                </div>

                <!-- Chat Body Area -->
                <div id="chat-widget-body" class="flex-1 flex flex-col min-h-0 bg-slate-50/50">
                    <!-- Directory View หรือ Messages Stream -->
                </div>

            </div>

            <!-- Minimized Floating Bar -->
            <div id="anpscore-chat-minimized-bar" onclick="window.expandChatWidget()" class="hidden fixed bottom-5 right-5 z-[125] h-12 px-4 rounded-full bg-slate-900 text-white shadow-xl border border-slate-700 flex items-center gap-3 cursor-pointer hover:bg-slate-800 transition-all active:scale-95">
                <div class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
                <div class="text-xs font-extrabold truncate max-w-[14rem]" id="chat-minimized-title">ข้อความ</div>
                <span id="chat-minimized-badge" class="hidden min-w-[1.25rem] h-5 px-1 bg-rose-500 text-white text-[11px] font-black rounded-full flex items-center justify-center">0</span>
                <i class="ph ph-arrows-out-simple text-sm text-slate-300"></i>
            </div>
        `;

        document.body.appendChild(container);
        renderChatHeaderControls();
    }

    // วาดปุ่มควบคุมบนหัวหน้าต่างแชท
    function renderChatHeaderControls() {
        const controls = document.getElementById('chat-header-controls');
        if(!controls) return;
        const soundIcon = chatState.soundEnabled ? 'ph-speaker-high' : 'ph-speaker-simple-slash';
        const soundTitle = chatState.soundEnabled ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน';

        const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { role: '' };
        const isAdmin = actor && actor.role === 'admin';
        const isConversation = chatState.viewMode === 'conversation';

        controls.innerHTML = `
            ${isAdmin && isConversation ? `
                <button onclick="window.adminClearCurrentChat()" class="w-8 h-8 rounded-full hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 flex items-center justify-center transition-colors" title="ล้างข้อความทั้งหมดในห้องนี้ (สิทธิ์แอดมิน - ลบแบบไม่มีใครเห็น)">
                    <i class="ph ph-trash text-base"></i>
                </button>
            ` : ''}
            <button onclick="window.toggleChatSound()" class="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors" title="${soundTitle}">
                <i class="ph ${soundIcon} text-base"></i>
            </button>
            <button onclick="window.minimizeChatWidget()" class="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors" title="ย่อหน้าต่าง">
                <i class="ph ph-minus text-base"></i>
            </button>
            <button onclick="window.closeChatWidget()" class="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors" title="ปิดหน้าต่าง">
                <i class="ph ph-x text-base"></i>
            </button>
        `;
    }

    // เปิด/ปิด หน้าต่างแชท
    window.toggleChatWidget = function(forceState) {
        ensureChatWidgetDOM();
        const next = typeof forceState === 'boolean' ? forceState : !chatState.isOpen;
        if(next) {
            window.openChatWidget();
        } else {
            window.closeChatWidget();
        }
    };

    window.openChatWidget = function() {
        ensureChatWidgetDOM();
        chatState.isOpen = true;
        chatState.isMinimized = false;

        const widget = document.getElementById('anpscore-chat-widget');
        const floatBtn = document.getElementById('chat-floating-btn');
        const minBar = document.getElementById('anpscore-chat-minimized-bar');

        if(minBar) minBar.classList.add('hidden');
        if(floatBtn) floatBtn.classList.add('hidden');

        if(widget) {
            widget.classList.remove('hidden');
            setTimeout(() => {
                widget.classList.remove('scale-95', 'opacity-0');
                widget.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

        if(chatState.viewMode === 'conversation') {
            renderConversationView();
            markCurrentChannelAsRead();
        } else {
            renderChatDirectory();
        }
    };

    window.closeChatWidget = function() {
        chatState.isOpen = false;
        chatState.isMinimized = false;

        const widget = document.getElementById('anpscore-chat-widget');
        const floatBtn = document.getElementById('chat-floating-btn');
        const minBar = document.getElementById('anpscore-chat-minimized-bar');

        if(minBar) minBar.classList.add('hidden');

        if(widget) {
            widget.classList.remove('scale-100', 'opacity-100');
            widget.classList.add('scale-95', 'opacity-0');
            setTimeout(() => widget.classList.add('hidden'), 200);
        }

        if(floatBtn) floatBtn.classList.remove('hidden');
    };

    window.minimizeChatWidget = function() {
        chatState.isOpen = false;
        chatState.isMinimized = true;

        const widget = document.getElementById('anpscore-chat-widget');
        const minBar = document.getElementById('anpscore-chat-minimized-bar');
        const floatBtn = document.getElementById('chat-floating-btn');

        if(widget) widget.classList.add('hidden');
        if(floatBtn) floatBtn.classList.add('hidden');

        if(minBar) {
            const currentActor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { displayName: 'ผู้ใช้งาน' };
            const minTitle = document.getElementById('chat-minimized-title');
            if(minTitle) {
                if(chatState.viewMode === 'conversation') {
                    if(chatState.activeChannel === 'all') {
                        minTitle.innerText = 'แท็บแชท: ห้องรวมโรงเรียน';
                    } else if(chatState.activePeer) {
                        minTitle.innerText = `แท็บแชทของ: ${chatState.activePeer.displayName}`;
                    } else {
                        minTitle.innerText = 'แท็บแชท';
                    }
                } else {
                    minTitle.innerText = `แท็บแชท: ${currentActor.displayName}`;
                }
            }
            minBar.classList.remove('hidden');
            updateUnreadBadges();
        }
    };

    window.expandChatWidget = function() {
        window.openChatWidget();
    };

    // เปิดห้องแชทกับบุคคลใดบุคคลหนึ่ง
    window.openChatWith = function(targetActorId, targetName, targetRole = 'teacher') {
        ensureChatWidgetDOM();
        const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { actorId: '' };
        if(actor.actorId === targetActorId) {
            if(window.notify) window.notify('นี่คือบัญชีของคุณเอง กรุณาเลือกเพื่อนร่วมงานท่านอื่นเพื่อสนทนา');
            return;
        }

        chatState.viewMode = 'conversation';
        chatState.activeChannel = targetActorId;
        chatState.activePeer = {
            actorId: targetActorId,
            displayName: targetName || 'ครูผู้สอน',
            role: targetRole || 'teacher'
        };

        saveLastReadTimestamp(targetActorId);
        window.openChatWidget();
        recalculateUnread();
        markCurrentChannelAsRead();
    };

    // เปิดห้องแชทกลาง (ทุกคน)
    window.openChatRoom = function(channelId = 'all') {
        ensureChatWidgetDOM();
        chatState.viewMode = 'conversation';
        chatState.activeChannel = 'all';
        chatState.activePeer = null;

        saveLastReadTimestamp('all');
        window.openChatWidget();
        recalculateUnread();
        markCurrentChannelAsRead();
    };

    // กลับไปหน้ารายชื่อและห้องแชท (Directory)
    window.backToChatDirectory = function() {
        chatState.viewMode = 'directory';
        chatState.activeChannel = '';
        chatState.activePeer = null;
        try {
            renderChatDirectory();
        } catch(err) {
            console.error('Error rendering chat directory:', err);
        }
        recalculateUnread();
    };

    // วาดหน้ารายชื่อและห้องแชท (Directory View)
    // ค้นหาหัวข้อการสนทนาทั้งหมดในโรงเรียน (สำหรับแอดมิน)
    function getAdminChatThreads() {
        const threads = new Map();
        const allTeachers = (window.DB && Array.isArray(window.DB.teachers) ? window.DB.teachers : []);
        const teacherMap = new Map();
        allTeachers.forEach(t => teacherMap.set(t.id, t.name));
        teacherMap.set('admin', 'ผู้ดูแลระบบ');

        chatState.messages.forEach(msg => {
            if(!msg || msg.recipientId === 'all') return;
            const channelId = msg.channelId || [msg.senderId, msg.recipientId].sort().join('__');
            if(!threads.has(channelId)) {
                const nameA = teacherMap.get(msg.senderId) || msg.senderName || msg.senderId;
                const nameB = teacherMap.get(msg.recipientId) || msg.recipientName || msg.recipientId;
                threads.set(channelId, {
                    channelId,
                    participantAId: msg.senderId,
                    participantAName: nameA,
                    participantARole: msg.senderRole,
                    participantBId: msg.recipientId,
                    participantBName: nameB,
                    messages: [],
                    lastMsg: null,
                    totalCount: 0
                });
            }
            const thread = threads.get(channelId);
            thread.messages.push(msg);
            thread.totalCount++;
            if(!thread.lastMsg || (Number(msg.clientTimestamp) > Number(thread.lastMsg.clientTimestamp))) {
                thread.lastMsg = msg;
            }
        });

        return Array.from(threads.values()).sort((a, b) => {
            const timeA = a.lastMsg ? Number(a.lastMsg.clientTimestamp || 0) : 0;
            const timeB = b.lastMsg ? Number(b.lastMsg.clientTimestamp || 0) : 0;
            return timeB - timeA;
        });
    }

    // กรองข้อความของห้องแชทที่กำลังเปิดอยู่
    function getRelevantMessagesForActiveChannel() {
        const currentActor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { actorId: '', role: '' };
        const myId = currentActor.actorId;
        const isGeneral = chatState.activeChannel === 'all';
        const peer = chatState.activePeer;

        return chatState.messages.filter(msg => {
            if(!msg) return false;
            if(isGeneral) {
                return msg.recipientId === 'all' || msg.channelId === 'all';
            } else if(peer && peer.isSupervisedThread) {
                return msg.channelId === chatState.activeChannel ||
                       (msg.senderId === peer.teacherAId && msg.recipientId === peer.teacherBId) ||
                       (msg.senderId === peer.teacherBId && msg.recipientId === peer.teacherAId);
            } else if(peer) {
                return (msg.senderId === myId && msg.recipientId === peer.actorId) ||
                       (msg.senderId === peer.actorId && msg.recipientId === myId);
            }
            return false;
        });
    }

    // เปิดดูแชทของครูในฐานะแอดมิน (Supervised Inspection)
    window.adminOpenTeacherChat = function(channelKey, teacherAId, teacherAName, teacherBId, teacherBName) {
        ensureChatWidgetDOM();
        chatState.viewMode = 'conversation';
        chatState.activeChannel = channelKey;
        chatState.activePeer = {
            actorId: teacherBId,
            displayName: `${teacherAName} ↔ ${teacherBName}`,
            role: 'teacher',
            isSupervisedThread: true,
            teacherAId,
            teacherAName,
            teacherBId,
            teacherBName,
            channelKey
        };
        saveLastReadTimestamp(channelKey);
        window.openChatWidget();
        recalculateUnread();
        renderConversationView();
    };

    // ลบข้อความเดี่ยว (ผู้ส่งลบข้อความของตนเองได้ หรือแอดมินลบข้อความใดก็ได้แบบเงียบ)
    window.adminDeleteMessageSilently = async function(msgId) {
        if(!msgId) return;
        const currentActor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : null;
        if(!currentActor || !currentActor.actorId) {
            if(window.notify) window.notify('กรุณาเข้าสู่ระบบก่อนทำรายการ', true);
            return;
        }

        const targetMsg = chatState.messages.find(m => m.id === msgId);
        const isAuthor = targetMsg && targetMsg.senderId === currentActor.actorId;
        const isAdmin = currentActor.role === 'admin';

        if(!isAdmin && !isAuthor) {
            if(window.notify) window.notify('คุณสามารถลบได้เฉพาะข้อความของตนเอง หรือต้องเป็นผู้ดูแลระบบ', true);
            return;
        }

        const confirmMsg = isAdmin && !isAuthor
            ? 'แอดมินต้องการลบข้อความนี้ใช่หรือไม่? (การลบจะไม่มีใครเห็นการแจ้งเตือน)'
            : 'คุณต้องการลบข้อความนี้ใช่หรือไม่?';

        if(!confirm(confirmMsg)) return;

        try {
            if(typeof window.firebaseDeleteMessage === 'function') {
                await window.firebaseDeleteMessage(msgId);
                if(window.notify) window.notify(isAdmin && !isAuthor ? 'ลบข้อความเรียบร้อยแล้ว (สิทธิ์แอดมิน)' : 'ลบข้อความเรียบร้อยแล้ว');
            }
        } catch(err) {
            console.error('Error deleting message:', err);
            if(window.notify) window.notify('ไม่สามารถลบข้อความได้: ' + (err.message || 'ข้อผิดพลาด'), true);
        }
    };
    window.confirmDeleteChatMessage = window.adminDeleteMessageSilently;

    // ล้างข้อความทั้งหมดในห้องรวมโรงเรียน (เฉพาะสิทธิ์แอดมิน)
    window.adminClearAllRoomMessages = async function() {
        const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : null;
        if(!actor || actor.role !== 'admin') {
            if(window.notify) window.notify('เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ล้างห้องรวม', true);
            return;
        }

        const generalMessages = chatState.messages.filter(m => m && (m.recipientId === 'all' || m.channelId === 'all'));
        if(generalMessages.length === 0) {
            if(window.notify) window.notify('ไม่มีข้อความในห้องรวมโรงเรียนให้ลบ');
            return;
        }

        if(!confirm(`ยืนยันการล้างข้อความทั้งหมด (${generalMessages.length} ข้อความ) ใน "ห้องรวมโรงเรียน" ใช่หรือไม่?\n\n(การลบนี้จะดำเนินการแบบเงียบ โดยไม่มีการแจ้งเตือนหรือร่องรอยแสดงให้ผู้อื่นเห็น)`)) {
            return;
        }

        try {
            const ids = generalMessages.map(m => m.id);
            if(typeof window.firebaseClearChannelMessages === 'function') {
                await window.firebaseClearChannelMessages('all', ids);
                if(window.notify) window.notify('ล้างข้อความในห้องรวมโรงเรียนเรียบร้อยแล้ว (เฉพาะแอดมิน)');
                if(chatState.viewMode === 'conversation' && chatState.activeChannel === 'all') {
                    renderConversationView();
                } else if(chatState.viewMode === 'directory') {
                    renderChatDirectory();
                }
            }
        } catch(err) {
            console.error('Error clearing all room messages:', err);
            if(window.notify) window.notify('ไม่สามารถล้างข้อความห้องรวมได้: ' + (err.message || 'ข้อผิดพลาด'), true);
        }
    };

    // ล้างข้อความทั้งหมดในห้องแชทปัจจุบันแบบเงียบ (เฉพาะสิทธิ์แอดมิน)
    window.adminClearCurrentChat = async function() {
        const actor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : null;
        if(!actor || actor.role !== 'admin') {
            if(window.notify) window.notify('เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ลบแชท', true);
            return;
        }

        const isGeneral = chatState.activeChannel === 'all';
        if(isGeneral) {
            return await window.adminClearAllRoomMessages();
        }

        const channelTitle = chatState.activePeer ? chatState.activePeer.displayName : 'ห้องนี้';

        if(!confirm(`ยืนยันการล้างข้อความทั้งหมดในแท็บแชท "${channelTitle}" ใช่หรือไม่?\n\n(การลบนี้จะดำเนินการแบบเงียบ โดยไม่มีการแจ้งเตือนหรือร่องรอยแสดงให้ผู้อื่นเห็น)`)) {
            return;
        }

        try {
            const relevantMessages = getRelevantMessagesForActiveChannel();
            const ids = relevantMessages.map(m => m.id);
            if(ids.length === 0) {
                if(window.notify) window.notify('ไม่มีข้อความให้ลบในห้องนี้');
                return;
            }

            if(typeof window.firebaseClearChannelMessages === 'function') {
                await window.firebaseClearChannelMessages(chatState.activeChannel, ids);
                if(window.notify) window.notify('ลบแชททั้งหมดในห้องนี้เรียบร้อยแล้ว (เฉพาะแอดมิน)');
                renderConversationView();
            }
        } catch(err) {
            console.error('Admin clear chat error:', err);
            if(window.notify) window.notify('ไม่สามารถล้างแชทได้: ' + (err.message || 'ข้อผิดพลาด'), true);
        }
    };

    // ลบประวัติแชททั้งห้องจากหน้ารวม (เฉพาะสิทธิ์แอดมิน)
    window.adminDeleteThreadSilently = async function(channelId, nameA, nameB) {
        const currentActor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : null;
        if(!currentActor || currentActor.role !== 'admin') {
            if(window.notify) window.notify('เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ลบแชท', true);
            return;
        }

        if(channelId === 'all') {
            return await window.adminClearAllRoomMessages();
        }

        if(!confirm(`แอดมินต้องการลบประวัติการสนทนาทั้งหมดของแท็บแชท "${nameA} ↔ ${nameB}" ใช่หรือไม่?\n\n(การลบนี้จะดำเนินการแบบเงียบ โดยไม่มีการแจ้งเตือนหรือร่องรอยแสดงให้ครูเห็น)`)) {
            return;
        }
        try {
            const messagesToDelete = chatState.messages.filter(m => {
                const cId = m.channelId || [m.senderId, m.recipientId].sort().join('__');
                return cId === channelId;
            });
            const ids = messagesToDelete.map(m => m.id);
            if(typeof window.firebaseClearChannelMessages === 'function') {
                await window.firebaseClearChannelMessages(channelId, ids);
                if(window.notify) window.notify(`ลบประวัติแชทของ "${nameA} ↔ ${nameB}" เรียบร้อยแล้ว (เฉพาะแอดมิน)`);
            }
        } catch(err) {
            console.error('Error deleting thread:', err);
            if(window.notify) window.notify('ไม่สามารถลบประวัติแชทได้', true);
        }
    };

    // วาดหน้ารายชื่อและห้องแชท (Directory View)
    function renderChatDirectory() {
        ensureChatWidgetDOM();
        chatState.viewMode = 'directory';
        renderChatHeaderControls();

        const currentActor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { actorId: '', role: 'guest', displayName: 'ผู้ใช้งาน' };
        if(currentActor.role !== 'admin' && chatState.directoryTab === 'admin_all') {
            chatState.directoryTab = 'direct';
        }

        // วาด Header
        const titleBox = document.getElementById('chat-header-title-box');
        if(titleBox) {
            titleBox.innerHTML = `
                <div class="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center shrink-0">
                    <i class="ph ph-chat-circle-dots text-xl"></i>
                </div>
                <div class="min-w-0">
                    <div class="text-sm font-extrabold text-white truncate">แท็บข้อความ & สอบถาม</div>
                    <div class="text-[11px] text-slate-400 font-medium truncate">กำลังสนทนาในชื่อ: ${window.escapeHtml(currentActor.displayName)}</div>
                </div>
            `;
        }

        const body = document.getElementById('chat-widget-body');
        if(!body) return;

        const activeUsers = (window.getActiveUsers ? window.getActiveUsers() : []).filter(u => u.actorId !== currentActor.actorId);
        const allTeachers = (window.DB && Array.isArray(window.DB.teachers) ? window.DB.teachers : []).filter(t => t.id !== currentActor.actorId);

        // หาข้อความล่าสุดในห้องรวม
        const allChannelMessages = chatState.messages.filter(m => m.recipientId === 'all');
        const lastAllMsg = allChannelMessages.length > 0 ? allChannelMessages[allChannelMessages.length - 1] : null;
        const allUnread = chatState.unreadCounts['all'] || 0;

        // คำนวณแชททั้งหมดสำหรับแอดมิน
        const adminThreads = currentActor.role === 'admin' ? getAdminChatThreads() : [];

        // ค้นหาตาม search query
        const query = (chatState.searchQuery || '').trim().toLowerCase();

        // กรองรายชื่อออนไลน์
        const filteredOnline = activeUsers.filter(u => {
            if(!query) return true;
            return (u.displayName || '').toLowerCase().includes(query) || (u.role || '').toLowerCase().includes(query);
        });

        // รายชื่อออฟไลน์ / อื่นๆ
        const onlineIds = new Set(activeUsers.map(u => u.actorId));
        const offlineTeachers = allTeachers.filter(t => !onlineIds.has(t.id) && (!query || (t.name || '').toLowerCase().includes(query)));

        // HTML ผู้ใช้งานออนไลน์
        let onlineHtml = '';
        if(filteredOnline.length > 0) {
            onlineHtml = filteredOnline.map(u => {
                const unread = chatState.unreadCounts[u.actorId] || 0;
                const roleText = u.role === 'admin' ? 'แอดมิน' : 'ครูผู้สอน';
                const roleBadgeClass = u.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-100';
                return `
                    <div onclick="window.openChatWith('${u.actorId}', '${window.escapeHtml(u.displayName)}', '${u.role}')" class="group flex items-center justify-between gap-3 p-3 bg-white hover:bg-indigo-50/60 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all cursor-pointer">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <div class="relative w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm shrink-0 border border-emerald-100">
                                <span class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
                                ${u.displayName.charAt(0)}
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="font-bold text-slate-800 text-sm truncate group-hover:text-indigo-600 transition-colors" title="${window.escapeHtml(u.displayName)}">
                                    แท็บแชทของ: ${window.escapeHtml(u.displayName)}
                                </div>
                                <div class="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 whitespace-nowrap">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> กำลังออนไลน์
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            ${unread > 0 ? `<span class="min-w-[1.25rem] h-5 px-1 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center shadow-sm animate-pulse">${unread}</span>` : ''}
                            <span class="text-[10px] px-2 py-0.5 rounded-md font-bold ${roleBadgeClass}">${roleText}</span>
                            <span class="w-7 h-7 rounded-lg bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
                                <i class="ph ph-paper-plane-right-fill text-xs"></i>
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            onlineHtml = `
                <div class="p-4 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                    ${query ? 'ไม่พบเพื่อนร่วมงานที่ตรงกับการค้นหา' : 'ยังไม่มีเพื่อนร่วมงานออนไลน์อยู่ในขณะนี้ (สามารถฝากข้อความไว้ได้)'}
                </div>
            `;
        }

        // HTML รายชื่อครูท่านอื่น
        let offlineHtml = '';
        if(offlineTeachers.length > 0) {
            offlineHtml = offlineTeachers.slice(0, 15).map(t => {
                const unread = chatState.unreadCounts[t.id] || 0;
                return `
                    <div onclick="window.openChatWith('${t.id}', '${window.escapeHtml(t.name)}', 'teacher')" class="group flex items-center justify-between gap-3 p-2.5 bg-white/70 hover:bg-white rounded-xl border border-slate-100/80 hover:border-indigo-100 transition-all cursor-pointer">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                                ${t.name.charAt(0)}
                            </div>
                            <div class="min-w-0">
                                <div class="font-bold text-slate-700 text-xs truncate group-hover:text-indigo-600">แท็บแชทของ: ${window.escapeHtml(t.name)}</div>
                                <div class="text-[10px] text-slate-400 font-medium">ครูผู้สอน</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            ${unread > 0 ? `<span class="min-w-[1.25rem] h-5 px-1 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center">${unread}</span>` : ''}
                            <i class="ph ph-chat-circle-dots text-slate-300 group-hover:text-indigo-600 transition-colors"></i>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // HTML แชททั้งหมดในระบบ (เฉพาะแอดมิน)
        let adminThreadsHtml = '';
        if(currentActor.role === 'admin') {
            if(adminThreads.length > 0) {
                adminThreadsHtml = adminThreads.map(thread => {
                    const lastText = window.escapeHtml((thread.lastMsg ? thread.lastMsg.text : '') || '');
                    const lastTimeStr = thread.lastMsg ? formatChatTime(thread.lastMsg.clientTimestamp) : '';
                    const senderPrefix = thread.lastMsg ? `${window.escapeHtml(thread.lastMsg.senderName)}: ` : '';
                    return `
                        <div class="group p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200/90 shadow-sm transition-all">
                            <div class="flex items-center justify-between gap-2 mb-2">
                                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-xs shrink-0">
                                        <i class="ph ph-chat-teardrop-dots text-base"></i>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="text-xs font-black text-slate-800 truncate" title="แท็บแชทของ: ${window.escapeHtml(thread.participantAName)} ↔ ${window.escapeHtml(thread.participantBName)}">
                                            แท็บแชทของ: ${window.escapeHtml(thread.participantAName)} ↔ ${window.escapeHtml(thread.participantBName)}
                                        </div>
                                        <div class="text-[10px] text-slate-400 font-medium">
                                            ${thread.totalCount} ข้อความ ${lastTimeStr ? `• ล่าสุด ${lastTimeStr}` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1 shrink-0">
                                    <button onclick="window.adminOpenTeacherChat('${thread.channelId}', '${thread.participantAId}', '${window.escapeHtml(thread.participantAName)}', '${thread.participantBId}', '${window.escapeHtml(thread.participantBName)}')" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-[11px] font-bold transition-colors">
                                        เปิดดู
                                    </button>
                                    <button onclick="window.adminDeleteThreadSilently('${thread.channelId}', '${window.escapeHtml(thread.participantAName)}', '${window.escapeHtml(thread.participantBName)}')" class="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors" title="ลบแชททั้งหมดในแท็บนี้ (สิทธิ์แอดมิน - ลบแบบไม่มีใครเห็น)">
                                        <i class="ph ph-trash text-sm"></i>
                                    </button>
                                </div>
                            </div>
                            ${lastText ? `
                                <div class="text-[11px] text-slate-600 truncate pl-2 border-l-2 border-indigo-200 ml-1">
                                    <span class="font-bold text-slate-700">${senderPrefix}</span>${lastText}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            } else {
                adminThreadsHtml = `
                    <div class="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                        ยังไม่มีประวัติการแชทส่วนตัวระหว่างครูในระบบ
                    </div>
                `;
            }
        }

        // แท็บ Body ตามแท็บที่เลือก
        let tabBodyHtml = '';
        if(chatState.directoryTab === 'public') {
            tabBodyHtml = `
                <!-- ห้องแชทรวม (ทุกคนในโรงเรียน) -->
                <div class="group p-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 rounded-2xl text-white shadow-md shadow-indigo-200/50 transition-all cursor-pointer">
                    <div class="flex items-center justify-between gap-3 mb-2" onclick="window.openChatRoom('all')">
                        <div class="flex items-center gap-2.5">
                            <div class="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-extrabold shadow-inner">
                                <i class="ph ph-buildings text-lg"></i>
                            </div>
                            <div>
                                <div class="font-extrabold text-sm leading-tight">แท็บแชท: ห้องรวมโรงเรียน (ทุกคน)</div>
                                <div class="text-[10px] text-indigo-100 font-medium">กระดานสอบถามและแจ้งข่าวสารส่วนรวม</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${currentActor.role === 'admin' ? `
                                <button onclick="event.stopPropagation(); window.adminClearAllRoomMessages()" class="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-rose-600 text-white text-[11px] font-bold flex items-center gap-1 transition-colors shadow-sm" title="ล้างข้อความทั้งหมดในห้องรวม (สิทธิ์แอดมิน - ลบแบบไม่มีใครเห็น)">
                                    <i class="ph ph-trash text-xs"></i>
                                    <span>ล้างห้องรวม</span>
                                </button>
                            ` : ''}
                            ${allUnread > 0 ? `<span class="min-w-[1.25rem] h-5 px-1.5 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center shadow-md border border-white animate-pulse">${allUnread}</span>` : '<i class="ph ph-caret-right text-indigo-200 text-base"></i>'}
                        </div>
                    </div>
                    <div onclick="window.openChatRoom('all')" class="text-xs text-indigo-100 truncate pl-1">
                        ${lastAllMsg ? `<span class="font-bold text-white">${window.escapeHtml(lastAllMsg.senderName)}:</span> ${window.escapeHtml(lastAllMsg.text)}` : 'เริ่มต้นการสนทนากับทุกคนในโรงเรียนได้ที่นี่'}
                    </div>
                </div>

                <!-- พรีวิวข้อความล่าสุดในห้องรวม -->
                <div>
                    <div class="flex items-center justify-between mb-2 px-1">
                        <div class="text-xs font-black text-slate-700 uppercase tracking-wider">ข้อความล่าสุดในห้องรวม (${allChannelMessages.length} ข้อความ)</div>
                        ${(currentActor.role === 'admin' && allChannelMessages.length > 0) ? `
                            <button onclick="window.adminClearAllRoomMessages()" class="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 transition-colors" title="ล้างข้อความทั้งหมดในห้องรวม (สิทธิ์แอดมิน)">
                                <i class="ph ph-trash text-xs"></i>
                                <span>ล้างห้อง</span>
                            </button>
                        ` : ''}
                    </div>
                    ${allChannelMessages.length > 0 ? `
                        <div class="space-y-2">
                            ${allChannelMessages.slice(-5).reverse().map(m => `
                                <div class="p-2.5 bg-white rounded-xl border border-slate-100 text-xs flex items-center justify-between gap-2 group">
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center justify-between mb-1">
                                            <span class="font-bold text-slate-800">${window.escapeHtml(m.senderName)}</span>
                                            <span class="text-[10px] text-slate-400">${formatChatTime(m.clientTimestamp)}</span>
                                        </div>
                                        <div class="text-slate-600 truncate">${window.escapeHtml(m.text)}</div>
                                    </div>
                                    ${(currentActor.role === 'admin' || m.senderId === currentActor.actorId) ? `
                                        <button onclick="window.adminDeleteMessageSilently('${m.id}')" class="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all shrink-0" title="ลบข้อความนี้">
                                            <i class="ph ph-trash text-xs"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="text-xs text-slate-400 text-center py-4 bg-white rounded-xl border border-dashed border-slate-200">ยังไม่มีข้อความในห้องรวม</div>'}
                </div>
            `;
        } else if(chatState.directoryTab === 'admin_all' && currentActor.role === 'admin') {
            tabBodyHtml = `
                <div class="flex items-center justify-between px-1">
                    <div class="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <i class="ph ph-shield-check text-amber-600 text-sm"></i>
                        <span>แชททั้งหมดในระบบ (${adminThreads.length + 1} ห้องสนทนา)</span>
                    </div>
                    <span class="text-[10px] text-slate-400 font-bold">สิทธิ์แอดมิน</span>
                </div>
                <div class="space-y-2">
                    <!-- Pinned Master Thread: ห้องรวมโรงเรียน -->
                    <div class="group p-3 bg-gradient-to-r from-indigo-50/90 to-white hover:bg-indigo-50 rounded-2xl border border-indigo-200 shadow-sm transition-all">
                        <div class="flex items-center justify-between gap-2 mb-1.5">
                            <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                <div class="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                    <i class="ph ph-buildings text-base"></i>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="text-xs font-black text-slate-800 truncate">
                                        แท็บแชท: ห้องรวมโรงเรียน (กระดานส่วนรวม)
                                    </div>
                                    <div class="text-[10px] text-slate-500 font-medium">
                                        ${allChannelMessages.length} ข้อความ ${lastAllMsg ? `• ล่าสุด ${formatChatTime(lastAllMsg.clientTimestamp)}` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                                <button onclick="window.openChatRoom('all')" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-colors">
                                    เปิดดู
                                </button>
                                <button onclick="window.adminClearAllRoomMessages()" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors" title="ล้างข้อความทั้งหมดในห้องรวม (สิทธิ์แอดมิน - ลบแบบไม่มีใครเห็น)">
                                    <i class="ph ph-trash text-sm"></i>
                                </button>
                            </div>
                        </div>
                        ${lastAllMsg ? `
                            <div class="text-[11px] text-slate-600 truncate pl-2 border-l-2 border-indigo-400 ml-1">
                                <span class="font-bold text-slate-700">${window.escapeHtml(lastAllMsg.senderName)}: </span>${window.escapeHtml(lastAllMsg.text)}
                            </div>
                        ` : ''}
                    </div>
                    ${adminThreadsHtml}
                </div>
            `;
        } else {
            // direct (default)
            tabBodyHtml = `
                <!-- กล่องค้นหา -->
                <div class="relative">
                    <i class="ph ph-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input type="text" id="chat-search-input" value="${window.escapeHtml(chatState.searchQuery)}" oninput="window.handleChatSearch(this.value)" placeholder="ค้นหาครู หรือส่งข้อความ..." class="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-sm transition-colors">
                </div>

                <!-- ผู้ใช้งานที่กำลังออนไลน์ตอนนี้ -->
                <div>
                    <div class="flex items-center justify-between mb-2 px-1">
                        <div class="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider">
                            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>ออนไลน์อยู่ตอนนี้ (${activeUsers.length} คน)</span>
                        </div>
                        <span class="text-[10px] text-slate-400 font-bold">พร้อมตอบกลับ</span>
                    </div>
                    <div class="space-y-2">
                        ${onlineHtml}
                    </div>
                </div>

                <!-- รายชื่อครูท่านอื่น -->
                ${offlineTeachers.length > 0 ? `
                    <div>
                        <div class="flex items-center justify-between mb-2 px-1 pt-1">
                            <div class="text-xs font-black text-slate-700 uppercase tracking-wider">รายชื่อครูและบุคลากร</div>
                            <span class="text-[10px] text-slate-400 font-bold">ฝากข้อความไว้ได้</span>
                        </div>
                        <div class="space-y-1.5">
                            ${offlineHtml}
                        </div>
                    </div>
                ` : ''}
            `;
        }

        body.innerHTML = `
            <div class="p-3.5 flex flex-col h-full overflow-y-auto custom-scrollbar space-y-3">
                
                <!-- แถบระบุตัวตนของผู้ใช้ (User Identity Pill) -->
                <div class="flex items-center justify-between p-2.5 bg-slate-100 rounded-2xl border border-slate-200/90 text-xs shadow-inner">
                    <div class="flex items-center gap-2 min-w-0">
                        <div class="w-7 h-7 rounded-xl ${currentActor.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white'} flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            ${currentActor.role === 'admin' ? '<i class="ph ph-shield-check"></i>' : currentActor.displayName.charAt(0)}
                        </div>
                        <div class="truncate">
                            <span class="text-slate-400 text-[10px] block leading-none">บัญชีของคุณ</span>
                            <span class="font-black text-slate-800 text-xs">${window.escapeHtml(currentActor.displayName)}</span>
                        </div>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-lg font-bold shrink-0 ${currentActor.role === 'admin' ? 'bg-slate-900 text-white shadow-sm' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}">
                        ${currentActor.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน'}
                    </span>
                </div>

                <!-- แถบแท็บแชทหลัก (Chat Directory Tabs) -->
                <div class="flex p-1 bg-slate-200/80 rounded-2xl text-xs font-bold gap-1 shrink-0">
                    <button onclick="window.switchChatTab('direct')" class="flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${chatState.directoryTab === 'direct' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}">
                        <i class="ph ph-user"></i>
                        <span>แชทส่วนตัว</span>
                    </button>
                    <button onclick="window.switchChatTab('public')" class="flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${chatState.directoryTab === 'public' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}">
                        <i class="ph ph-buildings"></i>
                        <span>ห้องรวม</span>
                        ${allUnread > 0 ? `<span class="min-w-[1rem] h-4 px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">${allUnread}</span>` : ''}
                    </button>
                    ${currentActor.role === 'admin' ? `
                        <button onclick="window.switchChatTab('admin_all')" class="flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${chatState.directoryTab === 'admin_all' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}" title="ดูและจัดการแชททั้งหมดในโรงเรียน (สิทธิ์แอดมิน)">
                            <i class="ph ph-shield-check"></i>
                            <span>แชททั้งหมด (${adminThreads.length})</span>
                        </button>
                    ` : ''}
                </div>

                <!-- เนื้อหาในแท็บที่เลือก -->
                ${tabBodyHtml}

            </div>
        `;
    }

    window.handleChatSearch = function(val) {
        chatState.searchQuery = val || '';
        renderChatDirectory();
    };

    window.updateChatOnlineUsersUI = function() {
        if(chatState.isOpen && chatState.viewMode === 'directory') {
            const searchInput = document.getElementById('chat-search-input');
            if(document.activeElement === searchInput) return;
            renderChatDirectory();
        }
    };

    // วาดหน้าต่างสนทนา (Conversation View)
    function renderConversationView() {
        ensureChatWidgetDOM();
        chatState.viewMode = 'conversation';
        renderChatHeaderControls();

        const isGeneral = chatState.activeChannel === 'all';
        const peer = chatState.activePeer;
        const currentActor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { actorId: '', role: 'guest', displayName: 'ผู้ใช้งาน' };

        // ตรวจสอบสถานะออนไลน์ของคู่สนทนา
        let isOnline = false;
        if(!isGeneral && peer && !peer.isSupervisedThread) {
            const activeUsers = window.getActiveUsers ? window.getActiveUsers() : [];
            isOnline = activeUsers.some(u => u.actorId === peer.actorId);
        }

        let tabBadgeText = '';
        let tabTitle = '';
        let tabSub = '';

        if(isGeneral) {
            tabBadgeText = 'แท็บแชท: ห้องรวมโรงเรียน (ทุกคน)';
            tabTitle = 'ห้องรวม (ทุกคนในโรงเรียน)';
            tabSub = `สนทนาในชื่อ: ${window.escapeHtml(currentActor.displayName)}`;
        } else if(peer && peer.isSupervisedThread) {
            tabBadgeText = `แท็บแชทของ: ${window.escapeHtml(peer.teacherAName)} ↔ ${window.escapeHtml(peer.teacherBName)}`;
            tabTitle = `${window.escapeHtml(peer.teacherAName)} กับ ${window.escapeHtml(peer.teacherBName)}`;
            tabSub = `สิทธิ์แอดมิน: ตรวจสอบและจัดการแชท (${window.escapeHtml(peer.teacherAId)} ↔ ${window.escapeHtml(peer.teacherBId)})`;
        } else if(peer) {
            tabBadgeText = `แท็บแชทของ: ${window.escapeHtml(peer.displayName)}`;
            tabTitle = `${window.escapeHtml(peer.displayName)} (${peer.role === 'admin' ? 'แอดมิน' : 'ครูผู้สอน'})`;
            tabSub = `สนทนากับ: ${window.escapeHtml(peer.displayName)} | คุณคือ: ${window.escapeHtml(currentActor.displayName)}`;
        }

        // วาด Header
        const titleBox = document.getElementById('chat-header-title-box');
        if(titleBox) {
            titleBox.innerHTML = `
                <button onclick="window.backToChatDirectory()" class="h-8 px-2.5 rounded-xl bg-white/15 hover:bg-indigo-600 text-white flex items-center gap-1 text-xs font-black transition-all shrink-0 border border-white/20 active:scale-95 shadow-sm" title="กลับไปยังหน้ารวมแท็บแชท">
                    <i class="ph ph-arrow-left text-sm font-bold"></i>
                    <span>แท็บ</span>
                </button>
                <div class="relative w-9 h-9 rounded-xl ${isGeneral ? 'bg-indigo-600' : (peer && peer.isSupervisedThread ? 'bg-amber-600' : 'bg-emerald-600')} text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md">
                    ${!isGeneral && isOnline ? '<span class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse"></span>' : ''}
                    <i class="ph ${isGeneral ? 'ph-buildings text-lg' : (peer && peer.isSupervisedThread ? 'ph-users text-lg' : 'ph-user text-lg')}"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 mb-0.5">
                        <span class="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-black tracking-wide truncate max-w-[210px]" title="${tabBadgeText}">
                            ${tabBadgeText}
                        </span>
                        ${!isGeneral && isOnline ? '<span class="text-[10px] text-emerald-400 font-bold flex items-center gap-1 whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ออนไลน์</span>' : ''}
                    </div>
                    <div class="text-xs font-black text-white truncate" title="${tabTitle}">
                        ${tabTitle}
                    </div>
                    <div class="text-[10px] text-slate-300 truncate" title="${tabSub}">
                        ${tabSub}
                    </div>
                </div>
            `;
        }

        // วาดส่วนโครงสร้างแชท
        const body = document.getElementById('chat-widget-body');
        if(!body) return;

        body.innerHTML = `
            <!-- แถบนำทางกลับหน้าแท็บและสลับแท็บด่วน (Quick Tabs Bar) -->
            <div class="px-3 py-2 bg-white border-b border-slate-200/90 flex items-center justify-between gap-2 shrink-0 shadow-xs">
                <button onclick="window.backToChatDirectory()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs border border-indigo-200/80 transition-all active:scale-95 shadow-xs" title="กลับไปยังหน้ารวมแท็บแชท">
                    <i class="ph ph-arrow-left text-sm font-bold"></i>
                    <span>กลับหน้าแท็บ</span>
                </button>
                
                <div class="flex items-center gap-1">
                    <button onclick="window.switchChatTabAndGo('direct')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${chatState.directoryTab === 'direct' && !isGeneral ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}" title="ไปยังแท็บแชทส่วนตัว">
                        <i class="ph ph-user text-[11px]"></i>
                        <span>ส่วนตัว</span>
                    </button>
                    <button onclick="window.switchChatTabAndGo('public')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${isGeneral ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}" title="ไปยังแท็บห้องรวม">
                        <i class="ph ph-buildings text-[11px]"></i>
                        <span>ห้องรวม</span>
                    </button>
                    ${currentActor.role === 'admin' ? `
                        <button onclick="window.switchChatTabAndGo('admin_all')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${chatState.directoryTab === 'admin_all' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-amber-700'}" title="ไปยังแท็บแชททั้งหมด (สิทธิ์แอดมิน)">
                            <i class="ph ph-shield-check text-[11px]"></i>
                            <span>ทั้งหมด</span>
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- รายการข้อความ -->
            <div id="chat-messages-container" class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                <!-- รายการฟองข้อความจะถูกวาดที่นี่ -->
            </div>

            <!-- ชิปข้อความด่วนสำหรับสอบถาม -->
            <div class="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <button onclick="window.insertQuickChatMessage('👋 สวัสดีครับ/ค่ะ')" class="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-[11px] font-bold border border-slate-200/70 whitespace-nowrap transition-colors">
                    👋 สวัสดีครับ/ค่ะ
                </button>
                <button onclick="window.insertQuickChatMessage('❓ ขอสอบถามเรื่องการกรอกคะแนนครับ')" class="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-[11px] font-bold border border-slate-200/70 whitespace-nowrap transition-colors">
                    ❓ สอบถามเรื่องคะแนน
                </button>
                <button onclick="window.insertQuickChatMessage('✅ บันทึกคะแนนเสร็จเรียบร้อยแล้วครับ')" class="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-[11px] font-bold border border-slate-200/70 whitespace-nowrap transition-colors">
                    ✅ บันทึกเสร็จแล้ว
                </button>
                <button onclick="window.insertQuickChatMessage('📋 รบกวนแอดมินช่วยตรวจสอบผลการเรียนด้วยครับ')" class="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-[11px] font-bold border border-slate-200/70 whitespace-nowrap transition-colors">
                    📋 รบกวนช่วยตรวจสอบ
                </button>
            </div>

            <!-- กล่องพิมพ์ข้อความ -->
            <div class="p-3 bg-white border-t border-slate-200/80 shrink-0">
                <form id="chat-send-form" onsubmit="window.handleChatSubmit(event)" class="flex items-center gap-2">
                    <input type="text" id="chat-message-input" autocomplete="off" placeholder="พิมพ์ข้อความสอบถามที่นี่... (กด Enter เพื่อส่ง)" class="flex-1 bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 rounded-2xl px-4 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-inner">
                    <button type="submit" id="chat-send-btn" class="tactile-btn w-10 h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-200 active:scale-95 transition-all" title="ส่งข้อความ">
                        <i class="ph ph-paper-plane-right-fill text-base"></i>
                    </button>
                </form>
            </div>
        `;

        renderMessagesStream(true);

        // โฟกัสช่องพิมพ์
        setTimeout(() => {
            const input = document.getElementById('chat-message-input');
            if(input) input.focus();
        }, 100);
    }

    // วาดสตรีมข้อความในห้องปัจจุบัน
    function renderMessagesStream(shouldScrollToBottom = false) {
        const container = document.getElementById('chat-messages-container');
        if(!container) return;

        const currentActor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : { actorId: '', role: 'guest' };
        const myId = currentActor.actorId;
        const isAdmin = currentActor.role === 'admin';
        const isGeneral = chatState.activeChannel === 'all';
        const peer = chatState.activePeer;

        // กรองข้อความของห้องนี้
        const relevantMessages = getRelevantMessagesForActiveChannel();

        if(relevantMessages.length === 0) {
            container.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <div class="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3 shadow-inner">
                        <i class="ph ph-chat-circle-dots text-3xl"></i>
                    </div>
                    <div class="font-bold text-slate-700 text-sm mb-1">ยังไม่มีข้อความในการสนทนานี้</div>
                    <div class="text-xs text-slate-400 max-w-[16rem]">
                        ${isGeneral ? 'คุณสามารถพิมพ์ข้อความสอบถามหรือแชร์ข้อมูลกับเพื่อนร่วมงานได้เลย' : `เริ่มต้นทักทายและสอบถาม ${window.escapeHtml(peer ? peer.displayName : '')} ได้ทันที`}
                    </div>
                </div>
            `;
            return;
        }

        // สร้าง HTML ฟองข้อความพร้อมตัวคั่นวันที่
        let lastDateLabel = '';
        const html = relevantMessages.map(msg => {
            const isMine = msg.senderId === myId;
            const timeStr = formatChatTime(msg.clientTimestamp);
            const dateLabel = formatChatDate(msg.clientTimestamp);

            let dividerHtml = '';
            if(dateLabel && dateLabel !== lastDateLabel) {
                lastDateLabel = dateLabel;
                dividerHtml = `
                    <div class="flex items-center justify-center my-3">
                        <span class="px-3 py-1 rounded-full bg-slate-200/80 text-[10px] font-extrabold text-slate-500 shadow-sm">${dateLabel}</span>
                    </div>
                `;
            }

            const senderName = window.escapeHtml(msg.senderName || 'ผู้ใช้');
            const text = window.escapeHtml(msg.text || '');
            const isSenderAdmin = msg.senderRole === 'admin';
            const roleBadge = isSenderAdmin ? 'แอดมิน' : 'ครู';

            if(isMine) {
                // ตรวจสอบสถานะว่ามีคนอ่านหรือยัง
                const readByList = Array.isArray(msg.readBy) ? msg.readBy.filter(id => id !== myId) : [];
                const isRead = !!(msg.read || readByList.length > 0);
                
                let readStatusHtml = '';
                if(isGeneral) {
                    if(readByList.length > 0) {
                        readStatusHtml = `
                            <span class="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5" title="มีผู้เปิดอ่านแล้ว ${readByList.length} คน">
                                <i class="ph ph-checks text-xs font-bold text-emerald-500"></i>
                                <span>อ่านแล้ว ${readByList.length} คน</span>
                            </span>
                        `;
                    } else {
                        readStatusHtml = `
                            <span class="text-[10px] text-slate-400 flex items-center gap-0.5" title="ส่งเรียบร้อยแล้ว ยังไม่มีผู้อื่นเปิดอ่าน">
                                <i class="ph ph-check text-xs"></i>
                                <span>ส่งแล้ว</span>
                            </span>
                        `;
                    }
                } else {
                    // สนทนาตัวต่อตัว 1-on-1
                    if(isRead) {
                        const readTimeStr = msg.readAt ? `อ่านเมื่อ ${formatChatTime(msg.readAt)}` : 'อ่านแล้ว';
                        readStatusHtml = `
                            <span class="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5" title="${readTimeStr}">
                                <i class="ph ph-checks text-xs font-bold text-emerald-500"></i>
                                <span>อ่านแล้ว</span>
                            </span>
                        `;
                    } else {
                        readStatusHtml = `
                            <span class="text-[10px] text-slate-400 flex items-center gap-0.5" title="ส่งเรียบร้อยแล้ว">
                                <i class="ph ph-check text-xs"></i>
                                <span>ส่งแล้ว</span>
                            </span>
                        `;
                    }
                }

                // ข้อความของตัวเอง (ชิดขวา สีคราม)
                return `
                    ${dividerHtml}
                    <div class="flex flex-col items-end group">
                        <div class="flex items-end gap-1.5 max-w-[85%]">
                            <button onclick="window.adminDeleteMessageSilently('${msg.id}')" class="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-opacity" title="${isAdmin ? 'ลบข้อความนี้ (สิทธิ์แอดมิน - ลบแบบไม่มีใครเห็น)' : 'ลบข้อความนี้'}">
                                <i class="ph ph-trash text-xs"></i>
                            </button>
                            <div class="p-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-tr-sm shadow-md shadow-indigo-100 text-xs leading-relaxed whitespace-pre-wrap break-words">
                                ${text}
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 mt-1 mr-1">
                            <span class="text-[10px] text-slate-400">${timeStr}</span>
                            ${readStatusHtml}
                        </div>
                    </div>
                `;
            } else {
                // ข้อความของอีกฝ่าย (ชิดซ้าย สีขาว/เทาอ่อน)
                return `
                    ${dividerHtml}
                    <div class="flex flex-col items-start group">
                        ${isGeneral || (peer && peer.isSupervisedThread) ? `
                            <div class="flex items-center gap-1.5 mb-1 ml-1">
                                <span class="text-[11px] font-extrabold text-slate-700">${senderName}</span>
                                <span class="text-[9px] px-1.5 py-0.2 rounded font-bold ${isSenderAdmin ? 'bg-slate-900 text-white' : 'bg-indigo-50 text-indigo-700'}">${roleBadge}</span>
                            </div>
                        ` : ''}
                        <div class="flex items-end gap-1.5 max-w-[85%]">
                            <div class="p-3 bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-200/70 shadow-sm text-xs leading-relaxed whitespace-pre-wrap break-words">
                                ${text}
                            </div>
                            ${isAdmin ? `
                                <button onclick="window.adminDeleteMessageSilently('${msg.id}')" class="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-opacity" title="ลบข้อความนี้ (สิทธิ์แอดมิน - ลบแบบไม่มีใครเห็น)">
                                    <i class="ph ph-trash text-xs"></i>
                                </button>
                            ` : ''}
                        </div>
                        <span class="text-[10px] text-slate-400 mt-1 ml-1">${timeStr}</span>
                    </div>
                `;
            }
        }).join('');

        container.innerHTML = html;

        if(shouldScrollToBottom) {
            container.scrollTop = container.scrollHeight;
        }

        // มาร์กห้องนี้ว่าอ่านแล้ว
        saveLastReadTimestamp(chatState.activeChannel);
        recalculateUnread();
        markCurrentChannelAsRead();
    }

    // ใส่ข้อความด่วน
    window.insertQuickChatMessage = function(text) {
        const input = document.getElementById('chat-message-input');
        if(!input) return;
        input.value = text;
        input.focus();
    };

    // ส่งข้อความ
    window.handleChatSubmit = async function(e) {
        if(e) e.preventDefault();
        const input = document.getElementById('chat-message-input');
        if(!input) return;

        const text = String(input.value || '').trim();
        if(!text) return;

        const currentActor = window.getCurrentActorInfo ? window.getCurrentActorInfo() : null;
        if(!currentActor || !currentActor.actorId) {
            if(window.notify) window.notify('กรุณาเข้าสู่ระบบก่อนส่งข้อความ', true);
            return;
        }

        const isGeneral = chatState.activeChannel === 'all';
        const peer = chatState.activePeer;

        let recipientId = 'all';
        let recipientName = 'ทุกคนในโรงเรียน';
        let channelId = 'all';

        if(isGeneral) {
            recipientId = 'all';
            recipientName = 'ทุกคนในโรงเรียน';
            channelId = 'all';
        } else if(peer && peer.isSupervisedThread) {
            recipientId = peer.teacherBId;
            recipientName = `${peer.teacherAName} & ${peer.teacherBName}`;
            channelId = peer.channelKey;
        } else if(peer) {
            recipientId = peer.actorId;
            recipientName = peer.displayName;
            channelId = [currentActor.actorId, peer.actorId].sort().join('__');
        }

        const payload = {
            senderId: currentActor.actorId,
            senderName: currentActor.displayName,
            senderRole: currentActor.role,
            recipientId,
            recipientName,
            channelId,
            text
        };

        // ล้างช่องป้อนทันทีเพื่อให้พิมพ์ต่อได้ลื่นไหล
        input.value = '';

        try {
            if(typeof window.firebaseSendMessage === 'function') {
                await window.firebaseSendMessage(payload);
            } else {
                console.warn('Firebase chat service not ready, queuing locally');
            }
        } catch(err) {
            console.error('Error sending message:', err);
            if(window.notify) window.notify('ไม่สามารถส่งข้อความได้: ' + (err.message || 'ข้อผิดพลาดเครือข่าย'), true);
        }
    };

    // ลบข้อความ (สิทธิ์เฉพาะแอดมิน - ลบแบบไม่มีใครเห็น)
    window.confirmDeleteChatMessage = window.adminDeleteMessageSilently;

    // กดปุ่ม Esc เพื่อกลับสู่หน้าแท็บหลักเมื่ออยู่ในห้องแชท
    document.addEventListener('keydown', (e) => {
        if(e.key === 'Escape' && chatState.isOpen && !chatState.isMinimized) {
            if(chatState.viewMode === 'conversation') {
                window.backToChatDirectory();
            }
        }
    });

    // เริ่มต้นระบบแชทเมื่อพร้อม
    document.addEventListener('DOMContentLoaded', () => {
        ensureChatWidgetDOM();
    });

    // ถ้าโหลดเสร็จแล้ว ให้สร้างทันที
    if(document.readyState === 'interactive' || document.readyState === 'complete') {
        ensureChatWidgetDOM();
    }

})();
