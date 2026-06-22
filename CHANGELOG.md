# OMC 2026 Registration — Changelog

A plain-language record of what changed in the registration form, intended for
both the team and non-technical stakeholders.

## Unreleased — 2026-06-21 (CC finance on both emails)

- **Consolidated to a single registration form.** The early-bird form
  (previously `omc-registration-june22.html`) is now simply
  **`omc-registration.html`**, and the old group/referral version that used that
  name was removed (it's still preserved as the `omc-registration-july20.html`
  backup). So the live registration page is now `omc-registration.html`.
- The **payment-instructions email** (sent when someone registers on
  `omc-registration.html`) and the **payment-proof acknowledgement email**
  (sent after they upload their receipt on `omc-payment.html`) are now **CC'd to
  `fica.treasury@gmail.com` and `yennychandra@fica.org`**. This gives finance a
  copy of what each registrant was told — the amount due, Zelle/Venmo details and
  reference at registration, and the "proof received, under review" note after
  upload — so they can follow up if someone doesn't finish paying. The CC list is
  the new `FINANCE_CC` constant near the top of `google-apps-script.gs`.
- The **payment-instructions email** now also includes a **"Complete your payment
  & upload your receipt"** button that deep-links back to `omc-payment.html` with
  the registrant's details pre-filled (registration ID, amount, name, email,
  category, and payment reference), so if they don't finish in one sitting they
  can return straight to the payment + upload step from the email — the amount,
  Zelle/Venmo details and reference all reappear. (Individual / early-bird flow.)
- The **Phone** field is now labelled **"Phone (WhatsApp)"** on both the live
  early-bird form and the July backup form, to signal it's used for WhatsApp
  contact. (Label text only — nothing else about the field changed.)
- The **payments Drive folder is now configured** (`PAYMENTS_FOLDER_ID` in
  `google-apps-script.gs`), so uploaded receipts/student IDs land in a specific
  folder you control. **Re-deploy the script** for this to take effect.
- **Setup instructions now cover hosting on WordPress / cPanel** — upload the
  pages as static files into their own sub-folder (not as a WordPress Page), and
  clarified that the Drive folder for receipts is separate from web hosting.
- **Fixed the "Complete your payment" button (and QR images) not being clickable
  in the email.** They are now built from a single configurable `SITE_BASE_URL`
  in `google-apps-script.gs` (the public folder where the pages are hosted),
  instead of from whatever page a registration happened to be submitted from. A
  test registration done from a local `file://` page no longer produces a
  dead/unclickable email link — set `SITE_BASE_URL` to your hosted address and
  the links always work. Added a `runDriveAuthCheck()` helper too, to authorize
  Drive and verify the payments folder ID from the editor.

## Unreleased — 2026-06-20 (early-bird form + payment upload flow)

### Two form versions
- `omc-registration-june22.html` is the new **early-bird registration form** that
  goes live now. `omc-registration-july20.html` is an unchanged backup copy of
  the previous form for the later period. The original `omc-registration.html`
  is untouched.

### Early-bird registration form changes (`omc-registration-june22.html`)
- **Individual only** — removed the group (5+) option and the referral / voucher
  fields for the early-bird season.
- **Phone**, **City**, **State**, and **Dietary requirements** are now **required**
  (City and State are separate fields and sheet columns), and a new **School /
  company** field was added.
- Google Sheet structure is unchanged (Registrations + Ticket Orders + TShirt
  Orders + Payments); early-bird registrations are **individual tickets only**.
- Reworked pricing into two clear tickets per attendee type:
  - **Full Package** — conference, accommodation, meals.
  - **Conference Entry Ticket** — conference only.
  Each shows the discounted price with the regular price struck through. Prices:
  Student $190 / $140, Professional $260 / $190 (regular: $220 / $170 and
  $290 / $220). Wording now reads "Price increases July 12 · Registration ends
  August 20" instead of "early bird / regular".
- The in-form fish quiz was removed (it now lives on the thank-you page).

### New payment + thank-you pages
- After registering, attendees go to a new **payment page** (`omc-payment.html`)
  showing the amount due, Zelle/Venmo details + QR codes, and an upload for their
  **payment receipt** (plus a **student ID** upload for student tickets).
- Submitting the proof saves the files to a **Google Drive folder**, logs a row
  in a new **"Payments"** sheet, and emails the attendee an acknowledgement that
  their payment is under review.
- A new **thank-you page** (`omc-thankyou.html`) then invites them to take the
  FICA "What Fish Are You?" quiz.

## Unreleased — 2026-06-20 (since "group registration, tiered pricing, payments")

### New for registrants
- Added **t-shirt ordering** — the "Filled to Overflow" tee ($25 each) in white
  and blue, with a per-size quantity grid (S–3XL), a size chart, and a preview
  image.
- Added an **order summary** that combines registration and t-shirt totals so
  people can see exactly what they're paying for before payment.
- Added the **FICA "What Fish Are You?" quiz** as a fun call-to-action both in
  the form and on the success screen.

### Pricing changes
- **Early-bird now applies to every ticket** bought during the early-bird window
  — including the "without accommodation & food" option (previously only the
  full package was marked early bird).

### Behind the scenes (Google Sheet + email)
- Every registration now gets a **sequential Registration ID** that ties
  together all of its order rows across sheets.
- Added two new tabs for finance: **"Ticket Orders"** (one row per ticket type,
  plus a group discount row) and **"TShirt Orders"** (one row per colour/size).
- The "Ticket Orders" tab now includes an **"Accommodation Ordered"** column
  (TRUE for full packages, FALSE for without-accommodation tickets) and an
  **"Early Bird"** column.
- Expanded the main "Registrations" tab with order totals (before/after
  discount, t-shirt totals, amount due).
- **Confirmation emails now include a full order breakdown**, and group members
  who add t-shirts now receive a payment email for the t-shirt amount.

## Commited — 2026-06-19 (since the initial registration form)

### New registration capabilities
- Added a **group registration option (5 or more people)** with automatic group
  naming, a discounted group rate, and a shareable link so each member registers
  their own details without paying.
- Added **tiered pricing** (Student / Professional, with or without
  accommodation) and **time-based pricing periods** (e.g. early-bird vs. later
  rates).
- Added a **referral / voucher feature** — the referrer and the referred person
  each receive a $10 merchandise voucher (vouchers are handled manually).

### Payment experience
- The success screen now shows **payment instructions** (Zelle & Venmo handles,
  amount due, and a payment reference) plus **QR codes** for easy payment.
- Added payment QR images (`payment barcode/` folder).

### Behind the scenes (Google Sheet + email)
- Expanded the Google Sheet to capture more data (registration type, group
  name/size, amount due, payment reference, referral info).
- The system now **automatically emails each registrant** a confirmation with
  payment instructions (or a "you're covered" note for group members).

### Documentation & extras
- Added a customer-journey document and updated setup instructions.
