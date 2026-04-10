/**
 * GOOGLE APPS SCRIPT - v4.1 (Anti-Duplicate Attendance)
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.action === 'registerUser') {
      const sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
      sheet.appendRow([String(data.id), String(data.name), String(data.year), data.desc, new Date()]);
      return jsonResponse({success: true});
    }
    
    if (data.action === 'logAttendance') {
      const attSheet = ss.getSheetByName('Attendance') || ss.insertSheet('Attendance');
      const now = new Date();
      const dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
      
      // --- ตรวจสอบการเช็คชื่อซ้ำในวันเดียวกัน ---
      const logs = attSheet.getDataRange().getValues();
      const isDuplicate = logs.some(row => 
        row[0] === data.name && 
        row[1] === data.subject && 
        Utilities.formatDate(new Date(row[3]), "GMT+7", "yyyy-MM-dd") === dateStr
      );
      
      if (isDuplicate) {
        return jsonResponse({success: false, message: 'คุณเช็คชื่อวิชานี้ไปแล้วในวันนี้'});
      }

      attSheet.appendRow([
        data.name, data.subject, 
        Utilities.formatDate(now, "GMT+7", "HH:mm:ss"), 
        "'" + dateStr, 
        data.lat, data.lng,
        `https://www.google.com/maps?q=${data.lat},${data.lng}`
      ]);
      return jsonResponse({success: true});
    }
  } catch (f) {
    return jsonResponse({success: false, error: f.toString()});
  }
}

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getKnownFaces') {
    const sheet = ss.getSheetByName('Users');
    if (!sheet) return jsonResponse([]);
    const data = sheet.getDataRange().getValues().slice(1);
    const result = data.map(r => ({ name: r[1], descriptor: JSON.parse(r[3]) }));
    return jsonResponse(result);
  }
  
  if (action === 'getSubjects') {
    const sheet = ss.getSheetByName('Subjects') || ss.insertSheet('Subjects');
    const data = sheet.getDataRange().getValues().slice(1);
    return jsonResponse(data.map(r => ({ code: r[0], name: r[1] })));
  }
  return ContentService.createTextOutput("Ready").setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
