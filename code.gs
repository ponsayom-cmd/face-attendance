// ============================================================
//  GOOGLE APPS SCRIPT — REST API Backend (v2 Full)
//  วิธีใช้: Deploy > New deployment > Web App
//           Execute as: Me | Who has access: Anyone
// ============================================================

// ─── CORS HEADERS (ใช้สำหรับ OPTIONS preflight) ─────────────
function doOptions() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ─── GET ROUTER ──────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action;
  let result;

  if      (action === 'getConfig')       result = getConfig();
  else if (action === 'getKnownFaces')   result = getKnownFaces();
  else if (action === 'getCourses')      result = getCourses();
  else if (action === 'getAttendance')   result = getAttendance(e.parameter.course, e.parameter.date);
  else if (action === 'getStats')        result = getStats();
  else if (action === 'getStudentList')  result = getStudentList();
  else if (action === 'checkStudentId')  result = checkStudentId(e.parameter.studentId);
  else result = { error: 'Unknown GET action: ' + action };

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── POST ROUTER ─────────────────────────────────────────────
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Invalid JSON body' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const action = data.action;
  let result;

  if      (action === 'registerUser')   result = registerUser(data.name, data.studentId, data.faceDescriptor, data.course);
  else if (action === 'checkDuplicate') result = checkDuplicate(data.faceDescriptor, data.studentId);
  else if (action === 'logAttendance')  result = logAttendance(data.studentId, data.name, data.course, data.lat, data.lng);
  else if (action === 'saveConfig')     result = saveConfig(data.lat, data.lng, data.radius);
  else if (action === 'saveCourse')     result = saveCourse(data.course);
  else if (action === 'addCourse')      result = saveCourse(data.courseName);   // admin.html ใช้ชื่อนี้
  else if (action === 'deleteCourse')   result = deleteCourse(data.courseName);
  else if (action === 'deleteStudent')  result = deleteStudent(data.name);
  else result = { error: 'Unknown POST action: ' + action };

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  USERS — ลงทะเบียนใบหน้า
// ============================================================

function _getUserSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Users');
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    sheet.appendRow(['Name', 'StudentId', 'FaceDescriptor', 'Course', 'RegisteredAt']);
  }
  return sheet;
}

// บันทึกนักเรียนใหม่ — มีการเช็คซ้ำก่อน insert
function registerUser(name, studentId, faceDescriptor, course) {
  // Guard: รหัสนักศึกษาซ้ำ
  if (studentId) {
    const idCheck = checkStudentId(studentId);
    if (idCheck.isDuplicate) {
      return { error: 'duplicate_id', message: 'รหัสนักศึกษา ' + studentId + ' มีในระบบแล้ว (' + idCheck.name + ')' };
    }
  }
  const sheet = _getUserSheet();
  sheet.appendRow([
    name,
    studentId || '',
    JSON.stringify(faceDescriptor),
    course    || '',
    new Date()
  ]);
  return { success: true, message: 'บันทึกข้อมูลใบหน้าเรียบร้อย' };
}

// ตรวจสอบรหัสนักศึกษาซ้ำ
function checkStudentId(studentId) {
  if (!studentId) return { isDuplicate: false };
  const sheet = _getUserSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const sid = String(row[1] || '').trim();
    if (sid && sid === String(studentId).trim()) {
      return { isDuplicate: true, name: row[0], studentId: sid, course: row[3] || '' };
    }
  }
  return { isDuplicate: false };
}

// ตรวจสอบใบหน้าซ้ำด้วย euclidean distance
function checkDuplicate(faceDescriptor, excludeStudentId) {
  const THRESHOLD = 0.45;
  const sheet = _getUserSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1 || !faceDescriptor) return { isDuplicate: false };

  const queryDesc = faceDescriptor;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let name, studentId, descriptorStr;
    if (row.length >= 5) {
      // schema ใหม่: Name | StudentId | Descriptor | Course | Date
      name = row[0]; studentId = row[1]; descriptorStr = row[2];
    } else if (row.length >= 4) {
      // schema กลาง: Name | StudentId | Descriptor | Date
      name = row[0]; studentId = row[1]; descriptorStr = row[2];
    } else {
      name = row[0]; studentId = ''; descriptorStr = row[1];
    }

    // ข้ามถ้าเป็นรหัสเดียวกัน (กรณีลงทะเบียนมุมเพิ่ม)
    if (excludeStudentId && studentId && String(studentId) === String(excludeStudentId)) continue;

    if (!descriptorStr) continue;
    try {
      const known = JSON.parse(descriptorStr);
      const dist  = euclideanDistance(queryDesc, known);
      if (dist < THRESHOLD) {
        return { isDuplicate: true, name, studentId: String(studentId || ''), distance: dist };
      }
    } catch(e) {}
  }
  return { isDuplicate: false };
}

// คำนวณ Euclidean distance ระหว่าง descriptor 2 ตัว
function euclideanDistance(a, b) {
  if (a.length !== b.length) return 1.0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// ดึงข้อมูลใบหน้าทั้งหมด (ส่งกลับ label + studentId + descriptor)
function getKnownFaces() {
  const sheet = _getUserSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const users = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // รองรับทั้ง schema เก่า (Name, Descriptor) และใหม่ (Name, StudentId, Descriptor)
    let name, studentId, descriptorStr;
    if (row.length >= 5) {
      // schema ใหม่: Name | StudentId | Descriptor | Course | Date
      name = row[0]; studentId = row[1]; descriptorStr = row[2];
    } else if (row.length >= 4) {
      // schema กลาง: Name | StudentId | Descriptor | Date
      name = row[0]; studentId = row[1]; descriptorStr = row[2];
    } else {
      // schema เก่า: Name | Descriptor | Date
      name = row[0]; studentId = ''; descriptorStr = row[1];
    }

    if (name && descriptorStr) {
      try {
        users.push({ label: name, studentId: studentId || '', descriptor: JSON.parse(descriptorStr) });
      } catch (e) {}
    }
  }
  return users;
}

// รายชื่อนักเรียนทั้งหมด (สำหรับ admin)
function getStudentList() {
  const sheet = _getUserSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const name    = row[0];
    const dateVal = row.length >= 5 ? row[4] : row.length >= 4 ? row[3] : row[2];
    if (name) list.push({ name, date: dateVal ? new Date(dateVal).toISOString() : '' });
  }
  return list;
}

// ลบนักเรียน
function deleteStudent(name) {
  const sheet = _getUserSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === name) sheet.deleteRow(i + 1);
  }
  return { success: true, message: 'ลบนักเรียนเรียบร้อย' };
}

// ============================================================
//  ATTENDANCE — บันทึก & ดึงประวัติเช็คชื่อ
// ============================================================

function _getAttSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Attendance');
  if (!sheet) {
    sheet = ss.insertSheet('Attendance');
    sheet.appendRow(['StudentId', 'Name', 'Course', 'Time', 'Date', 'Latitude', 'Longitude', 'Google Map Link']);
  }
  return sheet;
}

// บันทึกเช็คชื่อ
function logAttendance(studentId, name, course, lat, lng) {
  const sheet = _getAttSheet();
  const now = new Date();
  const tz  = Session.getScriptTimeZone();
  const mapLink = (lat && lng) ? 'https://www.google.com/maps?q=' + lat + ',' + lng : '';
  const dateStr = Utilities.formatDate(now, tz, 'd/M/yyyy');
  const timeStr = Utilities.formatDate(now, tz, 'HH:mm:ss');

  sheet.appendRow([
    studentId || '',
    name,
    course   || '',
    timeStr,
    "'" + dateStr,   // เติม ' กันไม่ให้ Sheets แปลงเป็น Date อัตโนมัติ
    lat || '',
    lng || '',
    mapLink
  ]);
  return { success: true, message: 'บันทึกเช็คชื่อสำเร็จ' };
}

// ดึงรายการเช็คชื่อ (กรองตามวิชา / วันที่)
function getAttendance(courseFilter, dateFilter) {
  const sheet = _getAttSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // schema: StudentId | Name | Course | Time | Date | Lat | Lng | MapLink
    // รองรับ schema เก่า: Name | Time | Date | Lat | Lng | MapLink
    let studentId, name, course, time, date, lat, lng, mapLink;

    if (row.length >= 8) {
      // schema ใหม่
      [studentId, name, course, time, date, lat, lng, mapLink] = row;
    } else {
      // schema เก่า (ไม่มี studentId, course)
      studentId = ''; [name, time, date, lat, lng, mapLink] = row; course = '';
    }

    // ทำความสะอาด date (ลบ ' ออก)
    date = String(date).replace(/^'/, '').trim();

    if (courseFilter && course !== courseFilter) continue;
    if (dateFilter   && date  !== dateFilter)   continue;

    rows.push({ studentId: String(studentId||''), name: String(name||''), course: String(course||''), time: String(time||''), date, lat: String(lat||''), lng: String(lng||''), mapLink: String(mapLink||'') });
  }
  return rows;
}

// ============================================================
//  COURSES — จัดการรายวิชา
// ============================================================

function _getCourseSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Courses');
  if (!sheet) {
    sheet = ss.insertSheet('Courses');
    sheet.appendRow(['CourseName']);
  }
  return sheet;
}

function getCourses() {
  const sheet = _getCourseSheet();
  const data  = sheet.getDataRange().getValues();
  const list  = [];
  for (let i = 1; i < data.length; i++) {
    const c = data[i][0];
    if (c) list.push(String(c));
  }
  return list;
}

function saveCourse(courseName) {
  if (!courseName) return { error: 'ไม่มีชื่อวิชา' };
  const sheet = _getCourseSheet();
  const existing = getCourses();
  if (existing.includes(courseName)) return { success: true, message: 'มีวิชานี้อยู่แล้ว' };
  sheet.appendRow([courseName]);
  return { success: true, message: 'เพิ่มวิชา "' + courseName + '" เรียบร้อย' };
}

function deleteCourse(courseName) {
  const sheet = _getCourseSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === courseName) sheet.deleteRow(i + 1);
  }
  return { success: true, message: 'ลบวิชาเรียบร้อย' };
}

// ============================================================
//  STATS — สำหรับ Admin Dashboard
// ============================================================

function getStats() {
  const students   = getStudentList().length;
  const courses    = getCourses().length;
  const allRows    = getAttendance(null, null);
  const totalLogs  = allRows.length;

  // นับ log แยกรายวิชา
  const courseChart = {};
  allRows.forEach(r => {
    const c = r.course || '(ไม่ระบุ)';
    courseChart[c] = (courseChart[c] || 0) + 1;
  });

  return {
    summary: { students, courses, totalLogs },
    courseChart
  };
}

// ============================================================
//  CONFIG — ตั้งค่า GPS
// ============================================================

function saveConfig(lat, lng, radius) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Config');
  if (!sheet) {
    sheet = ss.insertSheet('Config');
    sheet.getRange('A1:B1').setValues([['Parameter', 'Value']]);
    sheet.getRange('A2:A4').setValues([['Target Latitude'], ['Target Longitude'], ['Allowed Radius (KM)']]);
    sheet.setColumnWidth(1, 160);
  }
  sheet.getRange('B2').setValue(lat);
  sheet.getRange('B3').setValue(lng);
  sheet.getRange('B4').setValue(radius);
  return { success: true, message: 'บันทึกการตั้งค่าลง Google Sheets เรียบร้อย' };
}

function getConfig() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');
  const config = { lat: 0, lng: 0, radius: 0.5 };
  if (sheet) {
    const v2 = sheet.getRange('B2').getValue();
    const v3 = sheet.getRange('B3').getValue();
    const v4 = sheet.getRange('B4').getValue();
    if (v2 !== '') config.lat    = parseFloat(v2);
    if (v3 !== '') config.lng    = parseFloat(v3);
    if (v4 !== '') config.radius = parseFloat(v4);
  }
  return config;
}
