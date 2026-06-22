/**
 * OMC 2026 — Registration intake → Google Sheet
 *
 * Paste this whole file into the Apps Script editor that is bound to your
 * registration Google Sheet (Extensions ▸ Apps Script), then deploy it as a
 * Web App. Full steps are in SETUP-INSTRUCTIONS.md.
 *
 * The web form POSTs a JSON body; this script appends one row per submission.
 */

// Names of the tabs (sheets) rows are written to. They are created
// automatically on the first submission if they don't exist yet.
var SHEET_NAME = 'Registrations';
var TICKET_SHEET_NAME = 'Ticket Orders';
var TSHIRT_SHEET_NAME = 'TShirt Orders';
var PAYMENTS_SHEET_NAME = 'Payments';

// Event + payment details used in the confirmation emails.
// Keep PAYMENT_ZELLE / PAYMENT_VENMO in sync with the PAYMENT object in
// omc-registration.html. Fill these in with your real handles.
var EVENT_NAME = 'OMC 2026';
var REPLY_TO = 'omc@fica.org';                 // ← contact / reply-to address
// Finance / organiser addresses CC'd on the payment-instructions email (sent at
// registration) and the payment-proof acknowledgement (sent after upload), so
// they keep a record and can follow up if a registrant doesn't finish.
var FINANCE_CC = 'fica.treasury@gmail.com, yennychandra@fica.org';
var PAYMENT_ZELLE = 'fica.treasury@gmail.com'; // Zelle email
var PAYMENT_VENMO = '@givetofica';             // Venmo handle
var QUIZ_URL = 'https://omc2026fishquiz.netlify.app'; // FICA "What Fish Are You?" quiz

// Public address of the FOLDER where the pages are hosted (must end in "/").
// Email links — the "Complete your payment" button and the Zelle/Venmo QR images
// — are built from this so they're always clickable, even when a test
// registration was submitted from a local file:// or localhost page (Gmail won't
// linkify those). Leave blank to fall back to the page the form was submitted
// from. Change this to the WordPress URL for production.
var SITE_BASE_URL = 'https://benarivoo.github.io/omc-2026-registration/';

// Google Drive folder where payment receipts + student IDs are saved. Create a
// folder in your Drive, open it, and copy the ID from the URL
// (drive.google.com/drive/folders/THIS_PART). Leave blank to auto-create a
// folder named "OMC 2026 Payments" in the script owner's Drive root.
var PAYMENTS_FOLDER_ID = '1uQDMwvcMDmUrZU6o31ReOrjz9FE3ndx5';

// Group discount per person + flat t-shirt price (keep in sync with the form).
var GROUP_DISCOUNT_PER_PERSON = 10;
var TSHIRT_PRICE = 25;

// Main "Registrations" sheet — one row per submission. The keys must match the
// payload sent by the HTML form. The header row is written automatically.
var COLUMNS = [
  { key: 'registrationId',       header: 'Registration ID' },
  { key: 'timestamp',            header: 'Timestamp' },
  { key: 'registrationType',     header: 'Registration type' },
  { key: 'firstName',            header: 'First name' },
  { key: 'lastName',             header: 'Last name' },
  { key: 'email',                header: 'Email' },
  { key: 'phone',                header: 'Phone' },
  { key: 'city',                 header: 'City' },
  { key: 'state',                header: 'State' },
  { key: 'church',               header: 'Church / organisation' },
  { key: 'role',                 header: 'Role / vocation' },
  { key: 'regTicketType',        header: 'Ticket Type' },
  { key: 'ticket',               header: 'Ticket detail' },
  { key: 'groupName',            header: 'Group name' },
  { key: 'groupCode',            header: 'Group code' },
  { key: 'groupSize',            header: 'Group size' },
  { key: 'ticketBeforeDiscount', header: 'Total for Ticket before discount' },
  { key: 'ticketDiscount',       header: 'Total Discount' },
  { key: 'ticketAfterDiscount',  header: 'Total Ticket after discount' },
  { key: 'tshirtQty',            header: 'TShirt Order (Total)' },
  { key: 'tshirtTotal',          header: 'Total TShirt' },
  { key: 'amountDue',            header: 'Amount due (USD)' },
  { key: 'paymentRef',           header: 'Payment reference' },
  { key: 'tshirtOrder',          header: 'T-shirt order (detail)' },
  { key: 'dietary',              header: 'Dietary requirements' },
  { key: 'referral',             header: 'Heard about us via' },
  { key: 'referredByName',       header: 'Referred by (name)' },
  { key: 'referredByEmail',      header: 'Referred by (email)' },
  { key: 'notes',                header: 'Notes' },
  { key: 'marketingOptIn',       header: 'Marketing opt-in' },
  { key: 'school',               header: 'School / company' },
  { key: 'gender',               header: 'Gender' },
  { key: 'address',              header: 'Address' },
  { key: 'major',                header: 'Major (student)' },
  { key: 'university',           header: 'University (student)' },
  { key: 'studentProgram',       header: 'Program / year (student)' },
  { key: 'jobTitle',             header: 'Job title (professional)' },
  { key: 'company',              header: 'Company / organization (professional)' },
  { key: 'industry',             header: 'Industry (professional)' },
  { key: 'accommodationNights',  header: 'Accommodation nights' },
  { key: 'attendDays',           header: 'Days attending' },
  { key: 'language',             header: 'Language(s)' },
  { key: 'travelMode',           header: 'Travel mode' },
  { key: 'travelItinerary',      header: 'Travel itinerary' }
];

// "Ticket Orders" sheet — one row per ticket type within a registration, plus a
// "Discount" row for groups (unit price = -$10, quantity = group size).
var TICKET_COLUMNS = ['Registration ID', 'Ticket Type', 'Accommodation Ordered', 'Unit Price', 'Quantity', 'Total Price', 'Early Bird'];

// "TShirt Orders" sheet — one row per (registration, colour, size) combination.
var TSHIRT_COLUMNS = ['Registration ID', 'Color', 'Size', 'Quantity', 'Unit Price', 'Total Price', 'TShirt Order ID'];

// "Payments" sheet — one row per payment-proof submission from omc-payment.html.
var PAYMENTS_COLUMNS = ['Registration ID', 'Timestamp', 'Name', 'Email', 'Category', 'Amount (USD)', 'Receipt Link', 'Student ID Link', 'Folder Link'];

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

    // Payment-proof upload from omc-payment.html (separate flow from intake).
    if (data.action === 'payment') {
      return handlePaymentSubmission_(data);
    }

    // Honeypot: the form's hidden "website" field must stay empty. A value
    // here means a bot posted directly to this URL — drop it silently but
    // return success so the bot doesn't retry.
    if (data.website) {
      return jsonOutput_({ result: 'success' });
    }

    var sheet = getSheet_();
    ensureHeader_(sheet);

    // Sequential Registration ID, shared across all three sheets so finance can
    // join the order line items back to this registration.
    data.registrationId = getNextRegId_();

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
      // Members don't pay for registration, but they may owe for t-shirts.
      data.paymentRef = (Number(data.amountDue) > 0) ? ((data.groupCode || '') + ' ' + fullName) : '';
    } else if (data.registrationType === 'group-lead') {
      data.paymentRef = (data.groupCode || '') + ' ' + fullName;
    } else {
      data.paymentRef = fullName;
    }

    // Stamp server-side receipt time if the form didn't send a timestamp.
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }
    // Total number of t-shirts (the "TShirt Order (Total)" column).
    if (data.tshirtQty === undefined || data.tshirtQty === null || data.tshirtQty === '') {
      data.tshirtQty = 0;
    }

    var row = COLUMNS.map(function (col) {
      var value = data[col.key];
      return (value === undefined || value === null) ? '' : value;
    });

    sheet.appendRow(row);

    // Write the per-line-item rows to the Ticket Orders + TShirt Orders sheets.
    // Wrapped so a failure here never blocks the main registration record.
    try {
      writeTicketOrders_(data);
    } catch (ticketErr) {
      // Intentionally ignored — the main row is already saved.
    }
    try {
      writeTshirtOrders_(data);
    } catch (tshirtErr) {
      // Intentionally ignored — the main row is already saved.
    }

    // Send the confirmation / payment-instructions email. Wrapped so a mail
    // failure never blocks the registration from being recorded.
    try {
      sendConfirmationEmail_(data);
    } catch (mailErr) {
      // Intentionally ignored — the row is already saved.
    }

    return jsonOutput_({ result: 'success', groupCode: data.groupCode || '', registrationId: data.registrationId });
  } catch (err) {
    return jsonOutput_({ result: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handles a payment-proof submission from omc-payment.html: saves the uploaded
 * receipt (and student ID, for students) to Google Drive, records a row in the
 * "Payments" sheet, and emails the registrant an acknowledgement.
 *
 * Expected payload: { action:'payment', regId, name, email, category, amount,
 *   ref, files:[{ kind:'receipt'|'studentId', name, mimeType, dataBase64 }] }
 */
function handlePaymentSubmission_(data) {
  var files = data.files || [];
  if (!files.length) {
    return jsonOutput_({ result: 'error', message: 'No files received.' });
  }

  // A per-registration subfolder keeps each person's documents together.
  var parent = getPaymentsFolder_();
  var folderName = (data.regId ? (data.regId + ' - ') : '')
    + (data.name || 'Unknown') + ' - ' + formatStamp_(new Date());
  var folder = parent.createFolder(sanitizeName_(folderName));

  var receiptLink = '';
  var studentIdLink = '';
  files.forEach(function (f) {
    if (!f || !f.dataBase64) return;
    var bytes = Utilities.base64Decode(f.dataBase64);
    var blob = Utilities.newBlob(bytes, f.mimeType || 'application/octet-stream', f.name || (f.kind || 'file'));
    var file = folder.createFile(blob);
    if (f.kind === 'studentId') {
      studentIdLink = file.getUrl();
    } else {
      receiptLink = file.getUrl();
    }
  });

  // Record the submission for finance to verify against payments received.
  try {
    var sheet = getOrCreateSheet_(PAYMENTS_SHEET_NAME, PAYMENTS_COLUMNS);
    sheet.appendRow([
      data.regId || '',
      new Date().toISOString(),
      data.name || '',
      data.email || '',
      data.category || '',
      Number(data.amount) || 0,
      receiptLink,
      studentIdLink,
      folder.getUrl()
    ]);
  } catch (sheetErr) {
    // Files are already saved; don't fail the request over the log row.
  }

  // Let the registrant know we have their proof and it's under review.
  try {
    sendPaymentAckEmail_(data);
  } catch (mailErr) {
    // Intentionally ignored — the upload itself already succeeded.
  }

  return jsonOutput_({ result: 'success' });
}

/**
 * Returns the Drive folder where payment documents are saved — the configured
 * PAYMENTS_FOLDER_ID if set, otherwise an auto-created "OMC 2026 Payments"
 * folder in the script owner's Drive root.
 */
function getPaymentsFolder_() {
  if (PAYMENTS_FOLDER_ID) {
    return DriveApp.getFolderById(PAYMENTS_FOLDER_ID);
  }
  var name = EVENT_NAME + ' Payments';
  var existing = DriveApp.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : DriveApp.createFolder(name);
}

/**
 * Emails the registrant a confirmation that their payment proof was received
 * and is under review, with the fish-quiz link.
 */
function sendPaymentAckEmail_(data) {
  if (!data.email) return;
  var firstName = (data.name || '').split(' ')[0] || 'there';
  var amount = Number(data.amount) || 0;
  var subject = EVENT_NAME + ' — payment proof received';

  var lines = [];
  lines.push('Hi ' + firstName + ',');
  lines.push('');
  lines.push('Thank you — we have received your payment proof for ' + EVENT_NAME
    + (amount ? (' (amount: $' + amount + ')') : '') + '.');
  lines.push('');
  lines.push('Our team will verify your payment and confirm your spot by email within 3 business days.');
  if (data.regId) {
    lines.push('');
    lines.push('Your registration reference: ' + data.regId);
  }
  lines.push('');
  lines.push('Haven\'t taken our "What Fish Are You?" quiz yet? Discover your fish here:');
  lines.push('  ' + QUIZ_URL);
  lines.push('');
  lines.push('See you there,');
  lines.push('The ' + EVENT_NAME + ' team');

  MailApp.sendEmail({
    to: data.email,
    cc: FINANCE_CC,
    subject: subject,
    body: lines.join('\n'),
    htmlBody: buildPaymentAckHtml_(firstName, amount, data.regId),
    name: EVENT_NAME,
    replyTo: REPLY_TO
  });
}

/**
 * HTML version of the payment-acknowledgement email.
 */
function buildPaymentAckHtml_(firstName, amount, regId) {
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var h = [];
  h.push('<div style="font-family:Arial,Helvetica,sans-serif;color:#1a2640;max-width:520px;margin:0 auto;line-height:1.5;">');
  h.push('<p>Hi ' + esc(firstName) + ',</p>');
  h.push('<p>Thank you — we have received your payment proof for <strong>' + esc(EVENT_NAME) + '</strong>'
    + (amount ? (' (amount: <strong>$' + esc(amount) + '</strong>)') : '') + '.</p>');
  h.push('<p>Our team will verify your payment and confirm your spot by email within 3 business days.</p>');
  if (regId) {
    h.push('<p style="background:#faf8f4;border:1px dashed #e5e0d8;border-radius:8px;padding:10px 12px;">Your registration reference:<br><strong>' + esc(regId) + '</strong></p>');
  }
  h.push('<p style="background:#faf8f4;border:1px solid #e5e0d8;border-radius:8px;padding:12px 14px;font-size:13px;">Haven\'t taken our <strong>"What Fish Are You?"</strong> quiz yet? <a href="' + esc(QUIZ_URL) + '" style="color:#1a2640;font-weight:bold;">Discover your fish &rarr;</a></p>');
  h.push('<p style="margin-top:18px;">See you there,<br>The ' + esc(EVENT_NAME) + ' team</p>');
  h.push('</div>');
  return h.join('');
}

/**
 * Drive/folder-safe timestamp like "2026-06-20 15-04-09".
 */
function formatStamp_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'UTC', 'yyyy-MM-dd HH-mm-ss');
}

/**
 * Strips characters that aren't safe in Drive file/folder names.
 */
function sanitizeName_(name) {
  return String(name || '').replace(/[\\\/:*?"<>|]/g, '-').slice(0, 120);
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
 * RUN THIS ONCE to fix "We could not confirm your upload" on the payment page.
 *
 * In the Apps Script editor: pick "runDriveAuthCheck" in the function dropdown,
 * click Run, and approve the **Google Drive** permission when prompted. This
 * proves two things the public uploads need but can't prompt for themselves:
 *   1. the Drive scope is authorized for you (the script owner), and
 *   2. the configured PAYMENTS_FOLDER_ID is a folder your account can open.
 *
 * On success it creates (and then trashes) a tiny test file inside the payments
 * folder and logs "Drive OK". If PAYMENTS_FOLDER_ID is wrong or your account
 * can't access it, it throws a clear error naming the problem — fix the ID (or
 * share the folder with this account) and run again. After this passes, real
 * uploads from omc-payment.html will work.
 */
function runDriveAuthCheck() {
  var me = Session.getActiveUser().getEmail();
  var folder;
  try {
    folder = getPaymentsFolder_();
  } catch (e) {
    throw new Error('Cannot open the payments folder. Check PAYMENTS_FOLDER_ID ("'
      + PAYMENTS_FOLDER_ID + '") — it must be a folder the account ' + me
      + ' can access. Underlying error: ' + e);
  }
  var test = folder.createFile(
    Utilities.newBlob('OMC 2026 Drive auth check — safe to delete.', 'text/plain', 'omc-drive-auth-check.txt'));
  Logger.log('Drive OK — payments folder: "' + folder.getName() + '" (' + folder.getId()
    + '), authorized as ' + me + '. Test file: ' + test.getUrl());
  // Try to clean up the probe file. Trashing can be denied when the folder is
  // shared from another account or lives in a Shared Drive — that's harmless and
  // does NOT affect uploads (which only create folders/files). Just log it so the
  // owner can delete the probe file manually.
  try {
    test.setTrashed(true);
  } catch (trashErr) {
    Logger.log('Note: could not auto-delete the probe file (this does not affect '
      + 'uploads). Please delete "omc-drive-auth-check.txt" from the folder manually.');
  }
}

/**
 * Emails the registrant a confirmation. Payers (individual + group lead) get
 * payment instructions; group members get a "you're covered" note.
 */
function sendConfirmationEmail_(data) {
  if (!data.email) return;

  var type = data.registrationType || 'individual';
  var name = (data.firstName || '') + (data.lastName ? ' ' + data.lastName : '');
  var amountDue = Number(data.amountDue) || 0;
  var isPayer = amountDue > 0;
  // Individuals reference by name; group lead/members include their group code.
  var ref = data.groupCode ? (data.groupCode + ' ' + name) : name;
  var lines = [];
  var subject;

  lines.push('Hi ' + (data.firstName || 'there') + ',');
  lines.push('');

  if (type === 'group-member') {
    lines.push('Your spot in ' + (data.groupCode || 'your group') + ' is reserved. Your group lead has covered your registration.');
    if (isPayer) {
      subject = EVENT_NAME + ' — complete your t-shirt payment';
      lines.push('You also ordered t-shirts, so there is a t-shirt payment to complete below.');
    } else {
      subject = EVENT_NAME + ' — your group spot is reserved';
      lines.push('There is nothing for you to pay.');
    }
  } else {
    subject = EVENT_NAME + ' — complete your payment to confirm';
    if (type === 'group-lead') {
      lines.push('Thank you for registering ' + (data.groupCode || 'your group') + ' for ' + EVENT_NAME + '.');
    } else {
      lines.push('Thank you for registering for ' + EVENT_NAME + '.');
    }
  }

  if (isPayer) {
    lines.push('');
    lines.push('Order summary:');
    getOrderBreakdown_(type, data).forEach(function (r) {
      lines.push('  - ' + r[0] + ': ' + r[1]);
    });
    lines.push('  Total due: $' + amountDue);
    lines.push('');
    lines.push('Please send payment using one of the following:');
    lines.push('  - Zelle: ' + PAYMENT_ZELLE);
    lines.push('  - Venmo: ' + PAYMENT_VENMO);
    lines.push('  (QR codes for both are shown in this email.)');
    lines.push('');
    lines.push('Please include this reference with your payment: ' + ref);
    lines.push('');
    lines.push('Once we receive your payment we will confirm by email within 3 business days.');
  }

  // Deep link back to the payment page (individual / june22 flow), pre-filled so
  // they can return any time to pay and upload their receipt.
  var payUrl = (type === 'individual') ? paymentPageUrl_(data) : '';
  if (payUrl) {
    lines.push('');
    lines.push('Complete your payment and upload your receipt here (your details are pre-filled):');
    lines.push('  ' + payUrl);
  }

  if (type === 'group-lead') {
    lines.push('');
    lines.push('Your group name is ' + (data.groupCode || '') + '.');
    if (data.baseUrl) {
      lines.push('Share this link so each member can register their own details (they will not be asked to pay for registration):');
      lines.push('  ' + data.baseUrl + '?group=' + encodeURIComponent(data.groupCode || ''));
    } else {
      lines.push('Remember to share your group link so each member can register their own details.');
    }
  }

  lines.push('');
  lines.push('Haven\'t taken our "What Fish Are You?" quiz yet? Discover your fish here:');
  lines.push('  ' + QUIZ_URL);

  lines.push('');
  lines.push('See you there,');
  lines.push('The ' + EVENT_NAME + ' team');

  // Payers get the Zelle/Venmo QR codes inline. They're fetched from where the
  // form is hosted (derived from baseUrl). If they can't be fetched (e.g. local
  // testing), the email still goes out without the images.
  var inlineImages = {};
  var haveQr = false;
  if (isPayer) {
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
    cc: FINANCE_CC,
    subject: subject,
    body: lines.join('\n'),
    htmlBody: buildHtmlEmail_(type, data, name, ref, haveQr, isPayer),
    name: EVENT_NAME,
    replyTo: REPLY_TO,
    inlineImages: haveQr ? inlineImages : {}
  });
}

/**
 * Builds the absolute URL of the payment page (omc-payment.html), pre-filled so
 * an individual registrant can return later to pay and upload their receipt.
 * Derived from the registration page the form was submitted from (data.baseUrl),
 * so it works wherever IT hosts the files. The params match exactly what
 * omc-payment.html reads on load, so the amount, Zelle/Venmo details and the
 * payment reference all reappear. Returns '' if there's no base URL to build on.
 */
/**
 * Returns the public folder URL (always ending in "/") that email links are
 * built on: the configured SITE_BASE_URL if set, otherwise the directory of the
 * page the form was submitted from — but only when that's a real http(s) URL, so
 * a local file:// or localhost test never produces an unclickable email link.
 * Returns '' if neither is usable.
 */
function siteDir_(baseUrl) {
  if (SITE_BASE_URL) {
    return SITE_BASE_URL.charAt(SITE_BASE_URL.length - 1) === '/' ? SITE_BASE_URL : (SITE_BASE_URL + '/');
  }
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) return '';
  var slash = baseUrl.lastIndexOf('/');
  return slash >= 0 ? baseUrl.substring(0, slash + 1) : (baseUrl + '/');
}

function paymentPageUrl_(data) {
  var dir = siteDir_(data.baseUrl);
  if (!dir) return '';
  var name = (data.firstName || '') + (data.lastName ? ' ' + data.lastName : '');
  var params = [
    'regId=' + encodeURIComponent(data.registrationId || ''),
    'amount=' + encodeURIComponent(Number(data.amountDue) || 0),
    'name=' + encodeURIComponent(name),
    'email=' + encodeURIComponent(data.email || ''),
    'category=' + encodeURIComponent((data.regTicketType || '').toLowerCase()),
    'ref=' + encodeURIComponent(data.paymentRef || name)
  ];
  return dir + 'omc-payment.html?' + params.join('&');
}

/**
 * Builds the absolute URLs of the Zelle/Venmo QR images, on the same public
 * folder (SITE_BASE_URL, or the submitting page) as the rest of the email links.
 */
function barcodeUrls_(baseUrl) {
  var dir = siteDir_(baseUrl);
  if (!dir) return null;
  return {
    zelle: dir + 'payment%20barcode/FICA%20Zelle.jpeg',
    venmo: dir + 'payment%20barcode/FICA%20Venmo.jpeg'
  };
}

/**
 * Builds order-breakdown rows ([label, value]) for a payer's confirmation.
 * Individuals see their registration; group leads see subtotal + discount;
 * group members only see t-shirts (their registration is covered by the lead).
 */
function getOrderBreakdown_(type, data) {
  var rows = [];
  var size = Number(data.groupSize) || 0;

  if (type === 'group-lead') {
    rows.push(['Subtotal (' + size + (size === 1 ? ' person' : ' people') + ')', '$' + (Number(data.ticketBeforeDiscount) || 0)]);
    rows.push(['Group discount ($' + GROUP_DISCOUNT_PER_PERSON + ' \u00D7 ' + size + ')', '-$' + (Number(data.ticketDiscount) || 0)]);
  } else if (type !== 'group-member') {
    rows.push(['Registration', '$' + (Number(data.ticketAfterDiscount) || 0)]);
  }

  // Itemise each t-shirt (colour + size), then a t-shirt subtotal line.
  var lines = data.tshirtLines || [];
  if (lines.length) {
    lines.forEach(function (ln) {
      var q = Number(ln.quantity) || 0;
      rows.push(['T-shirt — ' + ln.color + ' ' + ln.size + ' (' + q + ' \u00D7 $' + TSHIRT_PRICE + ')', '$' + (q * TSHIRT_PRICE)]);
    });
    rows.push(['Total t-shirts (' + (Number(data.tshirtQty) || 0) + ')', '$' + (Number(data.tshirtTotal) || 0)]);
  }
  return rows;
}

/**
 * HTML version of the confirmation email.
 */
function buildHtmlEmail_(type, data, name, ref, haveQr, isPayer) {
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var amountDue = Number(data.amountDue) || 0;
  var tshirt = data.tshirtOrder ? String(data.tshirtOrder) : '';
  var h = [];
  h.push('<div style="font-family:Arial,Helvetica,sans-serif;color:#1a2640;max-width:520px;margin:0 auto;line-height:1.5;">');
  h.push('<p>Hi ' + esc(data.firstName || 'there') + ',</p>');

  if (type === 'group-member') {
    h.push('<p>Your spot in <strong>' + esc(data.groupCode || 'your group') + '</strong> is reserved. Your group lead has covered your registration.'
      + (isPayer ? '' : ' There is nothing for you to pay.') + '</p>');
    if (isPayer && tshirt) {
      h.push('<p>You also ordered t-shirts: <strong>' + esc(tshirt) + '</strong>.</p>');
    }
  } else {
    if (type === 'group-lead') {
      h.push('<p>Thank you for registering <strong>' + esc(data.groupCode || 'your group') + '</strong> for ' + esc(EVENT_NAME) + '.</p>');
    } else {
      h.push('<p>Thank you for registering for ' + esc(EVENT_NAME) + '.</p>');
    }
  }

  if (isPayer) {
    h.push('<div style="background:#1a2640;color:#ffffff;border-radius:8px;padding:16px;margin:16px 0;">');
    getOrderBreakdown_(type, data).forEach(function (r) {
      h.push('<div style="display:flex;justify-content:space-between;font-size:13px;color:rgba(255,255,255,.78);padding:3px 0;"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>');
    });
    h.push('<div style="border-top:1px solid rgba(255,255,255,.2);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;align-items:baseline;">');
    h.push('<span style="font-size:12px;opacity:.75;text-transform:uppercase;letter-spacing:.06em;">Total due</span>');
    h.push('<span style="font-size:24px;font-weight:bold;">$' + esc(amountDue) + '</span>');
    h.push('</div>');
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
    h.push('<p style="font-size:13px;color:#6b7280;">Once we receive your payment we will confirm by email within 3 business days.</p>');
  }

  // Deep link back to the payment page (individual / june22 flow), pre-filled so
  // they can return any time to pay and upload their receipt.
  var payUrl = (type === 'individual') ? paymentPageUrl_(data) : '';
  if (payUrl) {
    h.push('<p style="text-align:center;margin:18px 0;"><a href="' + esc(payUrl) + '" style="display:inline-block;background:#c9a84c;color:#1a2640;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 26px;border-radius:999px;">Complete your payment &amp; upload your receipt &rarr;</a></p>');
    h.push('<p style="font-size:12px;color:#6b7280;text-align:center;margin:-6px 0 4px;">Your details are pre-filled — just pay and attach your receipt.</p>');
  }

  if (type === 'group-lead' && data.baseUrl) {
    var link = esc(data.baseUrl + '?group=' + encodeURIComponent(data.groupCode || ''));
    h.push('<p style="font-size:13px;">Your group name is <strong>' + esc(data.groupCode || '') + '</strong>. Share this link so each member can register their own details (they will not be asked to pay for registration):<br><a href="' + link + '">' + link + '</a></p>');
  }

  h.push('<p style="background:#faf8f4;border:1px solid #e5e0d8;border-radius:8px;padding:12px 14px;font-size:13px;">Haven\'t taken our <strong>"What Fish Are You?"</strong> quiz yet? <a href="' + esc(QUIZ_URL) + '" style="color:#1a2640;font-weight:bold;">Discover your fish &rarr;</a></p>');
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

/**
 * Returns the next sequential counter value for the given Script Property key.
 * Used for Registration IDs and TShirt Order IDs. Call only inside the lock.
 */
function nextCounter_(propKey, start) {
  var props = PropertiesService.getScriptProperties();
  var last = parseInt(props.getProperty(propKey), 10);
  if (isNaN(last) || last < (start - 1)) last = start - 1;
  var next = last + 1;
  props.setProperty(propKey, String(next));
  return next;
}

function getNextRegId_() {
  return nextCounter_('lastRegNumber', 1001);
}

/**
 * Appends one row per ticket type to the "Ticket Orders" sheet, plus a single
 * "Discount" row for groups (unit price = -$10, quantity = group size).
 * Group members have no ticket rows — their registration is covered by the lead.
 */
function writeTicketOrders_(data) {
  var lines = data.ticketLines;
  if (!lines || !lines.length) {
    if (!(data.registrationType === 'group-lead' && Number(data.ticketDiscount) > 0)) return;
    lines = [];
  }

  var sheet = getOrCreateSheet_(TICKET_SHEET_NAME, TICKET_COLUMNS);
  var rows = [];
  lines.forEach(function (ln) {
    var unit = Number(ln.unitPrice) || 0;
    var qty = Number(ln.quantity) || 0;
    rows.push([data.registrationId, ln.type, ln.accommodation ? true : false, unit, qty, unit * qty, ln.earlyBird ? true : false]);
  });

  // Group discount as its own line: -$10 per person across the whole group.
  var discount = Number(data.ticketDiscount) || 0;
  if (data.registrationType === 'group-lead' && discount > 0) {
    var size = Number(data.groupSize) || 0;
    rows.push([data.registrationId, 'Discount', '', -GROUP_DISCOUNT_PER_PERSON, size, -discount, '']);
  }

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, TICKET_COLUMNS.length).setValues(rows);
  }
}

/**
 * Appends one row per (registration, colour, size) to the "TShirt Orders" sheet,
 * each with its own sequential TShirt Order ID.
 */
function writeTshirtOrders_(data) {
  var lines = data.tshirtLines;
  if (!lines || !lines.length) return;

  var sheet = getOrCreateSheet_(TSHIRT_SHEET_NAME, TSHIRT_COLUMNS);
  var rows = lines.map(function (ln) {
    var qty = Number(ln.quantity) || 0;
    return [data.registrationId, ln.color, ln.size, qty, TSHIRT_PRICE, qty * TSHIRT_PRICE, getNextTshirtOrderId_()];
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, TSHIRT_COLUMNS.length).setValues(rows);
}

function getNextTshirtOrderId_() {
  return nextCounter_('lastTshirtOrderNumber', 1);
}

/**
 * Returns the named sheet, creating it (with a bold, frozen header row) if it
 * doesn't exist yet.
 */
function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
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
