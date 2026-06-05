# GLUCOLIT Research Rewrite SOP

This SOP turns scholarly records into reviewable GLUCOLIT drafts. The goal is not literal translation or source replacement. The goal is a faithful, useful, source-bounded third-party commentary for people with prediabetes, insulin resistance, or early metabolic risk.

## Source Rules

- Prioritize Open Access papers, especially papers marked CC BY or with a clearly legal open-access full-text link.
- Use PubMed, Europe PMC, Unpaywall metadata, abstracts, and legal open-access links.
- Do not scrape or reproduce paywalled full text.
- If only metadata or an abstract is available, treat the post as an abstract-based commentary. Do not imply that GLUCOLIT read or reproduced the full paper.
- Do not invent sample size, results, methods, harms, or causal claims.
- If only a title is available, do not generate an article.
- Always link to the PubMed page, DOI page, or publisher page so readers can access the complete original content themselves.

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
2. Write the Chinese `原文精华摘要` first.
3. Write the English version as the same meaning, not a separate article.
4. Add practical takeaways without giving personal medical advice.
5. Run quality gates before saving an MDX draft.
6. Keep every generated article as `draft: true` until human review.

## Article Shape

Every draft must contain:

- a clear title in Chinese and English
- a short description in Chinese and English
- an original information box: title, authors when available, journal/source, DOI, PubMed/DOI/source link, publication date, evidence type, and open-access link when available
- an evidence card for review
- a Chinese `原文精华摘要` using this exact structure:
  - `### 研究背景` in the author's own words, about 100 Chinese characters
  - `### 核心发现` rewritten in the author's own words, no more than 300 Chinese characters
  - `### 你的解读与批判` as the main original commentary, at least 1500 Chinese characters
  - `### 临床/商业启发` as original GLUCOLIT insight, at least 500 Chinese characters
- an English plain-language article of at least 700 English characters
- at least 4 Chinese takeaways and 4 English takeaways
- source links, DOI, and publication date where available
- the line: `如需阅读原文，请点击链接获取完整内容。`
- the copyright disclaimer: `本站文章基于公开学术文献进行第三方评论，不代表原文作者及出版机构立场。如涉版权问题，请权利人联系下架。`

## Writing Standard

- Put the most important point first.
- Use ordinary words and short paragraphs.
- Keep Chinese paragraphs to about 2-4 sentences and roughly 90-150 Chinese characters.
- Keep English paragraphs to about 2-4 sentences and roughly 120-180 words.
- Each paragraph should explain one idea only. If the topic changes, start a new paragraph.
- Define medical terms when they first appear.
- Explain uncertainty: what the study suggests, what it does not prove, and who it may or may not apply to.
- Avoid hype, miracle language, fear language, and personal medical instructions.
- Avoid reviewer voice. Do not repeatedly say "this study", "this paper", "the researchers", "这篇研究", "这项研究", "这篇报告", or "研究者发现".
- Write from the source topic and reader problem, not from a manuscript-review perspective.
- Use numbers only when they help the reader understand the result.
- Never turn association into causation.
- Do not copy long sentences from the abstract. Short factual terms, titles, DOI, and journal names are allowed; the explanation must be rewritten.

## Quality Gate

Reject the draft if any of these are true:

- missing evidence card fields
- Chinese article is too short
- English article is too short
- fewer than 4 takeaways per language
- contains empty bullet points
- contains mojibake or broken encoding
- contains screening notes instead of article prose
- misses one of the required Chinese section headings
- Chinese commentary is too short for the required structure
- overuses reviewer voice or starts like a manuscript review
- claims medical advice, cure, guaranteed reversal, or unsupported causality
- fails to mention important limits or uncertainty
- does not include source links and the copyright disclaimer

## Human Review Checklist

Before publishing:

- Does the title match the study?
- Is the main conclusion faithful to the abstract?
- Are the limitations visible?
- Would a non-medical reader understand the article?
- Are the takeaways useful but not prescriptive medical advice?
- Are the DOI and source links correct?
