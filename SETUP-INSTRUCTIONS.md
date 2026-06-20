# OMC 2026 Registration → Google Sheet — Setup

This connects `omc-registration.html` to a Google Sheet you own, using a Google
Apps Script "Web App" as the bridge. No server or paid service is required.

```
Browser form  ──POST──►  Apps Script Web App  ──appendRow──►  Google Sheet
```

---

## 1. Create the Google Sheet

1. Go to <https://sheets.google.com> and create a **blank spreadsheet**.
2. Name it something like **OMC 2026 — Registrations**.
3. You don't need to add any headers — the script creates them automatically.

## 2. Add the Apps Script

1. In the Sheet menu: **Extensions ▸ Apps Script**.
2. Delete the default `function myFunction() {}` stub.
3. Open `google-apps-script.gs` (in this folder), copy **everything**, and paste
   it into the editor.
4. Click the **Save** icon (💾).

## 3. Deploy as a Web App

1. Top-right: **Deploy ▸ New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** `OMC 2026 registration intake`
   - **Execute as:** **Me** (your account)
   - **Who has access:** **Anyone**  ← required so the public form can post.
4. Click **Deploy**.
5. Google will ask you to **authorize access** the first time:
   - Choose your account → "Google hasn't verified this app" → **Advanced** →
     **Go to (project name)** → **Allow**. (This is normal for your own scripts.)
6. Copy the **Web app URL**. It ends in `/exec` and looks like:
   `https://script.google.com/macros/s/AKfy............/exec`

> Tip: paste that URL into a browser tab. You should see
> `{"result":"ok","message":"OMC 2026 registration endpoint is running."}`

## 4. Connect the HTML form

1. Open `omc-registration.html` in a text editor.
2. Near the bottom, find this line (inside the `<script>` block):
   ```js
   const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
   ```
3. Replace the placeholder with the `/exec` URL you copied:
   ```js
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfy....../exec';
   ```
4. Save the file.

## 4b. Set your payment details (Zelle / Venmo)

Payment instructions are shown on the success screen **and** emailed to each
registrant. Fill in your real handles in **two** places, keeping them identical:

1. In `omc-registration.html`, near the top of the `<script>` block:
   ```js
   const PAYMENT = {
     zelle: 'fica.treasury@gmail.com',   // Zelle email
     venmo: '@givetofica'                // Venmo handle
   };
   ```
2. In `google-apps-script.gs`, near the top:
   ```js
   var EVENT_NAME = 'OMC 2026';
   var REPLY_TO = 'omc@fica.org';                 // ← contact / reply-to address
   var PAYMENT_ZELLE = 'fica.treasury@gmail.com'; // Zelle email
   var PAYMENT_VENMO = '@givetofica';             // Venmo handle
   ```

### Payment QR codes

The Zelle/Venmo QR images live in the **`payment barcode/`** folder
(`FICA Zelle.jpeg`, `FICA Venmo.jpeg`). They appear on the success page and in
the confirmation email.

- **Hosting:** IT must upload the whole `payment barcode/` folder alongside
  `omc-registration.html`, keeping the same relative path.
- **Email images:** the script fetches those images from the hosted URL to embed
  them in the email, so this only works once the page is live on a public URL
  (during local testing the email simply goes out without the QR images). This
  uses the **external request** permission, so re-authorize when prompted.

> The first time the script tries to send an email, Google will ask you to grant
> the **Send email as you** permission. Re-run the deploy/authorize flow (Step 3)
> and click **Allow**. Without this, rows still save but no email is sent.

## 5. Test it locally

You can just double-click `omc-registration.html` to open it in your browser —
that works fine for this setup. (Optionally, serve it from a folder with
`python3 -m http.server 8000` and visit <http://localhost:8000/omc-registration.html>.)

1. Fill in the form and click **Continue to payment**.
2. You should see the payment-instructions screen (amount + Zelle/Venmo).
3. Switch to your Google Sheet — a new row should appear within a second or two,
   with a **Registrations** tab and a bold header row.
4. Check the inbox of the email you used — a confirmation should arrive.

If the row shows up, the connection works. 🎉

### Test the group + member flow

1. Choose **A group (5+)** and add 5+ people across the quantity steppers, then
   submit. (No group name to type — it's assigned automatically.)
2. The success screen shows the group total, the assigned name (e.g. `group-1`),
   and a **shareable group link** ending in `?group=group-1`.
3. Open that link in a new tab — the form switches to **member mode**: no
   pricing, no payment, just personal details. Submit it and confirm the row in
   the Sheet is tagged with the same group code.

### Test the referral

The optional **Referred by (name / email)** fields are recorded in the Sheet so
you can issue the $10 merchandise vouchers manually (up to 2 referrals each).

## 6. Hand off to IT

Give the IT team the **final `omc-registration.html`** (with the real URL pasted
in) to upload to `https://fica.org/omc/omc-registration.html`. Nothing else on
the server side is needed — the form talks directly to your Apps Script.

The Apps Script and Sheet stay in **your** Google account; IT never needs access
to them.

---

## Notes & troubleshooting

- **No row appears.** Re-open the `/exec` URL in a browser — if you don't see the
  "running" message, the deployment isn't live or "Who has access" isn't set to
  **Anyone**. Re-deploy and re-check step 3.
- **The form always says "success" even on error.** By design, the browser can't
  read the response from an Apps Script web app (no CORS), so the form treats a
  completed request as success. The reliable source of truth is the Sheet itself
  — spot-check it. For a registration form this is the standard, simplest setup.
- **Changing the script later.** If you edit `google-apps-script.gs`, you must
  **Deploy ▸ Manage deployments ▸ Edit (pencil) ▸ Version: New version ▸ Deploy**
  for changes to take effect. The `/exec` URL stays the same, so you don't need
  to touch the HTML again.
- **Adding/removing fields.** Add a matching entry to the `COLUMNS` array in the
  script *and* a matching key in the `payload` object in the HTML, keeping the
  `key` names identical on both sides.
- **No email arrives.** The script needs the Gmail "send email as you" scope.
  Re-deploy (Manage deployments ▸ Edit ▸ New version ▸ Deploy) and click
  **Allow** when prompted. Also check the registrant's spam folder. Note: a
  Gmail account can send a limited number of emails per day (~100 for free
  accounts), which is plenty for this event but worth knowing.
- **Group names are automatic.** When a group lead registers, the **Apps Script**
  assigns the next sequential name (`group-1`, `group-2`, ...) and returns it to
  the page, which shows it and builds the member link
  (`…/omc-registration.html?group=group-2`). The lead also receives the name +
  link by email. The counter is stored in the script's properties, so numbers
  never repeat even if you delete a row. To reset numbering (e.g. after testing),
  in the Apps Script editor run **Project Settings ▸ Script Properties** and
  delete/edit the `lastGroupNumber` value. Members who open the link don't pay;
  the lead pays the whole group total (each ticket minus $10).
- **Group submit reads the response.** Unlike the other paths, the group-lead
  submission makes a normal (readable) request so it can show the assigned name.
  This needs the deployment's **Who has access: Anyone** setting (Step 3). If the
  browser can't read it for any reason, the registration is still saved and the
  lead still gets the name + link by email.
- **Payments are manual (rev1).** This version shows Zelle/Venmo details and
  emails them. You reconcile payments yourself in the Sheet. PayPal checkout is
  planned for a later revision (rev2).
- **Privacy.** Submissions are written to a Sheet only you control. The form
  collects names, emails, and optional details — make sure your terms/privacy
  link reflects that.
