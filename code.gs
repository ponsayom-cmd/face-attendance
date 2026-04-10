// ============================================================
//  GOOGLE APPS SCRIPT — Fixed Column Mapping (v3.5)
// ============================================================

function doGet(e) {
  checkAndInitSheets();
  const action = e.parameter.action;
  if (action === 'getConfig') return jsonResponse(getConfig());
  if (action === 'getKnownFaces') return jsonResponse(getKnownFaces());
  if (action === 'getSubjects') return jsonResponse(getSubjects());
  if (action === 'getStudents') return jsonResponse(getStudents());
  if (action === 'getAttendanceReport') return jsonResponse(getAttendanceReport());
  return jsonResponse({ error: 'Unknown GET action' });
}

function doPost(e) {
  checkAndInitSheets();
  let data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return jsonResponse({ error: 'Invalid JSON' }); }
  
  const action = data.action;
  if (action === 'registerUser') return jsonResponse(registerUser(data.name, data.faceDescriptor));
  if (action === 'logAttendance') return jsonResponse(logAttendance(data.name, data.subject, data.lat, data.lng));
  if (action === 'saveConfig') return jsonResponse(saveConfig(data.lat, data.lng, data.radius));
  if (action === 'addSubject') return jsonResponse(addSubject(data.subjectName, data.subjectCode));
  if (action === 'deleteSubject') return jsonResponse(deleteSubject(data.subjectCode));
  if (action === 'deleteStudent') return jsonResponse(deleteStudent(data.name));
  return jsonResponse({ error: 'Unknown POST action' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkAndInitSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // กำหนดลำดับคอลัมน์ให้ชัดเจน
  const sheets = {
    'Users': ['Name', 'Descriptor', 'RegDate'],
    'Subjects': ['Code', 'Name'],
    'Attendance': ['Name', 'Subject', 'Time', 'Date', 'Lat', 'Lng', 'Map'],
    'Config': ['Param', 'Value']
  };
  
  for (let name in sheets) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight("bold").setBackground("#f3f3f3");
    }
  }
}

function logAttendance(name, subject, lat, lng) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendance');
  const now = new Date();
  
  // ปรับเวลาเป็นประเทศไทย (GMT+7)
  const timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
  const dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
  const mapLink = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : '-';

  // บันทึกเรียงตามหัวข้อ: Name, Subject, Time, Date, Lat, Lng, Map
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

function getAttendanceReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendance');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  // ส่งข้อมูลกลับแบบ Object โดยอ้างอิงจากหัวตาราง
  return data.slice(1).reverse().map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

function getSubjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Subjects');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({ code: r[0], name: r[1] }));
}

function getKnownFaces() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({ name: r[0], descriptor: JSON.parse(r[1]) }));
}

function registerUser(name, descriptor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  sheet.appendRow([name, JSON.stringify(descriptor), new Date()]);
  return { success: true };
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

function saveConfig(lat, lng, radius) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');
  sheet.getRange("B2").setValue(lat);
  sheet.getRange("B3").setValue(lng);
  sheet.getRange("B4").setValue(radius);
  return { success: true };
}

function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Config');
  const d = sheet.getDataRange().getValues();
  return { lat: d[1][1], lng: d[2][1], radius: d[3][1] };
}
