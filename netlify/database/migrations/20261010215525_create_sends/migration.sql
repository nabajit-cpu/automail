CREATE TABLE "sends" (
	"id" serial PRIMARY KEY,
	"recipient_email" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"role_title" text DEFAULT '' NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sends_recipient_email_idx" ON "sends" ("recipient_email");