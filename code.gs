// ============================================================
//  GOOGLE APPS SCRIPT — Advanced Backend
// ============================================================

function doGet(e) {
  const action = e.parameter.action;
  let result;

  if (action === 'getConfig') {
    result = getConfig();
  } else if (action === 'getKnownFaces') {
    result = getKnownFaces();
  } else if (action === 'getAttendanceReport') {
    result = getAttendanceReport();
  } else if (action === 'getSubjects') {
    result = getSubjects();
  } else if (action === 'getStudents') {
    result = getStudents();
  } else {
    result = { error: 'Unknown action: ' + action };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid JSON body' })).setMimeType(ContentService.MimeType.JSON);
  }

  const action = data.action;
  let result;

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
      result = { error: 'Unknown action: ' + action };
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// --- การจัดการใบหน้า ---
function registerUser(name, descriptor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Users');
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    sheet.appendRow(['Name', 'Descriptor', 'Registration Date']);
  }
  sheet.appendRow([name, JSON.stringify(descriptor), new Date()]);
  return { success: true, message: 'ลงทะเบียนใบหน้าสำเร็จ' };
}

function getKnownFaces() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const faces = [];
  for (let i = 1; i < data.length; i++) {
    faces.push({ name: data[i][0], descriptor: JSON.parse(data[i][1]) });
  }
  return faces;
}

// --- การจัดการรายวิชา ---
function addSubject(name, code) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Subjects') || ss.insertSheet('Subjects');
  if (sheet.getLastRow() === 0) sheet.appendRow(['Code', 'Name']);
  sheet.appendRow([code, name]);
  return { success: true, message: 'เพิ่มรายวิชาสำเร็จ' };
}

function getSubjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Subjects');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(r => ({ code: r[0], name: r[1] }));
}

function deleteSubject(code) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Subjects');
  if (!sheet) return { error: 'ไม่พบชีตรายวิชา' };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == code) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ลบรายวิชาสำเร็จ' };
    }
  }
  return { error: 'ไม่พบรหัสวิชา' };
}

// --- การจัดการนักศึกษา ---
function getStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(r => ({ name: r[0], regDate: r[2] }));
}

function deleteStudent(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'ลบข้อมูลนักศึกษาสำเร็จ' };
    }
  }
  return { error: 'ไม่พบชื่อนักศึกษา' };
}

// --- รายงานการเข้าเรียน ---
function logAttendance(name, subject, lat, lng) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Attendance');
  if (!sheet) {
    sheet = ss.insertSheet('Attendance');
    sheet.appendRow(['ชื่อ-นามสกุล', 'วิชา', 'เวลา', 'วันที่', 'Lat', 'Lng', 'แผนที่']);
  }
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  const mapLink = lat ? `https://www.google.com/maps?q=${lat},${lng}` : '-';

  sheet.appendRow([name, subject || 'ทั่วไป', timeStr, dateStr, lat || '-', lng || '-', mapLink]);
  return { success: true, message: 'เช็คชื่อสำเร็จ' };
}

function getAttendanceReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendance');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).reverse().map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

// --- Config GPS ---
function saveConfig(lat, lng, radius) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Config') || ss.insertSheet('Config');
  sheet.clear();
  sheet.appendRow(['Parameter', 'Value']);
  sheet.appendRow(['Target Latitude', lat]);
  sheet.appendRow(['Target Longitude', lng]);
  sheet.appendRow(['Allowed Radius (KM)', radius]);
  return { success: true, message: 'บันทึกตั้งค่าสำเร็จ' };
}

function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');
  let config = { lat: 0, lng: 0, radius: 0.5 };
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    config.lat = data[1][1];
    config.lng = data[2][1];
    config.radius = data[3][1];
  }
  return config;
}
