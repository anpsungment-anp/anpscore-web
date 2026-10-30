/* ANPSCORE — การเข้าถึงและการใช้งานด้วยแป้นพิมพ์
   ปรับเสริมจากภายนอก ไม่แก้ฟังก์ชันเดิม เพื่อให้ของที่ใช้งานอยู่ไม่กระทบ */

(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    /* =====================================================================
       กล่องหน้าต่าง (Modal)
       เดิมกด Esc ปิดไม่ได้ โฟกัสหลุดไปอยู่หลังกล่อง และโปรแกรมอ่านหน้าจอ
       ไม่รู้ว่ามีหน้าต่างเปิดอยู่
       ===================================================================== */

    const container = $('modal-container');
    const content = $('modal-content');
    let lastFocused = null;

    if (container && content) {
        container.setAttribute('role', 'dialog');
        container.setAttribute('aria-modal', 'true');
        container.setAttribute('aria-label', 'หน้าต่างย่อย');
        content.setAttribute('tabindex', '-1');

        const baseShowModal = window.showModal;
        window.showModal = function (html, widthClass) {
            lastFocused = document.activeElement;
            baseShowModal(html, widthClass);
            content.setAttribute('tabindex', '-1');
            labelIconButtons(content);
            // ย้ายโฟกัสทันที ไม่รอ requestAnimationFrame
            // เพราะ rAF ไม่ทำงานเมื่อแท็บถูกซ่อนอยู่ โฟกัสจะค้างอยู่หลังกล่อง
            const first = content.querySelector(FOCUSABLE);
            try { (first || content).focus(); } catch (e) { }
        };

        const baseHideModal = window.hideModal;
        window.hideModal = function () {
            baseHideModal();
            // คืนโฟกัสกลับไปที่ปุ่มที่กดเปิดหน้าต่าง ไม่ให้หลุดไปต้นหน้า
            if (lastFocused && document.contains(lastFocused)) {
                try { lastFocused.focus(); } catch (e) { }
            }
            lastFocused = null;
        };

        const modalOpen = () => !container.classList.contains('hidden');

        document.addEventListener('keydown', (e) => {
            if (!modalOpen()) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                window.hideModal();
                return;
            }

            /* ขังโฟกัสไว้ในกล่อง ไม่ให้ Tab หลุดไปหน้าเบื้องหลัง */
            if (e.key === 'Tab') {
                const items = Array.from(content.querySelectorAll(FOCUSABLE))
                    .filter(el => el.offsetParent !== null);
                if (!items.length) return;
                const first = items[0];
                const last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault(); last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault(); first.focus();
                }
            }
        });
    }

    /* =====================================================================
       ข้อความแจ้งเตือน (Toast)
       เดิมโปรแกรมอ่านหน้าจอไม่อ่านให้เลย ผู้ใช้จึงไม่รู้ว่าบันทึกสำเร็จหรือไม่
       ===================================================================== */

    const toast = $('toast');
    if (toast && window.notify) {
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.setAttribute('aria-atomic', 'true');

        const baseNotify = window.notify;
        window.notify = function (msg, isError) {
            // ข้อความผิดพลาดต้องแทรกอ่านทันที ไม่ต้องรอให้อ่านอย่างอื่นจบ
            toast.setAttribute('aria-live', isError ? 'assertive' : 'polite');
            return baseNotify(msg, isError);
        };
    }

    /* =====================================================================
       เลื่อนช่องกรอกคะแนนด้วยแป้นลูกศร
       ครูกรอกคะแนนทีละคอลัมน์เป็นสิบ ๆ แถว เดิมต้องกด Tab ไล่ไปทีละช่อง
       ซึ่งวิ่งตามแนวนอน ผิดทิศทางกับที่กรอกจริง
       ===================================================================== */

    const moveWithinColumn = (input, direction) => {
        const row = input.closest('tr');
        if (!row) return false;

        const cells = Array.from(row.querySelectorAll('.scorebook-input'));
        const columnIndex = cells.indexOf(input);
        if (columnIndex < 0) return false;

        const table = row.closest('table');
        if (!table) return false;

        const rows = Array.from(table.querySelectorAll('tr'))
            .filter(r => r.querySelector('.scorebook-input'));
        const rowIndex = rows.indexOf(row);
        const target = rows[rowIndex + direction];
        if (!target) return false;

        const targetCells = target.querySelectorAll('.scorebook-input');
        const next = targetCells[columnIndex];
        if (!next) return false;

        next.focus();
        if (typeof next.select === 'function') next.select();
        return true;
    };

    document.addEventListener('keydown', (e) => {
        const el = e.target;
        if (!el || !el.classList || !el.classList.contains('scorebook-input')) return;

        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            if (moveWithinColumn(el, 1)) e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            if (moveWithinColumn(el, -1)) e.preventDefault();
        }
    });

    /* =====================================================================
       ปุ่มที่มีแต่ไอคอน
       เดิมโปรแกรมอ่านหน้าจออ่านได้แค่ว่า "ปุ่ม" ไม่รู้ว่าปุ่มอะไร
       เนื้อหาส่วนใหญ่สร้างด้วย JavaScript จึงต้องเฝ้าดูการเปลี่ยนแปลงของหน้า
       ===================================================================== */

    const ICON_LABELS = {
        'ph-x': 'ปิด',
        'ph-trash': 'ลบ',
        'ph-pencil-simple': 'แก้ไข',
        'ph-pencil': 'แก้ไข',
        'ph-plus': 'เพิ่ม',
        'ph-printer': 'พิมพ์',
        'ph-download-simple': 'ดาวน์โหลด',
        'ph-upload-simple': 'อัปโหลด',
        'ph-magnifying-glass': 'ค้นหา',
        'ph-arrow-left': 'ย้อนกลับ',
        'ph-arrow-right': 'ถัดไป',
        'ph-caret-left': 'ก่อนหน้า',
        'ph-caret-right': 'ถัดไป',
        'ph-caret-down': 'ขยาย',
        'ph-caret-up': 'ย่อ',
        'ph-list': 'เปิดเมนู',
        'ph-gear': 'ตั้งค่า',
        'ph-gear-six': 'ตั้งค่า',
        'ph-eye': 'ดูรายละเอียด',
        'ph-copy': 'คัดลอก',
        'ph-clock-counter-clockwise': 'ประวัติการใช้งาน',
        'ph-users-three': 'ผู้ใช้ที่ออนไลน์',
        'ph-user-switch': 'ย้ายผู้ใช้',
        'ph-sign-out': 'ออกจากระบบ',
        'ph-moon': 'สลับเป็นโหมดกลางคืน',
        'ph-sun': 'สลับเป็นโหมดกลางวัน'
    };

    /* ประกาศแบบ function เพื่อให้ส่วนของกล่องหน้าต่างด้านบนเรียกใช้ได้ */
    function labelIconButtons(root) {
        const buttons = root.querySelectorAll('button:not([aria-label]), a:not([aria-label])');
        buttons.forEach(btn => {
            if (btn.textContent.trim()) return;          // มีข้อความอยู่แล้ว
            const icon = btn.querySelector('i[class*="ph-"]');
            if (!icon) return;

            const match = Array.from(icon.classList).find(c => ICON_LABELS[c]);
            const label = match ? ICON_LABELS[match] : (btn.getAttribute('title') || '');
            if (label) btn.setAttribute('aria-label', label);
        });
    }

    labelIconButtons(document);

    let pending = null;
    const observer = new MutationObserver(() => {
        if (pending) return;
        pending = setTimeout(() => {
            pending = null;
            labelIconButtons(document);
        }, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
