/* ==========================================================================
   ANPSCORE — รายงานผู้บริหาร (สรุปรวมคะแนนกลุ่มสาระการเรียนรู้/รายวิชา)
   แบบสรุปรวมคะแนนในกลุ่มสาระการเรียนรู้/รายวิชาของนักเรียน (A4 แนวตั้ง Portrait)
   ตรงตามแบบฟอร์มทางการของโรงเรียนอนุพงศ์พัชรินทร์ จ.แพร่
   รองรับ:
   1. จัดทำเป็นแบบ A4 แนวตั้ง (Portrait) ตัวหนังสืออยู่กึ่งกลางช่องพอดีทั้งใน Preview และไฟล์ PDF ที่ดาวน์โหลด ไม่จมหรือชนเส้นตาราง
   2. รองรับ "แบบหารครึ่ง (เต็ม 50)" ปัดจุดทศนิยมเป็นค่าเต็ม (จำนวนเต็ม ไม่มี .5 เช่น 48.5 -> 49)
   3. พิมพ์รวมทั้งหมดทั้งโรงเรียน (ป.1 - ป.6 รวม 20 ห้อง ในเล่มเดียว) หรือเลือกเฉพาะห้อง
   ========================================================================== */

(function() {
    'use strict';

    // Helper functions
    const esc = value => window.escapeHtml 
        ? window.escapeHtml(String(value ?? ''))
        : String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

    /**
     * จัดรูปแบบตัวเลขคะแนน
     * หาก roundInteger = true จะปัดเศษทศนิยมให้เป็นค่าเต็ม (จำนวนเต็ม)
     */
    const formatScore = (value, roundInteger = false) => {
        if(value === null || value === undefined || value === '') return '';
        const num = Number(value);
        if(!Number.isFinite(num)) return '';
        if(roundInteger) {
            return String(Math.round(num));
        }
        return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    };

    /**
     * แปลงชื่อวิชาให้กระชับและพอดีกับคอลัมน์ A4 แนวตั้ง
     */
    function getReportSubjectName(fullName) {
        const text = String(fullName || '').trim();
        if(text.includes('อังกฤษ') && (text.includes('สื่อสาร') || text.includes('เพิ่มเติม'))) return 'อังกฤษ<br>สื่อสาร';
        if(text.includes('จีน')) return 'จีน';
        if(text.includes('อังกฤษ')) return 'อังกฤษ';
        if(text.includes('การงาน')) return 'การงาน';
        if(text.includes('ทัศนศิลป์') || text.includes('ศิลป')) return 'ศิลปะ';
        if(text.includes('สุขศึกษา') || text.includes('พลศึกษา')) return 'สุขศึกษา';
        if(text.includes('ประวัติ')) return 'ประวัติฯ';
        if(text.includes('สังคม')) return 'สังคมฯ';
        if(text.includes('วิทย')) return 'วิทย์ฯ';
        if(text.includes('คณิต')) return 'คณิตฯ';
        if(text.includes('ภาษาไทย') || text === 'ไทย') return 'ไทย';
        if(text.includes('พลเมือง')) return 'หน้าที่ฯ';
        if(text.includes('ทุจริต')) return 'ต้าน<br>ทุจริต';
        return text.replace(/^วิชา\s*/, '');
    }

    /**
     * ดึงชื่อโรงเรียนพร้อมสถานที่ให้ตรงตามหัวแบบฟอร์ม:
     * "โรงเรียนอนุพงศ์พัชรินทร์   อำเภอสูงเม่น   จังหวัดแพร่"
     */
    function getDisplaySchoolName() {
        const raw = String((window.DB && DB.schoolInfo && DB.schoolInfo.name) || 'โรงเรียนอนุพงศ์พัชรินทร์').trim();
        if(raw.includes('สูงเม่น') || raw.includes('แพร่')) return raw;
        if(raw.includes('อนุพงศ์พัชรินทร์')) return 'โรงเรียนอนุพงศ์พัชรินทร์   อำเภอสูงเม่น   จังหวัดแพร่';
        return raw;
    }

    /**
     * ดึงรายการห้องประจำชั้นของครูที่กำลังล็อกอิน (หากเป็นแอดมินจะคืนค่า null เพื่อไม่จำกัดสิทธิ์)
     */
    function getTeacherHomeroomClassIds() {
        if(!window.state || !state.user) return [];
        if(state.user.role === 'admin') return null; // ผู้ดูแลระบบเข้าถึงได้ทุกห้อง
        const teacherId = String(state.user.id || '');
        const teacher = (window.DB && Array.isArray(DB.teachers) ? DB.teachers : []).find(t => String(t.id) === teacherId);
        if(!teacher) return [];
        const term = String((window.state && state.term) || '1');
        if(typeof window.getTeacherHomeroomClasses === 'function') {
            return (window.getTeacherHomeroomClasses(teacher, term) || []).map(String);
        }
        return [];
    }

    /**
     * ดึงรายการห้องเรียนทั้งหมดที่มีนักเรียนและรายวิชา
     * หากเป็นครู จะกรองให้เห็นเฉพาะห้องที่ตนเองเป็นครูประจำชั้นเท่านั้น ห้องอื่นจะไม่มีทางเห็นเด็ดขาด
     */
    function getAllAvailableClassEntries() {
        const homerooms = getTeacherHomeroomClassIds();
        return window.getSortedClassEntries().filter(([cId, cls]) => {
            if(homerooms !== null && !homerooms.includes(String(cId))) {
                return false; // ครูจะไม่มีทางเห็นห้องอื่นเด็ดขาด
            }
            return (cls.students || []).length > 0 && window.getAdminMidtermSubjectsForClass(cId).length > 0;
        });
    }

    /**
     * สร้าง HTML 1 หน้า A4 สำหรับ 1 ห้องเรียน
     * รองรับ scoreType:
     * - 'half': แบบหารครึ่ง / เต็ม 50 ทุกวิชา (รวม 600/650) ปัดเศษเป็นค่าเต็มตามสั่งการ
     * - 'final': ปลายภาค / รวมเต็ม 100 ทุกวิชา (รวม 1,200/1,300)
     * - 'mid': คะแนนสอบกลางภาค
     */
    window.buildExecutiveReportPage = function(cId, cls, scoreType = 'half', pageNumber = 1, totalPages = 1, orientation = 'portrait', roundInteger = true, studentsOverride = null, startIndex = 0, partLabel = '') {
        // ตรวจสอบสิทธิ์ความปลอดภัย: หากเป็นครู ต้องเป็นห้องประจำชั้นของตนเองเท่านั้น
        const homerooms = getTeacherHomeroomClassIds();
        if(homerooms !== null && !homerooms.includes(String(cId))) {
            return `
            <section class="executive-exam-pdf-page page-portrait" style="display:flex;align-items:center;justify-content:center;height:297mm;background:#ffffff;">
                <div style="text-align:center;padding:40px;color:#b91c1c;">
                    <div style="font-size:36px;margin-bottom:12px;"><i class="ph ph-lock-key"></i></div>
                    <h2 style="font-size:20px;font-weight:bold;margin-bottom:8px;">ไม่มีสิทธิ์เข้าถึงห้องเรียนนี้</h2>
                    <p style="font-size:14px;color:#64748b;">ครูสามารถดูได้เฉพาะห้องที่ตนเองเป็นครูประจำชั้นเท่านั้น</p>
                </div>
            </section>`;
        }
        const isPortrait = orientation !== 'landscape';
        const isHalf = scoreType === 'half';
        const isMid = scoreType === 'mid';

        let scoreLabel = 'ปลายภาค';
        if(isHalf) scoreLabel = 'ปลายภาค (หารครึ่ง)';
        else if(isMid) scoreLabel = 'กลางภาค';

        const subjects = window.getAdminMidtermSubjectsForClass(cId);
        const fullClassStudents = (cls && cls.students) || [];
        const students = studentsOverride || fullClassStudents;
        const totalClassCount = fullClassStudents.length;
        const pageStudentCount = students.length;

        const classKey = window.normalizeAdminMidtermClassKey(cls && cls.name) || (cls && cls.name) || cId;
        const teacherName = typeof window.getGuardianHomeroomDefault === 'function' ? window.getGuardianHomeroomDefault(cId) : '';
        const schoolName = getDisplaySchoolName();
        const schoolYear = String((window.DB && DB.schoolInfo && DB.schoolInfo.year) || '2568');
        const term = String((window.state && state.term) || '1');

        // คำนวณคะแนนเต็มแต่ละวิชา
        const fullScores = subjects.map(sub => {
            if(isHalf) return 50;
            if(isMid) return Number(window.getGuardianExamFullScore(sub.id, cId, 'mid') || 50);
            return 100;
        });
        const totalFullScore = fullScores.reduce((sum, val) => sum + val, 0);

        // คำนวณความสูงแถวและขนาดตัวอักษรแบบยืดหยุ่นตามจำนวนนักเรียนจริง
        // เพื่อให้ทุกห้องเรียน (รวมห้องขนาดใหญ่เช่น ป.6/1 ที่มี 55 คน) แสดงผลครบทุกคน ไม่ถูกตัดตกขอบกระดาษ A4
        let rowHeight;
        let bodyFontSize;
        let nameFontSize;
        let pagePaddingTop;
        let pagePaddingBottom;
        let headerRow1Height;
        let headerRow2Height;
        let isDenseMode = false;

        if (isPortrait) {
            if (pageStudentCount > 50) {
                // สำหรับห้อง 51 - 60 คน (เช่น ป.6/1 มี 55 คน แสดงครบใน 1 หน้า)
                isDenseMode = true;
                rowHeight = Math.max(16.5, Math.min(17.3, 955 / pageStudentCount));
                bodyFontSize = 8.5;
                nameFontSize = 8.5;
                pagePaddingTop = 4.5;
                pagePaddingBottom = 4.0;
                headerRow1Height = 24;
                headerRow2Height = 17;
            } else if (pageStudentCount > 44) {
                isDenseMode = true;
                rowHeight = 18.5;
                bodyFontSize = 9.0;
                nameFontSize = 9.0;
                pagePaddingTop = 6.0;
                pagePaddingBottom = 5.0;
                headerRow1Height = 26;
                headerRow2Height = 18.5;
            } else if (pageStudentCount > 38) {
                rowHeight = 20;
                bodyFontSize = 9.5;
                nameFontSize = 9.5;
                pagePaddingTop = 8.0;
                pagePaddingBottom = 5.5;
                headerRow1Height = 28;
                headerRow2Height = 20;
            } else if (pageStudentCount > 30) {
                rowHeight = 21.5;
                bodyFontSize = 10;
                nameFontSize = 10;
                pagePaddingTop = 8.5;
                pagePaddingBottom = 6.0;
                headerRow1Height = 28;
                headerRow2Height = 20;
            } else {
                rowHeight = 23;
                bodyFontSize = 10.5;
                nameFontSize = 10.5;
                pagePaddingTop = 8.5;
                pagePaddingBottom = 6.0;
                headerRow1Height = 28;
                headerRow2Height = 20;
            }
        } else {
            // แนวนอน (Landscape)
            if (pageStudentCount > 50) {
                isDenseMode = true;
                rowHeight = Math.max(11.8, Math.min(12.5, 680 / pageStudentCount));
                bodyFontSize = 7.5;
                nameFontSize = 7.5;
                pagePaddingTop = 4.0;
                pagePaddingBottom = 3.5;
                headerRow1Height = 22;
                headerRow2Height = 16;
            } else if (pageStudentCount > 40) {
                isDenseMode = true;
                rowHeight = 13.5;
                bodyFontSize = 8.0;
                nameFontSize = 8.0;
                pagePaddingTop = 5.0;
                pagePaddingBottom = 4.0;
                headerRow1Height = 24;
                headerRow2Height = 17;
            } else if (pageStudentCount > 34) {
                rowHeight = 14.8;
                bodyFontSize = 8.8;
                nameFontSize = 8.8;
                pagePaddingTop = 6.0;
                pagePaddingBottom = 4.5;
                headerRow1Height = 26;
                headerRow2Height = 18;
            } else if (pageStudentCount > 28) {
                rowHeight = 16;
                bodyFontSize = 9.5;
                nameFontSize = 9.5;
                pagePaddingTop = 7.0;
                pagePaddingBottom = 5.0;
                headerRow1Height = 28;
                headerRow2Height = 20;
            } else {
                rowHeight = 17.5;
                bodyFontSize = 10;
                nameFontSize = 10;
                pagePaddingTop = 7.0;
                pagePaddingBottom = 5.0;
                headerRow1Height = 28;
                headerRow2Height = 20;
            }
        }

        // คำนวณความกว้างคอลัมน์
        const fixedWidth = isPortrait ? 335 : 398;
        const usableWidth = isPortrait ? 748 : 1062;
        const subCount = Math.max(1, subjects.length);
        const subjectColWidth = Math.floor((usableWidth - fixedWidth) / subCount);

        const colWidthSeq = isPortrait ? 24 : 34;
        const colWidthId = isPortrait ? 46 : 68;
        const colWidthName = isPortrait ? 175 : 188;
        const colWidthSum = isPortrait ? 44 : 52;
        const colWidthPct = isPortrait ? 46 : 56;

        // แถวนักเรียน
        const studentRows = students.map((student, index) => {
            const seqNumber = startIndex + index + 1;
            let rawTotal = 0;
            let rawFullScoreTotal = 0;
            let filledCount = 0;

            const subjectScores = subjects.map((sub, sIdx) => {
                const rawScore = window.getGuardianExamScore(sub.id, cId, student.studentId, isMid ? 'mid' : 'final');
                if(rawScore === null || rawScore === undefined || rawScore === '') {
                    return { raw: null, exactVal: null, displayVal: '' };
                }
                const numRaw = Number(rawScore);
                const subFull = fullScores[sIdx] || (isHalf ? 50 : 100);
                const rawSubFull = isHalf ? subFull * 2 : subFull;

                rawTotal += numRaw;
                rawFullScoreTotal += rawSubFull;
                filledCount++;

                // ค่าจริงของคะแนน (หารครึ่งหากเป็นโหมด half): ค่ายังคงตัวเลขเดิมจากคะแนนเต็ม ไม่แตะต้องข้อมูลดิบ
                const exactVal = isHalf ? (numRaw / 2) : numRaw;
                // การแสดงผล: แสดงผลเป็นการปัดทศนิยม แต่ค่ายังเท่าเดิม (roundInteger true จะปัดเป็นจำนวนเต็ม)
                const displayVal = formatScore(exactVal, roundInteger);

                return { raw: numRaw, exactVal, displayVal };
            });

            const hasAnyScore = filledCount > 0;
            // คะแนนรวมแท้จริง: ถ้าเป็นหารครึ่ง คือ rawTotal / 2 (ค่ายังเท่าเดิมจากคะแนนเต็ม ไม่เกิดความผิดพลาดจากการปัดเศษย่อยสะสม)
            const exactTotal = isHalf ? (rawTotal / 2) : rawTotal;
            // ร้อยละ: คำนวณจากสัดส่วนคะแนนรวมดิบจริง เทียบกับคะแนนเต็มดิบจริง (ตรงกัน 100% กับคะแนนเต็ม ไม่คลาดเคลื่อน)
            const percent = rawFullScoreTotal > 0 ? (rawTotal / rawFullScoreTotal) * 100 : 0;
            // คะแนนรวมที่แสดงผล: ปัดทศนิยมให้ตรงกับการแสดงผล
            const displayTotal = hasAnyScore ? formatScore(exactTotal, roundInteger) : '';

            return `<tr class="exec-student-row" style="height:${rowHeight}px;">
                <td style="width:${colWidthSeq}px;text-align:center;"><span class="exec-cell-val">${seqNumber}</span></td>
                <td style="width:${colWidthId}px;text-align:center;"><span class="exec-cell-val">${esc(student.studentId || '')}</span></td>
                <td class="exec-student-name" style="width:${colWidthName}px;font-size:${nameFontSize}px;"><span class="exec-cell-val">${esc(student.name || '')}</span></td>
                ${subjectScores.map(item => `<td style="width:${subjectColWidth}px;text-align:center;"><span class="exec-cell-val">${item.displayVal}</span></td>`).join('')}
                <td class="exec-col-sum" style="width:${colWidthSum}px;text-align:center;"><span class="exec-cell-val">${displayTotal}</span></td>
                <td class="exec-col-pct" style="width:${colWidthPct}px;text-align:center;"><span class="exec-cell-val">${hasAnyScore ? percent.toFixed(2) : ''}</span></td>
            </tr>`;
        }).join('');

        const pageClass = (isPortrait ? 'executive-exam-pdf-page page-portrait' : 'executive-exam-pdf-page page-landscape') + (isDenseMode ? ' is-dense' : '');
        const headerClass = isDenseMode ? 'exec-page-header exec-page-header-dense' : 'exec-page-header';

        return `
        <section class="${pageClass}" style="padding-top:${pagePaddingTop}mm;padding-bottom:${pagePaddingBottom}mm;">
            <header class="${headerClass}">
                <div class="exec-title-line-1">แบบสรุปรวมคะแนนในกลุ่มสาระการเรียนรู้/รายวิชาของนักเรียน ประจำ${scoreLabel} ภาคเรียนที่ ${esc(term)} ปีการศึกษา ${esc(schoolYear)}</div>
                <div class="exec-title-line-2">${esc(schoolName)}</div>
                <div class="exec-title-line-3">
                    <span class="exec-meta-left">ระดับชั้นประถมศึกษาปีที่ <strong class="exec-bold">${esc(classKey)}${esc(partLabel)}</strong></span>
                    <span class="exec-meta-center">จำนวน <strong class="exec-bold">${totalClassCount}</strong> คน</span>
                    <span class="exec-meta-right">ครูประจำชั้น <strong class="exec-bold">${esc(teacherName || '-')}</strong></span>
                </div>
            </header>

            <table class="exec-table" style="font-size:${bodyFontSize}px;">
                <colgroup>
                    <col style="width:${colWidthSeq}px;">
                    <col style="width:${colWidthId}px;">
                    <col style="width:${colWidthName}px;">
                    ${subjects.map(() => `<col style="width:${subjectColWidth}px;">`).join('')}
                    <col style="width:${colWidthSum}px;">
                    <col style="width:${colWidthPct}px;">
                </colgroup>
                <thead>
                    <tr class="exec-header-row-1" style="height:${headerRow1Height}px;">
                        <th colspan="3" class="exec-th-group"><span class="exec-cell-val">กลุ่มสาระ/วิชา</span></th>
                        ${subjects.map(sub => `<th class="exec-th-subject"><span class="exec-cell-val exec-sub-text">${getReportSubjectName(sub.name || '')}</span></th>`).join('')}
                        <th class="exec-th-sum"><span class="exec-cell-val">รวม</span></th>
                        <th class="exec-th-pct"><span class="exec-cell-val">ร้อยละ</span></th>
                    </tr>
                    <tr class="exec-header-row-2" style="height:${headerRow2Height}px;">
                        <th class="exec-th-no"><span class="exec-cell-val">ลำดับ</span></th>
                        <th class="exec-th-id"><span class="exec-cell-val">รหัส</span></th>
                        <th class="exec-th-name"><span class="exec-cell-val">ชื่อ  -  สกุล</span></th>
                        ${fullScores.map(score => `<th class="exec-th-full"><span class="exec-cell-val">${formatScore(score, true)}</span></th>`).join('')}
                        <th class="exec-th-full-sum"><span class="exec-cell-val">${formatScore(totalFullScore, true)}</span></th>
                        <th class="exec-th-full-pct"><span class="exec-cell-val">-</span></th>
                    </tr>
                </thead>
                <tbody>
                    ${studentRows}
                </tbody>
            </table>

            <div class="exec-page-footer">หน้า ${pageNumber} / ${totalPages}</div>
        </section>
        `;
    };

    // Alias for backward compatibility
    window.buildAdminExamPdfPage = function(cId, cls, scoreType = 'half', pageNumber = 1, totalPages = 1, studentsOverride = null, startIndex = 0) {
        return window.buildExecutiveReportPage(cId, cls, scoreType, pageNumber, totalPages, 'portrait', true, studentsOverride, startIndex);
    };

    /**
     * สไตล์ CSS สำหรับ A4
     */
    function getExecutiveReportStyles(isPortrait = true) {
        return `
        .executive-exam-pdf-page {
            box-sizing: border-box;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important;
            overflow: visible;
            position: relative;
            margin: 0 auto 24px auto;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
            page-break-after: always;
            break-after: page;
        }

        .executive-exam-pdf-page.page-portrait {
            width: 210mm;
            min-height: 297mm;
            padding: 8.5mm 6mm 6mm;
        }

        .executive-exam-pdf-page.page-landscape {
            width: 297mm;
            min-height: 210mm;
            padding: 7mm 8mm 5mm;
        }

        .executive-exam-pdf-page.page-portrait.is-dense {
            padding-left: 5mm !important;
            padding-right: 5mm !important;
        }

        .executive-exam-pdf-page.page-landscape.is-dense {
            padding-left: 6mm !important;
            padding-right: 6mm !important;
        }

        .exec-page-header {
            text-align: center;
            margin-bottom: 5px;
            line-height: 1.25;
        }
        .exec-page-header-dense {
            margin-bottom: 2px !important;
            line-height: 1.15 !important;
        }
        .exec-page-header-dense .exec-title-line-1 {
            font-size: 12px !important;
        }
        .exec-page-header-dense .exec-title-line-2 {
            font-size: 11px !important;
            margin-top: 0px !important;
        }
        .exec-page-header-dense .exec-title-line-3 {
            font-size: 9.5px !important;
            margin-top: 1px !important;
        }
        .exec-title-line-1 {
            font-size: 13.5px;
            font-weight: 700;
            color: #000000;
            letter-spacing: 0.1px;
        }
        .exec-title-line-2 {
            font-size: 12.5px;
            font-weight: 700;
            color: #000000;
            margin-top: 1px;
        }
        .exec-title-line-3 {
            font-size: 11px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 4px;
            margin-top: 3px;
            color: #000000;
        }
        .exec-bold {
            font-weight: 800;
        }

        /* ตารางรายงาน */
        .exec-table {
            width: 100%;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            table-layout: fixed;
            color: #000000 !important;
            background: #ffffff !important;
        }
        .exec-table th, .exec-table td {
            border: 1px solid #000000 !important;
            padding: 0 1px !important;
            text-align: center;
            vertical-align: middle;
            box-sizing: border-box;
            background: #ffffff;
            color: #000000;
            font-size: inherit !important;
        }

        /* ใน Preview บนหน้าจอ และใน Native Print ตัวหนังสือถูกจัดกึ่งกลางปกติ */
        .exec-cell-val {
            display: inline-block;
            position: static;
            line-height: normal;
            letter-spacing: -0.1px;
            overflow: visible !important;
        }

        /* ชดเชย Baseline ของฟอนต์ไทยเฉพาะตอนที่แปลงเป็นภาพ Canvas / PDF ด้วย html2canvas ตัวหนังสือไม่จมตาราง */
        .executive-exam-pdf-page.is-exporting-pdf .exec-cell-val {
            position: relative !important;
            top: -4.5px !important;
            overflow: visible !important;
            line-height: normal !important;
        }
        .executive-exam-pdf-page.is-exporting-pdf .exec-header-row-1 .exec-cell-val {
            top: -2.5px !important;
            overflow: visible !important;
        }
        .executive-exam-pdf-page.is-exporting-pdf .exec-header-row-2 .exec-cell-val {
            top: -3.5px !important;
            overflow: visible !important;
        }

        .executive-exam-pdf-page.is-dense.is-exporting-pdf .exec-cell-val {
            top: -2.5px !important;
        }
        .executive-exam-pdf-page.is-dense.is-exporting-pdf .exec-header-row-1 .exec-cell-val {
            top: -1.5px !important;
        }
        .executive-exam-pdf-page.is-dense.is-exporting-pdf .exec-header-row-2 .exec-cell-val {
            top: -2px !important;
        }

        /* ส่วนหัวตาราง 2 ชั้น */
        .exec-header-row-1 {
            height: 28px;
            background: #f8fafc !important;
        }
        .exec-header-row-1 th {
            font-size: 8px;
            font-weight: 800;
            padding: 1px 1px !important;
            line-height: 1.15;
            letter-spacing: -0.2px;
        }
        .exec-sub-text {
            display: block;
            white-space: normal;
            overflow-wrap: break-word;
            word-break: break-word;
            line-height: 1.15;
        }
        .exec-header-row-2 {
            height: 20px;
            background: #f1f5f9 !important;
        }
        .exec-header-row-2 th {
            font-size: 8.5px;
            font-weight: 700;
        }

        .executive-exam-pdf-page.is-dense .exec-header-row-1 th {
            font-size: 7.5px !important;
            padding: 0 1px !important;
            line-height: 1.1 !important;
        }
        .executive-exam-pdf-page.is-dense .exec-header-row-2 th {
            font-size: 7.5px !important;
            padding: 0 1px !important;
        }

        /* แถวข้อมูลนักเรียน */
        .exec-student-name {
            text-align: left !important;
            padding-left: 5px !important;
            padding-right: 2px !important;
            white-space: nowrap;
            overflow: hidden;
            font-weight: 600;
        }
        .executive-exam-pdf-page.is-dense .exec-student-name {
            padding-left: 3px !important;
            padding-right: 1px !important;
        }
        .exec-student-name .exec-cell-val {
            display: inline-block !important;
            white-space: nowrap !important;
            overflow: visible !important;
            line-height: normal !important;
        }
        .executive-exam-pdf-page.is-exporting-pdf .exec-student-name .exec-cell-val {
            display: inline-block !important;
            white-space: nowrap !important;
            overflow: visible !important;
            line-height: normal !important;
        }
        .exec-col-sum, .exec-col-pct {
            font-weight: 800;
            background-color: #fafafa !important;
        }

        .exec-page-footer {
            position: absolute;
            bottom: 3.5mm;
            right: 6mm;
            font-size: 8px;
            color: #64748b;
        }

        /* การตั้งค่าพิมพ์ Native Browser Print */
        @media print {
            @page {
                size: ${isPortrait ? 'A4 portrait' : 'A4 landscape'} !important;
                margin: 0 !important;
            }
            html, body {
                width: ${isPortrait ? '210mm' : '297mm'} !important;
                min-height: ${isPortrait ? '297mm' : '210mm'} !important;
                height: auto !important;
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                color: #000000 !important;
                overflow: visible !important;
            }
            .no-print, #sidebar, #header, #app-container, #modal-container, #toast {
                display: none !important;
            }
            #print-view {
                display: block !important;
                position: static !important;
                width: 100% !important;
                height: auto !important;
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                z-index: 9999 !important;
            }
            .executive-exam-pdf-page {
                box-shadow: none !important;
                margin: 0 !important;
                page-break-after: always !important;
                break-after: page !important;
                max-height: none !important;
                overflow: visible !important;
            }
            .executive-exam-pdf-page:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
            }
            .exec-cell-val {
                top: 0 !important;
                position: static !important;
            }
        }
    `;
    }

    /**
     * ฉีดสไตล์สำหรับพิมพ์
     */
    function ensurePrintStyles(isPortrait = true) {
        let styleTag = document.getElementById('executive-report-style');
        if(!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'executive-report-style';
            document.head.appendChild(styleTag);
        }
        styleTag.innerHTML = getExecutiveReportStyles(isPortrait);
    }

    /**
     * ถอนสไตล์พิมพ์ออก
     */
    function removePrintStyles() {
        const styleTag = document.getElementById('executive-report-style');
        if(styleTag) styleTag.remove();
    }

    /**
     * สลับการแสดงผล Dropdown เลือกห้องเดี่ยว
     */
    window.toggleExecutiveScopeMode = function(mode) {
        const wrap = document.getElementById('exec-single-class-wrap');
        if(!wrap) return;
        if(mode === 'single') {
            wrap.classList.remove('hidden');
        } else {
            wrap.classList.add('hidden');
        }
    };

    /**
     * เปิดหน้าต่างตัวเลือกรายงานผู้บริหาร (Modal)
     * หากเป็นครู จะแสดงเฉพาะห้องที่ตนเองเป็นครูประจำชั้นเท่านั้น ไม่มีทางเห็นหรือเลือกห้องอื่นเด็ดขาด
     */
    window.openExecutiveReportModal = function(defaultClassId = '') {
        const isTeacher = !!(window.state && state.user && state.user.role === 'teacher');
        const allClassEntries = getAllAvailableClassEntries();
        if(!allClassEntries.length) {
            if(isTeacher) {
                window.notify('คุณยังไม่ได้รับมอบหมายเป็นครูประจำชั้นในภาคเรียนนี้ จึงไม่มีสิทธิ์เข้าถึงรายงานสรุปคะแนน', true);
            } else {
                window.notify('ไม่พบห้องเรียนที่มีรายวิชาและรายชื่อนักเรียนสำหรับสร้างรายงาน', true);
            }
            return;
        }

        const activeClassId = defaultClassId || (allClassEntries[0] ? allClassEntries[0][0] : '');

        let modalEl = document.getElementById('exec-report-modal');
        if(!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'exec-report-modal';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-in" role="dialog" aria-modal="true" aria-labelledby="exec-modal-title">
                <!-- Header -->
                <div class="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-bold">
                            <i class="ph ph-file-pdf"></i>
                        </div>
                        <div>
                            <h3 id="exec-modal-title" class="font-extrabold text-lg text-white">รายงานผู้บริหาร (สรุปรวมคะแนน)</h3>
                            <p class="text-xs text-slate-300">แบบสรุปรวมคะแนนในกลุ่มสาระการเรียนรู้/รายวิชา</p>
                        </div>
                    </div>
                    <button onclick="window.closeExecutiveReportModal()" class="text-slate-400 hover:text-white text-2xl p-1" aria-label="ปิด">
                        <i class="ph ph-x"></i>
                    </button>
                </div>

                <!-- Form Controls -->
                <div class="p-6 space-y-4 text-slate-800">
                    <!-- 1. เลือกประเภทคะแนนสอบ -->
                    <div>
                        <label class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">1. เลือกประเภทคะแนนสอบ</label>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <!-- Option 1: แบบหารครึ่ง เต็ม 50 (เลือกเป็นค่าเริ่มต้นตามสั่งการ) -->
                            <label class="cursor-pointer">
                                <input type="radio" name="exec-modal-score-type" value="half" checked class="peer sr-only">
                                <div class="h-full p-2.5 rounded-xl border-2 border-slate-200 peer-checked:border-indigo-600 peer-checked:bg-indigo-50/70 text-center transition hover:border-slate-300 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <i class="ph ph-divide text-2xl text-indigo-600 mb-0.5 block mx-auto"></i>
                                        <div class="font-extrabold text-slate-900 text-xs">แบบหารครึ่ง (เต็ม 50)</div>
                                    </div>
                                    <div class="text-[10px] text-indigo-700 font-bold mt-1">วิชาละ 50 (รวม 600/650)</div>
                                </div>
                            </label>

                            <!-- Option 2: ปลายภาค เต็ม 100 -->
                            <label class="cursor-pointer">
                                <input type="radio" name="exec-modal-score-type" value="final" class="peer sr-only">
                                <div class="h-full p-2.5 rounded-xl border-2 border-slate-200 peer-checked:border-emerald-500 peer-checked:bg-emerald-50/70 text-center transition hover:border-slate-300 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <i class="ph ph-calendar-check text-2xl text-emerald-600 mb-0.5 block mx-auto"></i>
                                        <div class="font-extrabold text-slate-900 text-xs">ปลายภาค (เต็ม 100)</div>
                                    </div>
                                    <div class="text-[10px] text-slate-500 mt-1">วิชาละ 100 (รวม 1,200/1,300)</div>
                                </div>
                            </label>

                            <!-- Option 3: กลางภาค -->
                            <label class="cursor-pointer">
                                <input type="radio" name="exec-modal-score-type" value="mid" class="peer sr-only">
                                <div class="h-full p-2.5 rounded-xl border-2 border-slate-200 peer-checked:border-emerald-500 peer-checked:bg-emerald-50/70 text-center transition hover:border-slate-300 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <i class="ph ph-calendar-blank text-2xl text-emerald-600 mb-0.5 block mx-auto"></i>
                                        <div class="font-extrabold text-slate-900 text-xs">กลางภาค</div>
                                    </div>
                                    <div class="text-[10px] text-slate-500 mt-1">คะแนนสอบกลางภาค</div>
                                </div>
                            </label>
                        </div>

                        <!-- Checkbox ปัดเศษเป็นค่าเต็ม -->
                        <div class="mt-2.5 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                            <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                                <input type="checkbox" id="exec-modal-round-integer" checked class="w-4 h-4 accent-indigo-600 rounded">
                                <span>ปัดจุดทศนิยมเป็นค่าเต็ม (จำนวนเต็ม ไม่มีจุด เช่น 48.5 ปัดเป็น 49)</span>
                            </label>
                        </div>
                    </div>

                    <!-- 2. เลือกรูปแบบกระดาษ (แนวตั้ง / แนวนอน) -->
                    <div>
                        <label class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">2. รูปแบบหน้ากระดาษ</label>
                        <div class="grid grid-cols-2 gap-3">
                            <label class="cursor-pointer">
                                <input type="radio" name="exec-modal-orientation" value="portrait" checked class="peer sr-only">
                                <div class="p-2.5 rounded-xl border-2 border-slate-200 peer-checked:border-indigo-600 peer-checked:bg-indigo-50/70 text-center transition shadow-sm">
                                    <i class="ph ph-file-text text-xl text-indigo-600 mb-0.5 block mx-auto"></i>
                                    <div class="font-extrabold text-slate-900 text-xs">A4 แนวตั้ง (Portrait)</div>
                                    <div class="text-[10px] text-emerald-700 font-bold">ช่องโปร่ง ไม่จมตาราง (แนะนำ)</div>
                                </div>
                            </label>
                            <label class="cursor-pointer">
                                <input type="radio" name="exec-modal-orientation" value="landscape" class="peer sr-only">
                                <div class="p-2.5 rounded-xl border-2 border-slate-200 peer-checked:border-indigo-600 peer-checked:bg-indigo-50/70 text-center transition shadow-sm">
                                    <i class="ph ph-file-image text-xl text-slate-600 mb-0.5 block mx-auto"></i>
                                    <div class="font-extrabold text-slate-900 text-xs">A4 แนวนอน (Landscape)</div>
                                    <div class="text-[10px] text-slate-500">คอลัมน์กว้างขึ้น</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- 3. เลือกขอบเขตห้องเรียน -->
                    <div>
                        <label class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                            ${isTeacher ? '3. ห้องประจำชั้นของคุณ' : '3. เลือกขอบเขตห้องเรียน'}
                        </label>
                        ${isTeacher ? `
                            <!-- กรณีครู: แสดงเฉพาะห้องประจำชั้นของตนเองเท่านั้น ไม่มีทางเห็นหรือเลือกห้องอื่น -->
                            <input type="hidden" name="exec-modal-scope-mode" value="single">
                            ${allClassEntries.length === 1 ? `
                                <div class="p-3.5 rounded-xl border-2 border-indigo-600 bg-indigo-50/70 flex items-center justify-between shadow-sm">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold shadow-sm">
                                            <i class="ph ph-chalkboard-teacher"></i>
                                        </div>
                                        <div>
                                            <div class="font-extrabold text-slate-900 text-sm">ห้อง ${esc(allClassEntries[0][1].name || allClassEntries[0][0])}</div>
                                            <div class="text-xs text-indigo-700 font-semibold">จำนวน ${(allClassEntries[0][1].students || []).length} คน (ห้องที่คุณเป็นครูประจำชั้น)</div>
                                        </div>
                                    </div>
                                    <span class="text-xs bg-indigo-600 text-white font-extrabold px-3 py-1 rounded-full shadow-sm">ห้องประจำชั้น</span>
                                </div>
                                <input type="hidden" id="exec-modal-class-select" value="${esc(allClassEntries[0][0])}">
                            ` : `
                                <div>
                                    <select id="exec-modal-class-select" class="w-full border-2 border-indigo-300 rounded-xl px-3 py-2.5 bg-indigo-50/50 font-bold text-slate-800 focus-ring text-sm">
                                        ${allClassEntries.map(([cId, cls]) => `
                                            <option value="${esc(cId)}" ${String(cId) === String(activeClassId) ? 'selected' : ''}>
                                                ห้อง ${esc(cls.name || cId)} (${(cls.students || []).length} คน)
                                            </option>
                                        `).join('')}
                                    </select>
                                    <p class="text-[11px] text-slate-500 mt-1.5">* แสดงเฉพาะห้องที่คุณได้รับมอบหมายเป็นครูประจำชั้นเท่านั้น</p>
                                </div>
                            `}
                        ` : `
                            <!-- กรณีผู้ดูแลระบบ: เลือกได้ทั้งรวมเล่มทั้งโรงเรียน หรือเฉพาะห้อง -->
                            <div class="space-y-2">
                                <label class="cursor-pointer block">
                                    <input type="radio" name="exec-modal-scope-mode" value="all" checked onchange="window.toggleExecutiveScopeMode(this.value)" class="peer sr-only">
                                    <div class="p-3 rounded-xl border-2 border-slate-200 peer-checked:border-indigo-600 peer-checked:bg-indigo-50/70 transition flex items-center justify-between shadow-sm">
                                        <div class="flex items-center gap-2.5">
                                            <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-bold">
                                                <i class="ph ph-buildings"></i>
                                            </div>
                                            <div>
                                                <div class="font-extrabold text-slate-900 text-sm">พิมพ์รวมทั้งหมดทั้งโรงเรียน</div>
                                                <div class="text-xs text-indigo-700 font-semibold">ป.1/1 ถึง ป.6/3 รวมทุกห้อง (${allClassEntries.length} ห้อง / ${allClassEntries.length} หน้า)</div>
                                            </div>
                                        </div>
                                        <span class="text-xs bg-indigo-600 text-white font-extrabold px-2.5 py-1 rounded-full">รวมเล่ม</span>
                                    </div>
                                </label>

                                <label class="cursor-pointer block">
                                    <input type="radio" name="exec-modal-scope-mode" value="single" onchange="window.toggleExecutiveScopeMode(this.value)" class="peer sr-only">
                                    <div class="p-3 rounded-xl border-2 border-slate-200 peer-checked:border-indigo-600 peer-checked:bg-indigo-50/70 transition flex items-center justify-between shadow-sm">
                                        <div class="flex items-center gap-2.5">
                                            <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-lg font-bold">
                                                <i class="ph ph-chalkboard-teacher"></i>
                                            </div>
                                            <div>
                                                <div class="font-extrabold text-slate-900 text-sm">เฉพาะห้องเรียนที่เลือก</div>
                                                <div class="text-xs text-slate-500">พิมพ์เฉพาะห้องใดห้องหนึ่ง (1 หน้า)</div>
                                            </div>
                                        </div>
                                        <span class="text-xs bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">เฉพาะห้อง</span>
                                    </div>
                                </label>
                            </div>

                            <div id="exec-single-class-wrap" class="hidden mt-2.5 pl-2 border-l-2 border-indigo-400">
                                <label for="exec-modal-class-select" class="block text-xs font-bold text-slate-600 mb-1">เลือกห้องเรียน:</label>
                                <select id="exec-modal-class-select" class="w-full border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-bold text-slate-800 focus-ring text-sm">
                                    ${allClassEntries.map(([cId, cls]) => `
                                        <option value="${esc(cId)}" ${String(cId) === String(activeClassId) ? 'selected' : ''}>
                                            ห้อง ${esc(cls.name || cId)} (${(cls.students || []).length} คน)
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Footer Action Buttons -->
                <div class="px-6 py-2.5 bg-teal-50/60 border-t border-teal-100 flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 text-xs font-bold text-teal-800">
                        <i class="ph ph-trend-up text-base text-teal-600"></i>
                        <span>ต้องการตรวจสอบและปัดคะแนน 54, 59, 64, 69, 74, 79 หรือไม่?</span>
                    </div>
                    <button type="button" onclick="window.closeExecutiveReportModal(); if(typeof window.showGradeBoundaryInspectorModal === 'function') window.showGradeBoundaryInspectorModal();" class="tactile-btn text-xs font-extrabold px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm flex items-center gap-1">
                        <i class="ph ph-magnifying-glass-plus"></i> ตรวจสอบและปัดคะแนน
                    </button>
                </div>
                <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row gap-2.5">
                    <button type="button" onclick="window.runExecutiveReportPrint()" class="flex-1 tactile-btn py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md">
                        <i class="ph ph-printer text-lg"></i> เปิดพิมพ์ / บันทึก PDF
                    </button>
                    <button type="button" onclick="window.runExecutiveReportDownload()" class="flex-1 tactile-btn py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md">
                        <i class="ph ph-download-simple text-lg"></i> ดาวน์โหลด .PDF
                    </button>
                </div>
            </div>
        </div>
        `;
    };

    /**
     * ปิดหน้าต่างตัวเลือก
     */
    window.closeExecutiveReportModal = function() {
        const modalEl = document.getElementById('exec-report-modal');
        if(modalEl) modalEl.innerHTML = '';
    };

    /**
     * คำนวณรายการห้องเรียนเป้าหมายจากตัวเลือก scope
     * หากเป็นครู จะตรวจสอบเข้มงวดให้เข้าถึงได้เฉพาะห้องประจำชั้นของตนเองเท่านั้น
     */
    function resolveTargetClasses(scope) {
        const all = getAllAvailableClassEntries();
        const homerooms = getTeacherHomeroomClassIds();
        if(homerooms !== null) {
            // กรณีครู: จำกัดเฉพาะห้องประจำชั้นของตนเองเท่านั้น ไม่มีทางเห็นหรือเลือกห้องอื่นเด็ดขาด
            const allowed = all.filter(([cId]) => homerooms.includes(String(cId)));
            if(scope === 'all') {
                return allowed;
            }
            return allowed.filter(([cId]) => String(cId) === String(scope));
        }
        if(scope === 'all') return all;
        return all.filter(([cId]) => String(cId) === String(scope));
    }

    /**
     * Preload คะแนนจาก Firestore สำหรับรายวิชาทั้งหมดของห้องที่เลือก
     */
    async function preloadScoresForClasses(targetClasses) {
        if(typeof window.firebaseLoadScoresForSubjectsBulk !== 'function') return;
        const allSubjectIds = new Set();
        targetClasses.forEach(([cId]) => {
            window.getAdminMidtermSubjectsForClass(cId).forEach(sub => allSubjectIds.add(String(sub.id)));
        });
        if(allSubjectIds.size > 0) {
            try {
                window.notify(`กำลังดึงคะแนนล่าสุดจากคลาวด์ (${allSubjectIds.size} วิชา)...`);
                await window.firebaseLoadScoresForSubjectsBulk(Array.from(allSubjectIds));
            } catch(e) {
                console.warn('Preload executive scores warning:', e);
            }
        }
    }

    /**
     * สั่งเปิดหน้าพิมพ์ / บันทึก PDF จาก Modal
     */
    window.runExecutiveReportPrint = async function() {
        const scoreTypeEl = document.querySelector('input[name="exec-modal-score-type"]:checked');
        const scoreType = scoreTypeEl ? scoreTypeEl.value : 'half';
        
        const roundEl = document.getElementById('exec-modal-round-integer');
        const roundInteger = roundEl ? roundEl.checked : true;

        const orientEl = document.querySelector('input[name="exec-modal-orientation"]:checked');
        const orientation = orientEl ? orientEl.value : 'portrait';

        const isTeacher = !!(window.state && state.user && state.user.role === 'teacher');
        const scopeModeEl = document.querySelector('input[name="exec-modal-scope-mode"]:checked');
        const scopeMode = scopeModeEl ? scopeModeEl.value : (isTeacher ? 'single' : 'all');
        let scope = 'all';
        if(isTeacher || scopeMode === 'single') {
            const selectEl = document.getElementById('exec-modal-class-select');
            scope = selectEl ? selectEl.value : (isTeacher ? (getAllAvailableClassEntries()[0] ? getAllAvailableClassEntries()[0][0] : '') : 'all');
        }

        window.closeExecutiveReportModal();
        await window.openExecutiveReportPrint(scoreType, scope, orientation, roundInteger);
    };

    /**
     * วางแผนการแบ่งหน้าสำหรับรายงานผู้บริหาร
     * ในโหมดแนวตั้ง (Portrait): ห้องที่มีนักเรียนไม่เกิน 58 คน (เช่น ป.6/1 ที่มี 55 คน) จะแสดงใน 1 หน้าเต็มพอดี
     * หากเกิน 58 คน (หรือในแนวนอนที่เกิน 38 คน) จะแบ่งหน้าย่อยอย่างสวยงาม (เช่น ตอนที่ 1/2, ตอนที่ 2/2) เพื่อไม่ให้ตกขอบ
     */
    function buildExecutiveReportPagePlan(targetClasses, orientation = 'portrait') {
        const isPortrait = orientation !== 'landscape';
        const maxPerPage = isPortrait ? 58 : 38;
        const plan = [];

        targetClasses.forEach(([cId, cls]) => {
            const fullStudents = (cls && cls.students) ? [...cls.students] : [];
            const total = fullStudents.length;

            if (total <= maxPerPage) {
                plan.push({
                    cId,
                    cls,
                    students: fullStudents,
                    startIndex: 0,
                    partLabel: ''
                });
            } else {
                const totalParts = Math.ceil(total / maxPerPage);
                const chunkSize = Math.ceil(total / totalParts);
                for (let part = 0; part < totalParts; part++) {
                    const start = part * chunkSize;
                    const chunk = fullStudents.slice(start, start + chunkSize);
                    plan.push({
                        cId,
                        cls,
                        students: chunk,
                        startIndex: start,
                        partLabel: ` (ตอนที่ ${part + 1}/${totalParts})`
                    });
                }
            }
        });

        return plan;
    }

    /**
     * เปิดหน้าต่าง Print View พร้อมปุ่มสั่งพิมพ์และดาวน์โหลด PDF
     */
    window.openExecutiveReportPrint = async function(scoreType = 'half', scope = 'all', orientation = 'portrait', roundInteger = true) {
        const isPortrait = orientation !== 'landscape';
        const targetClasses = resolveTargetClasses(scope);
        if(!targetClasses.length) {
            window.notify('ไม่พบห้องเรียนสำหรับพิมพ์รายงาน', true);
            return;
        }

        let scoreLabel = 'ปลายภาค';
        if(scoreType === 'half') scoreLabel = 'ปลายภาค (หารครึ่ง)';
        else if(scoreType === 'mid') scoreLabel = 'กลางภาค';

        await preloadScoresForClasses(targetClasses);

        // ฉีดสไตล์พิมพ์
        ensurePrintStyles(isPortrait);

        const printView = document.getElementById('print-view');
        if(!printView) {
            window.notify('ไม่พบส่วนแสดงผลพิมพ์ (#print-view)', true);
            return;
        }

        const plan = buildExecutiveReportPagePlan(targetClasses, orientation);
        const totalPages = plan.length;
        const pagesHtml = plan.map((item, index) => {
            return window.buildExecutiveReportPage(
                item.cId,
                item.cls,
                scoreType,
                index + 1,
                totalPages,
                orientation,
                roundInteger,
                item.students,
                item.startIndex,
                item.partLabel
            );
        }).join('');

        const isAllScope = targetClasses.length > 1;
        const scopeTitleText = isAllScope 
            ? `รวมทั้งหมดทั้งโรงเรียน (${targetClasses.length} ห้อง)`
            : (targetClasses[0][1].name || '1 ห้อง');

        const orientBadgeText = isPortrait ? 'A4 แนวตั้ง' : 'A4 แนวนอน';

        printView.className = 'executive-print-mode fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] overflow-y-auto print:bg-white print:static print:overflow-visible';
        printView.innerHTML = `
            <!-- Sticky Toolbar (ไม่แสดงตอนสั่งพิมพ์) -->
            <div class="no-print sticky top-0 w-full bg-slate-900/95 backdrop-blur-md p-3.5 flex flex-wrap items-center justify-between gap-3 z-[210] shadow-xl border-b border-white/10 px-6">
                <div class="flex items-center gap-3 text-white">
                    <div class="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold">
                        <i class="ph ph-file-pdf"></i>
                    </div>
                    <div>
                        <div class="font-extrabold text-sm text-white flex items-center gap-2">
                            แบบสรุปรวมคะแนนผู้บริหาร (${scoreLabel}) — ${scopeTitleText}
                            <span class="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">${orientBadgeText}</span>
                        </div>
                        <div class="text-xs text-slate-300">
                            ${targetClasses.length} ห้องเรียน (${totalPages} หน้า) — โรงเรียนอนุพงศ์พัชรินทร์
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2.5">
                    <button type="button" onclick="window.print()" class="tactile-btn bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg shadow-lg flex items-center font-extrabold text-sm">
                        <i class="ph ph-printer mr-2 text-lg"></i> ยืนยันสั่งพิมพ์ ${totalPages > 1 ? `ทั้งหมด ${totalPages} หน้า` : 'หน้านี้'} (บันทึก PDF)
                    </button>
                    <button type="button" onclick="window.runExecutiveReportDownloadFromPrintView('${scoreType}', '${scope}', '${orientation}', ${roundInteger})" id="exec-printview-download-btn" class="tactile-btn bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center font-extrabold text-sm">
                        <i class="ph ph-download-simple mr-2 text-lg"></i> ดาวน์โหลด .PDF ${totalPages > 1 ? `(รวม ${totalPages} หน้า)` : ''}
                    </button>
                    <button type="button" onclick="if(typeof window.showGradeBoundaryInspectorModal === 'function') window.showGradeBoundaryInspectorModal('${scope}')" class="tactile-btn bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center font-extrabold text-sm" title="ตรวจสอบและปัดคะแนนคาบเกี่ยวเกรด 54, 59, 64, 69, 74, 79 (+1 คะแนน)">
                        <i class="ph ph-trend-up mr-2 text-lg"></i> ปัดคะแนนคาบเกี่ยวเกรด
                    </button>
                    <button type="button" onclick="if(typeof window.showOver100AuditModal === 'function') window.showOver100AuditModal()" class="tactile-btn bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center font-extrabold text-sm" title="ตรวจสอบคะแนนเกินเกณฑ์ที่ตั้งไว้ (กลางภาค/ปลายภาค/ตัวชี้วัด/เกิน 100)">
                        <i class="ph ph-warning-octagon mr-2 text-lg"></i> ตรวจคะแนนเกิน
                    </button>
                    <button type="button" onclick="window.closeExecutiveReportPrint()" class="tactile-btn bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg flex items-center font-bold text-sm">
                        <i class="ph ph-x mr-1.5 text-lg"></i> ปิด
                    </button>
                </div>
            </div>

            <!-- หน้าเอกสาร A4 -->
            <div class="py-8 px-4 print:py-0 print:px-0">
                ${pagesHtml}
            </div>
        `;
        printView.classList.remove('hidden');
    };

    /**
     * ปิดหน้าต่าง Print View และคืนค่าสไตล์ปกติ
     */
    window.closeExecutiveReportPrint = function() {
        removePrintStyles();
        const printView = document.getElementById('print-view');
        if(printView) {
            printView.innerHTML = '';
            printView.classList.add('hidden');
            printView.className = 'hidden fixed inset-0 z-[200]';
        }
    };

    /**
     * สั่งดาวน์โหลดไฟล์ PDF โดยตรง จาก Modal
     */
    window.runExecutiveReportDownload = async function() {
        const scoreTypeEl = document.querySelector('input[name="exec-modal-score-type"]:checked');
        const scoreType = scoreTypeEl ? scoreTypeEl.value : 'half';
        
        const roundEl = document.getElementById('exec-modal-round-integer');
        const roundInteger = roundEl ? roundEl.checked : true;

        const orientEl = document.querySelector('input[name="exec-modal-orientation"]:checked');
        const orientation = orientEl ? orientEl.value : 'portrait';

        const isTeacher = !!(window.state && state.user && state.user.role === 'teacher');
        const scopeModeEl = document.querySelector('input[name="exec-modal-scope-mode"]:checked');
        const scopeMode = scopeModeEl ? scopeModeEl.value : (isTeacher ? 'single' : 'all');
        let scope = 'all';
        if(isTeacher || scopeMode === 'single') {
            const selectEl = document.getElementById('exec-modal-class-select');
            scope = selectEl ? selectEl.value : (isTeacher ? (getAllAvailableClassEntries()[0] ? getAllAvailableClassEntries()[0][0] : '') : 'all');
        }

        window.closeExecutiveReportModal();
        await window.exportExecutiveReportDownloadPdf(scoreType, scope, orientation, roundInteger);
    };

    /**
     * สั่งดาวน์โหลดไฟล์ PDF จากแถบเครื่องมือในหน้า Print View
     */
    window.runExecutiveReportDownloadFromPrintView = async function(scoreType, scope, orientation = 'portrait', roundInteger = true) {
        const btn = document.getElementById('exec-printview-download-btn');
        const origText = btn ? btn.innerHTML : '';
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="ph ph-spinner-gap animate-spin mr-2 text-lg"></i> กำลังสร้าง PDF';
        }
        try {
            await window.exportExecutiveReportDownloadPdf(scoreType, scope, orientation, roundInteger);
        } finally {
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
        }
    };

    /**
     * สร้างและดาวน์โหลดไฟล์ .PDF ขนาด A4 ด้วย jsPDF + html2canvas
     * ใส่คลาส is-exporting-pdf ลงบน pageEl โดยตรงเพื่อชดเชย Baseline ของฟอนต์ไทยใน html2canvas ตัวหนังสือไม่จมตาราง
     */
    window.exportExecutiveReportDownloadPdf = async function(scoreType = 'half', scope = 'all', orientation = 'portrait', roundInteger = true) {
        const isPortrait = orientation !== 'landscape';
        const JsPdfClass = window.jspdf && window.jspdf.jsPDF;
        if(typeof window.html2canvas !== 'function' || !JsPdfClass) {
            window.notify('ไม่พบไลบรารีสร้าง PDF กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่', true);
            return;
        }

        const targetClasses = resolveTargetClasses(scope);
        if(!targetClasses.length) {
            const isTeacher = !!(window.state && state.user && state.user.role === 'teacher');
            window.notify(isTeacher ? 'คุณสามารถดูและพิมพ์ได้เฉพาะห้องที่คุณเป็นครูประจำชั้นเท่านั้น' : 'ไม่พบห้องเรียนสำหรับดาวน์โหลด PDF', true);
            return;
        }

        let scoreLabel = 'ปลายภาค';
        if(scoreType === 'half') scoreLabel = 'ปลายภาค_หารครึ่ง';
        else if(scoreType === 'mid') scoreLabel = 'กลางภาค';

        const schoolYear = String((window.DB && DB.schoolInfo && DB.schoolInfo.year) || '2568');
        const term = String((window.state && state.term) || '1');

        await preloadScoresForClasses(targetClasses);

        const plan = buildExecutiveReportPagePlan(targetClasses, orientation);
        const total = plan.length;

        window.notify(`กำลังสร้างไฟล์ PDF รายงานผู้บริหาร (${total} หน้า)...`);

        const pdf = new JsPdfClass({
            orientation: isPortrait ? 'portrait' : 'landscape',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        ensurePrintStyles(isPortrait);

        const renderWidth = isPortrait ? 794 : 1122;
        const renderHeight = isPortrait ? 1123 : 793;

        let renderWrap = document.getElementById('exec-pdf-render-wrap');
        if(!renderWrap) {
            renderWrap = document.createElement('div');
            renderWrap.id = 'exec-pdf-render-wrap';
            renderWrap.style.cssText = `position:fixed;top:0;left:0;width:${renderWidth}px;height:${renderHeight}px;background:#ffffff;z-index:99999;pointer-events:none;overflow:hidden;box-sizing:border-box;`;
            document.body.appendChild(renderWrap);
        }

        try {
            if(document.fonts && document.fonts.ready) await document.fonts.ready;

            for(let i = 0; i < total; i++) {
                const item = plan[i];
                window.notify(`กำลังประมวลผล PDF หน้า ${i + 1}/${total} (${item.cls.name || item.cId}${item.partLabel})...`);

                renderWrap.innerHTML = window.buildExecutiveReportPage(
                    item.cId,
                    item.cls,
                    scoreType,
                    i + 1,
                    total,
                    orientation,
                    roundInteger,
                    item.students,
                    item.startIndex,
                    item.partLabel
                );
                const pageEl = renderWrap.firstElementChild;
                
                // ใส่คลาส is-exporting-pdf ลงบน pageEl โดยตรง เพื่อให้ html2canvas โคลนติดไปด้วย
                pageEl.classList.add('is-exporting-pdf');

                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

                const canvas = await window.html2canvas(pageEl, {
                    scale: 2.5, // 2.5x resolution for ultra-sharp print clarity
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    logging: false,
                    width: renderWidth,
                    height: renderHeight
                });

                if(i > 0) pdf.addPage('a4', isPortrait ? 'portrait' : 'landscape');
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, isPortrait ? 210 : 297, isPortrait ? 297 : 210, undefined, 'FAST');
            }

            const scopeTag = scope === 'all' ? 'ทุกห้องทั้งโรงเรียน' : (targetClasses[0][1].name || 'ห้องเดียว');
            const orientTag = isPortrait ? 'แนวตั้ง' : 'แนวนอน';
            const fileName = `รายงานผู้บริหาร_สรุปรวมคะแนน_${scoreLabel}_${scopeTag}_${orientTag}_เทอม${term}_${schoolYear}.pdf`;
            pdf.save(fileName);
            window.notify(`ดาวน์โหลด ${fileName} สำเร็จ (${total} หน้า)`);
        } catch(err) {
            console.error('Executive PDF download error:', err);
            window.notify('เกิดข้อผิดพลาดในการดาวน์โหลด PDF กรุณาลองใหม่', true);
        } finally {
            if(renderWrap) renderWrap.remove();
        }
    };

    /**
     * อัปเดต window.exportAdminExamSummaryPdf เดิมให้เรียกใช้ modal ใหม่
     */
    window.exportAdminExamSummaryPdf = function(examType = null) {
        const type = examType || (document.getElementById('admin-report-score-type') ? document.getElementById('admin-report-score-type').value : 'half');
        window.openExecutiveReportModal();
        setTimeout(() => {
            const radio = document.querySelector(`input[name="exec-modal-score-type"][value="${type === 'mid' ? 'mid' : (type === 'final' ? 'final' : 'half')}"]`);
            if(radio) radio.checked = true;
        }, 50);
    };

})();
