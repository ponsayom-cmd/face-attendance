// ============================================================
//  GOOGLE APPS SCRIPT — API Backend for Smart Face Scanner
// ============================================================

function doGet(e) {
  checkAndInitSheets();
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
  return jsonResponse(result);
}

function doPost(e) {
  checkAndInitSheets();
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ error: 'Invalid JSON' });
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
  return jsonResponse(result);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// --- บันทึกการเข้าเรียน (จัดลำดับคอลัมน์ให้ตรงกันเป๊ะ) ---
function logAttendance(name, subject, lat, lng) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendance');
  const now = new Date();
  const timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
  const dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
  const mapLink = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : '-';

  // คอลัมน์: Name (A), Subject (B), Time (C), Date (D), Lat (E), Lng (F), Map (G)
  sheet.appendRow([
    String(name), 
    String(subject || "ทั่วไป"), 
    String(timeStr), 
    "'" + String(dateStr), 
    String(lat || '-'), 
    String(lng || '-'), 
    String(mapLink)
  ]);
  return { success: true, message: 'บันทึกสำเร็จ' };
}

// --- ตรวจสอบและสร้าง Sheet ---
function checkAndInitSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsDef = {
    'Users': ['Name', 'Descriptor', 'RegDate'],
    'Subjects': ['Code', 'Name'],
    'Attendance': ['Name', 'Subject', 'Time', 'Date', 'Lat', 'Lng', 'Map'],
    'Config': ['Param', 'Value']
  };
  
  for (let sName in sheetsDef) {
    let sheet = ss.getSheetByName(sName);
    if (!sheet) {
      sheet = ss.insertSheet(sName);
      sheet.appendRow(sheetsDef[sName]);
      sheet.getRange(1, 1, 1, sheetsDef[sName].length).setFontWeight("bold").setBackground("#f0f0f0");
    }
  }
}

// --- ฟังก์ชันช่วยเหลืออื่นๆ ---
function getKnownFaces() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({ 
    name: r[0], 
    descriptor: JSON.parse(r[1]) 
  }));
}

function getSubjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Subjects');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({ code: r[0], name: r[1] }));
}

function registerUser(name, descriptor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  sheet.appendRow([name, JSON.stringify(descriptor), new Date()]);
  return { success: true };
}

function saveConfig(lat, lng, radius) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Config');
  sheet.getRange("B2").setValue(lat);
  sheet.getRange("B3").setValue(lng);
  sheet.getRange("B4").setValue(radius);
  return { success: true };
}

function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');
  const d = sheet.getDataRange().getValues();
  return { 
    lat: d[1] ? d[1][1] : 0, 
    lng: d[2] ? d[2][1] : 0, 
    radius: d[3] ? d[3][1] : 0.5 
  };
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
  const sheet = ss.getSheetByName('Subjects');
  sheet.appendRow([code, name]);
  return { success: true };
}

function deleteSubject(code) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Subjects');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == code) { sheet.deleteRow(i+1); return { success: true }; }
  }
  return { error: 'Not found' };
}

function deleteStudent(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == name) { sheet.deleteRow(i+1); return { success: true }; }
  }
  return { error: 'Not found' };
}
