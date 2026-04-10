/**
 * GOOGLE APPS SCRIPT - v4.7 (Full Admin & Multi-Page Support)
 * รองรับหน้า Index ใหม่: จัดการนักศึกษา, จัดการวิชา, และรายงานสรุป
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. บันทึกเข้าเรียน (Attendance)
    if (data.action === 'logAttendance') {
      const sheet = ss.getSheetByName('Attendance') || ss.insertSheet('Attendance');
      const now = new Date();
      const dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
      const timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['ชื่อ-นามสกุล', 'รายวิชา', 'เวลา', 'วันที่', 'Lat', 'Lng']);
      }
      
      // ตรวจสอบซ้ำในวันเดียวกัน/วิชาเดียวกัน
      const logs = sheet.getDataRange().getValues();
      const isDuplicate = logs.some(row => row[0] == data.name && row[1] == data.subject && row[3] == dateStr);
      
      if (isDuplicate) return jsonResponse({success: false, message: 'เช็คชื่อซ้ำวันนี้'});

      sheet.appendRow([data.name, data.subject, timeStr, dateStr, data.lat || 0, data.lng || 0]);
      return jsonResponse({success: true});
    }

    // 2. ลงทะเบียนนักศึกษาใหม่
    if (data.action === 'registerUser') {
      const sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
      if (sheet.getLastRow() === 0) sheet.appendRow(['ID', 'Name', 'Year', 'Descriptor', 'RegDate']);
      
      sheet.appendRow([data.id, data.name, data.year || "-", data.desc, new Date()]);
      return jsonResponse({success: true});
    }

    // 3. เพิ่มรายวิชาใหม่
    if (data.action === 'addSubject') {
      const sheet = ss.getSheetByName('Subjects') || ss.insertSheet('Subjects');
      if (sheet.getLastRow() === 0) sheet.appendRow(['Code', 'Name']);
      sheet.appendRow([data.code, data.name]);
      return jsonResponse({success: true});
    }

    // 4. ลบนักศึกษา
    if (data.action === 'deleteUser') {
      const sheet = ss.getSheetByName('Users');
      if (!sheet) return jsonResponse({success: false});
      const values = sheet.getDataRange().getValues();
      for (let i = values.length - 1; i >= 0; i--) {
        if (values[i][1] === data.name) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return jsonResponse({success: true});
    }

  } catch (err) {
    return jsonResponse({success: false, error: err.toString()});
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;

  // ดึงรายชื่อวิชา
  if (action === 'getSubjects') {
    const sheet = ss.getSheetByName('Subjects');
    if (!sheet) return jsonResponse([]);
    const values = sheet.getDataRange().getValues().slice(1);
    return jsonResponse(values.map(r => ({ code: r[0], name: r[1] })));
  }

  // ดึงข้อมูลใบหน้า (สำหรับหน้า Scan)
  if (action === 'getKnownFaces') {
    const sheet = ss.getSheetByName('Users');
    if (!sheet) return jsonResponse([]);
    const values = sheet.getDataRange().getValues().slice(1);
    const data = values.filter(r => r[1] && r[3]).map(r => ({ 
      name: String(r[1]), 
      descriptor: JSON.parse(r[3]) 
    }));
    return jsonResponse(data);
  }
  
  // ดึงรายงานการเข้าเรียน (สำหรับหน้า Report)
  if (action === 'getAttendance') {
    const sheet = ss.getSheetByName('Attendance');
    if (!sheet) return jsonResponse([]);
    const values = sheet.getDataRange().getValues().slice(1);
    // เรียงจากล่าสุดขึ้นก่อน
    const data = values.reverse().map(r => ({
      name: r[0], subject: r[1], time: r[2], date: r[3]
    }));
    return jsonResponse(data);
  }

  return ContentService.createTextOutput("Face API v4.7 Active").setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
