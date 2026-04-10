/**
 * GOOGLE APPS SCRIPT - v4.6 (High Precision & Data Fix)
 * แก้ปัญหาการสแกนไม่ติด และ ข้อมูล Dashboard เป็น undefined
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // --- ส่วนที่ 1: การลงทะเบียนนักศึกษาใหม่ ---
    if (data.action === 'registerUser') {
      const sheet = ss.getSheetByName('Users') || ss.insertSheet('Users');
      
      // ถ้าเป็นชีตใหม่ ให้สร้างหัวตาราง
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['ID', 'Name', 'Year', 'Descriptor', 'RegDate']);
      }
      
      // บันทึกข้อมูลใบหน้าแบบ High Precision
      sheet.appendRow([
        String(data.id), 
        String(data.name), 
        String(data.year || "-"), 
        data.desc, // เก็บ JSON string ของ Descriptor
        new Date()
      ]);
      return jsonResponse({success: true});
    }
    
    // --- ส่วนที่ 2: การบันทึกเวลาเรียน (เช็คชื่อ) ---
    if (data.action === 'logAttendance') {
      const attSheet = ss.getSheetByName('Attendance') || ss.insertSheet('Attendance');
      const now = new Date();
      const dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
      const timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
      
      // สร้างหัวตารางถ้ายังไม่มี
      if (attSheet.getLastRow() === 0) {
        attSheet.appendRow(['Name', 'Subject', 'Time', 'Date', 'Lat', 'Lng', 'MapURL']);
      }
      
      // ตรวจสอบการเช็คชื่อซ้ำ (ในวันเดียวกัน วิชากลุ่มเดียวกัน)
      const logs = attSheet.getDataRange().getValues();
      const isDuplicate = logs.some(row => 
        row[0] == data.name && 
        row[1] == data.subject && 
        row[3] == dateStr
      );
      
      if (isDuplicate) {
        return jsonResponse({success: false, message: 'คุณเช็คชื่อวิชานี้ไปแล้วในวันนี้'});
      }

      // บันทึกข้อมูลแบบ String เพื่อป้องกันปัญหา undefined ใน Dashboard
      attSheet.appendRow([
        String(data.name), 
        String(data.subject), 
        timeStr, 
        dateStr, 
        data.lat || 0, 
        data.lng || 0,
        `https://www.google.com/maps?q=${data.lat||0},${data.lng||0}`
      ]);
      
      return jsonResponse({success: true});
    }
  } catch (err) {
    return jsonResponse({success: false, error: err.toString()});
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;

  // ดึงรายชื่อวิชา (สำหรับหน้า Index)
  if (action === 'getSubjects') {
    const sheet = ss.getSheetByName('Subjects');
    if (!sheet) {
      const newSheet = ss.insertSheet('Subjects');
      newSheet.appendRow(['Code', 'Name']);
      return jsonResponse([]);
    }
    const values = sheet.getDataRange().getValues().slice(1);
    return jsonResponse(values.map(r => ({ code: r[0], name: r[1] })));
  }

  // ดึงข้อมูลใบหน้าที่รู้จัก (สำหรับหน้า Scan)
  if (action === 'getKnownFaces') {
    const sheet = ss.getSheetByName('Users');
    if (!sheet) return jsonResponse([]);
    const values = sheet.getDataRange().getValues().slice(1);
    
    // กรองข้อมูลที่สมบูรณ์เท่านั้น
    const data = values.filter(r => r[1] && r[3]).map(r => ({ 
      name: r[1], 
      descriptor: JSON.parse(r[3]) 
    }));
    return jsonResponse(data);
  }
  
  // สำหรับดึงไปแสดงผลในหน้า Dashboard
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

  return ContentService.createTextOutput("System Active (v4.6)").setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
