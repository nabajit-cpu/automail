const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "emails.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function load() {
  if (!fs.existsSync(dbPath)) {
    return { sends: [], nextId: 1 };
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return { sends: [], nextId: 1 };
  }
}

function save(data) {
  const tmp = dbPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, dbPath);
}

function insertSend(row) {
  const data = load();
  const id = data.nextId++;
  const record = {
    id,
    recipient_email: row.recipient_email,
    company: row.company || "",
    role_title: row.role_title || "",
    subject: row.subject,
    body: row.body,
    status: row.status,
    error_message: row.error_message || null,
    sent_at: new Date().toISOString(),
  };
  data.sends.push(record);
  save(data);
  return id;
}

function listSends({ email, company, limit = 100 } = {}) {
  let items = load().sends;
  if (email) {
    const e = email.trim().toLowerCase();
    items = items.filter((r) => r.recipient_email.toLowerCase() === e);
  }
  if (company) {
    const c = company.trim().toLowerCase();
    items = items.filter((r) => r.company.toLowerCase().includes(c));
  }
  items.sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
  return items.slice(0, limit);
}

function statsByRecipient() {
  const map = new Map();
  for (const r of load().sends) {
    if (r.status !== "sent") continue;
    const key = r.recipient_email.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        recipient_email: r.recipient_email,
        send_count: 0,
        last_sent_at: r.sent_at,
        companies: new Set(),
      });
    }
    const agg = map.get(key);
    agg.send_count++;
    if (r.sent_at > agg.last_sent_at) agg.last_sent_at = r.sent_at;
    if (r.company) agg.companies.add(r.company);
  }
  return [...map.values()]
    .map((x) => ({
      recipient_email: x.recipient_email,
      send_count: x.send_count,
      last_sent_at: x.last_sent_at,
      companies: [...x.companies].join(", "),
    }))
    .sort((a, b) => b.send_count - a.send_count || (a.last_sent_at < b.last_sent_at ? 1 : -1));
}

function statsByCompany() {
  const map = new Map();
  for (const r of load().sends) {
    if (r.status !== "sent" || !r.company) continue;
    const key = r.company;
    if (!map.has(key)) {
      map.set(key, {
        company: r.company,
        send_count: 0,
        recipients: new Set(),
        last_sent_at: r.sent_at,
      });
    }
    const agg = map.get(key);
    agg.send_count++;
    agg.recipients.add(r.recipient_email.toLowerCase());
    if (r.sent_at > agg.last_sent_at) agg.last_sent_at = r.sent_at;
  }
  return [...map.values()]
    .map((x) => ({
      company: x.company,
      send_count: x.send_count,
      unique_recipients: x.recipients.size,
      last_sent_at: x.last_sent_at,
    }))
    .sort((a, b) => b.send_count - a.send_count);
}

function countForRecipient(email) {
  const e = email.trim().toLowerCase();
  return load().sends.filter(
    (r) => r.status === "sent" && r.recipient_email.toLowerCase() === e
  ).length;
}

/** One row per company + recipient: send count and last successful send time. */
function statsByCompanyAndEmail() {
  const map = new Map();
  for (const r of load().sends) {
    if (r.status !== "sent") continue;
    const company = (r.company || "").trim() || "—";
    const emailKey = r.recipient_email.toLowerCase();
    const key = `${company.toLowerCase()}\0${emailKey}`;
    if (!map.has(key)) {
      map.set(key, {
        company,
        recipient_email: r.recipient_email,
        send_count: 0,
        last_sent_at: r.sent_at,
      });
    }
    const agg = map.get(key);
    agg.send_count++;
    if (r.sent_at > agg.last_sent_at) agg.last_sent_at = r.sent_at;
  }
  return [...map.values()].sort(
    (a, b) =>
      b.last_sent_at.localeCompare(a.last_sent_at) ||
      b.send_count - a.send_count
  );
}

module.exports = {
  insertSend,
  listSends,
  statsByRecipient,
  statsByCompany,
  statsByCompanyAndEmail,
  countForRecipient,
};
