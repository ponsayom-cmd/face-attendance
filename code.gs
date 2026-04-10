/**
 * GOOGLE APPS SCRIPT - v4.0 (Ultra Fast Edition)
 * ปรับปรุงเพื่อความเร็วสูงสุด ลดอาการค้าง
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
    
    if (data.action === 'registerUser') {
      // บันทึกข้อมูลแบบ Raw เพื่อความเร็วสูงสุด
      sheet.appendRow([
        String(data.id),
        String(data.name),
        String(data.year),
        data.desc, // ข้อมูลที่ถูกย่อขนาดมาแล้วจากฝั่งหน้าเว็บ
        new Date()
      ]);
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'logAttendance') {
      const attSheet = ss.getSheetByName('Attendance') || ss.insertSheet('Attendance');
      const now = new Date();
      attSheet.appendRow([
        data.name, data.subject, 
        Utilities.formatDate(now, "GMT+7", "HH:mm:ss"), 
        "'" + Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd"), 
        data.lat, data.lng
      ]);
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (f) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: f.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'getKnownFaces') {
    const sheet = ss.getSheetByName('Users');
    if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    const data = sheet.getDataRange().getValues().slice(1);
    const result = data.map(r => ({ name: r[1], descriptor: JSON.parse(r[3]) }));
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getSubjects') {
    const sheet = ss.getSheetByName('Subjects');
    const data = sheet.getDataRange().getValues().slice(1);
    return ContentService.createTextOutput(JSON.stringify(data.map(r => ({ code: r[0], name: r[1] })))).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput("Ready").setMimeType(ContentService.MimeType.TEXT);
}
