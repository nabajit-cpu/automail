# Cold Email Tracker (local)

Small local app for job-search cold email: compose, send via your SMTP, and track every send in a local JSON database (email, company, subject, full body, status, timestamp).

**Location:** `~/cold-email-tracker` (outside travel-hotels-platform).

## Setup

```bash
cd ~/cold-email-tracker
npm install
cp .env.example .env
# Edit .env with Gmail App Password or your SMTP provider
npm start
```

Open **http://localhost:3847**

### Gmail SMTP

1. Enable 2FA on Google account.
2. Create an [App Password](https://myaccount.google.com/apppasswords).
3. In `.env`:
   - `SMTP_USER` / `FROM_EMAIL` = your Gmail
   - `SMTP_PASS` = app password (16 chars)

## Data

Data file: `data/emails.json`

Tables log both **sent** and **failed** attempts so you do not double-send blindly without a record.

## API (optional)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | SMTP configured? |
| POST | `/api/send` | JSON body: recipient_email, company, role_title, subject, body |
| GET | `/api/history?email=&company=` | List sends |
| GET | `/api/count?email=` | Successful send count for one address |
| GET | `/api/stats/recipients` | Aggregates per email |
| GET | `/api/stats/companies` | Aggregates per company |

## Customize templates

Edit `YOUR_NAME`, links, and template text in `public/app.js`.

## Notes

- Runs only on your machine; do not expose port 3847 to the internet without auth.
- Respect CAN-SPAM / local laws; use for genuine job outreach only.
# automail
# automail
# automail
# automail
