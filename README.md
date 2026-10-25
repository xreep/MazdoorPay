# MazdoorPay

Daily Wage Labour Attendance & Payment Platform for construction contractors and site managers.

Digitizes daily attendance, automates wage calculation, tracks payments and dues, and keeps transparent worker records across multiple construction sites.

## Live URLs

- Frontend (Vercel): TBD after deploy
- Backend API (Render): TBD after deploy

## Stack

- Frontend: React 18 (Vite), plain CSS
- Backend: Node.js 20, Express 5, Mongoose 8
- Database: MongoDB (Atlas M0 / local)
- Auth: JWT access token (15 min) + refresh token rotation, bcryptjs

## Monorepo layout

- `client/` — Vite + React frontend
- `server/` — Express API
- `docs/TECHNICAL.md` — architecture, data model, API list, auth flow, wage rules

## Run locally

Prerequisites: Node.js 20+, MongoDB (local or Atlas URI).

```bash
# install dependencies for both apps
npm install

# copy env templates and fill in values
cp server/.env.example server/.env
cp client/.env.example client/.env

# seed the database (idempotent)
npm run seed

# run both apps in dev (two terminals)
npm run dev:server   # server on :5000
npm run dev:client   # client on :5173
```

Demo contractor credentials (after seeding):
- Email: `ravi.contractor@example.com` / Password: `Password123`
- Admin: `admin@mazdoorpay.example` / Password: `AdminPass123`

## Tests

```bash
npm run test:server   # Jest + supertest
npm run test:client   # Vitest + Testing Library
npm run audit         # dependency audit (target: 0 high/critical)
```
