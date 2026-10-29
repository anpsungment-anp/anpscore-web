/* ============================================================================
   ศูนย์รวมระบบโรงเรียน (portal.html)
   รวมลิงก์ของทุกระบบในโรงเรียนไว้หน้าเดียว ผู้ดูแลระบบเพิ่ม แก้ ลบ และจัดลำดับได้เองจากหน้านี้

   ข้อมูลอยู่ใน Firestore สองเอกสาร
     /anpscore/portal_public  ชื่อหน้า หมวดหมู่ และลิงก์ที่ทุกคนเห็น  — อ่านได้ก่อนล็อกอิน
     /anpscore/portal_staff   ลิงก์เฉพาะครูและบุคลากร                — อ่านได้เมื่อล็อกอินแล้ว
   ต้องแยกเป็นสองเอกสาร เพราะกฎของ Firestore คุมสิทธิ์ได้ทีละเอกสาร ไม่ใช่ทีละรายการ
   ลิงก์ภายในจึงห้ามอยู่ในเอกสารที่เปิดสาธารณะ

   ล็อกอินด้วยบัญชีเดียวกับระบบคะแนน (auth/session.js) และอายุการล็อกอินผูกกับแท็บ
   ระบบภายในจึงเปิดในแท็บเดิม เพื่อให้ไม่ต้องล็อกอินซ้ำ ส่วนเว็บภายนอกเปิดแท็บใหม่

   ความเร็ว — หน้านี้ตั้งใจไม่โหลด Firebase SDK (หลักเมกะไบต์) ตอนเปิดหน้า
     1. วาดรายการจากที่เก็บในเครื่องหรือรายการเริ่มต้นทันที
     2. อ่านรายการจริงด้วย REST ก้อนเดียวไม่กี่กิโลไบต์
     3. โหลด SDK ต่อเมื่อจำเป็น คือมีคนล็อกอินค้างในแท็บ กดเข้าสู่ระบบ หรือเริ่มจัดการลิงก์
   ผู้ปกครองหรือนักเรียนที่แค่เปิดดูลิงก์ จึงไม่ต้องโหลด SDK เลย
   ========================================================================== */

import { DEFAULT_PORTAL, ICONS, TONES } from './defaults.js';
import { firebaseConfig } from '../auth/firebase-config.js';

const CACHE_KEY = 'anpscore_portal_cache';
const PINS_KEY = 'anpscore_portal_pins';
const THEME_KEY = 'anpscore_theme';
/* ระบบคะแนนอ่านค่านี้ เพื่อนับการเข้าใช้งานของครูที่ล็อกอินจากหน้านี้ (app/app-shell.js) */
const LOGIN_RECORD_KEY = 'anpscore_pending_login_record';

const ICON_SET = new Set(ICONS);
const TONE_SET = new Set(TONES);
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const TONE_NAMES = {
    indigo: 'คราม', blue: 'น้ำเงิน', sky: 'ฟ้า', teal: 'เขียวอมฟ้า', emerald: 'เขียว',
    amber: 'เหลือง', orange: 'ส้ม', rose: 'แดงอมชมพู', violet: 'ม่วง', slate: 'เทา'
};

/* ---------------------------------------------------------------------------
   ตัวช่วยทั่วไป
   --------------------------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

/* สร้าง element แบบปลอดภัย ข้อความทุกชิ้นใส่เป็น text node จึงไม่มีทางกลายเป็น HTML */
function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
        for (const [key, value] of Object.entries(props)) {
            if (value == null || value === false) continue;
            if (key === 'class') el.className = value;
            else if (key === 'dataset') Object.assign(el.dataset, value);
            else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
            else el.setAttribute(key, value === true ? '' : String(value));
        }
    }
    for (const child of children.flat(Infinity)) {
        if (child == null || child === false) continue;
        el.append(child instanceof Node ? child : String(child));
    }
    return el;
}

const icon = (name, extra = '') =>
    h('i', { class: `ph ph-${name}${extra ? ' ' + extra : ''}`, 'aria-hidden': 'true' });

const safeIcon = (name, fallback = 'link') => (ICON_SET.has(name) ? name : fallback);

const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* เต็มหรือถูกปิดไว้ ข้ามได้ */ }
}

function toMillis(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    return 0;
}

const shortDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const longDate = new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/* ---------------------------------------------------------------------------
   ลิงก์และรูป — กันลิงก์แบบ javascript: ที่อาจถูกใส่เข้ามา
   --------------------------------------------------------------------------- */
function safeHref(raw) {
    const url = String(raw || '').trim();
    if (!url) return '';
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url);
    if (scheme && !SAFE_SCHEMES.has(scheme[1].toLowerCase())) return '';
    return url;
}

function describeHref(href) {
    try {
        const u = new URL(href, location.href);
        if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.origin === location.origin) {
            return { external: false, host: '' };
        }
        return { external: true, host: u.hostname.replace(/^www\./, '') };
    } catch {
        return { external: false, host: '' };
    }
}

/* คนมักพิมพ์ www.xxx.go.th โดยไม่มี https:// ถ้าปล่อยไว้เบราว์เซอร์จะมองเป็นไฟล์ในเว็บนี้
   แต่ชื่อไฟล์อย่าง schedule.html ต้องคงไว้ตามเดิม */
function normalizeUrl(raw) {
    const url = String(raw || '').trim();
    if (!url || /^[a-z][a-z0-9+.-]*:/i.test(url) || /^[./]/.test(url)) return url;
    const looksLikeDomain = /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#]|$)/.test(url);
    const looksLikePage = /^[^/?#]*\.html?([?#]|$)/i.test(url);
    return looksLikeDomain && !looksLikePage ? `https://${url}` : url;
}

function safeImageSrc(raw) {
    const src = String(raw || '').trim();
    if (!src) return '';
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(src);
    if (!scheme) return src;
    const name = scheme[1].toLowerCase();
    if (name === 'http' || name === 'https') return src;
    if (name === 'data' && /^data:image\//i.test(src)) return src;
    return '';
}

/* ย่อรูปตราโรงเรียนก่อนเก็บ เอกสารสาธารณะจะได้เล็กและโหลดเร็ว */
async function shrinkImage(src, { revoke = false, max = 192 } = {}) {
    try {
        const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('โหลดรูปไม่ได้'));
            el.src = src;
        });
        const naturalW = img.naturalWidth || max;
        const naturalH = img.naturalHeight || max;
        const scale = Math.min(1, max / Math.max(naturalW, naturalH));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(naturalW * scale));
        canvas.height = Math.max(1, Math.round(naturalH * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const webp = canvas.toDataURL('image/webp', 0.92);
        return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
    } finally {
        if (revoke) URL.revokeObjectURL(src);
    }
}

/* ---------------------------------------------------------------------------
   ทำความสะอาดข้อมูลที่อ่านมา — เอกสารอาจถูกแก้มือในคอนโซล จึงไม่เชื่อรูปแบบเต็มร้อย
   --------------------------------------------------------------------------- */
function cleanLink(raw, audience) {
    if (!raw || typeof raw !== 'object' || !raw.id) return null;
    const title = String(raw.title || '').trim();
    const url = String(raw.url || '').trim();
    if (!title || !url) return null;
    return {
        id: String(raw.id),
        category: String(raw.category || ''),
        title,
        description: String(raw.description || '').trim(),
        url,
        icon: safeIcon(raw.icon),
        tone: TONE_SET.has(raw.tone) ? raw.tone : 'slate',
        login: !!raw.login,
        audience,
        order: Number.isFinite(raw.order) ? raw.order : 0
    };
}

function cleanPublic(raw) {
    const page = (raw && raw.page) || {};
    const links = Array.isArray(raw && raw.links) ? raw.links : [];
    const categories = Array.isArray(raw && raw.categories) ? raw.categories : [];
    return {
        page: {
            schoolName: String(page.schoolName || DEFAULT_PORTAL.page.schoolName),
            subtitle: String(page.subtitle ?? DEFAULT_PORTAL.page.subtitle),
            logo: typeof page.logo === 'string' ? page.logo : ''
        },
        categories: categories
            .filter(c => c && c.id && c.name)
            .map(c => ({ id: String(c.id), name: String(c.name), icon: safeIcon(c.icon, 'folder-open') })),
        links: links.map((l, i) => cleanLink({ order: i, ...l }, 'public')).filter(Boolean),
        staffLinkCount: Number(raw && raw.staffLinkCount) || 0,
        updatedAt: toMillis(raw && raw.updatedAt)
    };
}

/* ---------------------------------------------------------------------------
   สถานะของหน้า
   --------------------------------------------------------------------------- */
const state = {
    data: null,
    publicStatus: 'loading',   // loading | ready | missing | error
    publicError: '',
    staffLinks: [],
    staffStatus: 'idle',       // idle | loading | ready | error
    live: false,               // true เมื่อต่อ SDK แล้วรับข้อมูลสดแล้ว
    staffError: '',
    session: null,
    sessionKnown: false,
    teacherName: '',
    editing: false,
    query: '',
    category: 'all',
    pins: loadPins()
};

const signedIn = () => !!state.session;
const isAdmin = () => !!state.session && state.session.role === 'admin';
const dataReady = () => state.publicStatus === 'ready' || state.publicStatus === 'missing';
/* แก้ได้เฉพาะตอนอ่านครบทั้งสองเอกสารแล้ว ไม่งั้นการบันทึกจะเขียนทับลิงก์ที่ยังโหลดไม่มา */
const canEdit = () => isAdmin() && dataReady() && state.staffStatus === 'ready';

function visibleLinks() {
    const links = [...(state.data ? state.data.links : []), ...(signedIn() ? state.staffLinks : [])];
    return links.sort((a, b) => a.order - b.order);
}

function displayName() {
    const s = state.session;
    if (!s) return '';
    if (s.role === 'admin') return s.displayName || 'ผู้ดูแลระบบสูงสุด';
    return s.displayName || state.teacherName || 'ครูผู้สอน';
}

/* ---------------------------------------------------------------------------
   ปักหมุด — เก็บในเครื่องของแต่ละคน ไม่ขึ้นคลาวด์
   --------------------------------------------------------------------------- */
function loadPins() {
    const pins = readJSON(PINS_KEY, []);
    return Array.isArray(pins) ? pins.map(String) : [];
}

function togglePin(link) {
    const pinned = state.pins.includes(link.id);
    state.pins = pinned ? state.pins.filter(id => id !== link.id) : [...state.pins, link.id];
    writeJSON(PINS_KEY, state.pins);
    withViewTransition(render);
    announce(pinned ? `เลิกปักหมุด ${link.title} แล้ว` : `ปักหมุด ${link.title} ไว้ด้านบนแล้ว`);
}

/* ---------------------------------------------------------------------------
   ค้นหา — ตัดช่องว่างและจุดทิ้งก่อนเทียบ พิมพ์ "ปพ1" ก็เจอ "ปพ.1"
   --------------------------------------------------------------------------- */
const normalize = (s) => String(s || '').toLowerCase().replace(/[\s.\-_/()]+/g, '');

const searchTerms = () => state.query.split(/\s+/).map(normalize).filter(Boolean);

function matchesSearch(link, terms, categoryName) {
    if (!terms.length) return true;
    const host = describeHref(safeHref(link.url)).host;
    const haystack = normalize([link.title, link.description, link.url, host, categoryName].join(' '));
    return terms.every(t => haystack.includes(t));
}

/* ---------------------------------------------------------------------------
   วาดหน้า
   --------------------------------------------------------------------------- */
/* เปลี่ยนหน้าจอแบบจางเข้าจางออก ถ้าเบราว์เซอร์รองรับ
   ถ้าไม่รองรับ หรือผู้ใช้ตั้งลดการเคลื่อนไหว ก็วาดใหม่ตามปกติ */
function withViewTransition(update) {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || !document.startViewTransition) {
        update();
        return;
    }
    const transition = document.startViewTransition(update);
    // แท็บถูกซ่อนหรือกดรัว ๆ เบราว์เซอร์จะยกเลิกภาพเปลี่ยนผ่าน (หน้าจอยังอัปเดตถูกต้อง)
    // ต้องรับ promise ไว้ ไม่งั้นจะโผล่เป็น error ค้างในคอนโซล
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
}

function render() {
    if (state.editing && !canEdit()) state.editing = false;
    const focusKey = document.activeElement && document.activeElement.dataset
        ? document.activeElement.dataset.key : '';
    renderBrand();
    renderTopbar();
    renderAdminbar();
    renderChips();
    renderNotices();
    renderSections();
    renderFooter();
    // ปุ่มที่เพิ่งกดถูกวาดใหม่ ย้ายโฟกัสกลับไปที่ตัวใหม่ คนใช้แป้นพิมพ์จะได้ไม่หลุดตำแหน่ง
    if (focusKey) {
        const again = document.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
        if (again && !again.disabled) again.focus();
    }
}

function renderBrand() {
    const page = state.data ? state.data.page : DEFAULT_PORTAL.page;
    $('brand-name').textContent = page.schoolName;
    $('brand-sub').textContent = page.subtitle;
    $('brand-sub').hidden = !page.subtitle;
    document.title = `ศูนย์รวมระบบ — ${page.schoolName}`;

    const crest = $('brand-crest');
    const src = safeImageSrc(page.logo);
    if (crest.dataset.src === src) return;
    crest.dataset.src = src;
    crest.classList.toggle('has-logo', !!src);
    if (!src) {
        crest.replaceChildren(icon('graduation-cap'));
        return;
    }
    const img = h('img', { src, alt: '' });
    img.addEventListener('error', () => {
        crest.classList.remove('has-logo');
        crest.replaceChildren(icon('graduation-cap'));
    }, { once: true });
    crest.replaceChildren(img);
}

function renderTopbar() {
    const dark = document.documentElement.classList.contains('dark-mode');
    const themeLabel = dark ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด';
    const items = [
        h('button', {
            class: 'btn btn--ghost btn--icon', type: 'button', title: themeLabel, 'aria-label': themeLabel,
            dataset: { key: 'theme' }, onclick: toggleTheme
        }, icon(dark ? 'sun' : 'moon'))
    ];

    if (isAdmin()) {
        items.push(h('button', {
            class: 'btn' + (state.editing ? ' btn--active' : ''), type: 'button',
            'aria-pressed': String(state.editing), 'aria-label': 'จัดการลิงก์',
            dataset: { key: 'edit-toggle' }, onclick: toggleEditing
        }, icon('pencil-simple'), h('span', { class: 'btn__label' }, 'จัดการลิงก์')));
    }

    if (state.session) {
        items.push(h('div', { class: 'user-chip', title: displayName() },
            h('span', { class: 'user-chip__text' },
                h('span', { class: 'user-chip__name' }, displayName()),
                h('span', { class: 'user-chip__role' }, isAdmin() ? 'Administrator' : 'ครูผู้สอน')),
            h('button', {
                class: 'btn btn--sm btn--ghost btn--icon', type: 'button',
                title: 'ออกจากระบบ', 'aria-label': 'ออกจากระบบ',
                dataset: { key: 'sign-out' }, onclick: signOut
            }, icon('sign-out'))));
    } else if (state.sessionKnown) {
        items.push(h('button', {
            class: 'btn btn--primary', type: 'button', 'aria-label': 'เข้าสู่ระบบ',
            dataset: { key: 'sign-in' }, onclick: () => openLogin()
        }, icon('sign-in'), h('span', { class: 'btn__label' }, 'เข้าสู่ระบบ')));
    }

    $('topbar-actions').replaceChildren(...items);
}

function renderAdminbar() {
    const bar = $('adminbar');
    bar.hidden = !state.editing;
    if (!state.editing) {
        bar.replaceChildren();
        return;
    }
    const tool = (iconName, label, onclick, key, extra = '') =>
        h('button', { class: `btn btn--sm ${extra}`, type: 'button', dataset: { key }, onclick }, icon(iconName), label);

    bar.replaceChildren(h('div', { class: 'adminbar__inner' },
        h('span', { class: 'adminbar__label' }, icon('pencil-simple'), 'โหมดจัดการ',
            h('small', null, 'บันทึกทันทีที่แก้ ทุกคนเห็นพร้อมกัน')),
        tool('plus', 'เพิ่มลิงก์', () => openLinkEditor(), 'bar-add-link'),
        tool('folder-simple-plus', 'เพิ่มหมวดหมู่', () => openCategoryEditor(), 'bar-add-category'),
        tool('gear-six', 'ตั้งค่าหน้า', openPageEditor, 'bar-page'),
        tool('check', 'เสร็จสิ้น', toggleEditing, 'bar-done', 'btn--primary')));
}

function renderChips() {
    const host = $('chips');
    const links = visibleLinks();
    const categories = (state.data ? state.data.categories : [])
        .map(c => ({ ...c, count: links.filter(l => l.category === c.id).length }))
        .filter(c => c.count > 0 || state.editing);

    if (state.category !== 'all' && !categories.some(c => c.id === state.category)) state.category = 'all';
    if (categories.length < 2) {
        host.hidden = true;
        host.replaceChildren();
        return;
    }

    const chip = (id, name, count, iconName) => h('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(state.category === id),
        dataset: { key: `chip-${id}` },
        onclick: () => withViewTransition(() => { state.category = id; render(); })
    }, iconName ? icon(iconName) : null, name, h('span', { class: 'chip__count' }, String(count)));

    host.hidden = false;
    host.replaceChildren(
        chip('all', 'ทั้งหมด', links.length),
        ...categories.map(c => chip(c.id, c.name, c.count, c.icon)));
}

function renderNotices() {
    const items = [];
    const notice = (kind, iconName, text, action) =>
        h('div', { class: `notice${kind ? ' notice--' + kind : ''}` }, icon(iconName),
            h('div', { class: 'notice__text' }, text), action || null);

    if (isAdmin() && (state.publicStatus === 'error' || state.staffStatus === 'error')) {
        const code = state.publicStatus === 'error' ? state.publicError : state.staffError;
        items.push(notice('warn', 'warning',
            [h('strong', null, 'อ่านรายการลิงก์จากฐานข้อมูลไม่ได้'), code ? ` (${code}) ` : ' ',
             'ถ้าเพิ่งติดตั้งหน้านี้ ต้อง deploy กฎความปลอดภัยชุดใหม่ก่อน ',
             h('code', null, 'firebase deploy --only firestore:rules')]));
    } else if (state.editing && state.publicStatus === 'missing') {
        items.push(notice('', 'info',
            [h('strong', null, 'ตอนนี้เป็นรายการเริ่มต้น'),
             ' ยังไม่เคยบันทึกลงฐานข้อมูล การแก้ไขครั้งแรกจะบันทึกรายการทั้งหมดให้เอง']));
    }

    const hiddenForStaff = state.data ? state.data.staffLinkCount : 0;
    if (state.sessionKnown && !signedIn() && hiddenForStaff > 0) {
        items.push(notice('', 'lock-simple',
            [h('strong', null, `มีลิงก์สำหรับครูและบุคลากรอีก ${hiddenForStaff} รายการ`), ' เข้าสู่ระบบเพื่อดูลิงก์ภายใน'],
            h('button', { class: 'btn btn--sm', type: 'button', onclick: () => openLogin() }, 'เข้าสู่ระบบ')));
    }

    $('notices').replaceChildren(...items);
}

function renderSections() {
    const main = $('portal-main');
    if (!state.data) {
        main.replaceChildren(skeletonView());
        return;
    }

    const terms = searchTerms();
    const links = visibleLinks();
    const categories = state.data.categories;
    const categoryName = new Map(categories.map(c => [c.id, c.name]));
    const found = links.filter(l => matchesSearch(l, terms, categoryName.get(l.category)));
    const out = [];
    let shown = 0;

    if (!terms.length && state.category === 'all' && !state.editing) {
        const pinned = state.pins.map(id => links.find(l => l.id === id)).filter(Boolean);
        if (pinned.length) out.push(sectionView({ id: 'pinned', name: 'ปักหมุดไว้', icon: 'push-pin' }, pinned, { pinned: true }));
    }

    categories.forEach((cat, index) => {
        if (state.category !== 'all' && state.category !== cat.id) return;
        const items = found.filter(l => l.category === cat.id);
        // ตอนจัดการให้เห็นหมวดว่างด้วย จะได้กดเพิ่มลิงก์ลงไปได้
        if (!items.length && !(state.editing && !terms.length)) return;
        shown += items.length;
        out.push(sectionView(cat, items, { index, total: categories.length }));
    });

    // ลิงก์ที่หมวดหมู่หายไปแล้ว ยังต้องแสดง ไม่งั้นจะหาไม่เจอและแก้ไม่ได้
    const orphans = found.filter(l => !categoryName.has(l.category));
    if (orphans.length && state.category === 'all') {
        shown += orphans.length;
        out.push(sectionView({ id: 'other', name: 'อื่น ๆ', icon: 'link' }, orphans, { orphan: true }));
    }

    if (state.editing && !terms.length && !categories.length) out.push(emptyView('no-categories'));
    else if (!shown && !(state.editing && !terms.length)) out.push(emptyView(terms.length ? 'search' : 'none'));

    main.replaceChildren(...out);
    if (terms.length) announce(shown ? `พบ ${shown} รายการ` : 'ไม่พบรายการที่ค้นหา');
}

function sectionView(cat, items, opts = {}) {
    const headingId = `section-${cat.id}`;
    const editable = state.editing && !opts.pinned && !opts.orphan;

    const head = h('div', { class: 'section__head' },
        icon(opts.pinned ? 'push-pin' : safeIcon(cat.icon, 'folder-open'), 'section__icon'),
        h('h2', { class: 'section__title', id: headingId }, cat.name),
        h('span', { class: 'section__count', 'aria-label': `${items.length} รายการ` }, String(items.length)),
        editable ? h('div', { class: 'section__tools' },
            toolButton('pencil-simple', `แก้ไขหมวด ${cat.name}`, () => openCategoryEditor(cat), `cat-edit-${cat.id}`),
            toolButton('arrow-up', `เลื่อนหมวด ${cat.name} ขึ้น`, () => moveCategory(cat.id, -1), `cat-up-${cat.id}`, { disabled: opts.index === 0 }),
            toolButton('arrow-down', `เลื่อนหมวด ${cat.name} ลง`, () => moveCategory(cat.id, 1), `cat-down-${cat.id}`, { disabled: opts.index === opts.total - 1 }),
            toolButton('trash', `ลบหมวด ${cat.name}`, () => deleteCategory(cat), `cat-delete-${cat.id}`, { danger: true })
        ) : null);

    const grid = h('div', { class: 'grid' },
        items.map((link, index) => tileView(link, { index, count: items.length, pinnedSection: opts.pinned })));
    if (editable) {
        grid.append(h('button', {
            class: 'add-tile', type: 'button', dataset: { key: `add-${cat.id}` },
            onclick: () => openLinkEditor(null, cat.id)
        }, icon('plus'), 'เพิ่มลิงก์ในหมวดนี้'));
    }

    return h('section', { class: 'section' + (opts.pinned ? ' section--pinned' : ''), 'aria-labelledby': headingId }, head, grid);
}

function toolButton(iconName, label, onclick, key, { disabled = false, danger = false } = {}) {
    return h('button', {
        class: `btn btn--sm btn--icon ${danger ? 'btn--danger' : 'btn--ghost'}`, type: 'button',
        title: label, 'aria-label': label, disabled, dataset: { key }, onclick
    }, icon(iconName));
}

function cardContent(link) {
    const href = safeHref(link.url);
    const { external, host } = href ? describeHref(href) : { external: false, host: '' };
    const tags = [];
    if (link.login) tags.push(h('span', { class: 'tag' }, icon('lock-simple'), 'ต้องเข้าสู่ระบบ'));
    if (link.audience === 'staff') tags.push(h('span', { class: 'tag tag--staff' }, icon('users-three'), 'เฉพาะบุคลากร'));
    if (host) tags.push(h('span', { class: 'tag' }, icon('globe'), host));

    return [
        h('span', { class: 'card__icon' }, icon(safeIcon(link.icon))),
        h('span', { class: 'card__body' },
            h('span', { class: 'card__title' }, link.title,
                external ? icon('arrow-up-right', 'card__ext') : null,
                external ? h('span', { class: 'sr-only' }, ' (เปิดในแท็บใหม่)') : null),
            link.description ? h('span', { class: 'card__desc' }, link.description) : null,
            tags.length ? h('span', { class: 'card__tags' }, tags) : null)
    ];
}

function tileView(link, opts = {}) {
    if (state.editing) {
        return h('div', { class: 'tile tile--edit', dataset: { tone: link.tone } },
            h('button', {
                class: 'card', type: 'button', 'aria-label': `แก้ไข ${link.title}`,
                dataset: { key: `card-edit-${link.id}` }, onclick: () => openLinkEditor(link)
            }, cardContent(link)),
            h('div', { class: 'tile__tools' },
                toolButton('arrow-left', `เลื่อน ${link.title} ไปก่อนหน้า`, () => moveLink(link.id, -1), `left-${link.id}`, { disabled: opts.index === 0 }),
                toolButton('arrow-right', `เลื่อน ${link.title} ไปถัดไป`, () => moveLink(link.id, 1), `right-${link.id}`, { disabled: opts.index === opts.count - 1 }),
                toolButton('pencil-simple', `แก้ไข ${link.title}`, () => openLinkEditor(link), `edit-${link.id}`),
                toolButton('trash', `ลบ ${link.title}`, () => deleteLink(link), `delete-${link.id}`, { danger: true })));
    }

    const href = safeHref(link.url);
    const { external } = href ? describeHref(href) : { external: false };
    const scope = opts.pinnedSection ? 'pinned' : 'card';
    const pinned = state.pins.includes(link.id);

    const card = href
        ? h('a', {
            class: 'card', href, dataset: { key: `${scope}-${link.id}` },
            target: external ? '_blank' : null, rel: external ? 'noopener noreferrer' : null
        }, cardContent(link))
        : h('div', { class: 'card card--static' }, cardContent(link));

    return h('div', { class: 'tile', dataset: { tone: link.tone } }, card,
        h('button', {
            class: 'card__pin', type: 'button', 'aria-pressed': String(pinned),
            'aria-label': `${pinned ? 'เลิกปักหมุด' : 'ปักหมุด'} ${link.title}`,
            title: pinned ? 'เลิกปักหมุด' : 'ปักหมุดไว้ด้านบน',
            dataset: { key: `${scope}-pin-${link.id}` }, onclick: () => togglePin(link)
        }, icon('push-pin')));
}

function skeletonView() {
    return h('div', { 'aria-hidden': 'true' },
        h('div', { class: 'skeleton-title' }),
        h('div', { class: 'grid' }, Array.from({ length: 6 }, () => h('div', { class: 'skeleton' }))));
}

function emptyView(kind) {
    if (kind === 'search') {
        return h('div', { class: 'empty' }, icon('magnifying-glass'),
            h('p', { class: 'empty__title' }, 'ไม่พบระบบที่ค้นหา'),
            h('p', null, 'ลองใช้คำอื่น หรือดูรายการทั้งหมด'),
            h('button', { class: 'btn', type: 'button', onclick: clearSearch }, icon('eraser'), 'ล้างคำค้นหา'));
    }
    if (kind === 'no-categories') {
        return h('div', { class: 'empty' }, icon('folder-simple-plus'),
            h('p', { class: 'empty__title' }, 'ยังไม่มีหมวดหมู่'),
            h('p', null, 'สร้างหมวดหมู่ก่อน แล้วค่อยเพิ่มลิงก์ลงไป'),
            h('button', { class: 'btn btn--primary', type: 'button', onclick: () => openCategoryEditor() }, icon('plus'), 'เพิ่มหมวดหมู่'));
    }
    return h('div', { class: 'empty' }, icon('squares-four'),
        h('p', { class: 'empty__title' }, 'ยังไม่มีลิงก์'),
        h('p', null, isAdmin() ? 'กด "จัดการลิงก์" ด้านบนเพื่อเพิ่มระบบแรกของโรงเรียน' : 'ผู้ดูแลระบบยังไม่ได้เพิ่มลิงก์'));
}

function renderFooter() {
    const page = state.data ? state.data.page : DEFAULT_PORTAL.page;
    const updated = state.data ? state.data.updatedAt : 0;
    const parts = [h('span', null, `${page.schoolName} · ศูนย์รวมระบบโรงเรียน`)];
    if (updated) parts.push(h('span', null, `ปรับปรุงรายการล่าสุด ${shortDate.format(new Date(updated))}`));
    $('foot').replaceChildren(...parts);
}

let announceTimer = 0;
function announce(text) {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => { $('live-region').textContent = text; }, 450);
}

function toast(message, kind = 'info') {
    const icons = { ok: 'check-circle', error: 'warning-circle', warn: 'warning', info: 'info' };
    const el = h('div', { class: `toast toast--${kind}` }, icon(icons[kind] || 'info'), h('span', null, message));
    $('toast-host').append(el);
    setTimeout(() => {
        el.classList.add('is-leaving');
        setTimeout(() => el.remove(), 250);
    }, kind === 'error' ? 5200 : 2800);
}

/* ---------------------------------------------------------------------------
   กล่องโต้ตอบ (ใช้ <dialog> ของเบราว์เซอร์ ได้การกัน focus และปุ่ม Esc มาฟรี)
   --------------------------------------------------------------------------- */
function openDialog({ title, size = '', form = false, onClose = null }) {
    const titleId = newId('dlg');
    const dlg = h('dialog', { class: `dlg${size ? ' dlg--' + size : ''}`, 'aria-labelledby': titleId });
    const body = h('div', { class: 'dlg__body' });
    const foot = h('div', { class: 'dlg__foot' });
    // ปิดและเก็บกวาดทันที ไม่รออีเวนต์ close ของเบราว์เซอร์ ซึ่งบางครั้งมาช้าหรือไม่มาเลยตอนแท็บไม่ได้แสดงผล
    let closed = false;
    const close = () => {
        if (closed) return;
        closed = true;
        if (dlg.open) dlg.close();
        dlg.remove();
        if (onClose) onClose();
    };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    dlg.addEventListener('close', close);
    const panel = h(form ? 'form' : 'div', { class: 'dlg__panel', novalidate: form },
        h('div', { class: 'dlg__head' },
            h('h2', { class: 'dlg__title', id: titleId }, title),
            h('button', { class: 'btn btn--ghost btn--icon', type: 'button', 'aria-label': 'ปิด', onclick: close }, icon('x'))),
        body, foot);
    dlg.append(panel);
    // กดพื้นหลังเพื่อปิดได้เฉพาะกล่องที่ไม่มีฟอร์ม กันพิมพ์มาเยอะแล้วหายเพราะกดพลาด
    if (!form) dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    document.body.append(dlg);
    return { dlg, panel, body, foot, close, open: () => dlg.showModal() };
}

function confirmDialog({ title, message, confirmText = 'ยืนยัน', danger = false }) {
    return new Promise((resolve) => {
        let confirmed = false;
        const d = openDialog({ title, size: 'sm', onClose: () => resolve(confirmed) });
        d.body.append(h('p', { class: 'dlg__message' }, message));
        d.foot.append(
            h('span', { class: 'spacer' }),
            h('button', { class: 'btn', type: 'button', autofocus: true, onclick: d.close }, 'ยกเลิก'),
            h('button', {
                class: `btn ${danger ? 'btn--danger-solid' : 'btn--primary'}`, type: 'button',
                onclick: () => { confirmed = true; d.close(); }
            }, confirmText));
        d.open();
    });
}

function field(label, control, { required = false, hint = '' } = {}) {
    if (!control.id) control.id = newId('f');
    if (required) control.setAttribute('aria-required', 'true');
    const hintId = hint ? `${control.id}-hint` : '';
    if (hintId) control.setAttribute('aria-describedby', hintId);
    return h('div', { class: 'field' },
        h('label', { class: 'field__label', for: control.id }, label,
            required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
        control,
        hint ? h('span', { class: 'field__hint', id: hintId }, hint) : null);
}

const fieldGroup = (legend, control) =>
    h('fieldset', { class: 'field' }, h('legend', { class: 'field__label' }, legend), control);

function iconPicker(name, selected) {
    return h('div', { class: 'icon-grid' }, ICONS.map(n =>
        h('label', { class: 'icon-opt', title: n },
            h('input', { type: 'radio', name, value: n, checked: n === selected, 'aria-label': n }),
            h('span', null, icon(n)))));
}

function tonePicker(name, selected) {
    return h('div', { class: 'swatches' }, TONES.map(t =>
        h('label', { class: 'swatch', title: TONE_NAMES[t], dataset: { tone: t } },
            h('input', { type: 'radio', name, value: t, checked: t === selected, 'aria-label': TONE_NAMES[t] }),
            h('span'))));
}

function optionCard(name, value, checked, iconName, title, description) {
    return h('label', { class: 'option' },
        h('input', { type: 'radio', name, value, checked }),
        h('span', { class: 'option__box' }, icon(iconName),
            h('span', null,
                h('span', { class: 'option__title' }, title),
                h('span', { class: 'option__desc' }, description))));
}

/* เลื่อนรายการไอคอนไปที่ตัวที่เลือกอยู่ โดยไม่ให้ทั้งกล่องเลื่อนตาม */
function revealSelectedIcon(form) {
    const grid = form.querySelector('.icon-grid');
    const picked = grid && grid.querySelector('input:checked');
    if (picked) grid.scrollTop = picked.parentElement.offsetTop - grid.offsetTop - 8;
}

function showFormError(box, message, control) {
    box.replaceChildren(icon('warning-circle'), h('span', null, message));
    box.hidden = false;
    if (control) {
        control.setAttribute('aria-invalid', 'true');
        control.focus();
        control.addEventListener('input', () => control.removeAttribute('aria-invalid'), { once: true });
    }
}

/* ---------------------------------------------------------------------------
   บันทึก — เขียนสองเอกสารพร้อมกันใน batch เดียว สำเร็จหรือล้มเหลวไปด้วยกัน
   --------------------------------------------------------------------------- */
function currentModel() {
    return {
        page: { ...state.data.page },
        categories: state.data.categories.map(c => ({ ...c })),
        links: visibleLinks().map(l => ({ ...l }))
    };
}

function saveErrorText(err) {
    const code = err && err.code;
    if (code === 'permission-denied') return 'ไม่มีสิทธิ์บันทึก ตรวจว่า deploy กฎ firestore.rules ชุดใหม่แล้ว';
    if (code === 'unavailable') return 'เชื่อมต่อฐานข้อมูลไม่ได้ ลองใหม่อีกครั้ง';
    return 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง';
}

async function persist(next, successMessage) {
    const before = { data: state.data, staffLinks: state.staffLinks };
    const ordered = next.links.map((link, order) => ({ ...link, order }));
    const publicLinks = ordered.filter(l => l.audience !== 'staff');
    const staffLinks = ordered.filter(l => l.audience === 'staff');
    const stored = ({ audience, ...rest }) => rest;

    // แสดงผลทันทีไม่ต้องรอเน็ต ถ้าบันทึกไม่ผ่านจะย้อนกลับให้
    state.data = { ...state.data, page: next.page, categories: next.categories, links: publicLinks, staffLinkCount: staffLinks.length };
    state.staffLinks = staffLinks;
    render();

    try {
        const api = await loadCloud();
        const batch = api.writeBatch(api.db);
        batch.set(api.publicRef, {
            version: 1,
            page: next.page,
            categories: next.categories,
            links: publicLinks.map(stored),
            staffLinkCount: staffLinks.length,
            updatedAt: api.serverTimestamp(),
            updatedBy: displayName()
        });
        batch.set(api.staffRef, { links: staffLinks.map(stored), updatedAt: api.serverTimestamp() });
        await batch.commit();
        if (successMessage) toast(successMessage, 'ok');
        return true;
    } catch (err) {
        console.error('บันทึกรายการลิงก์ไม่สำเร็จ', err);
        state.data = before.data;
        state.staffLinks = before.staffLinks;
        render();
        toast(saveErrorText(err), 'error');
        return false;
    }
}

/* ---------------------------------------------------------------------------
   โหมดจัดการ
   --------------------------------------------------------------------------- */
function toggleEditing() {
    if (!state.editing && !canEdit()) {
        explainCannotEdit();
        return;
    }
    state.editing = !state.editing;
    withViewTransition(render);
    if (state.editing) toast('คลิกที่การ์ดเพื่อแก้ไข หรือใช้ปุ่มด้านล่างการ์ด', 'info');
}

function explainCannotEdit() {
    if (state.publicStatus === 'loading' || state.staffStatus === 'loading' || state.staffStatus === 'idle') {
        toast('กำลังโหลดรายการ รอสักครู่แล้วลองใหม่', 'info');
        return;
    }
    const code = state.publicStatus === 'error' ? state.publicError : state.staffError;
    const d = openDialog({ title: 'ยังแก้ไขรายการไม่ได้', size: 'sm' });
    d.body.append(
        h('p', { class: 'dlg__message' },
            'อ่านรายการลิงก์จากฐานข้อมูลไม่สำเร็จ', code ? ` (${code})` : '',
            ' จึงยังไม่ให้บันทึก เพื่อไม่ให้เขียนทับลิงก์ที่มีอยู่แล้ว'),
        h('p', { class: 'field__hint' },
            'ถ้าเพิ่งติดตั้งหน้านี้ ต้อง deploy กฎความปลอดภัยชุดใหม่ก่อน ด้วยคำสั่ง firebase deploy --only firestore:rules แล้วรีเฟรชหน้า'));
    d.foot.append(h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn--primary', type: 'button', autofocus: true, onclick: d.close }, 'เข้าใจแล้ว'));
    d.open();
}

function openLinkEditor(existing = null, presetCategory = '') {
    if (!canEdit()) return explainCannotEdit();
    const categories = state.data.categories;
    if (!categories.length) {
        toast('สร้างหมวดหมู่ก่อน แล้วจึงเพิ่มลิงก์', 'warn');
        openCategoryEditor();
        return;
    }

    const isNew = !existing;
    const fallbackCategory = categories.some(c => c.id === state.category) ? state.category : categories[0].id;
    const base = existing || {
        id: newId('l'), title: '', url: '', description: '',
        category: presetCategory || fallbackCategory,
        icon: 'link', tone: 'indigo', login: false, audience: 'public'
    };

    const d = openDialog({ title: isNew ? 'เพิ่มลิงก์' : 'แก้ไขลิงก์', form: true });
    const form = d.panel;
    const error = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const preview = h('div', { class: 'dlg__preview', 'aria-hidden': 'true' });

    const titleInput = h('input', { class: 'input', name: 'title', value: base.title, maxlength: 80, autocomplete: 'off', autofocus: true });
    const urlInput = h('input', { class: 'input', name: 'url', value: base.url, inputmode: 'url', autocomplete: 'off', spellcheck: 'false', placeholder: 'https://' });
    const descInput = h('textarea', { class: 'input', name: 'description', maxlength: 140, rows: 2 }, base.description);
    const categorySelect = h('select', { class: 'input', name: 'category' },
        categories.map(c => h('option', { value: c.id, selected: c.id === base.category }, c.name)));

    d.body.append(
        preview,
        error,
        field('ชื่อที่แสดง', titleInput, { required: true }),
        field('ที่อยู่ลิงก์', urlInput, {
            required: true,
            hint: 'เว็บภายนอกขึ้นต้นด้วย https://  ส่วนระบบในเว็บนี้ใส่ชื่อไฟล์ได้เลย เช่น schedule.html'
        }),
        field('คำอธิบายสั้น ๆ', descInput, { hint: 'ไม่เกิน 140 ตัวอักษร' }),
        field('หมวดหมู่', categorySelect),
        fieldGroup('ใครเห็นลิงก์นี้', h('div', { class: 'options' },
            optionCard('audience', 'public', base.audience !== 'staff', 'globe', 'ทุกคน', 'แสดงให้ทุกคนที่เปิดหน้านี้'),
            optionCard('audience', 'staff', base.audience === 'staff', 'users-three', 'เฉพาะครูและบุคลากร', 'เห็นเมื่อเข้าสู่ระบบแล้วเท่านั้น'))),
        h('div', { class: 'field' },
            h('label', { class: 'check' },
                h('input', { type: 'checkbox', name: 'login', checked: base.login }),
                'ระบบนี้ต้องเข้าสู่ระบบก่อนใช้งาน (แสดงป้ายบนการ์ด)')),
        fieldGroup('ไอคอน', iconPicker('icon', base.icon)),
        fieldGroup('สี', tonePicker('tone', base.tone)));

    const submit = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('check'), isNew ? 'เพิ่มลิงก์' : 'บันทึก');
    if (!isNew) {
        d.foot.append(h('button', {
            class: 'btn btn--danger', type: 'button',
            onclick: () => { d.close(); deleteLink(existing); }
        }, icon('trash'), 'ลบ'));
    }
    d.foot.append(
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', onclick: d.close }, 'ยกเลิก'),
        submit);

    const readForm = () => {
        const f = form.elements;
        return {
            ...base,
            title: f.title.value.trim(),
            url: normalizeUrl(f.url.value),
            description: f.description.value.trim(),
            category: f.category.value,
            audience: f.audience.value === 'staff' ? 'staff' : 'public',
            login: f.login.checked,
            icon: safeIcon(f.icon.value),
            tone: TONE_SET.has(f.tone.value) ? f.tone.value : 'indigo'
        };
    };

    const paintPreview = () => {
        const draft = readForm();
        preview.replaceChildren(
            h('span', { class: 'dlg__preview-label' }, 'ตัวอย่างการ์ด'),
            h('div', { class: 'tile', dataset: { tone: draft.tone } },
                h('div', { class: 'card card--static' },
                    cardContent({ ...draft, title: draft.title || 'ชื่อที่แสดง' }))));
    };
    form.addEventListener('input', paintPreview);
    form.addEventListener('change', paintPreview);
    paintPreview();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        error.hidden = true;
        const draft = readForm();
        if (!draft.title) return showFormError(error, 'กรุณาใส่ชื่อที่แสดง', titleInput);
        if (!draft.url) return showFormError(error, 'กรุณาใส่ที่อยู่ลิงก์', urlInput);
        if (!safeHref(draft.url)) return showFormError(error, 'ที่อยู่ลิงก์ต้องขึ้นต้นด้วย https:// หรือเป็นชื่อไฟล์ในเว็บนี้', urlInput);

        const next = currentModel();
        const index = next.links.findIndex(l => l.id === draft.id);
        if (index < 0) {
            next.links.push(draft);
        } else if (next.links[index].category !== draft.category) {
            // ย้ายหมวดแล้วให้ไปต่อท้ายหมวดใหม่ ไม่ไปแทรกกลางหมวดตามลำดับเดิม
            next.links.splice(index, 1);
            next.links.push(draft);
        } else {
            next.links[index] = draft;
        }

        submit.disabled = true;
        const ok = await persist(next, isNew ? 'เพิ่มลิงก์แล้ว' : 'บันทึกการแก้ไขแล้ว');
        if (ok) d.close();
        else submit.disabled = false;
    });

    d.open();
    revealSelectedIcon(form);
}

async function deleteLink(link) {
    const confirmed = await confirmDialog({
        title: 'ลบลิงก์',
        message: `ต้องการลบ "${link.title}" ออกจากหน้านี้ใช่ไหม`,
        confirmText: 'ลบลิงก์',
        danger: true
    });
    if (!confirmed || !canEdit()) return;
    const next = currentModel();
    next.links = next.links.filter(l => l.id !== link.id);
    persist(next, 'ลบลิงก์แล้ว');
}

function moveLink(id, direction) {
    if (!canEdit()) return;
    const next = currentModel();
    const from = next.links.findIndex(l => l.id === id);
    if (from < 0) return;
    const category = next.links[from].category;
    let to = from + direction;
    while (to >= 0 && to < next.links.length && next.links[to].category !== category) to += direction;
    if (to < 0 || to >= next.links.length) return;
    [next.links[from], next.links[to]] = [next.links[to], next.links[from]];
    persist(next);
}

function openCategoryEditor(existing = null) {
    if (!canEdit()) return explainCannotEdit();
    const isNew = !existing;
    const base = existing || { id: newId('c'), name: '', icon: 'folder-open' };

    const d = openDialog({ title: isNew ? 'เพิ่มหมวดหมู่' : 'แก้ไขหมวดหมู่', form: true });
    const form = d.panel;
    const error = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const nameInput = h('input', { class: 'input', name: 'name', value: base.name, maxlength: 60, autocomplete: 'off', autofocus: true, placeholder: 'เช่น งานวิชาการ งานกิจการนักเรียน' });

    d.body.append(error, field('ชื่อหมวดหมู่', nameInput, { required: true }), fieldGroup('ไอคอน', iconPicker('icon', base.icon)));
    const submit = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('check'), isNew ? 'เพิ่มหมวดหมู่' : 'บันทึก');
    d.foot.append(h('span', { class: 'spacer' }), h('button', { class: 'btn', type: 'button', onclick: d.close }, 'ยกเลิก'), submit);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        error.hidden = true;
        const name = nameInput.value.trim();
        if (!name) return showFormError(error, 'กรุณาใส่ชื่อหมวดหมู่', nameInput);
        const category = { id: base.id, name, icon: safeIcon(form.elements.icon.value, 'folder-open') };
        const next = currentModel();
        const index = next.categories.findIndex(c => c.id === category.id);
        if (index < 0) next.categories.push(category);
        else next.categories[index] = category;

        submit.disabled = true;
        const ok = await persist(next, isNew ? 'เพิ่มหมวดหมู่แล้ว' : 'บันทึกหมวดหมู่แล้ว');
        if (ok) d.close();
        else submit.disabled = false;
    });

    d.open();
    revealSelectedIcon(form);
}

async function deleteCategory(cat) {
    const inUse = visibleLinks().filter(l => l.category === cat.id).length;
    if (inUse) {
        toast(`หมวด "${cat.name}" ยังมีลิงก์อยู่ ${inUse} รายการ ย้ายไปหมวดอื่นหรือลบลิงก์ก่อน`, 'warn');
        return;
    }
    const confirmed = await confirmDialog({
        title: 'ลบหมวดหมู่',
        message: `ต้องการลบหมวด "${cat.name}" ใช่ไหม`,
        confirmText: 'ลบหมวดหมู่',
        danger: true
    });
    if (!confirmed || !canEdit()) return;
    const next = currentModel();
    next.categories = next.categories.filter(c => c.id !== cat.id);
    persist(next, 'ลบหมวดหมู่แล้ว');
}

function moveCategory(id, direction) {
    if (!canEdit()) return;
    const next = currentModel();
    const from = next.categories.findIndex(c => c.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= next.categories.length) return;
    [next.categories[from], next.categories[to]] = [next.categories[to], next.categories[from]];
    persist(next);
}

function openPageEditor() {
    if (!canEdit()) return explainCannotEdit();
    const page = state.data.page;
    let logo = page.logo;

    const d = openDialog({ title: 'ตั้งค่าหน้า', form: true });
    const form = d.panel;
    const error = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const nameInput = h('input', { class: 'input', name: 'schoolName', value: page.schoolName, maxlength: 80, autocomplete: 'off', autofocus: true });
    const subInput = h('input', { class: 'input', name: 'subtitle', value: page.subtitle, maxlength: 80, autocomplete: 'off' });

    const logoPreview = h('div', { class: 'logo-edit__preview' });
    const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
    const removeButton = h('button', { class: 'btn btn--sm btn--danger', type: 'button', onclick: () => { logo = ''; paintLogo(); } }, icon('trash'), 'เอาออก');
    const uploadButton = h('button', { class: 'btn btn--sm', type: 'button', onclick: () => fileInput.click() }, icon('upload-simple'), 'อัปโหลดรูป');
    const pullButton = h('button', { class: 'btn btn--sm', type: 'button', onclick: pullFromScoreSystem }, icon('arrow-clockwise'), 'ใช้ชื่อและตราจากระบบคะแนน');
    const submit = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('check'), 'บันทึก');

    // ระหว่างย่อรูปหรืออ่านจากระบบคะแนน ห้ามกดบันทึก ไม่งั้นจะบันทึกไปทั้งที่ยังไม่มีตรา
    const setBusy = (busy) => {
        submit.disabled = busy;
        uploadButton.disabled = busy;
        pullButton.disabled = busy;
    };

    function paintLogo() {
        const src = safeImageSrc(logo);
        logoPreview.replaceChildren(src ? h('img', { src, alt: 'ตัวอย่างตราโรงเรียน' }) : icon('graduation-cap'));
        removeButton.disabled = !logo;
    }

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast('กรุณาเลือกไฟล์รูปภาพ', 'warn');
            return;
        }
        setBusy(true);
        try {
            logo = await shrinkImage(URL.createObjectURL(file), { revoke: true });
            paintLogo();
        } catch (err) {
            console.warn('อ่านไฟล์รูปไม่ได้', err);
            toast('อ่านไฟล์รูปไม่ได้ ลองใช้ไฟล์ PNG หรือ JPG', 'error');
        } finally {
            setBusy(false);
        }
    });

    async function pullFromScoreSystem() {
        setBusy(true);
        try {
            const api = await loadCloud();
            const snap = await api.getDoc(api.coreRef);
            const info = (snap.exists() && snap.data().schoolInfo) || {};
            if (info.name) nameInput.value = info.name;
            if (info.logo) logo = String(info.logo).startsWith('data:') ? await shrinkImage(info.logo) : info.logo;
            paintLogo();
            if (info.name || info.logo) toast('ดึงข้อมูลจากระบบคะแนนแล้ว กดบันทึกเพื่อใช้งาน', 'ok');
            else toast('ระบบคะแนนยังไม่ได้ตั้งชื่อหรือตราโรงเรียน', 'warn');
        } catch (err) {
            console.warn('อ่านข้อมูลโรงเรียนจากระบบคะแนนไม่สำเร็จ', err);
            toast('อ่านข้อมูลจากระบบคะแนนไม่สำเร็จ', 'error');
        } finally {
            setBusy(false);
        }
    }

    d.body.append(
        error,
        field('ชื่อโรงเรียน', nameInput, { required: true }),
        field('ข้อความใต้ชื่อ', subInput, { hint: 'เว้นว่างได้ถ้าไม่ต้องการ' }),
        fieldGroup('ตราโรงเรียน', h('div', { class: 'logo-edit' }, logoPreview,
            h('div', { class: 'logo-edit__actions' }, uploadButton, pullButton, removeButton),
            fileInput)));

    d.foot.append(h('span', { class: 'spacer' }), h('button', { class: 'btn', type: 'button', onclick: d.close }, 'ยกเลิก'), submit);
    paintLogo();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        error.hidden = true;
        const schoolName = nameInput.value.trim();
        if (!schoolName) return showFormError(error, 'กรุณาใส่ชื่อโรงเรียน', nameInput);
        const next = currentModel();
        next.page = { schoolName, subtitle: subInput.value.trim(), logo: safeImageSrc(logo) };

        submit.disabled = true;
        const ok = await persist(next, 'บันทึกการตั้งค่าแล้ว');
        if (ok) d.close();
        else submit.disabled = false;
    });

    d.open();
}

/* ---------------------------------------------------------------------------
   เข้าและออกจากระบบ
   --------------------------------------------------------------------------- */
function openLogin() {
    const d = openDialog({ title: 'เข้าสู่ระบบ', size: 'sm', form: true });
    const form = d.panel;
    let role = 'teacher';

    const error = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const teacherSelect = h('select', { class: 'input', name: 'teacher', autocomplete: 'username', autofocus: true },
        h('option', { value: '' }, 'กำลังโหลดรายชื่อ...'));
    const teacherPassword = h('input', { class: 'input', type: 'password', name: 'teacherPassword', autocomplete: 'current-password' });
    const adminPassword = h('input', { class: 'input', type: 'password', name: 'adminPassword', autocomplete: 'current-password' });

    const paneIds = { teacher: newId('pane'), admin: newId('pane') };
    const tabIds = { teacher: newId('tab'), admin: newId('tab') };
    const teacherPane = h('div', { id: paneIds.teacher, role: 'tabpanel', 'aria-labelledby': tabIds.teacher },
        field('บัญชีผู้ใช้', teacherSelect), field('รหัสผ่าน', teacherPassword));
    const adminPane = h('div', { id: paneIds.admin, role: 'tabpanel', 'aria-labelledby': tabIds.admin, hidden: true },
        field('รหัสผ่านผู้ดูแลระบบ', adminPassword));

    const tab = (key, label) => h('button', {
        type: 'button', role: 'tab', id: tabIds[key], 'aria-controls': paneIds[key],
        'aria-selected': String(role === key), onclick: () => selectTab(key)
    }, label);
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'ประเภทผู้ใช้' }, tab('teacher', 'ครูผู้สอน'), tab('admin', 'ผู้ดูแลระบบ'));

    function selectTab(key) {
        role = key;
        tabs.querySelectorAll('[role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.id === tabIds[key])));
        teacherPane.hidden = key !== 'teacher';
        adminPane.hidden = key !== 'admin';
        error.hidden = true;
        (key === 'teacher' ? teacherSelect : adminPassword).focus();
    }

    d.body.append(tabs, error, teacherPane, adminPane,
        h('p', { class: 'field__hint' }, 'ใช้บัญชีเดียวกับระบบคะแนน เข้าสู่ระบบที่นี่แล้วเปิดระบบของโรงเรียนต่อได้เลยโดยไม่ต้องล็อกอินซ้ำ'));
    const submit = h('button', { class: 'btn btn--primary', type: 'submit' }, icon('sign-in'), 'เข้าสู่ระบบ');
    d.foot.append(h('span', { class: 'spacer' }), h('button', { class: 'btn', type: 'button', onclick: d.close }, 'ยกเลิก'), submit);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        error.hidden = true;
        if (role === 'admin') {
            if (!adminPassword.value) return showFormError(error, 'กรุณากรอกรหัสผ่าน', adminPassword);
        } else {
            if (!teacherSelect.value) return showFormError(error, 'กรุณาเลือกบัญชีผู้ใช้', teacherSelect);
            if (!teacherPassword.value) return showFormError(error, 'กรุณากรอกรหัสผ่าน', teacherPassword);
        }
        submit.disabled = true;
        try {
            const api = await loadCloud();
            if (role === 'admin') await api.signInAdmin(adminPassword.value);
            else await api.signInTeacher(teacherSelect.value, teacherPassword.value);
            try { sessionStorage.setItem(LOGIN_RECORD_KEY, '1'); } catch { /* ไม่มีผลกับการล็อกอิน */ }
            d.close();
            toast('เข้าสู่ระบบแล้ว', 'ok');
        } catch (err) {
            showFormError(error, authErrorText(err), role === 'admin' ? adminPassword : teacherPassword);
            submit.disabled = false;
        }
    });

    d.open();
    // โหลดส่วนยืนยันตัวตนไว้เบื้องหลังระหว่างที่ผู้ใช้กรอกฟอร์ม กดแล้วจะได้ไม่ต้องรอ
    loadCloud().catch(() => { /* ถ้าโหลดไม่ได้ จะแจ้งตอนกดเข้าสู่ระบบ */ });

    fetchTeacherDirectory().then((teachers) => {
        const keep = teacherSelect.value;
        teacherSelect.replaceChildren(
            h('option', { value: '' }, teachers.length ? '-- เลือกบัญชีของคุณ --' : 'โหลดรายชื่อครูไม่สำเร็จ'),
            ...teachers.map(t => h('option', { value: t.id }, t.name)));
        if (keep) teacherSelect.value = keep;
    });
}

async function signOut() {
    try {
        const api = await loadCloud();
        await api.signOutNow();
        toast('ออกจากระบบแล้ว', 'ok');
    } catch (err) {
        console.warn('ออกจากระบบไม่สำเร็จ', err);
        toast('ออกจากระบบไม่สำเร็จ', 'error');
    }
    try { sessionStorage.removeItem(LOGIN_RECORD_KEY); } catch { /* ข้ามได้ */ }
}

async function resolveTeacherName(teacherId) {
    const teachers = await fetchTeacherDirectory();
    const found = teachers.find(t => String(t.id) === String(teacherId));
    if (found && state.session && state.session.teacherId === teacherId) {
        state.teacherName = found.name;
        renderTopbar();
    }
}

/* ---------------------------------------------------------------------------
   ธีมและการค้นหา
   --------------------------------------------------------------------------- */
function toggleTheme() {
    const dark = !document.documentElement.classList.contains('dark-mode');
    document.documentElement.classList.toggle('dark-mode', dark);
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* ข้ามได้ */ }
    const bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.content = dark ? '#0b1020' : '#f4f6fb';
    render();
}

const searchInput = $('search-input');

function clearSearch() {
    searchInput.value = '';
    state.query = '';
    state.category = 'all';
    render();
    searchInput.focus();
}

searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    renderSections();
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchInput.value) {
        e.preventDefault();
        clearSearch();
    } else if (e.key === 'Enter' && state.query.trim()) {
        // พิมพ์แล้วกด Enter เปิดผลลัพธ์แรกได้เลย
        const first = document.querySelector('#portal-main a.card');
        if (first) {
            e.preventDefault();
            first.click();
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
});

/* ---------------------------------------------------------------------------
   ชั้นข้อมูล — อ่านด้วย REST ก่อน แล้วค่อยต่อ Firebase SDK เมื่อจำเป็น
   --------------------------------------------------------------------------- */
const REST_ROOT = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
/* เน็ตค้างหรือเจอหน้าล็อกอิน อย่าให้คำขอค้างไปตลอด */
const timeoutSignal = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

const restUrl = (path) => `${REST_ROOT}/${path}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;

/* REST ส่งค่ามาพร้อมชนิดกำกับ เช่น { stringValue: "..." } แปลงกลับเป็นค่าธรรมดาก่อนใช้
   กฎใน firestore.rules คุมสิทธิ์ทาง REST เหมือนกับที่คุม SDK ทุกประการ */
function restValue(value) {
    if (!value || typeof value !== 'object') return null;
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('booleanValue' in value) return value.booleanValue === true;
    if ('timestampValue' in value) return Date.parse(value.timestampValue) || 0;
    if ('mapValue' in value) return restFields(value.mapValue.fields);
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(restValue);
    return null;
}

const restFields = (fields) =>
    Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, restValue(value)]));

let teacherDirectory = null;
async function fetchTeacherDirectory() {
    if (teacherDirectory) return teacherDirectory;
    try {
        const res = await fetch(restUrl('anpscore/public_directory'), { headers: { Accept: 'application/json' }, signal: timeoutSignal(8000) });
        if (!res.ok) return [];
        const data = restFields((await res.json()).fields);
        const list = Array.isArray(data.teachers) ? data.teachers : [];
        teacherDirectory = list
            .filter(t => t && t.id && t.name)
            .map(t => ({ id: String(t.id), name: String(t.name) }));
        return teacherDirectory;
    } catch (err) {
        console.warn('อ่านรายชื่อครูไม่สำเร็จ', err);
        return [];
    }
}

let lastRestAt = 0;
async function refreshOverRest(force = false) {
    if (state.live) return;                                  // ต่อ SDK แล้ว ข้อมูลสดกว่า REST
    if (!force && Date.now() - lastRestAt < 30000) return;   // สลับแท็บไปมาถี่ ๆ ไม่ต้องยิงซ้ำ
    lastRestAt = Date.now();
    try {
        const res = await fetch(restUrl('anpscore/portal_public'), { headers: { Accept: 'application/json' }, signal: timeoutSignal(8000) });
        if (state.live) return;
        if (res.status === 404) {
            // ยังไม่เคยบันทึกรายการ ใช้รายการเริ่มต้นไปก่อน
            state.data = cleanPublic(DEFAULT_PORTAL);
            state.publicStatus = 'missing';
            try { localStorage.removeItem(CACHE_KEY); } catch { /* ข้ามได้ */ }
        } else if (!res.ok) {
            const code = res.status === 403 ? 'permission-denied' : `http-${res.status}`;
            throw Object.assign(new Error(code), { code });
        } else {
            const raw = restFields((await res.json()).fields);
            state.data = cleanPublic(raw);
            state.publicStatus = 'ready';
            writeJSON(CACHE_KEY, raw);
        }
        state.publicError = '';
    } catch (err) {
        console.warn('อ่านรายการลิงก์ไม่สำเร็จ', err);
        state.publicStatus = 'error';
        state.publicError = (err && err.code) || '';
        if (!state.data) state.data = cleanPublic(DEFAULT_PORTAL);
    }
    render();
}

/* Firebase Auth เก็บสถานะล็อกอินไว้ใน sessionStorage (อายุผูกกับแท็บ)
   ถ้าเจอร่องรอย แปลว่าน่าจะมีคนล็อกอินอยู่ เช่นเดินมาจากระบบคะแนน จึงต่อ SDK ให้เลย
   ถ้าคีย์เปลี่ยนรูปแบบในอนาคต อย่างมากคือผู้ใช้ต้องกดเข้าสู่ระบบเอง ไม่ได้พัง */
function hasStoredAuthSession() {
    try {
        // ดูเฉพาะ sessionStorage เพราะ auth/session.js ตั้งอายุการล็อกอินไว้แค่ระดับแท็บ
        // ถ้าไล่ไปอ่าน localStorage ด้วย กุญแจเก่าค้างจะทำให้เครื่องส่วนกลางโหลด SDK ทิ้งโดยไม่จำเป็น
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('firebase:authUser:')) return true;
        }
    } catch { /* เบราว์เซอร์ปิดที่เก็บข้อมูลไว้ */ }
    return false;
}

const whenIdle = (fn) =>
    (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));

let cloudApi = null;
let cloudPromise = null;

/* โหลด Firebase SDK กับชั้นยืนยันตัวตนครั้งเดียว แล้วเปิดการอัปเดตแบบสด */
function loadCloud() {
    if (!cloudPromise) {
        cloudPromise = (async () => {
            const [session, store] = await Promise.all([
                import('../auth/session.js'),
                import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
            ]);
            cloudApi = {
                db: session.db,
                signInTeacher: session.signInTeacher,
                signInAdmin: session.signInAdmin,
                signOutNow: session.signOutNow,
                describeAuthError: session.describeAuthError,
                getDoc: store.getDoc,
                onSnapshot: store.onSnapshot,
                writeBatch: store.writeBatch,
                serverTimestamp: store.serverTimestamp,
                publicRef: store.doc(session.db, 'anpscore', 'portal_public'),
                staffRef: store.doc(session.db, 'anpscore', 'portal_staff'),
                coreRef: store.doc(session.db, 'anpscore', 'core_db')
            };
            watchPublicLinks();
            session.onSession(handleSession);
            return cloudApi;
        })();
        // โหลดไม่สำเร็จก็ให้ลองใหม่ได้ในครั้งถัดไป ไม่ต้องรีเฟรชหน้า
        cloudPromise.catch((err) => {
            console.warn('โหลดส่วนเชื่อมต่อฐานข้อมูลไม่สำเร็จ', err);
            cloudPromise = null;
        });
    }
    return cloudPromise;
}

function authErrorText(err) {
    if (cloudApi) return cloudApi.describeAuthError(err);
    return 'เชื่อมต่อระบบยืนยันตัวตนไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่';
}

/* ติดตามรายการลิงก์แบบสด ผู้ดูแลระบบแก้เมื่อไร เครื่องที่เปิดหน้านี้ค้างไว้เห็นทันที */
function watchPublicLinks() {
    cloudApi.onSnapshot(cloudApi.publicRef, (snap) => {
        state.live = true;
        if (snap.exists()) {
            const raw = snap.data({ serverTimestamps: 'estimate' });
            state.data = cleanPublic(raw);
            state.publicStatus = 'ready';
            writeJSON(CACHE_KEY, { ...raw, updatedAt: toMillis(raw.updatedAt) });
        } else {
            state.data = cleanPublic(DEFAULT_PORTAL);
            state.publicStatus = 'missing';
            try { localStorage.removeItem(CACHE_KEY); } catch { /* ข้ามได้ */ }
        }
        state.publicError = '';
        render();
    }, (err) => {
        console.warn('ติดตามรายการลิงก์แบบสดไม่สำเร็จ', err);
        state.live = false;
        // ถ้า REST อ่านมาได้ก่อนหน้านี้แล้ว ก็ใช้ของเดิมต่อ ไม่ต้องขึ้นข้อความผิดพลาด
        if (state.publicStatus !== 'ready' && state.publicStatus !== 'missing') {
            state.publicStatus = 'error';
            state.publicError = (err && err.code) || '';
        }
        render();
    });
}

let stopStaffWatch = null;

function watchStaffLinks() {
    if (stopStaffWatch || !cloudApi) return;
    state.staffStatus = 'loading';
    stopStaffWatch = cloudApi.onSnapshot(cloudApi.staffRef, (snap) => {
        const links = snap.exists() && Array.isArray(snap.data().links) ? snap.data().links : [];
        state.staffLinks = links.map(l => cleanLink(l, 'staff')).filter(Boolean);
        state.staffStatus = 'ready';
        state.staffError = '';
        render();
    }, (err) => {
        console.warn('อ่านลิงก์สำหรับบุคลากรไม่สำเร็จ', err);
        state.staffStatus = 'error';
        state.staffError = (err && err.code) || '';
        render();
    });
}

function unwatchStaffLinks() {
    if (stopStaffWatch) stopStaffWatch();
    stopStaffWatch = null;
    state.staffLinks = [];
    state.staffStatus = 'idle';
    state.staffError = '';
}

function handleSession(session) {
    state.session = session;
    state.sessionKnown = true;
    state.teacherName = '';
    if (session) {
        watchStaffLinks();
        if (session.role === 'teacher' && !session.displayName && session.teacherId) resolveTeacherName(session.teacherId);
    } else {
        unwatchStaffLinks();
        state.editing = false;
    }
    render();
}

/* ---------------------------------------------------------------------------
   เริ่มทำงาน
   --------------------------------------------------------------------------- */
$('hero-date').textContent = longDate.format(new Date());

// แสดงรายการครั้งก่อนจากเครื่องไปก่อน เปิดหน้าแล้วเห็นลิงก์ทันทีไม่ต้องรอเน็ต
const cached = readJSON(CACHE_KEY, null);
if (cached) state.data = cleanPublic(cached);

// ไม่มีร่องรอยล็อกอินในแท็บนี้ ถือว่าเป็นผู้มาเยือนทั่วไป ขึ้นปุ่มเข้าสู่ระบบได้เลยไม่ต้องรอ SDK
const staffSessionLikely = hasStoredAuthSession();
state.sessionKnown = !staffSessionLikely;
render();

// รายการจริงมาด้วย REST ก้อนเดียว ไม่กี่กิโลไบต์
refreshOverRest(true);

// มีคนล็อกอินค้างอยู่ จึงต่อ SDK ให้ เพื่อเห็นลิงก์ของบุคลากรและรับการอัปเดตสด
if (staffSessionLikely) whenIdle(loadCloud);

// เน็ตช้ามากหรือหลุด ก็ยังต้องมีลิงก์ให้กด
setTimeout(() => {
    if (!state.data) {
        state.data = cleanPublic(DEFAULT_PORTAL);
        render();
    }
}, 8000);

// กลับมาที่แท็บนี้อีกครั้ง เช็กว่ามีใครแก้รายการไว้หรือเปล่า (ตอนต่อ SDK อยู่ไม่ต้องเช็ก เพราะสดอยู่แล้ว)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshOverRest();
});
