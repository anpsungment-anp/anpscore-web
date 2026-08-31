/* ANPSCORE — วงโคจรโลโก้โรงเรียน
   โลโก้ สช. ใหญ่อยู่ตรงกลาง โลโก้โรงเรียนลอยออกมาจากกลางวงแล้วโคจรรอบ ๆ อย่างช้า ๆ
   ใช้คู่กับ app/school-orbit.css  วางไฟล์รูปไว้ที่ assets/schools/<id>.png (ดู assets/schools/README.md) */

/* โลโก้ตรงกลาง */
window.SCHOOL_ORBIT_CENTER = {
    id: 'sch',
    name: 'สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน',
    short: 'สช'
};

/* โรงเรียนเอกชนจังหวัดแพร่ — แก้ไข เพิ่ม หรือลบรายการได้ที่นี่ที่เดียว
   id คือชื่อไฟล์รูป (ไม่ต้องใส่นามสกุล) และ short คืออักษรย่อที่ใช้แทนเมื่อยังไม่มีไฟล์รูป */
window.SCHOOL_ORBIT_LOGOS = [
    { id: 'thanawit-phitthakun',  name: 'ธนาวิทย์พิทธากูร',          short: 'ธว' },
    { id: 'charoenrat',           name: 'เจริญราษฎร์',                short: 'จร' },
    { id: 'thepnaree',            name: 'เทพนารี',                    short: 'ทน' },
    { id: 'anupong-patcharin',    name: 'อนุพงศ์พัชรินทร์',           short: 'อพ' },
    { id: 'anuban-namthong',      name: 'อนุบาลน้ำทอง',               short: 'นท' },
    { id: 'anuban-phenrat',       name: 'อนุบาลเพ็ญรัต',              short: 'พร' },
    { id: 'santi-jintana',        name: 'สอนคนตาบอดสันติจินตนา',      short: 'สจ' },
    { id: 'anuban-rongkwang',     name: 'อนุบาลร้องกวาง',             short: 'รก' },
    { id: 'rabiabpittaya',        name: 'ระเบียบพิทยา',               short: 'รบ' },
    { id: 'marda-uppatham',       name: 'มารดาอุปถัมภ์',              short: 'มอ' },
    { id: 'sanfun-phrae',         name: 'สานฝันแพร่',                 short: 'สฝ' },
    { id: 'charoensil-phrae',     name: 'เจริญศิลป์แพร่',             short: 'จศ' },
    { id: 'saint-francis-xavier', name: 'เซนต์ฟรังซิสเซเวียร์ แพร่',  short: 'SF' },
    { id: 'thepphithak-wittaya',  name: 'เทพพิทักษ์วิทยา',            short: 'ทพ' }
];

/* แบ่งโลโก้ลงวงโคจร: วงในไม่เกิน 5 ดวง ที่เหลือไปวงนอก
   ถ้ามีมากกว่า 16 ดวงจะแตกเป็นวงที่สามให้เอง */
window.planSchoolOrbitRings = function(count) {
    if(count <= 0) return [];
    if(count <= 7) return [{ n: count, r: 0.40, dur: 66, dir: 'normal' }];
    if(count <= 16) {
        const inner = Math.min(5, Math.floor(count / 3) + 2);
        return [
            { n: inner,         r: 0.29, dur: 52, dir: 'reverse' },
            { n: count - inner, r: 0.44, dur: 78, dir: 'normal'  }
        ];
    }
    const a = Math.round(count * 0.25), b = Math.round(count * 0.33);
    return [
        { n: a,             r: 0.25, dur: 46, dir: 'reverse' },
        { n: b,             r: 0.37, dur: 66, dir: 'normal'  },
        { n: count - a - b, r: 0.48, dur: 88, dir: 'reverse' }
    ];
}

/* คืน element รูปโลโก้ ถ้าโหลดไฟล์ไม่ได้จะสลับไปใช้อักษรย่อแทนโดยอัตโนมัติ */
window.buildSchoolOrbitArt = function(item, basePath, ext) {
    const fallback = document.createElement('span');
    fallback.className = 'orbit__fallback';
    fallback.textContent = item.short || String(item.name || '?').slice(0, 2);

    if(!item.id && !item.src) return fallback;

    const img = document.createElement('img');
    img.alt = item.name || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => {
        if(img.parentNode) img.parentNode.replaceChild(fallback, img);
    }, { once: true });
    img.src = item.src || (basePath + item.id + ext);
    return img;
}

/* วาดวงโคจรลงใน target (id หรือ element)
   opts: { logos, center, basePath, ext, labels, onDark, backdrop, size, stagger } */
window.renderSchoolOrbit = function(target, opts = {}) {
    const host = typeof target === 'string' ? document.getElementById(target) : target;
    if(!host) return null;

    const logos    = opts.logos  || window.SCHOOL_ORBIT_LOGOS || [];
    const center   = opts.center === undefined ? window.SCHOOL_ORBIT_CENTER : opts.center;
    const basePath = opts.basePath || 'assets/schools/';
    const ext      = opts.ext || '.png';
    const stagger  = typeof opts.stagger === 'number' ? opts.stagger : 0.09;

    const orbit = document.createElement('div');
    orbit.className = 'orbit';
    if(opts.labels === false) orbit.classList.add('orbit--no-labels');
    if(opts.onDark) orbit.classList.add('orbit--on-dark');
    if(opts.backdrop) orbit.classList.add('orbit--backdrop');
    if(opts.size) orbit.style.setProperty('--orbit-size', opts.size);
    orbit.setAttribute('role', 'img');
    orbit.setAttribute('aria-label',
        `${(center && center.name) || 'โลโก้ศูนย์กลาง'} ล้อมรอบด้วยโลโก้ ${logos.length} โรงเรียน`);

    const plan = window.planSchoolOrbitRings(logos.length);
    let placed = 0;

    plan.forEach((ring, ringIndex) => {
        const radius = (ring.r * 100).toFixed(2) + '%';

        const track = document.createElement('div');
        track.className = 'orbit__track';
        track.style.setProperty('--r', radius);
        orbit.appendChild(track);

        const ringEl = document.createElement('div');
        ringEl.className = 'orbit__ring';
        ringEl.style.setProperty('--dur', ring.dur + 's');
        ringEl.style.setProperty('--dir', ring.dir);
        ringEl.style.setProperty('--dir-counter', ring.dir === 'reverse' ? 'normal' : 'reverse');

        /* เยื้องมุมเริ่มต้นของแต่ละวง ไม่ให้โลโก้เรียงตรงกันเป็นแนวรัศมี */
        const offset = ringIndex * (180 / Math.max(ring.n, 1));

        for(let i = 0; i < ring.n; i++) {
            const item = logos[placed];
            if(!item) break;

            const slot = document.createElement('div');
            slot.className = 'orbit__slot';
            slot.style.setProperty('--a', (offset + (360 / ring.n) * i).toFixed(2) + 'deg');
            slot.style.setProperty('--r', radius);
            slot.style.setProperty('--delay', (placed * stagger).toFixed(2) + 's');
            slot.style.setProperty('--bob', (4.2 + (placed % 5) * 0.6).toFixed(1) + 's');

            const upright = document.createElement('div');
            upright.className = 'orbit__upright';

            const bob = document.createElement('div');
            bob.className = 'orbit__bob';

            const badge = document.createElement('div');
            badge.className = 'orbit__badge';
            badge.title = item.name || '';
            badge.appendChild(window.buildSchoolOrbitArt(item, basePath, ext));

            bob.appendChild(badge);

            if(opts.labels !== false) {
                const label = document.createElement('span');
                label.className = 'orbit__label';
                label.textContent = item.name || '';
                bob.appendChild(label);
            }

            upright.appendChild(bob);
            slot.appendChild(upright);
            ringEl.appendChild(slot);
            placed++;
        }

        orbit.appendChild(ringEl);
    });

    const halo = document.createElement('div');
    halo.className = 'orbit__halo';
    orbit.appendChild(halo);

    if(center) {
        const core = document.createElement('div');
        core.className = 'orbit__core';
        core.title = center.name || '';
        core.appendChild(window.buildSchoolOrbitArt(center, basePath, ext));
        orbit.appendChild(core);
    }

    host.appendChild(orbit);
    return orbit;
}
