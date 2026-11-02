/* ANPSCORE — โหลดไลบรารีส่งออก Excel / PDF ทีหลัง
   ไลบรารีพวกนี้รวมกันราว 1.5MB เดิมโหลดแบบ defer ใน <head> ซึ่งต้องรันเสร็จก่อน cloud.js
   ทำให้การเชื่อมต่อคลาวด์และการดึงคะแนนเริ่มช้าไปด้วย ตอนนี้จึงโหลดเบื้องหลังหลังหน้าเว็บพร้อมแล้ว
   และฟังก์ชันที่ต้องใช้ไลบรารีจะรอให้โหลดเสร็จก่อนทำงานเสมอ */

(function() {
    const VENDOR_SRC = {
        xlsx: { src: 'vendor/xlsx.full.min.js', ready: () => typeof window.XLSX !== 'undefined' },
        jspdf: { src: 'vendor/jspdf.umd.min.js', ready: () => !!(window.jspdf && window.jspdf.jsPDF) },
        html2canvas: { src: 'vendor/html2canvas.min.js', ready: () => typeof window.html2canvas === 'function' }
    };
    const pending = {};

    const loadOne = (name) => {
        const lib = VENDOR_SRC[name];
        if(!lib) return Promise.reject(new Error('unknown library ' + name));
        if(lib.ready()) return Promise.resolve();
        if(pending[name]) return pending[name];
        pending[name] = new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = lib.src;
            el.async = true;
            el.onload = () => lib.ready() ? resolve() : reject(new Error(name + ' did not initialise'));
            el.onerror = () => reject(new Error('โหลด ' + lib.src + ' ไม่สำเร็จ'));
            document.head.appendChild(el);
        }).catch(err => { delete pending[name]; throw err; });
        return pending[name];
    };

    window.loadVendorLibs = function(names) {
        return Promise.all((names || []).map(loadOne));
    };

    // ฟังก์ชันที่เรียกใช้ไลบรารี: ห่อให้รอไลบรารีก่อน ถ้าผู้ใช้กดเร็วกว่าที่โหลดเบื้องหลังเสร็จ
    const NEEDS = {
        xlsx: [
            'processExcelImport',
            'exportAdminExamImportTemplate', 'exportAdminExamSummary', 'exportExecutiveReportExcel',
            'exportGradeBoundaryToExcel', 'importAdminExamTemplate', 'importAdminMidtermSummary',
            't_exportScoreExcel', 't_importScores',
            'exportCurrentTermScores', 'downloadTermScoreArchive'
        ],
        pdf: ['exportExecutiveReportDownloadPdf']
    };
    const wrap = (fnName, libs) => {
        const original = window[fnName];
        if(typeof original !== 'function' || original.__vendorWrapped) return;
        const wrapped = async function() {
            try {
                await window.loadVendorLibs(libs);
            } catch(err) {
                console.error(err);
                if(typeof window.notify === 'function') window.notify('โหลดเครื่องมือส่งออก/นำเข้าไฟล์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', true);
                return;
            }
            return original.apply(this, arguments);
        };
        wrapped.__vendorWrapped = true;
        window[fnName] = wrapped;
    };

    const wrapAll = () => {
        NEEDS.xlsx.forEach(n => wrap(n, ['xlsx']));
        NEEDS.pdf.forEach(n => wrap(n, ['jspdf', 'html2canvas']));
    };

    // สคริปต์ของแอปทั้งหมดอยู่ก่อนไฟล์นี้ใน index.html ฟังก์ชันจึงมีครบแล้ว
    wrapAll();
    // บางฟังก์ชันถูกสร้างภายหลัง (เช่นตอนหน้า DOM พร้อม) ห่อซ้ำอีกรอบ
    document.addEventListener('DOMContentLoaded', wrapAll);

    // โหลดเบื้องหลังเมื่อหน้าเว็บว่าง ส่วนใหญ่จะเสร็จก่อนผู้ใช้กดส่งออกครั้งแรก
    const preload = () => window.loadVendorLibs(['xlsx', 'jspdf', 'html2canvas']).catch(err => console.warn('preload vendor:', err));
    window.addEventListener('load', () => {
        if('requestIdleCallback' in window) requestIdleCallback(preload, { timeout: 6000 });
        else setTimeout(preload, 2500);
    });
})();
