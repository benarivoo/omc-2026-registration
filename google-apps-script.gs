/**
 * OMC 2026 — Registration intake → Google Sheet
 *
 * Paste this whole file into the Apps Script editor that is bound to your
 * registration Google Sheet (Extensions ▸ Apps Script), then deploy it as a
 * Web App. Full steps are in SETUP-INSTRUCTIONS.md.
 *
 * The web form POSTs a JSON body; this script appends one row per submission.
 */

// Name of the tab (sheet) rows are written to. It is created automatically
// on the first submission if it doesn't exist yet.
var SHEET_NAME = 'Registrations';

// Column order. These keys must match the payload sent by the HTML form.
// The header row is written automatically using these labels.
var COLUMNS = [
  { key: 'timestamp',      header: 'Timestamp' },
  { key: 'firstName',      header: 'First name' },
  { key: 'lastName',       header: 'Last name' },
  { key: 'email',          header: 'Email' },
  { key: 'phone',          header: 'Phone' },
  { key: 'city',           header: 'City / state' },
  { key: 'church',         header: 'Church / organisation' },
  { key: 'role',           header: 'Role / vocation' },
  { key: 'ticket',         header: 'Ticket type' },
  { key: 'dietary',        header: 'Dietary requirements' },
  { key: 'referral',       header: 'Heard about us via' },
  { key: 'notes',          header: 'Notes' },
  { key: 'marketingOptIn', header: 'Marketing opt-in' }
];

/**
 * Handles POST requests from the registration form.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // avoid two submissions writing the same row

  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    // Honeypot: the form's hidden "website" field must stay empty. A value
    // here means a bot posted directly to this URL — drop it silently but
    // return success so the bot doesn't retry.
    if (data.website) {
      return jsonOutput_({ result: 'success' });
    }

    var sheet = getSheet_();
    ensureHeader_(sheet);

    var row = COLUMNS.map(function (col) {
      var value = data[col.key];
      return (value === undefined || value === null) ? '' : value;
    });
    // Stamp server-side receipt time if the form didn't send a timestamp.
    if (!row[0]) {
      row[0] = new Date().toISOString();
    }

    sheet.appendRow(row);

    return jsonOutput_({ result: 'success' });
  } catch (err) {
    return jsonOutput_({ result: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lets you open the /exec URL in a browser to confirm the app is live.
 */
function doGet() {
  return jsonOutput_({ result: 'ok', message: 'OMC 2026 registration endpoint is running.' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    var headers = COLUMNS.map(function (col) { return col.header; });
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
