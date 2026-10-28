# MazdoorPay — Technical Documentation

- **Live app:** https://mazdoorpay.vercel.app
- **API reference (Swagger UI):** https://mazdoorpay-api.onrender.com/api/v1/docs/
- **Source:** https://github.com/xreep/MazdoorPay

## 1. Architecture

```
Browser (phone or desktop)
   │  https://mazdoorpay.vercel.app
   ▼
Vercel ── static React build (client/dist)
   │  /api/*  rewritten to Render (same origin, so the refresh cookie stays first-party)
   ▼
Render (Singapore) ── Node 22 + Express 5 API, /api/v1
   │  Mongoose 8, transactions
   ▼
MongoDB Atlas M0 (replica set)
```

The repository is an npm workspace with three packages:

| Package   | Role                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shared/` | Zod schemas, constants, India-time day helpers, paise money helpers. Imported by both the API and the app, so validation rules are written once. |
| `server/` | Express API. Layers: routes → `validate` (Zod) → thin controllers → services (all business rules) → Mongoose models.                             |
| `client/` | React 18 + Vite app. TanStack Query for server state, React Router 7 data router, Tailwind CSS, Framer Motion, Recharts, react-hook-form.        |

### Request flow

1. `helmet`, strict CORS allow-list, compression, 100 kB JSON body limit, cookie parser.
2. NoSQL-operator sanitising (`$` and `.` keys are stripped from body, query and params).
3. Rate limits: 300 requests / 15 min per client on `/api`; 30 / 15 min on login and register. Each limit is also counted per nearest proxy hop, at five times the allowance. Behind Vercel → Render the client address comes from `X-Forwarded-For`, which a caller going straight to Render could forge; the address Render itself records cannot be.
4. `requireAuth` verifies the access token and re-reads the user's role and status from the database on every request; `requireRole` guards contractor and admin routes.
5. `validate` parses body, query and params with the shared Zod schemas and replaces them with the parsed values (unknown keys are dropped).
6. Services enforce the domain rules; every write is recorded in the audit log.
7. The error handler maps Zod, Mongoose and HTTP errors to `{ error, details? }` and never returns stack traces.

## 2. Data model

All money is **integer paise** (₹1 = 100). All business days are **`YYYY-MM-DD` strings in Asia/Kolkata**.

| Collection      | Key fields                                                                                                                                                                                                        | Indexes                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `users`         | name, email (unique, lowercase), passwordHash (bcrypt, never selected by default), phone, role (`contractor` / `admin`), status (`active` / `suspended`), suspendedReason, lastLoginAt, preferredLanguage, isDemo | email unique; role + createdAt                                           |
| `refreshtokens` | userId, tokenHash (SHA-256, unique), family, expiresAt (TTL), revokedAt, replacedByHash                                                                                                                           | tokenHash unique; family; TTL on expiresAt                               |
| `loginattempts` | email, attempts, lockoutUntil                                                                                                                                                                                     | email unique; TTL 24 h                                                   |
| `sites`         | contractorId, name, location, isActive                                                                                                                                                                            | contractorId + name unique (case-insensitive)                            |
| `workers`       | contractorId, siteId, name, role, dailyRate, rateHistory[{rate, effectiveFrom, setAt, setBy}], phone, upiId, preferredLanguage, joinedOn, isActive, deactivatedOn, qrVersion, ledgerVersion                       | contractorId + isActive + name; contractorId + siteId                    |
| `attendances`   | contractorId, workerId, siteId, day, status, rateSnapshot, earned, method, markedBy                                                                                                                               | workerId + day unique; contractorId + day; contractorId + siteId + day   |
| `payments`      | contractorId, workerId, siteId, day, amount, type (`wage` / `advance`), method (`cash` / `upi` / `bank`), reference, notes, recordedBy, idempotencyKey, voidedAt, voidedBy, voidReason                            | contractorId + idempotencyKey unique; contractorId + day; workerId + day |
| `auditlogs`     | actorId, actorRole, contractorId, action, entity, entityId, before, after, ip, at                                                                                                                                 | contractorId + at; entity + entityId + at; action + at                   |

## 3. Domain rules

| Rule                 | How it works                                                                                                                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Earnings             | Present earns the day's rate, half-day earns `floor(rate / 2)`, absent earns 0. The rate and earnings are stored on each attendance record (`rateSnapshot`, `earned`), so changing a rate never silently rewrites history.                                                                                 |
| Rate changes         | A worker keeps a rate history. A new rate starts from a chosen day (not in the future, not before the latest change) and re-prices only days already marked from then on; the API reports how many days were recalculated. A change on the latest start day corrects a typo instead of adding a new entry. |
| Balance              | `balance = all earnings − all non-voided payments (wages + advances)`. Positive means wages are owed; negative means an advance is still to be recovered from future work.                                                                                                                                 |
| Wage payments        | A wage payment cannot exceed the current dues; the extra must be recorded as an advance.                                                                                                                                                                                                                   |
| Concurrency          | Payments, attendance changes, rate changes and voids run in MongoDB transactions and bump the worker's `ledgerVersion`, so two writers racing on one worker's money conflict and the loser re-checks the dues.                                                                                             |
| Idempotency          | Every payment carries a request key. Sending the same key again returns the first payment (HTTP 200); reusing a key for a different payment is refused (409). The app mints one key per opening of the payment form.                                                                                       |
| Mistakes             | Payments are never edited or deleted. A wrong payment is voided with a reason and stays on record.                                                                                                                                                                                                         |
| Backdated attendance | Changing attendance more than 7 days back needs a reason, which is stored in the audit log. Future days are refused.                                                                                                                                                                                       |
| Weeks                | Monday to Sunday, in India time.                                                                                                                                                                                                                                                                           |
| Tenant isolation     | Every contractor query is scoped to the caller. Another contractor's ids return **404**, never 403, so ids cannot be probed.                                                                                                                                                                               |

## 4. Authentication

- **Register** always creates a contractor; any `role` sent is ignored. Admins are created only by the seed or `npm run create-admin -w server`.
- **Passwords:** 8–72 characters with a letter and a number, bcrypt cost 12.
- **Lockout:** 5 failed logins lock that email for 15 minutes (HTTP 423). Wrong email and wrong password return the same message, and unknown emails are compared against a dummy hash so both take the same time. Demo accounts are never locked: their passwords are public, so a lockout would only let anyone shut everyone else out of the demo.
- **Access token:** JWT (HS256), 15 minutes, returned in the response body and kept only in the app's memory.
- **Refresh token:** 48 random bytes in an httpOnly, SameSite=Lax cookie scoped to `/api/v1/auth` (Secure in production), stored as a SHA-256 hash, valid 7 days, rotated on every refresh.
  - Each login starts a token **family**. Presenting a token that was rotated more than 30 seconds ago is treated as theft and revokes the whole family.
  - A token rotated within the last 30 seconds (a lost response, or two tabs refreshing at once) gets a fresh token in the same family instead of a logout.
  - The new token is written before the old one is retired, so parallel refreshes never see the session without a live token.
- **App behaviour:** the app refreshes silently on load and on any 401, sharing one refresh between parallel requests, then retries once. Only a 401/403 from the refresh ends the session; a network error or server error keeps the user signed in.
- **Suspension** blocks login, refresh and existing access tokens, and revokes every refresh token of that user.

## 5. API

Interactive reference: **https://mazdoorpay-api.onrender.com/api/v1/docs/** (raw OpenAPI 3.1 at `/api/v1/docs/openapi.json`). Request bodies and query parameters in it are generated from the same Zod schemas the routes validate with. The route list and each route's status codes are maintained by hand beside them, and a test fails if that list differs from the routes the API serves. Response bodies are described in words, not schemas.

| Module     | Endpoints                                                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth       | register, login, refresh, logout, `GET/PATCH /auth/me`                                                                                                                                                                                                                                                         |
| Sites      | list with worker counts, create, read with stats, update, delete (only when unused)                                                                                                                                                                                                                            |
| Workers    | search and paginate, create, read, private statement link (make, status, stop), ID cards (signed QR codes) for a site or worker, replace a lost card, summary (balance, 60-day attendance, recent payments), wage slip for a period (opening and closing balance), update, rate change, deactivate, reactivate |
| Attendance | scan an ID card (marks present today), bulk save for a day, history, site register for a day, month calendar                                                                                                                                                                                                   |
| Wages      | daily or weekly summary with period payments and balances                                                                                                                                                                                                                                                      |
| Payments   | record (idempotent), history, dues and advances, receipt data, void                                                                                                                                                                                                                                            |
| Reports    | attendance, muster roll, wage register, payments — JSON or CSV                                                                                                                                                                                                                                                 |
| Dashboard  | today's progress per site, money totals, 30-day trend                                                                                                                                                                                                                                                          |
| Admin      | overview, weekly growth, daily activity, users, user detail, a contractor's workers (masked contacts), suspend, reactivate, audit log, data checks, KPIs (JSON or CSV)                                                                                                                                         |

CSV exports start with a UTF-8 byte-order mark (so Excel shows ₹ correctly), use CRLF line endings and RFC 4180 quoting, and prefix cells that start with `= + - @` with an apostrophe so a spreadsheet never runs them as formulas (plain numbers, including negatives, stay numeric).

## 6. Security checklist

| Area                  | Measure                                                                                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords             | bcrypt cost 12; length and complexity rules; lockout after 5 failures; unknown emails take as long to reject as wrong passwords                                                                                                   |
| Sessions              | short-lived access token in memory only; rotating, hashed, httpOnly refresh cookie with family revocation                                                                                                                         |
| Authorization         | role re-checked from the database on every request; no API path to create or promote admins; admins cannot suspend themselves, other admins or the shared demo accounts; the demo admin (public password) sees only demo accounts |
| Tenant isolation      | every contractor query scoped by `contractorId`; cross-tenant ids return 404; covered by a security test that tries ~20 routes                                                                                                    |
| Input                 | Zod validation with unknown keys stripped on every endpoint; NoSQL operator keys removed; 100 kB body limit; ObjectId and calendar-date validation (impossible dates like 30 Feb are rejected)                                    |
| Transport and headers | Helmet on the API and a Content-Security-Policy on the app (Vercel) that allows scripts only from the app's own origin; nosniff, frame protection, strict CORS allow-list, `x-powered-by` removed, HTTPS on Vercel and Render     |
| Rate limiting         | per-client limits on the API and stricter limits on login and register, also counted per nearest proxy hop so a forged `X-Forwarded-For` cannot reset them; proxy hop count configurable (`TRUST_PROXY`)                          |
| Data                  | money as integers; append-only payments with voids; audit log of every write; phone and UPI masked in admin views; secrets only in environment variables                                                                          |
| Redirects             | post-login `next` accepts only same-app paths (no `//`, backslashes or control characters)                                                                                                                                        |
| Dependencies          | `npm audit --omit=dev` reports 0 vulnerabilities and runs in CI                                                                                                                                                                   |

## 7. Testing

| Suite                    | Tool                                                 | Count     | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API unit and integration | Jest, supertest, mongodb-memory-server (replica set) | 197 tests | every route, domain rules, money maths, concurrency races, idempotency, IST midnight boundary, CSV injection, tenant isolation matrix, auth flows, seed, backup and restore, API docs                                                                                                                                                                                                                                                                                      |
| App components and pages | Vitest, Testing Library, MSW                         | 185 tests | API client (single-flight refresh, network errors), every page's behaviour, forms and validation, attendance draft and save, payment double-tap protection, colour contrast of the design tokens, tap-target sizes                                                                                                                                                                                                                                                         |
| End to end               | Playwright with a production build                   | 21 runs   | the full contractor journey (sign up → site → workers → attendance → wages → payment → receipt), admin suspend and reactivate with the audit log, the demo admin's limits, the production Content-Security-Policy (with the card scanner's camera), statement links opened without an account, the installable app offline, dark mode without a light flash, a 15-worker attendance speed test, phone layouts at 412 and 360 px, and axe accessibility scans of every page |

- **Coverage (API):** 98% of lines and 85% of branches; the CI gate requires 80% / 70%.
- **Accessibility:** axe finds 0 serious or critical issues on all 18 pages scanned (WCAG 2.1 A and AA rules), with the main pages scanned again in Hindi and in dark mode. A unit test checks the contrast of every text and colour pair in both themes.
- **Usability:** marking 15 workers and saving takes 0.6–0.7 s of scripted interaction (requirement: under 30 s).
- **CI:** GitHub Actions runs lint, API tests with the coverage gate, app tests, the production build, the dependency audit and the Playwright suite on every push to `main`.

Run locally:

```bash
npm test                          # API and app tests
npm run test:coverage -w server   # API tests with the coverage gate
npm run test:e2e                  # Playwright: its own API (port 5056, in-memory database) and production build (4174)
```

## 8. Performance

**Lighthouse (mobile profile, live login page only):** performance 96–98, accessibility 100, best practices 96, SEO 91. First contentful paint 1.9–2.2 s on Lighthouse's simulated slow 4G, total blocking time 0–20 ms, layout shift 0. The signed-in pages need a login, which a plain Lighthouse run cannot do; the axe scans above cover their accessibility.

**Bundle:** the first page loads about 149 kB of gzipped JavaScript; every page and the charting library load on demand. The font is self-hosted, so nothing blocks the first paint.

**API load test** — six read endpoints, autocannon, 20 concurrent connections for 15 s each, production mode, on a local machine (Apple M5) with the demo dataset in an in-memory MongoDB. It measures the API's own work: network latency to Atlas and the live free-tier hosts is not included, and writes were not load-tested.

| Endpoint                           | req/s | p50 ms | p90 ms | p97.5 ms | p99 ms | errors |
| ---------------------------------- | ----- | ------ | ------ | -------- | ------ | ------ |
| GET /health                        | 6695  | 2      | 4      | 5        | 6      | 0      |
| GET /dashboard                     | 536   | 35     | 47     | 58       | 69     | 0      |
| GET /attendance/sheet (8 workers)  | 1400  | 13     | 16     | 18       | 21     | 0      |
| GET /workers (page of 20)          | 1496  | 12     | 15     | 17       | 19     | 0      |
| GET /payments/dues                 | 913   | 20     | 27     | 33       | 38     | 0      |
| GET /wages/summary (month, weekly) | 359   | 54     | 69     | 81       | 89     | 0      |

All six endpoints kept p99 under 90 ms, well within the 300 ms p95 target. Reads use `.lean()`, list endpoints are paginated, and summaries are MongoDB aggregations rather than per-worker queries.

## 9. Scalability

- The API is stateless (no server sessions), so more instances can run behind a load balancer.
- Every query starts from a contractor-scoped compound index; lists are paginated (20 per page, at most 100).
- Business rules live in services behind a versioned `/api/v1`, so a mobile app or integrations can use the same API.
- The shared package keeps validation identical on both sides.

## 10. Operations

### Environment variables (API)

| Variable                                                                                              | Purpose                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                                                                                         | Atlas connection string (database `mazdoorpay`)                                                                                                            |
| `JWT_ACCESS_SECRET`, `QR_SECRET`                                                                      | ≥ 32 characters in production (Render generates them)                                                                                                      |
| `FRONTEND_ORIGIN`                                                                                     | comma-separated allowed browser origins                                                                                                                    |
| `TRUST_PROXY`                                                                                         | proxy hops in front of the API (2 behind Vercel → Render)                                                                                                  |
| `SEED_DEMO_IF_MISSING`                                                                                | `true` creates the demo accounts on start unless a finished demo seed is recorded; a database lock lets only one instance seed while a deploy overlaps two |
| `BCRYPT_COST`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX` | tuning, with safe defaults                                                                                                                                 |

The API validates its environment on start and exits with one clear line if anything is wrong.

### Deployment

- **API:** Render Blueprint ([`render.yaml`](../render.yaml)), health check `/api/v1/health`, auto-deploy from `main`.
- **App:** Vercel project with root directory `client` ([`client/vercel.json`](../client/vercel.json)); `/api/*` is rewritten to Render.
- **Database:** Atlas M0; network access open to Render (`0.0.0.0/0`, since free-tier IPs change); a dedicated database user with read/write rights.

### Backups

Atlas M0 has no automated backups, so the project ships its own:

```bash
npm run backup -w server                              # writes backups/mazdoorpay-<time>.jsonl.gz
npm run restore -w server -- --file <file> --confirm  # replaces the collections in the backup
```

- The backup is one Extended JSON line per document (ObjectIds and dates keep their types), gzipped, and streamed in both directions, so memory use does not grow with the database.
- Restore prints the target database, refuses a backup taken from a different database unless `--force` is passed, reads the whole file before deleting anything (a damaged file changes nothing), and saves the current data as a fresh backup first.
- Stop the API while restoring, so nothing writes during the replacement.
- Round trip, batching, the database check and the damaged-file case are covered by tests.

### Demo data

`npm run seed` replaces only the demo accounts (`isDemo: true`): an admin, two contractors, four sites in Bengaluru, Pune and Mumbai, 30 workers, 45 days of attendance, Saturday payouts in cash and UPI, four advances, three pay raises and one voided payment. It is deterministic and refuses to run against production unless explicitly allowed.

## 11. Known limitations

- Render's free plan sleeps after 15 minutes without traffic; the first request then takes up to a minute (the app shows "Waking up the server…").
- The demo logins are shared in the README for evaluation; the website itself does not show them. The demo admin sees only the demo accounts (platform totals still count everyone) and cannot suspend them; rotate its password afterwards.
- Offline marking is designed but not built; see the PRD's future enhancements.
- Dark mode: `.dark` on `<html>` swaps the colour tokens; `--on-ink`, `--on-brand` and `--on-solid` keep text readable on filled surfaces in both themes. `public/theme.js` applies the saved or system theme before the first paint (an external file, since the security policy allows no inline scripts), and the app follows the system setting until the reader picks. Printed sheets use `.theme-light`, so they stay black on white.
- Installable app: `client/public/manifest.webmanifest` with regular and maskable icons, and a hand-written service worker (`client/public/sw.js`, about 60 lines) registered in production builds only. Pages are network-first with the cached shell as the offline fallback; content-hashed `/assets/` are cache-first, capped at 80 files; `/api/` is never cached. `sw.js` is served with `no-cache` so updates reach users on the next visit.
- Statement links: a 32-byte random token, stored only as its SHA-256 hash (so the link is shown once, when made). `GET /api/v1/statements/:token` is public, held to the login rate limit, answers stopped and made-up tokens with the same 404, and records `lastViewedAt`. The page sends `noindex` and `no-referrer`.
- Hindi: `client/src/lib/hi.js` mirrors `en.js` key for key, and a test fails if a key or `{placeholder}` is missing. The chosen language is kept on the device and in the account (`preferredLanguage`), and the account's choice wins after login. Dates use `hi-IN` formats through `useFormat()`; amounts keep Indian-English digits (₹1,23,450), as people write them. Server messages stay in English.
- WhatsApp messages are click-to-send links (`wa.me`): MazdoorPay writes the text, and the contractor sends it from their own WhatsApp. Nothing is sent automatically.
- UPI pay-assist builds a standard `upi://pay` request (payee, name, amount, note) for the contractor's own UPI app, or a QR code of it on a computer. It is not a payment integration: MazdoorPay cannot see whether money moved, so the contractor still enters the UTR.
- QR cards: the code is `MP1.<workerId>.<card version>.<signature>`, where the signature is the first 96 bits of an HMAC-SHA256 under `QR_SECRET`. A scan (`POST /attendance/scan`) checks the signature, that the worker belongs to the scanning contractor and that the card version is current, then marks the worker present today with method `qr`. Scanning always marks today: a card proves someone is on site now. The camera scanner (`qr-scanner`) loads only when scanning starts, and the app's security policy allows the camera and the scanner's `blob:` worker for that.
