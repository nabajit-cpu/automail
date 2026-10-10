require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./db");
const { sendMail, smtpConfigured } = require("./mailer");

const app = express();
const PORT = Number(process.env.PORT || 3847);

app.use(express.json({ limit: "512kb" }));
app.use(express.static(path.join(__dirname, "public")));

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, smtpConfigured: smtpConfigured() });
});

app.get("/api/stats/recipients", (_req, res) => {
  res.json({ items: db.statsByRecipient() });
});

app.get("/api/stats/companies", (_req, res) => {
  res.json({ items: db.statsByCompany() });
});

app.get("/api/stats/rows", (_req, res) => {
  res.json({ items: db.statsByCompanyAndEmail() });
});

app.get("/api/history", (req, res) => {
  const { email, company, limit } = req.query;
  const items = db.listSends({
    email: email || undefined,
    company: company || undefined,
    limit: limit ? Math.min(Number(limit), 500) : 100,
  });
  res.json({ items });
});

app.get("/api/count", (req, res) => {
  const email = (req.query.email || "").trim();
  if (!email) {
    return res.status(400).json({ error: "email query param required" });
  }
  res.json({ email, count: db.countForRecipient(email) });
});

app.post("/api/send", async (req, res) => {
  const recipient_email = (req.body.recipient_email || "").trim().toLowerCase();
  const company = (req.body.company || "").trim();
  const role_title = (req.body.role_title || "").trim();
  const subject = (req.body.subject || "").trim();
  const body = (req.body.body || "").trim();

  if (!isValidEmail(recipient_email)) {
    return res.status(400).json({ error: "Invalid recipient email" });
  }
  if (!subject || !body) {
    return res.status(400).json({ error: "Subject and body are required" });
  }

  const priorCount = db.countForRecipient(recipient_email);

  try {
    await sendMail({
      to: recipient_email,
      subject,
      text: body,
    });
    const id = db.insertSend({
      recipient_email,
      company,
      role_title,
      subject,
      body,
      status: "sent",
      error_message: null,
    });
    res.json({
      ok: true,
      id,
      priorSendCount: priorCount,
      totalSendCount: priorCount + 1,
    });
  } catch (err) {
    const id = db.insertSend({
      recipient_email,
      company,
      role_title,
      subject,
      body,
      status: "failed",
      error_message: String(err.message || err),
    });
    res.status(500).json({
      ok: false,
      id,
      error: String(err.message || err),
      priorSendCount: priorCount,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Cold email tracker: http://localhost:${PORT}`);
  if (!smtpConfigured()) {
    console.warn("SMTP not configured — copy .env.example to .env before sending.");
  }
});
