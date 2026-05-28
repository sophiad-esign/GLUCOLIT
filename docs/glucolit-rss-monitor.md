# GLUCOLIT RSS Monitor

This project includes a small Python monitor for diabetes and metabolic-health research feeds.

## What It Does

- Checks the configured RSS feeds once per run.
- Falls back to PubMed E-utilities when a publisher RSS URL is unavailable.
- Scores each item for relevance to prediabetes, insulin resistance, diabetes prevention, and lifestyle intervention.
- Generates a bilingual MDX blog post under `packages/cms/src/collections/blog/content`.
- Stores processed item IDs in `data/glucolit-rss-state.json` to avoid duplicates.

## Run Locally

```bash
python scripts/glucolit_rss_monitor.py --dry-run
python scripts/glucolit_rss_monitor.py --status published
```

## GitHub Actions

The workflow `.github/workflows/glucolit-rss-monitor.yml` runs daily and can also be triggered manually.

For better plain-language summaries, add this GitHub secret:

```text
OPENAI_API_KEY
```

Optional repository variable:

```text
OPENAI_MODEL
```

Without `OPENAI_API_KEY`, the script still creates conservative research-note scaffolds, but those should be treated as drafts that need human review.

## Medical Safety

Generated content is educational and should not be treated as diagnosis, treatment, or medication advice. Keep human review in the loop before relying on any summary.
