CREATE TABLE "gmail_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"refresh_token_enc" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sent_today" integer DEFAULT 0 NOT NULL,
	"sent_date_utc" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_sent_at" timestamp,
	CONSTRAINT "gmail_account_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"list_id" uuid NOT NULL,
	"subject_template" text NOT NULL,
	"body_template" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"account_id" uuid,
	"track_token" text NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"gmail_message_id" text,
	"gmail_thread_id" text,
	"opened_at" timestamp,
	"replied_at" timestamp,
	"last_error" text,
	CONSTRAINT "recipient_track_token_unique" UNIQUE("track_token")
);
--> statement-breakpoint
CREATE TABLE "email_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"type" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "placement_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"seed_mailbox_id" uuid NOT NULL,
	"placement" text NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seed_mailbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"provider" text NOT NULL,
	"gmail_account_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seed_mailbox_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"email" text NOT NULL,
	"fields" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"headers" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduler_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"hourly_max" integer DEFAULT 20 NOT NULL,
	"daily_max" integer DEFAULT 100 NOT NULL,
	"min_interval_seconds" integer DEFAULT 45 NOT NULL,
	"max_interval_seconds" integer DEFAULT 120 NOT NULL,
	"window_start" text DEFAULT '09:00' NOT NULL,
	"window_end" text DEFAULT '17:00' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_list_id_lead_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lead_list"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipient" ADD CONSTRAINT "recipient_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_list_id_lead_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lead_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gmail_account_status_idx" ON "gmail_account" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recipient_campaign_idx" ON "recipient" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "recipient_status_sched_idx" ON "recipient" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "recipient_thread_idx" ON "recipient" USING btree ("gmail_thread_id");--> statement-breakpoint
CREATE INDEX "email_event_recipient_idx" ON "email_event" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "email_event_campaign_type_idx" ON "email_event" USING btree ("campaign_id","type");--> statement-breakpoint
CREATE INDEX "placement_campaign_idx" ON "placement_result" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "lead_list_id_idx" ON "lead" USING btree ("list_id");