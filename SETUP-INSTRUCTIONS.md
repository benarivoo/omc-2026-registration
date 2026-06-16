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

## 5. Test it locally

You can just double-click `omc-registration.html` to open it in your browser —
that works fine for this setup. (Optionally, serve it from a folder with
`python3 -m http.server 8000` and visit <http://localhost:8000/omc-registration.html>.)

1. Fill in the form and click **Complete registration**.
2. You should see the "You're registered!" screen.
3. Switch to your Google Sheet — a new row should appear within a second or two,
   with a **Registrations** tab and a bold header row.

If the row shows up, the connection works. 🎉

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
- **Privacy.** Submissions are written to a Sheet only you control. The form
  collects names, emails, and optional details — make sure your terms/privacy
  link reflects that.
