const nodemailer = require("nodemailer");

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true";
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function sendMail({ to, subject, text }) {
  const transport = createTransport();
  if (!transport) {
    throw new Error(
      "SMTP not configured. Copy .env.example to .env and set SMTP_* variables."
    );
  }
  const fromName = process.env.FROM_NAME || "Nabajit Boro";
  const fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text,
  });
}

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

module.exports = { sendMail, smtpConfigured };
