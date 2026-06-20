# OMC 2026 Registration — Changelog

A plain-language record of what changed in the registration form, intended for
both the team and non-technical stakeholders.

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
