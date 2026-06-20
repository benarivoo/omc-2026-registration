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

// Event + payment details used in the confirmation emails.
// Keep PAYMENT_ZELLE / PAYMENT_VENMO in sync with the PAYMENT object in
// omc-registration.html. Fill these in with your real handles.
var EVENT_NAME = 'OMC 2026';
var REPLY_TO = 'omc@fica.org';                 // ← contact / reply-to address
var PAYMENT_ZELLE = 'fica.treasury@gmail.com'; // Zelle email
var PAYMENT_VENMO = '@givetofica';             // Venmo handle

// Column order. These keys must match the payload sent by the HTML form.
// The header row is written automatically using these labels.
var COLUMNS = [
  { key: 'timestamp',        header: 'Timestamp' },
  { key: 'registrationType', header: 'Registration type' },
  { key: 'firstName',        header: 'First name' },
  { key: 'lastName',         header: 'Last name' },
  { key: 'email',            header: 'Email' },
  { key: 'phone',            header: 'Phone' },
  { key: 'city',             header: 'City / state' },
  { key: 'church',           header: 'Church / organisation' },
  { key: 'role',             header: 'Role / vocation' },
  { key: 'ticket',           header: 'Ticket type' },
  { key: 'groupName',        header: 'Group name' },
  { key: 'groupCode',        header: 'Group code' },
  { key: 'groupSize',        header: 'Group size' },
  { key: 'amountDue',        header: 'Amount due (USD)' },
  { key: 'paymentRef',       header: 'Payment reference' },
  { key: 'dietary',          header: 'Dietary requirements' },
  { key: 'referral',         header: 'Heard about us via' },
  { key: 'referredByName',   header: 'Referred by (name)' },
  { key: 'referredByEmail',  header: 'Referred by (email)' },
  { key: 'notes',            header: 'Notes' },
  { key: 'marketingOptIn',   header: 'Marketing opt-in' }
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

    // Group leads get an auto-assigned sequential name (group-1, group-2, ...).
    // This runs inside the script lock above, so two leads can't get the same
    // number. The name doubles as the group code / share-link key.
    if (data.registrationType === 'group-lead') {
      var assigned = getNextGroupName_();
      data.groupName = assigned;
      data.groupCode = assigned;
    } else if (data.registrationType === 'group-member') {
      // Members arrive with their group code in the URL; mirror it into the
      // Group name column so both columns show the group in the Sheet.
      if (!data.groupName) data.groupName = data.groupCode || '';
    }

    // Payment reference = the exact note registrants are told to include with
    // their Zelle/Venmo payment, so finance can match payments to this row.
    var fullName = (data.firstName || '') + (data.lastName ? ' ' + data.lastName : '');
    if (data.registrationType === 'group-member') {
      data.paymentRef = '';
    } else if (data.registrationType === 'group-lead') {
      data.paymentRef = (data.groupCode || '') + ' ' + fullName;
    } else {
      data.paymentRef = fullName;
    }

    var row = COLUMNS.map(function (col) {
      var value = data[col.key];
      return (value === undefined || value === null) ? '' : value;
    });
    // Stamp server-side receipt time if the form didn't send a timestamp.
    if (!row[0]) {
      row[0] = new Date().toISOString();
    }

    sheet.appendRow(row);

    // Send the confirmation / payment-instructions email. Wrapped so a mail
    // failure never blocks the registration from being recorded.
    try {
      sendConfirmationEmail_(data);
    } catch (mailErr) {
      // Intentionally ignored — the row is already saved.
    }

    return jsonOutput_({ result: 'success', groupCode: data.groupCode || '' });
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

/**
 * RUN THIS ONCE to fix "email does not work".
 *
 * In the Apps Script editor: pick "runEmailAuthCheck" in the function dropdown,
 * click Run, and approve the permissions when prompted (Gmail "send email as
 * you", and external requests for the QR images). You should then receive a
 * test email. After this, the registration confirmation emails will send.
 */
function runEmailAuthCheck() {
  var me = Session.getActiveUser().getEmail();
  MailApp.sendEmail({
    to: me,
    subject: EVENT_NAME + ' — test email',
    body: 'If you can read this, email sending is authorized and the OMC 2026 '
        + 'confirmation emails will work.\n\nZelle: ' + PAYMENT_ZELLE
        + '\nVenmo: ' + PAYMENT_VENMO,
    name: EVENT_NAME,
    replyTo: REPLY_TO
  });
  Logger.log('Test email sent to: ' + me);
}

/**
 * Emails the registrant a confirmation. Payers (individual + group lead) get
 * payment instructions; group members get a "you're covered" note.
 */
function sendConfirmationEmail_(data) {
  if (!data.email) return;

  var type = data.registrationType || 'individual';
  var name = (data.firstName || '') + (data.lastName ? ' ' + data.lastName : '');
  var ref = (type === 'group-lead') ? ((data.groupCode || '') + ' ' + name) : name;
  var lines = [];
  var subject;

  lines.push('Hi ' + (data.firstName || 'there') + ',');
  lines.push('');

  if (type === 'group-member') {
    subject = EVENT_NAME + ' — your group spot is reserved';
    lines.push('Your spot in ' + (data.groupCode || 'your group') + ' is reserved. Your group lead has covered your registration, so there is nothing for you to pay.');
  } else {
    subject = EVENT_NAME + ' — complete your payment to confirm';
    if (type === 'group-lead') {
      lines.push('Thank you for registering ' + (data.groupCode || 'your group') + ' for ' + EVENT_NAME + '.');
    } else {
      lines.push('Thank you for registering for ' + EVENT_NAME + '.');
    }
    lines.push('');
    lines.push('Amount due: $' + (data.amountDue || 0));
    lines.push('');
    lines.push('Please send payment using one of the following:');
    lines.push('  - Zelle: ' + PAYMENT_ZELLE);
    lines.push('  - Venmo: ' + PAYMENT_VENMO);
    lines.push('  (QR codes for both are shown in this email.)');
    lines.push('');
    lines.push('Please include this reference with your payment: ' + ref);
    lines.push('');
    lines.push('Once we receive your payment we will confirm your spot by email within 3 business days.');
    if (type === 'group-lead') {
      lines.push('');
      lines.push('Your group name is ' + (data.groupCode || '') + '.');
      if (data.baseUrl) {
        lines.push('Share this link so each member can register their own details (they will not be asked to pay):');
        lines.push('  ' + data.baseUrl + '?group=' + encodeURIComponent(data.groupCode || ''));
      } else {
        lines.push('Remember to share your group link so each member can register their own details (they will not be asked to pay).');
      }
    }
  }

  lines.push('');
  lines.push('See you there,');
  lines.push('The ' + EVENT_NAME + ' team');

  // Payers get the Zelle/Venmo QR codes inline. They're fetched from where the
  // form is hosted (derived from baseUrl). If they can't be fetched (e.g. local
  // testing), the email still goes out without the images.
  var inlineImages = {};
  var haveQr = false;
  if (type !== 'group-member') {
    var urls = barcodeUrls_(data.baseUrl);
    if (urls) {
      try {
        inlineImages.zelleqr = UrlFetchApp.fetch(urls.zelle).getBlob().setName('zelleqr');
        inlineImages.venmoqr = UrlFetchApp.fetch(urls.venmo).getBlob().setName('venmoqr');
        haveQr = true;
      } catch (qrErr) {
        haveQr = false;
      }
    }
  }

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: lines.join('\n'),
    htmlBody: buildHtmlEmail_(type, data, name, ref, haveQr),
    name: EVENT_NAME,
    replyTo: REPLY_TO,
    inlineImages: haveQr ? inlineImages : {}
  });
}

/**
 * Builds the absolute URLs of the Zelle/Venmo QR images, derived from the page
 * the form was submitted from (so it works wherever IT hosts the files).
 */
function barcodeUrls_(baseUrl) {
  if (!baseUrl) return null;
  var slash = baseUrl.lastIndexOf('/');
  var dir = slash >= 0 ? baseUrl.substring(0, slash + 1) : (baseUrl + '/');
  return {
    zelle: dir + 'payment%20barcode/FICA%20Zelle.jpeg',
    venmo: dir + 'payment%20barcode/FICA%20Venmo.jpeg'
  };
}

/**
 * HTML version of the confirmation email.
 */
function buildHtmlEmail_(type, data, name, ref, haveQr) {
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var h = [];
  h.push('<div style="font-family:Arial,Helvetica,sans-serif;color:#1a2640;max-width:520px;margin:0 auto;line-height:1.5;">');
  h.push('<p>Hi ' + esc(data.firstName || 'there') + ',</p>');

  if (type === 'group-member') {
    h.push('<p>Your spot in <strong>' + esc(data.groupCode || 'your group') + '</strong> is reserved. Your group lead has covered your registration, so there is nothing for you to pay.</p>');
  } else {
    if (type === 'group-lead') {
      h.push('<p>Thank you for registering <strong>' + esc(data.groupCode || 'your group') + '</strong> for ' + esc(EVENT_NAME) + '.</p>');
    } else {
      h.push('<p>Thank you for registering for ' + esc(EVENT_NAME) + '.</p>');
    }
    h.push('<div style="background:#1a2640;color:#ffffff;border-radius:8px;padding:16px;margin:16px 0;">');
    h.push('<div style="font-size:12px;opacity:.75;text-transform:uppercase;letter-spacing:.06em;">Amount due</div>');
    h.push('<div style="font-size:26px;font-weight:bold;">$' + esc(data.amountDue || 0) + '</div>');
    h.push('</div>');
    h.push('<p style="margin:0 0 6px;">Please send payment using one of the following:</p>');
    h.push('<ul style="margin:0 0 12px;padding-left:18px;">');
    h.push('<li>Zelle: <strong>' + esc(PAYMENT_ZELLE) + '</strong></li>');
    h.push('<li>Venmo: <strong>' + esc(PAYMENT_VENMO) + '</strong></li>');
    h.push('</ul>');
    if (haveQr) {
      h.push('<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;"><tr>');
      h.push('<td style="text-align:center;padding-right:14px;"><img src="cid:zelleqr" width="150" style="border:1px solid #e5e0d8;border-radius:8px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;">Scan for Zelle</div></td>');
      h.push('<td style="text-align:center;"><img src="cid:venmoqr" width="150" style="border:1px solid #e5e0d8;border-radius:8px;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;">Scan for Venmo</div></td>');
      h.push('</tr></table>');
    }
    h.push('<p style="background:#faf8f4;border:1px dashed #e5e0d8;border-radius:8px;padding:10px 12px;">Please include this reference with your payment:<br><strong>' + esc(ref) + '</strong></p>');
    h.push('<p style="font-size:13px;color:#6b7280;">Once we receive your payment we will confirm your spot by email within 3 business days.</p>');
    if (type === 'group-lead' && data.baseUrl) {
      var link = esc(data.baseUrl + '?group=' + encodeURIComponent(data.groupCode || ''));
      h.push('<p style="font-size:13px;">Your group name is <strong>' + esc(data.groupCode || '') + '</strong>. Share this link so each member can register their own details (they will not be asked to pay):<br><a href="' + link + '">' + link + '</a></p>');
    }
  }

  h.push('<p style="margin-top:18px;">See you there,<br>The ' + esc(EVENT_NAME) + ' team</p>');
  h.push('</div>');
  return h.join('');
}

/**
 * Returns the next sequential group name ("group-1", "group-2", ...).
 * The counter is kept in Script Properties so numbers never repeat, even if a
 * group row is later deleted. Call only from inside the doPost lock.
 */
function getNextGroupName_() {
  var props = PropertiesService.getScriptProperties();
  var last = parseInt(props.getProperty('lastGroupNumber'), 10);
  if (isNaN(last) || last < 0) last = 0;
  var next = last + 1;
  props.setProperty('lastGroupNumber', String(next));
  return 'group-' + next;
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
