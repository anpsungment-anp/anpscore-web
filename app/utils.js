/* ANPSCORE — ตัวช่วยทั่วไป รูปภาพ และการแปลงค่าคะแนน
   แยกออกจาก index.html เดิมที่รวมทุกอย่างไว้ไฟล์เดียว */

window.formatImgUrl = function(url) {
    if (!url) return '';
    const cleanUrl = String(url).trim();
    if(!cleanUrl || cleanUrl.startsWith('data:image/')) return cleanUrl;
    if(!/drive\.google\.com/i.test(cleanUrl)) return cleanUrl;

    const driveIdPatterns = [
        /drive\.google\.com\/file\/d\/([^/?#]+)/i,
        /drive\.google\.com\/open\?id=([^&#]+)/i,
        /drive\.google\.com\/uc\?(?:.*[?&])?id=([^&#]+)/i,
        /drive\.google\.com\/thumbnail\?(?:.*[?&])?id=([^&#]+)/i,
        /[?&]id=([^&#]+)/i
    ];
    for(const pattern of driveIdPatterns) {
        const match = cleanUrl.match(pattern);
        if(match && match[1]) {
            return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w400`;
        }
    }
    return cleanUrl;
}

window.compressImageDataUrl = function(dataUrl, maxSize = 180, quality = 0.82) {
    return new Promise((resolve) => {
        if(!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return resolve(dataUrl);
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, maxSize / img.width, maxSize / img.height);
                const w = Math.max(1, Math.round(img.width * scale));
                const h = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                const candidates = [
                    canvas.toDataURL('image/webp', quality),
                    canvas.toDataURL('image/png')
                ].filter(Boolean);
                const best = candidates.reduce((shortest, item) => item.length < shortest.length ? item : shortest, dataUrl);
                resolve(best.length < dataUrl.length ? best : dataUrl);
            } catch(e) {
                console.warn('Logo compression skipped:', e);
                resolve(dataUrl);
            }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

window.compressSchoolLogo = async function(dbObj) {
    if(!dbObj || !dbObj.schoolInfo) return dbObj;
    const logo = dbObj.schoolInfo.logo;
    if(typeof logo === 'string' && logo.length > 160000 && logo.startsWith('data:image/')) {
        dbObj.schoolInfo.logo = await window.compressImageDataUrl(logo);
    }
    return dbObj;
}

window.normalizeScoreValue = function(value, preferredKey = '') {
    const seen = new Set();
    const pick = (item) => {
        if(item === null || item === undefined || item === '') return '';
        if(typeof item === 'number') return Number.isFinite(item) ? item : '';
        if(typeof item === 'string') {
            const trimmed = item.trim();
            if(!trimmed || trimmed === '[object Object]') return '';
            const num = Number(trimmed);
            return Number.isFinite(num) ? num : '';
        }
        if(typeof item === 'boolean') return item ? 1 : 0;
        if(Array.isArray(item)) {
            for(const entry of item) {
                const found = pick(entry);
                if(found !== '') return found;
            }
            return '';
        }
        if(typeof item === 'object') {
            if(seen.has(item)) return '';
            seen.add(item);
            const priorityKeys = [preferredKey, 'value', 'score', 'total', 'amount', 'midTermScore', 'finalScore', 'mid', 'final', 'k', 'p', 'a'].filter(Boolean);
            for(const key of priorityKeys) {
                if(Object.prototype.hasOwnProperty.call(item, key)) {
                    const found = pick(item[key]);
                    if(found !== '') return found;
                }
            }
            for(const entry of Object.values(item)) {
                const found = pick(entry);
                if(found !== '') return found;
            }
        }
        return '';
    };
    return pick(value);
}

window.scoreNumber = function(value, preferredKey = '') {
    const normalized = window.normalizeScoreValue(value, preferredKey);
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
}

window.scoreDisplayValue = function(value, fallback = '', preferredKey = '') {
    const normalized = window.normalizeScoreValue(value, preferredKey);
    return normalized === '' ? fallback : normalized;
}

window.normalizeSubjectScores = function(subjectData) {
    if(!subjectData || typeof subjectData !== 'object' || !subjectData.scores || typeof subjectData.scores !== 'object') return false;
    let changed = false;
    const setIfFixed = (obj, key) => {
        if(!obj || typeof obj !== 'object' || obj[key] === undefined) return;
        const fixed = window.normalizeScoreValue(obj[key], key);
        if(obj[key] !== fixed) {
            obj[key] = fixed;
            changed = true;
        }
    };
    const fixScoreBlock = (scoreBlock) => {
        if(!scoreBlock || typeof scoreBlock !== 'object') return;
        if(scoreBlock.indicators && typeof scoreBlock.indicators === 'object') {
            Object.values(scoreBlock.indicators).forEach(indScores => {
                if(indScores && typeof indScores === 'object') {
                    ['k', 'p', 'a'].forEach(key => setIfFixed(indScores, key));
                }
            });
        }
        ['midTermScore', 'finalScore'].forEach(key => setIfFixed(scoreBlock, key));
    };

    Object.values(subjectData.scores).forEach(classScores => {
        if(!classScores || typeof classScores !== 'object') return;
        Object.values(classScores).forEach(studentScores => {
            if(!studentScores || typeof studentScores !== 'object') return;
            if(studentScores.term !== undefined) fixScoreBlock(studentScores);
            Object.values(studentScores).forEach(termScores => {
                if(termScores && typeof termScores === 'object') fixScoreBlock(termScores);
            });
        });
    });
    return changed;
}

window.subjectScoresNeedRepair = function(subjectData) {
    try {
        const copy = JSON.parse(JSON.stringify(subjectData || {}));
        return window.normalizeSubjectScores(copy);
    } catch(e) {
        return false;
    }
}

window.repairAllSubjectScoreValues = function() {
    let changed = false;
    Object.values(window.DB_SubjectData || {}).forEach(subjectData => {
        if(window.normalizeSubjectScores(subjectData)) changed = true;
    });
    return changed;
}
