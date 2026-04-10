// ============================================================
//  GOOGLE APPS SCRIPT — Fast Data Processing Patch
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

function doPost(e) {
  checkAndInitSheets();
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: 'JSON Error' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  const action = data.action;

  if (action === 'registerUser') {
    // ฟังก์ชันแบบส่งทีละรูป แต่ประมวลผลเร็ว
    sheet.appendRow([
      String(data.id || '-'),
      String(data.name),
      String(data.year || '-'),
      JSON.stringify(data.faceDescriptor),
      new Date()
    ]);
    return jsonResponse({ success: true });
  }

  if (action === 'logAttendance') {
    const attSheet = ss.getSheetByName('Attendance');
    const now = new Date();
    attSheet.appendRow([
      data.name, 
      data.subject, 
      Utilities.formatDate(now, "GMT+7", "HH:mm:ss"), 
      "'" + Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd"), 
      data.lat, data.lng, 
      `https://www.google.com/maps?q=${data.lat},${data.lng}`
    ]);
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Action not found' });
}

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (action === 'getKnownFaces') {
    const sheet = ss.getSheetByName('Users');
    if (!sheet) return jsonResponse([]);
    const data = sheet.getDataRange().getValues().slice(1);
    // ส่งข้อมูลกลับแบบลดขนาด
    const result = data.map(r => ({ name: r[1], descriptor: JSON.parse(r[3]) }));
    return jsonResponse(result);
  }
  if (action === 'getSubjects') {
    const sheet = ss.getSheetByName('Subjects');
    const data = sheet.getDataRange().getValues().slice(1);
    return jsonResponse(data.map(r => ({ code: r[0], name: r[1] })));
  }
  return jsonResponse({ status: 'ready' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
