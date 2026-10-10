import type { Config } from "@netlify/functions";
import nodemailer from "nodemailer";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { db } from "../../db/index.js";
import { sends } from "../../db/schema.js";

const env = (name: string) => Netlify.env.get(name) || "";

function smtpConfigured() {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS"));
}

async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }) {
  if (!smtpConfigured()) {
    throw new Error("SMTP not configured. Set the SMTP_* environment variables in Netlify.");
  }
  const transport = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT") || 587),
    secure: env("SMTP_SECURE") === "true",
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
  });
  const fromName = env("FROM_NAME") || "Nabajit Boro";
  const fromEmail = env("FROM_EMAIL") || env("SMTP_USER");
  await transport.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, text });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function authorized(req: Request) {
  const expected = env("ACCESS_KEY");
  if (!expected) return false;
  const given = Buffer.from(req.headers.get("x-access-key") || "");
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

const toRow = (r: typeof sends.$inferSelect) => ({
  id: r.id,
  recipient_email: r.recipientEmail,
  company: r.company,
  role_title: r.roleTitle,
  subject: r.subject,
  body: r.body,
  status: r.status,
  error_message: r.errorMessage,
  sent_at: r.sentAt.toISOString(),
});

async function countForRecipient(email: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sends)
    .where(and(eq(sends.status, "sent"), eq(sends.recipientEmail, email.trim().toLowerCase())));
  return row?.n ?? 0;
}

async function handleSend(req: Request) {
  const input = await req.json().catch(() => ({}));
  const recipient_email = String(input.recipient_email || "").trim().toLowerCase();
  const company = String(input.company || "").trim();
  const role_title = String(input.role_title || "").trim();
  const subject = String(input.subject || "").trim();
  const body = String(input.body || "").trim();

  if (!isValidEmail(recipient_email)) return json({ error: "Invalid recipient email" }, 400);
  if (!subject || !body) return json({ error: "Subject and body are required" }, 400);

  const priorCount = await countForRecipient(recipient_email);
  const record = { recipientEmail: recipient_email, company, roleTitle: role_title, subject, body };

  try {
    await sendMail({ to: recipient_email, subject, text: body });
    const [row] = await db.insert(sends).values({ ...record, status: "sent" }).returning({ id: sends.id });
    return json({ ok: true, id: row.id, priorSendCount: priorCount, totalSendCount: priorCount + 1 });
  } catch (err) {
    const error = String((err as Error)?.message || err);
    const [row] = await db
      .insert(sends)
      .values({ ...record, status: "failed", errorMessage: error })
      .returning({ id: sends.id });
    return json({ ok: false, id: row.id, error, priorSendCount: priorCount }, 500);
  }
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api/, "").replace(/\/$/, "");

  if (route === "/health" && req.method === "GET") {
    return json({ ok: true, smtpConfigured: smtpConfigured(), accessKeyConfigured: Boolean(env("ACCESS_KEY")) });
  }

  if (!env("ACCESS_KEY")) {
    return json({ error: "ACCESS_KEY is not set. Add it in Netlify environment variables." }, 503);
  }
  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);

  if (route === "/send" && req.method === "POST") return handleSend(req);
  if (req.method !== "GET") return json({ error: "Not found" }, 404);

  const lastSent = sql<string>`max(${sends.sentAt})`;

  switch (route) {
    case "/history": {
      const email = url.searchParams.get("email")?.trim().toLowerCase();
      const company = url.searchParams.get("company")?.trim();
      const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);
      const rows = await db
        .select()
        .from(sends)
        .where(
          and(
            email ? eq(sends.recipientEmail, email) : undefined,
            company ? ilike(sends.company, `%${company}%`) : undefined
          )
        )
        .orderBy(desc(sends.sentAt))
        .limit(limit);
      return json({ items: rows.map(toRow) });
    }

    case "/count": {
      const email = (url.searchParams.get("email") || "").trim();
      if (!email) return json({ error: "email query param required" }, 400);
      return json({ email, count: await countForRecipient(email) });
    }

    case "/stats/recipients": {
      const items = await db
        .select({
          recipient_email: sends.recipientEmail,
          send_count: sql<number>`count(*)::int`,
          last_sent_at: lastSent,
          companies: sql<string>`coalesce(string_agg(distinct nullif(${sends.company}, ''), ', '), '')`,
        })
        .from(sends)
        .where(eq(sends.status, "sent"))
        .groupBy(sends.recipientEmail)
        .orderBy(sql`count(*) desc`, sql`max(${sends.sentAt}) desc`);
      return json({ items });
    }

    case "/stats/companies": {
      const items = await db
        .select({
          company: sends.company,
          send_count: sql<number>`count(*)::int`,
          unique_recipients: sql<number>`count(distinct ${sends.recipientEmail})::int`,
          last_sent_at: lastSent,
        })
        .from(sends)
        .where(and(eq(sends.status, "sent"), sql`${sends.company} <> ''`))
        .groupBy(sends.company)
        .orderBy(sql`count(*) desc`);
      return json({ items });
    }

    case "/stats/rows": {
      const companyExpr = sql<string>`coalesce(nullif(trim(${sends.company}), ''), '—')`;
      const items = await db
        .select({
          company: companyExpr,
          recipient_email: sends.recipientEmail,
          send_count: sql<number>`count(*)::int`,
          last_sent_at: lastSent,
        })
        .from(sends)
        .where(eq(sends.status, "sent"))
        .groupBy(companyExpr, sends.recipientEmail)
        .orderBy(sql`max(${sends.sentAt}) desc`, sql`count(*) desc`);
      return json({ items });
    }
  }

  return json({ error: "Not found" }, 404);
};

export const config: Config = {
  path: "/api/*",
};
