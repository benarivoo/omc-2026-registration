# OMC 2026 Registration — Changelog

A plain-language record of what changed in the registration form, intended for
both the team and non-technical stakeholders.

## Unreleased — 2026-06-19 (since the initial registration form)

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
