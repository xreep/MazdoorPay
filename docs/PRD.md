# MazdoorPay — Product Requirements Document

**Product:** MazdoorPay — daily wage labour attendance and payment platform
**Live:** https://mazdoorpay.vercel.app
**Status:** Phase 1 released (October 2026)

## 1. Problem

Construction contractors in India manage daily wage workers — masons, labourers, electricians, helpers — across several sites. Most still use a paper attendance register and pay in cash on Saturday. That causes:

- **Errors:** wages worked out by hand from a register, with half-days and rate changes, go wrong.
- **Slow pay day:** totalling a week of attendance for every worker takes hours.
- **No transparency:** a worker cannot see how their pay was worked out, and the contractor has no record of advances already given.
- **Multi-site confusion:** workers move between sites; registers live at each site.
- **Disputes:** "I came on Tuesday", "You already took ₹1,000 advance" — with no shared record, every disagreement is word against word.

## 2. Goals

**Primary**

1. Digitise daily attendance for daily wage workers.
2. Work out wages automatically from attendance.
3. Track every payment and the dues still pending.
4. Make contractors' workforce management faster.
5. Reduce disputes and errors with a shared, permanent record.

**Secondary**

- Reports for labour compliance (muster roll, wage register).
- Each worker's history: attendance, earnings, payments.
- Easy record-keeping and printable records.
- Encourage digital adoption on construction sites.

**Success looks like:** a contractor marks a site's attendance in under a minute on a phone, knows exactly what every worker is owed at any moment, and can show a worker a printed record of each payment.

## 3. Users

| Persona                                                        | Context                                                | Needs                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Contractor** (e.g. Ravi Kumar, two sites in Bengaluru)       | Phone-first, often on site, moderate comfort with apps | Mark attendance fast, know who to pay, record cash and UPI payments, keep advances straight, print records |
| **Site supervisor** (uses the contractor's account in Phase 1) | On site every morning, may have low digital literacy   | One tap per worker, large buttons, plain words, no typing                                                  |
| **Platform admin**                                             | Runs MazdoorPay                                        | Manage contractor accounts, monitor usage, check data accuracy, report KPIs                                |
| **Worker** (indirect in Phase 1)                               | Gets paid; may not read English                        | A receipt they can keep; trust that the numbers are right                                                  |

## 4. Scope

### In scope (Phase 1)

- Registration and login
- Worker management
- Attendance tracking
- Wage calculation
- Payment tracking
- Admin panel

### Out of scope (Phase 1) and how the product respects it

| Out of scope                            | Decision                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Direct digital payment integration      | No money moves through MazdoorPay. Payments made in cash, UPI or bank are _recorded_; UPI payments carry the UTR reference.               |
| Biometric attendance                    | Not built. Attendance is marked by tapping on the register screen, or by scanning a worker's printed ID card (a QR code, not biometrics). |
| Government compliance filing automation | Not built. Compliance-style _exports_ only (muster roll, wage register as CSV and print).                                                 |
| Mobile application version              | No native app. The web app is mobile-first and works in any phone browser.                                                                |

## 5. User flows

**Contractor:** Register / log in → create a site → add workers → mark attendance → track wages → record payments.

**Admin:** Manage users → monitor activity → generate reports.

## 6. Functional requirements

| #     | Requirement                           | How MazdoorPay meets it                                                                                                                               |
| ----- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Contractor module**                 |                                                                                                                                                       |
| 1.1   | Register / log in                     | Email and password sign-up (always a contractor account), login, silent session refresh, logout, lockout after 5 failed attempts                      |
| 1.2   | Create and manage construction sites  | Sites page: add, rename, set location, mark inactive, delete only when unused; worker counts per site                                                 |
| 1.3   | Add and manage workers                | Workers page with search and filters; add/edit; deactivate/reactivate; move between sites                                                             |
| 1.4   | Mark daily attendance                 | Attendance register per site and day; one tap per worker; "Mark all present"; undo; save bar                                                          |
| 1.5   | Track wages and payments              | Dashboard money totals; Wages page; Payments page with dues, advances and history                                                                     |
| **2** | **Worker management**                 |                                                                                                                                                       |
| 2.1   | Worker details: name, role, wage rate | Name, work type (mason, labourer, electrician, plumber, carpenter, painter, welder, helper, other), daily wage, phone, UPI ID, joining date, language |
| 2.2   | Worker profiles                       | Profile page: balance (earned, paid, due or advance), details, wage history                                                                           |
| 2.3   | Work history                          | 60-day attendance calendar and recent payments on the profile; full history in attendance and payment lists                                           |
| 2.4   | Assign workers to sites               | Site chosen on the worker form; can be changed any time                                                                                               |
| **3** | **Attendance**                        |                                                                                                                                                       |
| 3.1   | Present / absent / half-day           | Three large buttons per worker, each with colour, icon and word                                                                                       |
| 3.2   | View attendance records               | Daily register, month calendar per site, per-worker calendar                                                                                          |
| 3.3   | Attendance reports                    | Attendance report and muster roll (workers × days, P/H/A, totals) as CSV and print view                                                               |
| 3.4   | Attendance history                    | Any past day can be opened; changes older than 7 days need a reason and are logged                                                                    |
| **4** | **Wage calculation**                  |                                                                                                                                                       |
| 4.1   | Wages from attendance                 | Present = day rate, half-day = half, absent = 0; the rate in force that day is stored with the mark                                                   |
| 4.2   | Daily / weekly calculation            | Wages page with a Daily / Weekly switch (weeks run Monday–Sunday) and period presets                                                                  |
| 4.3   | Total earnings and pending payments   | Earned in period, paid in period and current balance per worker and in total; dashboard "pending wages"                                               |
| 4.4   | Wage summaries                        | Wage register (days, rates, gross, advances, wages paid, balance) as CSV and print view                                                               |
| **5** | **Payment tracking**                  |                                                                                                                                                       |
| 5.1   | Record payments                       | Record payment form: amount pre-filled with what is owed, wage or advance, cash / UPI (with UTR) / bank, date, note                                   |
| 5.2   | Track pending dues                    | "To pay" list sorted by amount, with a total; advances list                                                                                           |
| 5.3   | Payment history                       | History with filters (worker, site, method, dates, voided)                                                                                            |
| 5.4   | Payment reports                       | Payments report as CSV and print view; printable receipt for each payment                                                                             |

### Extras beyond the brief

| Extra                      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WhatsApp messages          | One tap opens WhatsApp with a receipt (from the receipt page) or this week's summary (from the worker's profile) written in the worker's language; the contractor presses Send. No WhatsApp Business API.                                                                                                                                                                                                                                                                    |
| UPI pay-assist             | With UPI chosen in Record payment, a phone opens the contractor's own UPI app with the worker's UPI ID and amount filled in; a computer shows the same request as a QR code. The contractor types the UTR back in. **Not a payment integration:** MazdoorPay never sees or moves money and cannot confirm the payment.                                                                                                                                                       |
| Wage slip                  | A printable, A5-sized slip for one worker and any period: previous balance + earned − paid = balance due, with each day's attendance and rate and each payment. Linked from every worker on the Wages page (for the period on screen) and from the worker's profile (this week).                                                                                                                                                                                             |
| QR attendance and ID cards | Printable credit-card-size ID cards (one worker, or every active worker on a site, ten to an A4 sheet). "Scan ID cards" on the Attendance page uses the phone camera: each card marks that worker present today, with a beep and buzz; a worker already marked keeps their mark. Cards carry a signed code (`MP1.<worker>.<version>.<signature>`), so they cannot be forged; "Replace lost card" makes the old card stop working.                                            |
| Hindi                      | Every screen in simple, everyday Hindi, switched with one tap (sidebar, phone header or login page) and saved to the account so it follows the user to any device. Dates follow the language. Receipts and wage slips print in the worker's own language, whatever the contractor uses. The Devanagari font is self-hosted and downloads only when Hindi is on screen. Messages from the server (such as validation errors) stay in English.                                 |
| Worker statement link      | From the worker's profile, the contractor makes a private link and sends it (copy or WhatsApp). The worker opens it without an account and sees, in their own language, their all-time balance (the same figure the contractor sees) and the last 90 days of attendance, earnings and payments. Nothing else is shown: no other workers, no contractor contact details. A new link replaces the old one, "Stop link" ends it, and the profile shows when it was last opened. |
| Installable app            | "Add to home screen" on Android and iPhone opens MazdoorPay full-screen like an app, with its own icon. A service worker caches the app shell only: the app opens quickly, and without a connection it says it cannot reach the server instead of showing old figures. Nothing is saved offline.                                                                                                                                                                             |
| **6**                      | **Admin**                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                                                                                                                                                                       |
| 6.1                        | Manage users and contractors                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Users list with search; read-only contractor detail; suspend (ends their sessions) and reactivate                                                                     |
| 6.2                        | Monitor system usage                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Overview totals, weekly sign-ups, activity per day, full activity log with filters                                                                                    |
| 6.3                        | Ensure data accuracy                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Data checks: attendance after deactivation or before joining, wages paid above earnings, UPI payments without a UTR, workers with no site, possible duplicate workers |
| 6.4                        | Analytics reports                                                                                                                                                                                                                                                                                                                                                                                                                                                            | KPI page with CSV export (see section 9)                                                                                                                              |

**Pages (8):** Login / register, Dashboard, Sites, Workers (with worker profile), Attendance, Wages, Payments, Admin panel — plus printable views (receipt, muster roll, wage register, attendance and payments reports).

## 7. Non-functional requirements

| Requirement                                     | Target                                                                      | Result                                                                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Security** — secure authentication            | Industry-standard auth, no privilege escalation, no cross-contractor access | bcrypt, lockout, rotating httpOnly refresh cookies with theft detection, role checks on every request, tenant isolation tested across ~20 routes |
| **Usability** — simple for low digital literacy | One tap per worker, plain words, no typing to mark attendance               | 15 workers marked and saved in under 1 s of scripted use; status always shown as colour + icon + word                                            |
| **Accessibility** — mobile-responsive           | Works from 360 px phones; WCAG 2.1 AA                                       | Phone layouts tested at 412 and 360 px; 48 px tap targets; Lighthouse accessibility 100 (login page); axe: 0 serious/critical issues on 17 pages |
| **Performance** — fast                          | Lighthouse mobile ≥ 90; API p95 < 300 ms                                    | Lighthouse performance 96–98 (login page); p99 under 90 ms for six read endpoints in a local load test                                           |
| **Data** — secure storage                       | Encrypted at rest, no plain secrets, correct money                          | Atlas encryption and TLS; hashed passwords and tokens; integer paise; append-only payments; audit log; streaming backup and guarded restore      |
| **Scalability**                                 | Grows with users                                                            | Stateless API, contractor-scoped indexes, pagination, aggregation pipelines, versioned API                                                       |

Details and measurements: [TECHNICAL.md](TECHNICAL.md).

## 8. Data requirements

| Entity     | Required fields                            | Stored as                                                                                                           |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Worker     | name, role, daily wage rate, assigned site | name, role, dailyRate (paise) with rate history, siteId, plus phone, UPI ID, joining date, language, status         |
| Attendance | worker, date, status                       | workerId, day (India date), status, plus the rate used and amount earned                                            |
| Payment    | worker, amount, date, pending dues         | workerId, amount (paise), day, type, method, reference; pending dues are computed live from attendance and payments |

## 9. Key performance indicators

All are computed live from the data on the admin **Analytics** page and exportable as CSV.

| KPI                               | Definition                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Contractors using the platform    | Contractor accounts                                                                                         |
| Workers managed                   | Workers across all contractors                                                                              |
| Attendance records created        | Attendance marks (one per worker per day)                                                                   |
| Payment tracking accuracy         | Share of non-voided payments with no data problem                                                           |
| User engagement rate              | Share of active contractors with at least one recorded action in the last 7 days (30-day figure also shown) |
| Digital payments with a reference | Share of UPI and bank payments carrying a UTR or reference                                                  |

## 10. Assumptions and constraints

**Assumptions:** contractors are willing to move from paper registers; workers accept digital records; the site has mobile internet at least once a day.

**Constraints and responses:**

| Constraint                            | Response                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Digital literacy varies               | Large tap targets, plain language, one primary action per screen, colour + icon + word for every status |
| Data accuracy depends on manual entry | Validation on every field, a reason for old changes, voids instead of deletes, data checks for admins   |
| Payments may stay partly offline      | Cash payments are first-class; each gets a printable receipt                                            |
| Free hosting sleeps when idle         | The app shows "Waking up the server…" instead of failing                                                |

## 11. Release

| Phase       | Content                                                                                                              | Status      |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1 — Backend | API, rules, security, tests                                                                                          | Done        |
| 2 — Web app | 8 pages, print views                                                                                                 | Done        |
| 3 — Quality | End-to-end tests, accessibility, performance, CI                                                                     | Done        |
| 4 — Launch  | Deployment, demo data, documentation                                                                                 | Done        |
| 5 — Extras  | WhatsApp messages, UPI pay-assist, wage slip, QR attendance, Hindi, statement links, installable app; dark mode next | In progress |

## 12. Risks

| Risk                                           | Mitigation                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Wrong wages erode trust                        | Stored rate per day, tested wage maths, re-pricing only on purpose and reported  |
| Duplicate payments from double taps or retries | Request keys make payments idempotent; the form locks after saving               |
| Lost data                                      | Atlas storage, append-only payments, audit log, backup and restore scripts       |
| Account sharing or theft                       | Rotating refresh tokens with theft detection; admin suspension ends all sessions |
| Free-tier cold starts during a demo            | Wake-up message; upgrade path to an always-on plan                               |

## 13. Future enhancements

Designed but not built yet:

1. **Offline marking** — mark attendance without signal and sync later (the app already installs to the home screen).
2. **Dark mode** — the colour system already has a dark palette.
3. **Overtime hours and piece-rate work.**
4. **Biometric or GPS attendance.**
5. **Digital payouts** through a payment gateway (UPI, bank transfer).
6. **Government compliance filing** (PF, ESIC, BOCW welfare board).
7. **Native mobile app** for on-site use.
