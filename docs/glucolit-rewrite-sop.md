# GLUCOLIT Research Rewrite SOP

This SOP turns scholarly records into reviewable GLUCOLIT drafts. The goal is not literal translation. The goal is faithful, useful, plain-language medical education for people with prediabetes, insulin resistance, or early metabolic risk.

## Source Rules

- Use PubMed, Europe PMC, Unpaywall metadata, abstracts, and legal open-access links.
- Do not scrape or reproduce paywalled full text.
- Do not invent sample size, results, methods, harms, or causal claims.
- If only a title is available, do not generate an article.

## Required Workflow

1. Extract the evidence card:
   - research question
   - population
   - intervention or exposure
   - comparison
   - outcomes
   - main findings
   - limits
   - reader meaning
2. Write the Chinese plain-language article first.
3. Write the English version as the same meaning, not a separate article.
4. Add practical takeaways without giving personal medical advice.
5. Run quality gates before saving an MDX draft.
6. Keep every generated article as `draft: true` until human review.

## Article Shape

Every draft must contain:

- a clear title in Chinese and English
- a short description in Chinese and English
- an evidence card for review
- a Chinese plain-language article of at least 600 Chinese characters
- an English plain-language article of at least 700 English characters
- at least 4 Chinese takeaways and 4 English takeaways
- source links, DOI, and publication date where available
- a medical disclaimer

## Writing Standard

- Put the most important point first.
- Use ordinary words and short paragraphs.
- Define medical terms when they first appear.
- Explain uncertainty: what the study suggests, what it does not prove, and who it may or may not apply to.
- Avoid hype, miracle language, fear language, and personal medical instructions.
- Use numbers only when they help the reader understand the result.
- Never turn association into causation.

## Quality Gate

Reject the draft if any of these are true:

- missing evidence card fields
- Chinese article is too short
- English article is too short
- fewer than 4 takeaways per language
- contains empty bullet points
- contains mojibake or broken encoding
- contains screening notes instead of article prose
- claims medical advice, cure, guaranteed reversal, or unsupported causality
- fails to mention important limits or uncertainty

## Human Review Checklist

Before publishing:

- Does the title match the study?
- Is the main conclusion faithful to the abstract?
- Are the limitations visible?
- Would a non-medical reader understand the article?
- Are the takeaways useful but not prescriptive medical advice?
- Are the DOI and source links correct?
