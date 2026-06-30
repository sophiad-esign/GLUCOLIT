import postgres from "postgres";

if (
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes("placeholder")
) {
  console.warn("DATABASE_URL is not configured; skipping OGTT table setup.");
  process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS "ogtt_analysis" (
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
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "ogtt_analysis_created_at_idx"
    ON "ogtt_analysis" ("created_at")
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "ogtt_analysis_risk_level_idx"
    ON "ogtt_analysis" ("risk_level")
  `;
  await sql`ALTER TABLE "ogtt_analysis" ENABLE ROW LEVEL SECURITY`;
  await sql`REVOKE ALL ON TABLE "ogtt_analysis" FROM "anon", "authenticated"`;
  console.log("OGTT analysis table is ready.");
} finally {
  await sql.end();
}
