CREATE TABLE "ogtt_analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"source" text DEFAULT 'screenshot' NOT NULL,
	"risk_level" text NOT NULL,
	"classification" text NOT NULL,
	"confidence" real NOT NULL,
	"needs_manual_review" boolean DEFAULT false NOT NULL,
	"glucose_unit" text NOT NULL,
	"extracted_metrics" jsonb NOT NULL,
	"profile" jsonb NOT NULL,
	"report_markdown" text NOT NULL,
	"image_stored" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ogtt_analysis_created_at_idx" ON "ogtt_analysis" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ogtt_analysis_risk_level_idx" ON "ogtt_analysis" USING btree ("risk_level");--> statement-breakpoint
ALTER TABLE "ogtt_analysis" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "ogtt_analysis" FROM "anon", "authenticated";
