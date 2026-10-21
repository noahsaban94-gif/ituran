/**
 * Google Apps Script Web App for Saban Logistics
 * Spreadsheet ID: 1FsLseQrKbIj_AvlE6-dW4J12Gr88P3uaoFVBjEcUjsw
 *
 * Provides:
 * 1. GET ?action=bootstrap -> returns { ok: true, data: { discs, visits, sites, cities, user } }
 * 2. GET ?action=image&id=...&token=... -> extracts image from Google Drive by File ID / link and returns Data URL (base64)
 * 3. POST action=saveDisc -> writes date/plate correction & Rami approval to "ארכיון_טכוגרף"
 */

var SPREADSHEET_ID = "1FsLseQrKbIj_AvlE6-dW4J12Gr88P3uaoFVBjEcUjsw";
var AUTH_TOKEN = PropertiesService.getScriptProperties().getProperty("API_TOKEN") || "";

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "health";
  var token = (e && e.parameter && e.parameter.token) || "";

  // Optional Token Authentication Check
  if (AUTH_TOKEN && token !== AUTH_TOKEN) {
    return jsonResponse_({ ok: false, error: "טוקן אימות שגוי" }, 401);
  }

  // 1. Health check
  if (action === "health") {
    return jsonResponse_({ ok: true, status: "healthy", timestamp: new Date().toISOString() });
  }

  // 2. Extract image from Drive as Data URL (base64)
  if (action === "image") {
    var fileLinkOrId = e.parameter.id || e.parameter.link || "";
    var imgResult = getImageDataUrl(fileLinkOrId);
    return jsonResponse_(imgResult);
  }

  // 3. Bootstrap all sheets data
  if (action === "bootstrap") {
    var data = getBootstrapData_();
    return jsonResponse_({ ok: true, data: data });
  }

  return jsonResponse_({ ok: false, error: "פעולה אינה מוכרת: " + action }, 400);
}

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : "";
    var payload = JSON.parse(contents || "{}");

    if (AUTH_TOKEN && payload.token !== AUTH_TOKEN) {
      return jsonResponse_({ ok: false, error: "טוקן אימות שגוי" }, 401);
    }

    if (payload.action === "saveDisc") {
      var result = saveDiscCorrection_(payload.row, payload.fix);
      return jsonResponse_(result);
    }

    return jsonResponse_({ ok: false, error: "פעולת POST אינה מוכרת" }, 400);
  } catch (err) {
    return jsonResponse_({ ok: false, error: "שגיאה בעיבוד POST: " + err.toString() }, 500);
  }
}

/**
 * משיכת קובץ סריקה מ-Google Drive והמרתו ל-Data URL (base64)
 * @param {string} fileLinkOrId - קישור שיתוף של Drive (לדוגמה https://drive.google.com/file/d/.../view) או מזהה קובץ
 * @returns {Object} { ok: boolean, dataUrl?: string, mimeType?: string, fileName?: string, error?: string }
 */
function getImageDataUrl(fileLinkOrId) {
  if (!fileLinkOrId) {
    return { ok: false, error: "חסר מזהה קובץ Drive או קישור" };
  }

  var fileId = extractDriveId_(fileLinkOrId);
  if (!fileId) {
    return { ok: false, error: "לא ניתן לחלץ מזהה קובץ תקין מתוך הקישור" };
  }

  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var mimeType = blob.getContentType() || "image/jpeg";
    var bytes = blob.getBytes();
    var base64 = Utilities.base64Encode(bytes);
    var dataUrl = "data:" + mimeType + ";base64," + base64;

    return {
      ok: true,
      dataUrl: dataUrl,
      fileId: fileId,
      fileName: file.getName(),
      mimeType: mimeType,
      sizeBytes: bytes.length,
      lastUpdated: file.getLastUpdated().toISOString()
    };
  } catch (err) {
    return {
      ok: false,
      error: "שגיאה בגישה לקובץ ב-Google Drive (ודא הרשאות צפייה): " + err.toString(),
      fileId: fileId
    };
  }
}

/**
 * חילוץ מזהה קובץ Drive מתוך מגוון תבניות URL
 */
function extractDriveId_(input) {
  if (!input) return null;
  var str = input.toString().trim();

  // Pattern 1: /file/d/{id}
  var match1 = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1 && match1[1]) return match1[1];

  // Pattern 2: id={id}
  var match2 = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2 && match2[1]) return match2[1];

  // Pattern 3: /d/{id}
  var match3 = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match3 && match3[1]) return match3[1];

  // Pattern 4: Raw file ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(str)) {
    return str;
  }

  return null;
}

/**
 * קריאת כל הטאבים מהגיליון לפי שמות עמודות
 */
function getBootstrapData_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var discs = readSheetObjects_(ss, "ארכיון_טכוגרף");
  var visits = readSheetObjects_(ss, "היסטוריית_ביקורים");
  if (visits.length === 0) {
    visits = readSheetObjects_(ss, "איתוראן_ביקורים_יומי");
  }
  var sites = readSheetObjects_(ss, "אתרי_לקוחות");
  if (sites.length === 0) {
    sites = readSheetObjects_(ss, "אתרים_וערים");
  }
  var notes = readSheetObjects_(ss, "ארכיון_תעודות_גליה");

  return {
    discs: discs,
    visits: visits,
    sites: sites,
    deliveryNotes: notes,
    user: { name: "ראמי מסארווה", role: "סדרן עבודה ואיש שטח" }
  };
}

/**
 * קריאת טאב והמרת שורות למערך אובייקטים עם מפתחות לפי שמות הכותרות
 */
function readSheetObjects_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var rows = [];

  for (var r = 1; r < data.length; r++) {
    var rowValues = data[r];
    var obj = { _row: r + 1 };
    var hasContent = false;

    for (var c = 0; c < headers.length; c++) {
      var header = headers[c].toString().trim();
      var val = rowValues[c];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "Asia/Jerusalem", "dd/MM/yyyy HH:mm");
      }
      obj[header] = val;
      if (val !== "" && val !== null && val !== undefined) {
        hasContent = true;
      }
    }

    if (hasContent) {
      rows.push(obj);
    }
  }

  return rows;
}

/**
 * שמירת תיקוני דיסקית ואישור ראמי בטאב "ארכיון_טכוגרף"
 */
function saveDiscCorrection_(rowNumber, fix) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("ארכיון_טכוגרף");
  if (!sheet) {
    return { ok: false, error: "טאב ארכיון_טכוגרף לא נמצא" };
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  function getColIndex(colName) {
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].toString().trim() === colName) return i + 1;
    }
    return -1;
  }

  var dateCol = getColIndex("תאריך מתוקן") > 0 ? getColIndex("תאריך מתוקן") : getColIndex("תיקון תאריך");
  var plateCol = getColIndex("משאית מתוקנת") > 0 ? getColIndex("משאית מתוקנת") : getColIndex("תיקון רישוי");
  var approverCol = getColIndex("אושר ע״י") > 0 ? getColIndex("אושר ע״י") : getColIndex("מאשר");
  var approveDateCol = getColIndex("אושר בתאריך") > 0 ? getColIndex("אושר בתאריך") : getColIndex("אישור דיסקית");

  if (fix.date && dateCol > 0) {
    sheet.getRange(rowNumber, dateCol).setValue(fix.date);
  }
  if (fix.plate && plateCol > 0) {
    sheet.getRange(rowNumber, plateCol).setValue(fix.plate);
  }
  if (fix.approve) {
    var nowStr = Utilities.formatDate(new Date(), "Asia/Jerusalem", "dd/MM/yyyy HH:mm");
    if (approverCol > 0) sheet.getRange(rowNumber, approverCol).setValue(fix.approver || "ראמי מסארווה");
    if (approveDateCol > 0) sheet.getRange(rowNumber, approveDateCol).setValue(nowStr);
  }

  return { ok: true, message: "הדיסקית עודכנה בהצלחה בשורה " + rowNumber };
}

function jsonResponse_(obj, status) {
  var output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
