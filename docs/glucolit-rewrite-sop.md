# GLUCOLIT Research Rewrite SOP

This SOP turns academic evidence into useful, reviewable health education. It is not literal translation and must never replace the original paper.

## Source Rules

- Prioritize Open Access papers, especially CC BY publications.
- Use PubMed, Europe PMC, Unpaywall, abstracts, and legal open-access full text.
- Never scrape or reproduce paywalled full text.
- State clearly when an article is based on an abstract rather than full text.
- Never invent methods, sample sizes, effect sizes, harms, or causal claims.
- Do not generate an article when only a title is available.
- Preserve DOI, PubMed, and publisher links for verification.

## Evidence Workflow

1. Extract the research question, population, exposure or intervention, comparison, outcomes, findings, and limitations.
2. Separate facts reported by the source from GLUCOLIT interpretation.
3. Write the Chinese article first, then write a concise English version with the same factual boundaries.
4. Run the quality gate before saving the draft.
5. Keep every generated article as `draft: true` until human review.

## Reader-Facing Article Structure

Use the following labels as plain text, each on its own line. Do not prefix them with Markdown hashes.

- `先说结论`: give the useful takeaway immediately in 80-140 Chinese characters.
- `为什么值得关注`: connect the topic to a concrete reader problem in 120-220 characters.
- `证据告诉我们什么`: explain methods and the strongest source-bounded finding in 300-450 characters. Use numbers only when the source provides them.
- `应该怎样理解`: explain meaning, uncertainty, applicability, and important limitations. This is the deepest section and should contain at least 900 Chinese characters.
- `可以怎么做`: turn evidence into cautious, practical next steps. Include `给糖前读者` and `给健康科技行业` and write at least 550 Chinese characters.

## Writing Standard

- Lead with the answer, not the research process.
- Build the article as answer, context, evidence, limits, and action.
- Use familiar words, concrete examples, and one idea per paragraph.
- Keep Chinese paragraphs to 2-4 sentences and roughly 90-150 characters.
- Define medical terms at first use.
- Explain absolute meaning when a relative risk is provided and the source supports the calculation.
- Distinguish association from causation.
- State who the evidence may not apply to.
- Avoid hype, fear, miracle language, and personal medical instructions.
- Avoid manuscript-review narration such as repeated references to the paper or researchers.
- Never expose internal editorial labels or visible Markdown heading markers in article prose.
- Do not use internal review labels in public copy.

## Quality Gate

Reject or retain for revision when any of the following is true:

- evidence-card or source links are missing
- Chinese article has fewer than 1800 Chinese characters
- English comparison version is missing or outside its allowed length
- any reader-facing section is missing or too short
- exact numbers appear without source support
- metadata is mixed into the public article body
- empty bullets, broken encoding, or visible Markdown hashes remain
- internal editorial language appears in reader-facing prose
- uncertainty or major limitations are omitted
- association is presented as causation
- medical cure, guaranteed reversal, or replacement of professional care is implied

## Human Review Checklist

- Does the title match the source?
- Is every key claim traceable to the abstract or legal full text?
- Are evidence limits prominent and understandable?
- Can a non-medical reader understand the first screen?
- Are next steps useful without becoming personal medical advice?
- Are DOI and source links correct?
