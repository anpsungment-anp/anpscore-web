import openpyxl
import json
import os

def main():
    wb_path = r'f:\เก็บงานหน้าจอ\ปี 69\ปพ.1 69\01.PP2551P6_18วิชา_Onet4วิชา_ไม่แสดงโอเน็ต_360คน-อนุพงศ์พัชรินทร์.xlsm'
    print(f"Loading {wb_path}...")
    wb = openpyxl.load_workbook(wb_path, data_only=True)

    def sheet_rows(name):
        if name not in wb.sheetnames:
            return []
        ws = wb[name]
        rows = []
        for r in ws.iter_rows(values_only=True):
            rows.append([str(c).strip() if c is not None else '' for c in r])
        return rows

    def cell_at(rows, r, c):
        if r < len(rows) and c < len(rows[r]):
            val = rows[r][c]
            if val is None:
                return ''
            s = str(val).strip()
            if s.endswith('.0') and s[:-2].replace('-', '').isdigit():
                s = s[:-2]
            return s
        return ''

    # 1. School Basic Info
    basic = sheet_rows('ข้อมูลพื้นฐาน')
    school = {
        'name': cell_at(basic, 3, 3) or 'อนุพงศ์พัชรินทร์',
        'affiliation': cell_at(basic, 4, 3) or 'สำนักงานศึกษาธิการจังหวัดแพร่',
        'area': cell_at(basic, 5, 3) or 'แพร่',
        'tambon': cell_at(basic, 6, 3) or 'สูงเม่น',
        'amphoe': cell_at(basic, 7, 3) or 'สูงเม่น',
        'province': cell_at(basic, 8, 3) or 'แพร่',
        'registrar': cell_at(basic, 9, 3) or 'นายเชาวลิต  กลไกร',
        'registrarPosition': cell_at(basic, 10, 3) or 'นายทะเบียน',
        'director': cell_at(basic, 11, 3) or 'นางพัชรินทร์  กันทะเสน',
        'directorPosition': cell_at(basic, 12, 3) or 'ผู้อำนวยการโรงเรียน',
        'logo': '',
        'addressLine': ''
    }
    print("School:", school)

    # 2. Curriculum
    cur = sheet_rows('หลักสูตร')
    bands = [
        { 'level': 1, 'base': 0,  'subFrom': 3,  'subTo': 20, 'actFrom': 22, 'actTo': 26 },
        { 'level': 2, 'base': 8,  'subFrom': 3,  'subTo': 20, 'actFrom': 22, 'actTo': 26 },
        { 'level': 3, 'base': 16, 'subFrom': 3,  'subTo': 20, 'actFrom': 22, 'actTo': 26 },
        { 'level': 4, 'base': 0,  'subFrom': 31, 'subTo': 48, 'actFrom': 50, 'actTo': 54 },
        { 'level': 5, 'base': 8,  'subFrom': 31, 'subTo': 48, 'actFrom': 50, 'actTo': 54 },
        { 'level': 6, 'base': 16, 'subFrom': 31, 'subTo': 48, 'actFrom': 50, 'actTo': 54 }
    ]
    curriculum = {}
    for b in bands:
        subs = []
        acts = []
        for r in range(b['subFrom'], b['subTo'] + 1):
            code = cell_at(cur, r, b['base'] + 1)
            name = cell_at(cur, r, b['base'] + 2)
            if not code and not name:
                continue
            if name == 'ชื่อรายวิชา' or code == 'รหัสวิชา':
                continue
            # Fix code for ภาษาไทย if missing in level 6
            if not code and 'ภาษาไทย' in name:
                code = f'ท1{b["level"]}101'
            subs.append({
                'code': code,
                'name': name,
                'type': cell_at(cur, r, b['base'] + 3) or 'พื้นฐาน',
                'area': cell_at(cur, r, b['base'] + 4),
                'hours': cell_at(cur, r, b['base'] + 5),
                'credit': cell_at(cur, r, b['base'] + 6)
            })
        for r in range(b['actFrom'], b['actTo'] + 1):
            code = cell_at(cur, r, b['base'] + 1)
            name = cell_at(cur, r, b['base'] + 2)
            if not code and not name:
                continue
            if name == 'ชื่อรายวิชา' or code == 'รหัสวิชา':
                continue
            acts.append({
                'code': code,
                'name': name,
                'hours': cell_at(cur, r, b['base'] + 5)
            })
        lvl_key = str(b['level'])
        curriculum[lvl_key] = { 'subjects': subs, 'activities': acts }
        print(f"Level {lvl_key}: {len(subs)} subjects, {len(acts)} activities")

    # 3. Students
    stu_rows = sheet_rows('ข้อมูลนักเรียน')
    start_year = cell_at(stu_rows, 3, 5) or '2564'
    print(f"Start year: {start_year}")

    map_cols = {
        'room': 0, 'no': 1, 'studentId': 2, 'prefix': 3, 'first': 4, 'last': 5, 'citizenId': 6,
        'entryD': 7, 'entryM': 8, 'entryY': 9, 'prevSchool': 10, 'prevProvince': 11, 'prevLevel': 12,
        'birthD': 13, 'birthM': 14, 'birthY': 15, 'sex': 16, 'nationality': 17, 'religion': 18,
        'father': 19, 'mother': 20, 'pp1Set': 21, 'pp1No': 22, 'pp2No': 23,
        'gradD': 24, 'gradM': 25, 'gradY': 26, 'leaveD': 27, 'leaveM': 28, 'leaveY': 29, 'leaveReason': 30,
        'evalBasic': 31, 'evalRead': 32, 'evalChar': 33, 'evalAct': 34,
        'decBasic': 35, 'decRead': 36, 'decChar': 37, 'decAct': 38,
        'onet_thai': 39, 'onet_math': 40, 'onet_sci': 41, 'onet_soc': 42,
        'onet_health': 43, 'onet_art': 44, 'onet_work': 45, 'onet_eng': 46,
        'onetAvg': 47, 'pp1Note': 52
    }
    students = []
    for r in range(6, len(stu_rows)):
        sid = cell_at(stu_rows, r, 2)
        first = cell_at(stu_rows, r, 4)
        if not sid and not first:
            continue
        rec = {}
        for k, c in map_cols.items():
            rec[k] = cell_at(stu_rows, r, c)
        if not rec.get('studentId'):
            continue
        
        # Ensure level is set
        rec['level'] = 6
        if not rec.get('room'):
            rec['room'] = '1'
        if not rec.get('nationality'):
            rec['nationality'] = 'ไทย'
        if not rec.get('religion'):
            rec['religion'] = 'พุทธ'
        if not rec.get('entryD'):
            rec['entryD'] = '13'
            rec['entryM'] = 'พฤษภาคม'
            rec['entryY'] = '2564'
        if not rec.get('gradD'):
            rec['gradD'] = '31'
            rec['gradM'] = 'มีนาคม'
            rec['gradY'] = '2569'
        if not rec.get('evalBasic'):
            rec['evalBasic'] = 'ผ่าน'
        if not rec.get('evalRead'):
            rec['evalRead'] = 'ดีเยี่ยม'
        if not rec.get('evalChar'):
            rec['evalChar'] = 'ดีเยี่ยม'
        if not rec.get('evalAct'):
            rec['evalAct'] = 'ผ่าน'
        if not rec.get('decBasic'):
            rec['decBasic'] = 'ผ่าน'
        if not rec.get('decRead'):
            rec['decRead'] = 'ผ่าน'
        if not rec.get('decChar'):
            rec['decChar'] = 'ผ่าน'
        if not rec.get('decAct'):
            rec['decAct'] = 'ผ่าน'

        students.append(rec)

    print(f"Total students extracted: {len(students)}")

    # 4. Certificate data
    cert_rows = sheet_rows('ข้อมูลใบรับรอง')
    cert_data = {}
    if cert_rows:
        for r in range(6, len(cert_rows)):
            sid = cell_at(cert_rows, r, 2)
            if not sid:
                continue
            cert_data[sid] = {
                'docNo': cell_at(cert_rows, r, 6),
                'd': cell_at(cert_rows, r, 7) or '9',
                'm': cell_at(cert_rows, r, 8) or 'มีนาคม',
                'y': cell_at(cert_rows, r, 9) or '2567',
                'l1': cell_at(cert_rows, r, 10) or 'กำลังศึกษาระดับชั้นประถมศึกษาปีที่ 6',
                'l2': cell_at(cert_rows, r, 11) or 'มีระดับผลการเรียนระดับดี',
                'l3': cell_at(cert_rows, r, 12) or 'มีความประพฤติดี',
                'note': cell_at(cert_rows, r, 13) or 'ใบรับรองนี้มีอายุ 120 วัน นับแต่วันที่ออกให้'
            }
    print(f"Cert data count: {len(cert_data)}")

    # 5. Grades 1 - 6
    quality_map = { '3': 'ดีเยี่ยม', '2': 'ดี', '1': 'ผ่าน', '0': 'ไม่ผ่าน' }
    grades = {}
    for level in range(1, 7):
        lvl_key = str(level)
        grades[lvl_key] = { 'year': '', 'records': {} }
        g = sheet_rows(f'เกรด{level}')
        year = cell_at(g, 0, 3)
        if not year:
            if start_year and start_year.isdigit():
                year = str(int(start_year) + level - 1)
        grades[lvl_key]['year'] = year

        cols = []
        for c in range(7, 25):
            cols.append({ 'c': c, 'code': cell_at(g, 2, c), 'name': cell_at(g, 1, c) })
        act_cols = []
        for c in range(25, 30):
            act_cols.append({ 'c': c, 'code': cell_at(g, 2, c), 'name': cell_at(g, 1, c) })

        cur_subs = curriculum.get(lvl_key, {}).get('subjects', [])
        cur_acts = curriculum.get(lvl_key, {}).get('activities', [])

        rec_count = 0
        score_count = 0
        for r in range(6, len(g)):
            sid = cell_at(g, r, 2)
            if not sid:
                continue
            rec = {
                'subjects': {},
                'activities': {},
                'character': '',
                'reading': ''
            }
            for idx, col in enumerate(cols):
                val = cell_at(g, r, col['c'])
                if val == '':
                    continue
                target = None
                if col['code']:
                    for s in cur_subs:
                        if s.get('code', '').strip() == col['code'].strip():
                            target = s
                            break
                if not target and col['name']:
                    for s in cur_subs:
                        if s.get('name', '').strip() == col['name'].strip():
                            target = s
                            break
                if not target and idx < len(cur_subs):
                    target = cur_subs[idx]
                if not target:
                    continue
                rec['subjects'][target.get('code') or target.get('name')] = val
                score_count += 1

            for idx, col in enumerate(act_cols):
                val = cell_at(g, r, col['c'])
                if val == '':
                    continue
                target = None
                if col['code']:
                    for a in cur_acts:
                        if a.get('code', '').strip() == col['code'].strip():
                            target = a
                            break
                if not target and col['name']:
                    for a in cur_acts:
                        if a.get('name', '').strip() == col['name'].strip():
                            target = a
                            break
                if not target and idx < len(cur_acts):
                    target = cur_acts[idx]
                if not target:
                    continue
                rec['activities'][target.get('code') or target.get('name')] = val

            ch = cell_at(g, r, 30)
            rd = cell_at(g, r, 31)
            rec['character'] = quality_map.get(ch, ch) or 'ดีเยี่ยม'
            rec['reading'] = quality_map.get(rd, rd) or 'ดีเยี่ยม'
            # คอลัมน์ AK ชื่อชุมนุม — ปพ.1 พิมพ์ต่อท้ายคำว่า "ชุมนุม"
            rec['clubName'] = cell_at(g, r, 36)

            # Default activities to ผ่าน if not set
            if not rec['activities']:
                for a in cur_acts:
                    rec['activities'][a.get('code') or a.get('name')] = 'ผ'

            grades[lvl_key]['records'][sid] = rec
            rec_count += 1

        print(f"Grade {level}: Year {year}, {rec_count} students, {score_count} scores recorded")

    # Settings
    settings = {
        'startYear': start_year,
        'onetPercent': 3,
        'onetGroups': 4,
        'showOnet': False, # Master file specifies: ไม่แสดงโอเน็ต
        'showGpa': True,
        'pp1Layout': 'byYear',
        'pp3Style': 'copy',
        'pp3Term': '2',
        'pp3Year': '2569',
        'pp3Page': 1,
        'certValidity': 'ใบรับรองนี้มีอายุ 120 วัน นับแต่วันที่ออกให้',
        'certFormat': 'pp7',
        'certYear': '2569',
        'certResult': 'ดีเยี่ยม',
        'certBehavior': 'เรียบร้อย',
        'certNote': 'เอกสารสำคัญฉบับนี้มีอายุการใช้งาน 120 วัน',
        'gradYear': '2569',
        'gradTerm': '2',
        'baseHours': '5,040',
        'extraHours': '240',
        'cohortLevel': 6,
        'cohortClassIds': [],
        'syncRequireBothTerms': True,
        'pp1PaperPadTop': 0,
        'pp1PaperPadBottom': 0,
        'pp1PaperPadLeft': 0,
        'pp1PaperPadRight': 0,
        'pp1PaperScale': 100,
        'pp1Numerals': 'arabic'
    }

    full_db = {
        'school': school,
        'settings': settings,
        'curriculum': curriculum,
        'students': students,
        'grades': grades,
        'certData': cert_data,
        'onetRaw': { 'header': {}, 'rows': [] },
        'meta': {
            'updatedAt': '2026-10-28T14:40:00Z',
            'source': '01.PP2551P6_18วิชา_Onet4วิชา_ไม่แสดงโอเน็ต_360คน-อนุพงศ์พัชรินทร์.xlsm',
            'version': '2569-official'
        }
    }

    out_json = r'C:\Users\Ohunited\Desktop\anpscore-web\pp1-master-data.json'
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(full_db, f, ensure_ascii=False, indent=2)
    print(f"Successfully saved {out_json} ({os.path.getsize(out_json)} bytes)")

if __name__ == '__main__':
    main()
