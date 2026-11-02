/* ANPSCORE — คลังคะแนนเก็บรายภาคเรียน
   บันทึกคะแนนเก็บ (ตัวชี้วัด K/P/A) กลางภาค ปลายภาค รวม และเกรด ของทุกวิชาทุกห้อง
   ในภาคเรียนที่เลือก เก็บไว้บนคลาวด์เป็นรุ่น ๆ ไม่เขียนทับของเดิม
   และดาวน์โหลดเป็น Excel ได้ทั้งจากคะแนนปัจจุบันและจากรุ่นที่เก็บไว้ */

const termArchiveHasValue = v => v !== undefined && v !== null && v !== '';

// คะแนนของนักเรียนในภาคเรียนนั้น รองรับข้อมูลรูปแบบเก่าที่เก็บ term ไว้ในตัวโหนด
const termArchiveNodeOf = (stuNode, term) => {
    if(!stuNode || typeof stuNode !== 'object') return null;
    if(stuNode.term !== undefined) return String(stuNode.term) === String(term) ? stuNode : null;
    return stuNode[String(term)] && typeof stuNode[String(term)] === 'object' ? stuNode[String(term)] : null;
};

const termArchiveNodeHasScore = (node) => {
    if(!node) return false;
    if(termArchiveHasValue(node.midTermScore) || termArchiveHasValue(node.finalScore)) return true;
    return Object.values(node.indicators || {}).some(v => v && ['k', 'p', 'a'].some(t => termArchiveHasValue(v[t])));
};

// หนึ่งรายการต่อ วิชา/ห้อง ที่มีคะแนนอย่างน้อยหนึ่งช่องในภาคเรียนนั้น
window.buildTermScoreSnapshot = function(term = state.term) {
    term = String(term);
    const entries = [];
    let studentCount = 0;
    let scoreCount = 0;
    (DB.subjects || []).forEach(sub => {
        const sd = DB_SubjectData[sub.id];
        if(!sd || !sd.scores) return;
        Object.keys(sd.scores).forEach(clsId => {
            const cls = DB.classes && DB.classes[clsId];
            const scStore = sd.scores[clsId] || {};
            if(!Object.values(scStore).some(n => termArchiveNodeHasScore(termArchiveNodeOf(n, term)))) return;

            const cfg = (sd.classData && sd.classData[clsId]) ? sd.classData[clsId] : sd;
            const units = window.termUnitsOfConfig(cfg, term).map(u => ({
                id: u.id, name: u.name || '',
                indicators: (u.indicators || []).map(i => ({
                    id: i.id, name: i.name || i.code || '',
                    max_k: Number(i.max_k || 0), max_p: Number(i.max_p || 0), max_a: Number(i.max_a || 0)
                }))
            }));
            const exam = Object.assign({ mid: 20, final: 30 }, (cfg.examSettings && cfg.examSettings[term]) || {});

            // นักเรียนตามลำดับในห้อง ตามด้วยรหัสที่มีคะแนนแต่ไม่อยู่ในรายชื่อแล้ว (เช่น ย้ายห้อง) เพื่อไม่ให้คะแนนตกหล่น
            const roster = ((cls && cls.students) || []).slice();
            const rosterIds = new Set(roster.map(s => String(s.studentId)));
            Object.keys(scStore).forEach(stuId => {
                if(!rosterIds.has(String(stuId)) && termArchiveNodeHasScore(termArchiveNodeOf(scStore[stuId], term))) {
                    roster.push({ studentId: stuId, name: '(ไม่อยู่ในรายชื่อห้องแล้ว)' });
                }
            });

            const students = roster.map(stu => {
                const node = termArchiveNodeOf(scStore[stu.studentId], term);
                let collected = 0;
                units.forEach(u => u.indicators.forEach(i => {
                    const v = node && node.indicators ? node.indicators[i.id] : null;
                    if(v) collected += window.scoreNumber(v.k, 'k') + window.scoreNumber(v.p, 'p') + window.scoreNumber(v.a, 'a');
                }));
                const mid = node ? window.scoreNumber(node.midTermScore, 'midTermScore') : 0;
                const fin = node ? window.scoreNumber(node.finalScore, 'finalScore') : 0;
                const total = Math.round((collected + mid + fin) * 100) / 100;
                if(termArchiveNodeHasScore(node)) {
                    studentCount++;
                    Object.values(node.indicators || {}).forEach(v => ['k', 'p', 'a'].forEach(t => { if(v && termArchiveHasValue(v[t])) scoreCount++; }));
                    if(termArchiveHasValue(node.midTermScore)) scoreCount++;
                    if(termArchiveHasValue(node.finalScore)) scoreCount++;
                }
                return {
                    studentId: String(stu.studentId || ''),
                    name: stu.name || '',
                    collected: Math.round(collected * 100) / 100,
                    mid: node ? (termArchiveHasValue(node.midTermScore) ? node.midTermScore : '') : '',
                    final: node ? (termArchiveHasValue(node.finalScore) ? node.finalScore : '') : '',
                    total,
                    grade: termArchiveNodeHasScore(node) ? window.calculateGrade(total, DB.gradeSettings) : '',
                    // คะแนนดิบทั้งหมดของภาคเรียน รวมถึงตัวชี้วัดที่ถูกซ่อนจากโครงสร้าง - กู้คืนได้ครบ
                    raw: node ? JSON.parse(JSON.stringify(node)) : null
                };
            });

            entries.push({
                subId: sub.id, clsId,
                payload: {
                    subjectName: sub.name || '', subjectCode: sub.code || '',
                    className: (cls && cls.name) || clsId,
                    units, exam, students
                }
            });
        });
    });
    return { entries, summary: { classCount: new Set(entries.map(e => e.clsId)).size, subjectCount: new Set(entries.map(e => e.subId)).size, studentCount, scoreCount } };
};

// คะแนนของแต่ละวิชาโหลดจากคลาวด์เมื่อเปิดใช้ ต้องดึงให้ครบทุกวิชาก่อน ไม่อย่างนั้นคลังจะขาดวิชาที่ยังไม่ได้เปิด
window.loadAllScoresForTermArchive = async function() {
    const ids = (DB.subjects || []).map(s => s.id);
    if(typeof window.firebaseLoadScoresForSubjectsBulk !== 'function') return { ok: true };
    const res = await window.firebaseLoadScoresForSubjectsBulk(ids);
    if(res && res.attempted && res.failed > 0) return { ok: false, failed: res.failed };
    return { ok: true };
};

window.saveTermScoreArchive = async function() {
    const term = String(state.term);
    const year = String((DB.schoolInfo && DB.schoolInfo.year) || '').trim();
    if(!year) return window.notify('กรุณาระบุปีการศึกษาในหน้าตั้งค่าก่อน', true);
    if(!confirm(`บันทึกคะแนนเก็บ กลางภาค ปลายภาค และเกรด ของภาคเรียนที่ ${term}/${year} ทุกวิชาทุกห้อง เข้าคลัง?\n\nระบบจะเก็บเป็นรุ่นใหม่ ไม่เขียนทับรุ่นเดิม\nคะแนนที่ใช้งานอยู่ไม่ถูกแก้ไขหรือลบ`)) return;

    const btn = $('term-archive-btn');
    const setBtn = (html, disabled) => { if(btn) { btn.disabled = disabled; btn.innerHTML = html; } };
    setBtn('<i class="ph ph-spinner-gap text-3xl animate-spin"></i> กำลังดึงคะแนนทุกวิชา...', true);
    try {
        const loaded = await window.loadAllScoresForTermArchive();
        if(!loaded.ok) throw new Error(`ดึงคะแนนจากคลาวด์ไม่ครบ ${loaded.failed} วิชา กรุณาลองใหม่เมื่อเน็ตเสถียร`);
        const snapshot = window.buildTermScoreSnapshot(term);
        if(snapshot.entries.length === 0) {
            window.notify(`ภาคเรียนที่ ${term} ยังไม่มีคะแนนให้เก็บ`, true);
        } else {
            setBtn('<i class="ph ph-spinner-gap text-3xl animate-spin"></i> กำลังบันทึกเข้าคลัง...', true);
            const res = await window.firebaseSaveTermScoreSnapshot(year, term, snapshot.entries, snapshot.summary);
            window.notify(`บันทึกคะแนนภาคเรียนที่ ${term}/${year} เข้าคลังแล้ว (${res.count} วิชา/ห้อง, ${snapshot.summary.scoreCount} ช่องคะแนน)`);
        }
    } catch(err) {
        console.error(err);
        window.notify('บันทึกคะแนนรายภาคไม่สำเร็จ: ' + (err.message || ''), true);
    }
    setBtn(`<i class="ph ph-floppy-disk-back text-3xl opacity-80"></i> บันทึกคะแนนเทอม ${term} เข้าคลัง`, false);
    window.renderTermArchiveList();
};

const termArchiveSheetRows = (payload, term, year) => {
    const header1 = ['ที่', 'เลขประจำตัว', 'ชื่อ-สกุล'];
    const header2 = ['', '', ''];
    const cols = [];
    payload.units.forEach(u => u.indicators.forEach(i => {
        ['k', 'p', 'a'].forEach(t => {
            const max = Number(i[`max_${t}`] || 0);
            if(max <= 0) return;
            cols.push({ indId: i.id, t });
            header1.push(i.name || u.name || 'ตัวชี้วัด');
            header2.push(`${t.toUpperCase()} (${max})`);
        });
    }));
    header1.push('คะแนนเก็บ', 'กลางภาค', 'ปลายภาค', 'รวม', 'เกรด');
    header2.push('', `(${payload.exam.mid})`, `(${payload.exam.final})`, '(100)', '');
    const rows = [
        [`วิชา ${payload.subjectName}  ห้อง ${payload.className}  ภาคเรียนที่ ${term}/${year}`],
        header1, header2
    ];
    payload.students.forEach((s, idx) => {
        const inds = (s.raw && s.raw.indicators) || {};
        const row = [idx + 1, s.studentId, s.name];
        cols.forEach(c => {
            const v = inds[c.indId] ? inds[c.indId][c.t] : '';
            row.push(termArchiveHasValue(v) ? Number(v) : '');
        });
        row.push(s.collected, termArchiveHasValue(s.mid) ? Number(s.mid) : '', termArchiveHasValue(s.final) ? Number(s.final) : '', s.total, s.grade);
        rows.push(row);
    });
    return rows;
};

const termArchiveWriteWorkbook = (entries, term, year, label) => {
    if(typeof XLSX === 'undefined') return window.notify('ไม่พบตัวสร้างไฟล์ Excel', true);
    const wb = XLSX.utils.book_new();
    const used = new Set();
    const sorted = entries.slice().sort((a, b) =>
        String(a.payload.className).localeCompare(String(b.payload.className), 'th', { numeric: true })
        || String(a.payload.subjectName).localeCompare(String(b.payload.subjectName), 'th'));
    sorted.forEach(e => {
        let base = `${e.payload.className} ${e.payload.subjectName}`.replace(/[\\\/\?\*\[\]:]/g, '-').slice(0, 28);
        let name = base; let n = 2;
        while(used.has(name)) name = `${base.slice(0, 25)}_${n++}`;
        used.add(name);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(termArchiveSheetRows(e.payload, term, year)), name);
    });
    XLSX.writeFile(wb, `คะแนนเก็บ_เทอม${term}_${String(year).replace(/[^\w฀-๿-]/g, '')}${label ? '_' + label : ''}.xlsx`);
};

// ดาวน์โหลดคะแนนปัจจุบันของภาคเรียนที่เลือก โดยไม่ต้องบันทึกเข้าคลัง
window.exportCurrentTermScores = async function() {
    const term = String(state.term);
    const year = String((DB.schoolInfo && DB.schoolInfo.year) || '');
    window.notify('กำลังดึงคะแนนทุกวิชา...');
    const loaded = await window.loadAllScoresForTermArchive();
    if(!loaded.ok) return window.notify(`ดึงคะแนนจากคลาวด์ไม่ครบ ${loaded.failed} วิชา กรุณาลองใหม่`, true);
    const snapshot = window.buildTermScoreSnapshot(term);
    if(snapshot.entries.length === 0) return window.notify(`ภาคเรียนที่ ${term} ยังไม่มีคะแนน`, true);
    termArchiveWriteWorkbook(snapshot.entries, term, year, 'ปัจจุบัน');
};

window.downloadTermScoreArchive = async function(year, term, version) {
    window.notify('กำลังโหลดคะแนนจากคลัง...');
    try {
        const entries = await window.firebaseLoadTermScoreSnapshot(year, term, version);
        if(!entries.length) return window.notify('ไม่พบข้อมูลในคลังรุ่นนี้', true);
        const d = new Date(Number(version));
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
        termArchiveWriteWorkbook(entries, term, year, stamp);
    } catch(err) {
        console.error(err);
        window.notify('โหลดคลังคะแนนไม่สำเร็จ: ' + (err.message || ''), true);
    }
};

window.renderTermArchiveList = async function() {
    const box = $('term-archive-list');
    if(!box) return;
    let list = [];
    try { list = await window.firebaseListTermScoreSnapshots(); }
    catch(err) { box.innerHTML = 'อ่านคลังคะแนนรายภาคไม่สำเร็จ'; return; }
    if(!$('term-archive-list')) return;
    box.innerHTML = list.length
        ? `<div class="w-full"><div class="font-bold text-slate-700 mb-1">รุ่นที่บันทึกไว้</div>${list.slice(0, 30).map(x => {
            const when = x.createdAt ? new Date(x.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '';
            return `<div class="flex items-center justify-between gap-2 border-t border-slate-100 py-1.5">
                <span><b>เทอม ${window.escapeHtml(x.term)}/${window.escapeHtml(x.year)}</b> <span class="text-slate-400">${window.escapeHtml(when)} · ${x.classCount || 0} ห้อง · ${x.scoreCount || 0} ช่อง</span></span>
                <button onclick="window.downloadTermScoreArchive('${window.escapeHtml(x.year)}','${window.escapeHtml(x.term)}','${window.escapeHtml(x.version)}')" class="tactile-btn text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold shrink-0"><i class="ph ph-file-xls"></i> Excel</button>
            </div>`;
          }).join('')}</div>`
        : 'ยังไม่มีคะแนนรายภาคเรียนในคลัง';
};
