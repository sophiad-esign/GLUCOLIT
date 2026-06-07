# GLUCOLIT RSS Monitor

This project includes a Python monitor for diabetes and metabolic-health literature.

## What It Does

- Searches PubMed first, then enriches records with Europe PMC and Unpaywall metadata when available.
- Uses multiple discovery pools: prediabetes, diabetes prevention/remission, insulin resistance interventions, obesity and metabolic health, nutrition/glycemic control, and digital prevention.
- Large counts such as 800k+ are database-scale PubMed totals. The workflow does not rewrite that whole universe; it ranks candidates and only sends the strongest daily candidates to the LLM.
- Scores each item for relevance to prediabetes, insulin resistance, diabetes prevention, and lifestyle intervention.
- Generates a bilingual MDX blog post under `packages/cms/src/collections/blog/content`.
- Writes `draft: true` by default, so articles stay hidden until human review.
- If a useful candidate does not fully pass the GLUCOLIT SOP quality gate, it is still saved as a draft with `reviewRequired: true` and `qualityStatus: needs_revision`. The admin publish action blocks those drafts until they are manually revised.
- Stores processed item IDs in `data/glucolit-rss-state.json` to avoid duplicates.

## Run Locally

```bash
python scripts/glucolit_literature_monitor.py --dry-run --max-created 2
python scripts/glucolit_literature_monitor.py --status published --draft --max-created 2
```

## GitHub Actions

The workflow `.github/workflows/glucolit-rss-monitor.yml` runs daily and can also be triggered manually.

For plain-language rewriting, add at least one GitHub secret:

```text
OPENAI_API_KEY
KIMI_API_KEY
```

Optional repository variable:

```text
OPENAI_MODEL
KIMI_MODEL
KIMI_BASE_URL
UNPAYWALL_EMAIL
```

The GitHub workflow requires `OPENAI_API_KEY` or `KIMI_API_KEY`. If an LLM returns a useful but imperfect article, the workflow now keeps it as a revision draft instead of discarding it.

To publish a reviewed article, change its frontmatter from:

```yaml
draft: true
reviewRequired: false
qualityStatus: ready
```

to:

```yaml
draft: false
reviewRequired: false
qualityStatus: ready
```

## Medical Safety

Generated content is educational and should not be treated as diagnosis, treatment, or medication advice. Keep human review in the loop before relying on any summary.
