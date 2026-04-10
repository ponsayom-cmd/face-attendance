/**
 * GOOGLE APPS SCRIPT - v4.3 (Data Integrity Fix)
 * แก้ปัญหาข้อมูล undefined และวันที่ผิดเพี้ยน
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.action === 'logAttendance') {
      const attSheet = ss.getSheetByName('Attendance') || ss.insertSheet('Attendance');
      const now = new Date();
      const dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
      const timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
      
      // ตรวจสอบซ้ำ
      const logs = attSheet.getDataRange().getValues();
      const isDuplicate = logs.some(row => 
        row[0] == data.name && 
        row[1] == data.subject && 
        row[3] == dateStr
      );
      
      if (isDuplicate) {
        return jsonResponse({success: false, message: 'เช็คชื่อไปแล้ววันนี้'});
      }

      // บันทึกข้อมูล (ตรวจสอบให้แน่ใจว่าลำดับคอลัมน์ตรงกับหน้า Dashboard)
      // คอลัมน์: ชื่อ, วิชา, เวลา, วันที่, Lat, Lng, Map
      attSheet.appendRow([
        data.name, 
        data.subject, 
        timeStr, 
        dateStr, 
        data.lat || 0, 
        data.lng || 0,
        `https://www.google.com/maps?q=${data.lat||0},${data.lng||0}`
      ]);
      
      return jsonResponse({success: true});
    }

    if (data.action === 'registerUser') {
      const sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
      sheet.appendRow([data.id, data.name, data.year, data.desc, new Date()]);
      return jsonResponse({success: true});
    }
  } catch (err) {
    return jsonResponse({success: false, error: err.toString()});
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;

  if (action === 'getKnownFaces') {
    const sheet = ss.getSheetByName('Users');
    if (!sheet) return jsonResponse([]);
    const values = sheet.getDataRange().getValues().slice(1);
    const data = values.map(r => ({ name: r[1], descriptor: JSON.parse(r[3]) }));
    return jsonResponse(data);
  }

  if (action === 'getSubjects') {
    const sheet = ss.getSheetByName('Subjects') || ss.insertSheet('Subjects');
    const values = sheet.getDataRange().getValues().slice(1);
    return jsonResponse(values.map(r => ({ code: r[0], name: r[1] })));
  }

  // สำหรับหน้า Admin Dashboard ดึงข้อมูล Attendance
  if (action === 'getAttendance') {
    const sheet = ss.getSheetByName('Attendance');
    if (!sheet) return jsonResponse([]);
    const values = sheet.getDataRange().getValues().slice(1);
    return jsonResponse(values.map(r => ({
      name: r[0],
      subject: r[1],
      time: r[2],
      date: r[3],
      lat: r[4],
      lng: r[5]
    })));
  }

  return ContentService.createTextOutput("System Ready").setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
