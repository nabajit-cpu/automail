const YOUR_NAME = "Nabajit Boro";
const YOUR_PHONE = "+91 8431619640";
const YOUR_LINKEDIN = "https://www.linkedin.com/in/nabajit-boro/";
const YOUR_LEETCODE = "https://leetcode.com/u/nabajitboro/";

const templates = {
  referral: {
    subject: (company, role) =>
      `Referral request — ${role || "Software Engineer"} role at ${company}`,
    body: (company, role) =>
      `Hi,

I hope you are doing well. I am ${YOUR_NAME}, a Software Development Engineer (Paytm — hotels/travel platform; previously Jio). I am interested in ${role ? `the ${role} position` : "backend/platform roles"} at ${company}.

If you are open to it, I would appreciate a referral or a pointer to the right hiring contact. I have experience with Java, Go, Spring Boot, Kafka, and building event-driven microservices.

Links: LinkedIn ${YOUR_LINKEDIN} | LeetCode ${YOUR_LEETCODE}

Thank you for your time.

Best regards,
${YOUR_NAME}
${YOUR_PHONE}`,
  },
  direct: {
    subject: (company, role) =>
      `${role || "Software Engineering"} opportunities at ${company}`,
    body: (company, role) =>
      `Hi, I'm currently an SDE at Paytm, working on the hotel booking platform, with prior experience at Jio in real-time systems and Spring Boot.

I'm interested in ${role ? role + " opportunities" : "Software Engineering opportunities"} at ${company} and would appreciate the chance to connect.

LinkedIn: ${YOUR_LINKEDIN}

Regards,
${YOUR_NAME}`,
  },
  followup: {
    subject: (company, role) =>
      `Following up — ${company}${role ? " (" + role + ")" : ""}`,
    body: (company, role) =>
      `Hi,

I wanted to follow up on my earlier note regarding ${role || "roles"} at ${company}. I remain very interested and happy to share my resume or jump on a quick call.

Thank you,
${YOUR_NAME}
${YOUR_PHONE}`,
  },
  blank: {
    subject: () => "",
    body: () => "",
  },
};

const el = (id) => document.getElementById(id);

function applyTemplate() {
  const key = el("template").value;
  const company = el("company").value.trim() || "[Company]";
  const role = el("role_title").value.trim();
  const t = templates[key];
  if (!t) return;
  el("subject").value = t.subject(company, role);
  el("body").value = t.body(company, role);
}

el("template").addEventListener("change", applyTemplate);
el("company").addEventListener("blur", () => {
  if (el("template").value !== "blank") applyTemplate();
});
el("role_title").addEventListener("blur", () => {
  if (el("template").value !== "blank") applyTemplate();
});

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function showMessage(text, ok) {
  const msg = el("formMessage");
  msg.hidden = false;
  msg.textContent = text;
  msg.className = "message " + (ok ? "ok" : "err");
}

async function loadHealth() {
  const badge = el("smtpBadge");
  try {
    const { smtpConfigured } = await api("/api/health");
    if (smtpConfigured) {
      badge.textContent = "SMTP ready";
      badge.className = "badge badge-ok";
    } else {
      badge.textContent = "SMTP not configured (.env)";
      badge.className = "badge badge-warn";
    }
  } catch {
    badge.textContent = "Server offline";
    badge.className = "badge badge-warn";
  }
}

function renderStatsSummary(items) {
  const tbody = el("statsSummary").querySelector("tbody");
  tbody.innerHTML = "";
  for (const row of items) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.company)}</td>
      <td>${escapeHtml(row.recipient_email)}</td>
      <td>${row.send_count}</td>
      <td>${formatDate(row.last_sent_at)}</td>`;
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => {
      el("filterCompany").value = row.company === "—" ? "" : row.company;
      el("filterEmail").value = row.recipient_email;
      loadHistory();
    });
    tbody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleString();
}

async function loadStats() {
  const { items } = await api("/api/stats/rows");
  renderStatsSummary(items);
}

async function loadHistory() {
  const email = el("filterEmail").value.trim();
  const company = el("filterCompany").value.trim();
  const q = new URLSearchParams();
  if (email) q.set("email", email);
  if (company) q.set("company", company);
  q.set("limit", "200");
  const { items } = await api("/api/history?" + q.toString());
  const tbody = el("historyTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (const row of items) {
    const tr = document.createElement("tr");
    const statusClass =
      row.status === "sent" ? "status-sent" : "status-failed";
    tr.innerHTML = `
      <td>${formatDate(row.sent_at)}</td>
      <td>${escapeHtml(row.recipient_email)}</td>
      <td>${escapeHtml(row.company)}</td>
      <td>${escapeHtml(row.role_title)}</td>
      <td>${escapeHtml(row.subject)}</td>
      <td class="${statusClass}">${escapeHtml(row.status)}</td>
      <td><button type="button" class="btn link" data-id="${row.id}">Body</button></td>`;
    tr.querySelector("button").addEventListener("click", () => {
      el("bodyDialogContent").textContent = row.body;
      el("bodyDialog").showModal();
    });
    tbody.appendChild(tr);
  }
}

el("sendForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = el("sendBtn");
  btn.disabled = true;
  showMessage("Sending…", true);
  try {
    const payload = {
      recipient_email: el("recipient_email").value.trim(),
      company: el("company").value.trim(),
      role_title: el("role_title").value.trim(),
      subject: el("subject").value.trim(),
      body: el("body").value.trim(),
    };
    const result = await api("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    showMessage(
      `Sent successfully. This address has been emailed ${result.totalSendCount} time(s) in total.`,
      true
    );
    await Promise.all([loadStats(), loadHistory()]);
  } catch (err) {
    showMessage(err.message || "Send failed (see history for logged attempt).", false);
    await loadHistory();
  } finally {
    btn.disabled = false;
  }
});

el("previewCountBtn").addEventListener("click", async () => {
  const email = el("recipient_email").value.trim();
  if (!email) {
    el("countHint").textContent = "Enter an email first.";
    return;
  }
  try {
    const { count } = await api("/api/count?email=" + encodeURIComponent(email));
    el("countHint").textContent =
      count === 0
        ? "No successful sends logged for this address yet."
        : `Already sent successfully ${count} time(s) to this address.`;
  } catch {
    el("countHint").textContent = "Could not fetch count.";
  }
});

el("refreshHistory").addEventListener("click", () => loadHistory());
el("filterEmail").addEventListener("change", loadHistory);
el("filterCompany").addEventListener("change", loadHistory);

applyTemplate();
loadHealth();
loadStats();
loadHistory();
