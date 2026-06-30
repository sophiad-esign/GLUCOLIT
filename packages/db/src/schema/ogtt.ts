import {
  boolean,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const ogttAnalysis = pgTable(
  "ogtt_analysis",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    source: text("source").default("screenshot").notNull(),
    riskLevel: text("risk_level").notNull(),
    classification: text("classification").notNull(),
    confidence: real("confidence").notNull(),
    needsManualReview: boolean("needs_manual_review").default(false).notNull(),
    glucoseUnit: text("glucose_unit").notNull(),
    extractedMetrics: jsonb("extracted_metrics")
      .$type<Record<string, unknown>>()
      .notNull(),
    profile: jsonb("profile").$type<Record<string, unknown>>().notNull(),
    reportMarkdown: text("report_markdown").notNull(),
    imageStored: boolean("image_stored").default(false).notNull(),
  },
  (table) => [
    index("ogtt_analysis_created_at_idx").on(table.createdAt),
    index("ogtt_analysis_risk_level_idx").on(table.riskLevel),
  ],
);
