// ============================================================
//  GOOGLE APPS SCRIPT — REST API Backend (Latest Update)
// ============================================================

function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    if (action === 'getConfig') result = getConfig();
    else if (action === 'getKnownFaces') result = getKnownFaces();
    else if (action === 'getSubjects') result = getSubjects();
    else if (action === 'getStudents') result = getStudents();
    else if (action === 'getAttendanceReport') result = getAttendanceReport();
    else result = { error: 'Unknown GET action' };
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
      case 'registerUser': result = registerUser(data.name, data.faceDescriptor); break;
      case 'logAttendance': result = logAttendance(data.name, data.subject, data.lat, data.lng); break;
      case 'saveConfig': result = saveConfig(data.lat, data.lng, data.radius); break;
      case 'addSubject': result = addSubject(data.subjectName, data.subjectCode); break;
      case 'deleteSubject': result = deleteSubject(data.subjectCode); break;
      case 'deleteStudent': result = deleteStudent(data.name); break;
      default: result = { error: 'Unknown POST action' };
    }
  } catch (err) {
    result = { error: err.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// --- ฟังก์ชันหลัก ---
function registerUser(name, descriptor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
  if (sheet.getLastRow() === 0) sheet.appendRow(['Name', 'Descriptor', 'RegDate']);
  
  const data = sheet.getDataRange().getValues();
  const exists = data.some(row => row[0].toString().toLowerCase() === name.trim().toLowerCase());
  if (exists) return { success: false, error: 'นักศึกษาชื่อนี้มีในระบบแล้ว' };

  sheet.appendRow([name.trim(), JSON.stringify(descriptor), new Date()]);
  return { success: true, message: 'ลงทะเบียนสำเร็จ' };
}

function getKnownFaces() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(r => ({ name: r[0], descriptor: JSON.parse(r[1]) }));
}

function getSubjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Subjects') || ss.insertSheet('Subjects');
  if (sheet.getLastRow() === 0) sheet.appendRow(['Code', 'Name']);
  return sheet.getDataRange().getValues().slice(1).map(r => ({ code: r[0], name: r[1] }));
}

function logAttendance(name, subject, lat, lng) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Attendance') || ss.insertSheet('Attendance');
  if (sheet.getLastRow() === 0) sheet.appendRow(['Name', 'Subject', 'Time', 'Date', 'Lat', 'Lng', 'Map']);
  
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');
  sheet.appendRow([name, subject || '-', timeStr, "'" + dateStr, lat || '-', lng || '-', `https://www.google.com/maps?q=${lat},${lng}`]);
  return { success: true };
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

function getStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({ name: r[0], regDate: r[2] }));
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
  if (!sheet) return { error: 'Not found' };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == code) { sheet.deleteRow(i+1); return { success: true }; }
  }
  return { error: 'Not found' };
}

function deleteStudent(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return { error: 'Not found' };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == name) { sheet.deleteRow(i+1); return { success: true }; }
  }
  return { error: 'Not found' };
}

function saveConfig(lat, lng, radius) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Config') || ss.insertSheet('Config');
  sheet.clear().appendRow(['Param', 'Value']).appendRow(['Lat', lat]).appendRow(['Lng', lng]).appendRow(['Rad', radius]);
  return { success: true };
}

function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');
  if (!sheet) return { lat: 0, lng: 0, radius: 0.5 };
  const d = sheet.getDataRange().getValues();
  return { lat: d[1][1], lng: d[2][1], radius: d[3][1] };
}
