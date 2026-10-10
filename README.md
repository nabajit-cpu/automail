# Automail — Cold Email Tracker

Small app for job-search cold email: compose, send via your SMTP account, and track every send (email, company, subject, full body, status, timestamp). Hosted on Netlify, with the frontend served from `public/`, the API in a Netlify Function (`netlify/functions/api.ts`), and send history stored in Netlify Database (Postgres).

## Setup

In the Netlify UI go to **Project configuration → Environment variables** and add the variables listed in `.env.example`:

- `ACCESS_KEY`: a long random string. The browser asks for it the first time you open the app. Without it set, the API refuses all requests, so strangers can't send email from your account.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`: your SMTP credentials.
- `FROM_NAME`, `FROM_EMAIL`: what recipients see in the "From" field.

Redeploy after you change these variables.

### Gmail SMTP

1. Enable 2FA on your Google account.
2. Create an [App Password](https://myaccount.google.com/apppasswords).
3. Set `SMTP_USER` / `FROM_EMAIL` to your Gmail address and `SMTP_PASS` to the 16-character app password.

## Local development

```bash
npm install
cp .env.example .env   # fill in values
npx netlify dev
```

## Data

Sends live in the `sends` table. The schema is in `db/schema.ts`, and migrations are in `netlify/database/migrations/`; Netlify applies them on deploy. After you change the schema, run `npx drizzle-kit generate --name <change>`.

Both **sent** and **failed** attempts get logged, so you always have a record before sending to someone again.

## API

All endpoints except `/api/health` need an `x-access-key` header.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | SMTP / access key configured? |
| POST | `/api/send` | JSON body: recipient_email, company, role_title, subject, body |
| GET | `/api/history?email=&company=` | List sends |
| GET | `/api/count?email=` | Successful send count for one address |
| GET | `/api/stats/rows` | Aggregates per company + email |
| GET | `/api/stats/recipients` | Aggregates per email |
| GET | `/api/stats/companies` | Aggregates per company |

## Customize templates

Edit `YOUR_NAME`, links, and template text in `public/app.js`.

## Notes

- Respect CAN-SPAM and local laws. Use this for genuine job outreach only.
