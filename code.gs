// ============================================================
//  GOOGLE APPS SCRIPT — Advanced Attendance System (V3.0)
//  รองรับ: เลือกรายวิชา, ป้องกันลงทะเบียนซ้ำ, เช็คชื่ออัตโนมัติ
// ============================================================

function doGet(e) {
  const action = e.parameter.action;
  let result;

  try {
    switch (action) {
      case 'getConfig': result = getConfig(); break;
      case 'getKnownFaces': result = getKnownFaces(); break;
      case 'getSubjects': result = getSubjects(); break;
      case 'getStudents': result = getStudents(); break;
      case 'getAttendanceReport': result = getAttendanceReport(); break;
      default: result = { error: 'Unknown GET action' };
    }
  } catch (err) {
    result = { error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid JSON' })).setMimeType(ContentService.MimeType.JSON);
  }

  const action = data.action;
  let result;

  try {
    switch (action) {
      case 'registerUser':
        result = registerUser(data.name, data.faceDescriptor);
        break;
      case 'logAttendance':
        result = logAttendance(data.name, data.subject, data.lat, data.lng);
        break;
      case 'saveConfig':
        result = saveConfig(data.lat, data.lng, data.radius);
        break;
      case 'addSubject':
        result = addSubject(data.subjectName, data.subjectCode);
        break;
      case 'deleteSubject':
        result = deleteSubject(data.subjectCode);
        break;
      case 'deleteStudent':
        result = deleteStudent(data.name);
        break;
      default:
        result = { error: 'Unknown POST action' };
    }
  } catch (err) {
    result = { error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// --- ส่วนจัดการนักศึกษา & ใบหน้า (Users) ---
function registerUser(name, descriptor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
  if (sheet.getLastRow() === 0) sheet.appendRow(['Name', 'Descriptor', 'RegDate']);

  // ตรวจสอบชื่อซ้ำ (Case-insensitive)
  const data = sheet.getDataRange().getValues();
  const exists = data.some(row => row[0].toString().toLowerCase() === name.toLowerCase());
  if (exists) return { success: false, error: 'นักศึกษาชื่อนี้ลงทะเบียนในระบบแล้ว' };

  sheet.appendRow([name, JSON.stringify(descriptor), new Date()]);
  return { success: true, message: 'ลงทะเบียนสำเร็จ' };
}

function getKnownFaces() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(r => ({ name: r[0], descriptor: JSON.parse(r[1]) }));
}

function getStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({ name: r[0], regDate: r[2] }));
}

function deleteStudent(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return { error: 'Sheet Users not found' };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Not found' };
}

// --- ส่วนจัดการรายวิชา (Subjects) ---
function getSubjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Subjects') || ss.insertSheet('Subjects');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Code', 'Name']);
    return [];
  }
  return sheet.getDataRange().getValues().slice(1).map(r => ({ code: r[0], name: r[1] }));
}

function addSubject(name, code) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Subjects') || ss.insertSheet('Subjects');
  sheet.appendRow([code, name]);
  return { success: true };
}

function deleteSubject(code) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Subjects');
  if (!sheet) return { error: 'Sheet not found' };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == code) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Not found' };
}

// --- ส่วนบันทึกการเข้าเรียน (Attendance) ---
function logAttendance(name, subject, lat, lng) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Attendance') || ss.insertSheet('Attendance');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Name', 'Subject', 'Time', 'Date', 'Lat', 'Lng', 'Map']);
  }

  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  const mapLink = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '-';

  sheet.appendRow([name, subject || '-', timeStr, "'" + dateStr, lat || '-', lng || '-', mapLink]);
  return { success: true, message: 'บันทึกสำเร็จ' };
}

function getAttendanceReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendance');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  // ส่งข้อมูลแบบย้อนกลับเพื่อดูอันล่าสุดก่อน
  return data.slice(1).reverse().map(r => {
    let item = {};
    headers.forEach((h, i) => item[h] = r[i]);
    return item;
  });
}

// --- ส่วนการตั้งค่า (Config) ---
function saveConfig(lat, lng, radius) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Config') || ss.insertSheet('Config');
  sheet.clear();
  sheet.appendRow(['Parameter', 'Value']);
  sheet.appendRow(['Lat', lat]);
  sheet.appendRow(['Lng', lng]);
  sheet.appendRow(['Radius', radius]);
  return { success: true };
}

function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');
  let config = { lat: 0, lng: 0, radius: 0.5 };
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    if (data.length >= 4) {
      config.lat = data[1][1];
      config.lng = data[2][1];
      config.radius = data[3][1];
    }
  }
  return config;
}
