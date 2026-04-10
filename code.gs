// ============================================================
//  GOOGLE APPS SCRIPT — Updated for Student ID and Year
// ============================================================

function checkAndInitSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsDef = {
    'Users': ['ID', 'Name', 'Year', 'Descriptor', 'RegDate'], // เพิ่ม ID และ Year
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

// ปรับปรุงฟังก์ชันลงทะเบียนให้รับข้อมูลชุดใหญ่ (Array)
function registerUserBatch(studentData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  
  // studentData คาดหวังเป็น Array ของ [id, name, year, descriptor, date]
  const rows = studentData.map(item => [
    item.id, 
    item.name, 
    item.year, 
    JSON.stringify(item.descriptor), 
    new Date()
  ]);
  
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return { success: true, count: rows.length };
}

function doPost(e) {
  checkAndInitSheets();
  let data = JSON.parse(e.postData.contents);
  const action = data.action;

  if (action === 'registerUserBatch') return jsonResponse(registerUserBatch(data.users));
  // ... ฟังก์ชันเดิมที่เหลือยังคงอยู่ ...
  if (action === 'logAttendance') return jsonResponse(logAttendance(data.name, data.subject, data.lat, data.lng));
  return jsonResponse({ error: 'Action not found' });
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getKnownFaces') {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
    const data = sheet.getDataRange().getValues().slice(1);
    return jsonResponse(data.map(r => ({ name: r[1], descriptor: JSON.parse(r[3]) })));
  }
  // ... อื่นๆ ...
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
