import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const sends = pgTable(
  "sends",
  {
    id: serial().primaryKey(),
    recipientEmail: text("recipient_email").notNull(),
    company: text().notNull().default(""),
    roleTitle: text("role_title").notNull().default(""),
    subject: text().notNull(),
    body: text().notNull(),
    status: text().notNull(),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sends_recipient_email_idx").on(t.recipientEmail)]
);
