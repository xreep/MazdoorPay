# MazdoorPay

Daily wage labour attendance and payment platform for construction contractors and site managers.

It digitises daily attendance, works out wages from that attendance, tracks payments, advances and dues, and keeps a transparent, audited record for every worker across multiple sites.

## Live URLs

- Frontend (Vercel): TBD after deploy
- Backend API (Render): TBD after deploy

## Stack

- Backend: Node.js 20, Express 5, Mongoose 8, Zod 4
- Database: MongoDB Atlas (transactions on a replica set)
- Auth: 15-minute JWT access token + rotating httpOnly refresh cookie, bcrypt
- Tests: Jest, supertest, mongodb-memory-server
- Frontend: React 18 + Vite (Phase 2)

## Repository layout

- `shared/` — `@mazdoorpay/shared`: Zod schemas, constants, India-time (IST) day helpers, paise money helpers
- `server/` — Express API under `/api/v1`
- `client/` — React frontend (Phase 2)
- `docs/` — requirements, design and build plans

## Run locally

Prerequisites: Node.js 20+.

```bash
npm install
cp server/.env.example server/.env   # then fill in MONGODB_URI and the two secrets
```

Fastest start, no database needed — runs the API on an in-memory MongoDB filled with demo data:

```bash
npm run dev:memory -w server
```

With a real database (local MongoDB replica set or Atlas):

```bash
npm run seed         # replaces only the demo accounts; real users are never touched
npm run dev:server   # API on http://localhost:5000
```

Create a real admin account:

```bash
npm run create-admin -w server -- --name "Asha Rao" --email asha@example.com --password 'Choose-a-strong-1'
```

## Demo logins (after seeding)

| Role                              | Email                        | Password     |
| --------------------------------- | ---------------------------- | ------------ |
| Contractor (Bengaluru, 2 sites)   | `ravi.kumar@mazdoorpay.in`   | `Demo@2026`  |
| Contractor (Pune/Mumbai, 2 sites) | `sunita.patil@mazdoorpay.in` | `Demo@2026`  |
| Admin                             | `admin@mazdoorpay.in`        | `Admin@2026` |

The seed creates 30 workers, 45 days of attendance, Saturday wage payouts (cash and UPI), four advances, three pay raises and one voided payment.

## Scripts

```bash
npm test                          # API test suite
npm run test:coverage -w server   # with coverage gate (lines ≥ 80%, branches ≥ 70%)
npm run lint                      # ESLint
npm run audit                     # production dependency audit
```
