// ============================================================
//  GOOGLE APPS SCRIPT — High-Speed Registration Patch
// ============================================================

function checkAndInitSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsDef = {
    'Users': ['ID', 'Name', 'Year', 'Descriptor', 'RegDate'],
    'Subjects': ['Code', 'Name'],
    'Attendance': ['Name', 'Subject', 'Time', 'Date', 'Lat', 'Lng', 'Map'],
    'Config': ['Param', 'Value']
  };
  
  for (let sName in sheetsDef) {
    let sheet = ss.getSheetByName(sName);
    if (!sheet) {
      sheet = ss.insertSheet(sName);
      sheet.appendRow(sheetsDef[sName]);
    }
  }
}

function registerUserBatch(users) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  const now = new Date();
  
  // ใช้ LockService เพื่อป้องกันไฟล์ชนกันและช่วยให้ประมวลผลเร็วขึ้น
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // รอ 10 วินาที
    
    // เตรียมข้อมูลเป็นแถวๆ
    const rows = users.map(u => [
      String(u.id), 
      String(u.name), 
      String(u.year), 
      JSON.stringify(u.descriptor), 
      now
    ]);
    
    // เขียนข้อมูลลงไปรวดเดียว
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'registerUserBatch') {
      return jsonResponse(registerUserBatch(data.users));
    }
    // กรณีการเช็คชื่อ
    if (data.action === 'logAttendance') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('Attendance');
      const now = new Date();
      sheet.appendRow([
        data.name, 
        data.subject, 
        Utilities.formatDate(now, "GMT+7", "HH:mm:ss"), 
        "'" + Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd"), 
        data.lat, data.lng, 
        `https://www.google.com/maps?q=${data.lat},${data.lng}`
      ]);
      return jsonResponse({ success: true });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getKnownFaces') {
    const sheet = ss.getSheetByName('Users');
    const data = sheet.getDataRange().getValues().slice(1);
    const result = data.map(r => ({ name: r[1], descriptor: JSON.parse(r[3]) }));
    return jsonResponse(result);
  }
  
  if (action === 'getSubjects') {
    const sheet = ss.getSheetByName('Subjects');
    const data = sheet.getDataRange().getValues().slice(1);
    return jsonResponse(data.map(r => ({ code: r[0], name: r[1] })));
  }
  
  return jsonResponse({ status: 'connected' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
