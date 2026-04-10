// ============================================================
//  GOOGLE APPS SCRIPT — Fixed Data Mapping Version
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

// --- ตรวจสอบและสร้าง Sheet อัตโนมัติ ---
function checkAndInitSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

// --- บันทึกการเข้าเรียน (FIXED: ตรงคอลัมน์แน่นอน) ---
function logAttendance(name, subject, lat, lng) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendance');
  const now = new Date();
  const timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
  const dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
  const mapLink = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : '-';

  // ลำดับต้องตรงกับ: Name, Subject, Time, Date, Lat, Lng, Map
  sheet.appendRow([
    name, 
    subject || "ทั่วไป", 
    timeStr, 
    "'" + dateStr, 
    lat || '-', 
    lng || '-', 
    mapLink
  ]);
  return { success: true, message: 'บันทึกเวลาสำเร็จ' };
}

// ฟังก์ชันอื่นๆ (getSubjects, getKnownFaces, etc.) ให้ใช้ตามเวอร์ชัน Auto-Setup ก่อนหน้าที่เสถียรแล้ว
function getSubjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Subjects');
  return sheet.getDataRange().getValues().slice(1).map(r => ({ code: r[0], name: r[1] }));
}

function getKnownFaces() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({ name: r[0], descriptor: JSON.parse(r[1]) }));
}

function getAttendanceReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Attendance');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).reverse().map(r => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}
