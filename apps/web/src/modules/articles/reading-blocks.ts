export type ReadingBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    };

const hasCjk = (text: string) => /[\u3400-\u9fff]/.test(text);

const sentenceParts = (text: string) =>
  text
    .match(/[^\u3002\uff01\uff1f!?]+[\u3002\uff01\uff1f!?]?/g)
    ?.map((part) => part.trim()) || [text];

const splitOversizedSentence = (sentence: string, maxLength: number) => {
  if (sentence.length <= maxLength) {
    return [sentence];
  }

  const chunks: string[] = [];
  let remaining = sentence.trim();

  while (remaining.length > maxLength) {
    const window = remaining.slice(0, maxLength);
    const breakAt = Math.max(
      window.lastIndexOf("\uff0c"),
      window.lastIndexOf(","),
      window.lastIndexOf("\u3001"),
      window.lastIndexOf(" "),
    );
    const cut = breakAt > maxLength * 0.45 ? breakAt + 1 : maxLength;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
};

const compactParagraphs = (paragraph: string) => {
  const maxLength = hasCjk(paragraph) ? 115 : 210;
  const parts = sentenceParts(paragraph).flatMap((sentence) =>
    splitOversizedSentence(sentence, maxLength),
  );
  const chunks: string[] = [];
  let current = "";

  parts.forEach((part) => {
    const next = current ? current + " " + part : part;

    if (current && next.length > maxLength) {
      chunks.push(current.trim());
      current = part;
      return;
    }

    current = next;
  });

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
};

const normalizeLooseBullets = (content: string) =>
  content
    .replace(/\r\n/g, "\n")
    .replace(/([\u3002\uff01\uff1f!?])\s+[-*]\s+/g, "$1\n- ")
    .replace(/\n[ \t]*[-*]\s+/g, "\n- ");

const sanitizeReaderText = (content: string) =>
  content
    .replace(/^#{1,6}\s*/gm, "")
    .replace(
      /^(\u7814\u7a76\u80cc\u666f|\u6838\u5fc3\u53d1\u73b0|\u4f60\u7684\u6279\u5224\u4e0e\u89e3\u8bfb|\u4f60\u7684\u89e3\u8bfb\u4e0e\u6279\u5224|\u4e34\u5e8a\/\u5546\u4e1a\u542f\u53d1)\s*[:\uff1a]?/gm,
      "",
    )
    .replace(
      /^(\u5148\u8bf4\u7ed3\u8bba|\u4e3a\u4ec0\u4e48\u503c\u5f97\u5173\u6ce8|\u8bc1\u636e\u544a\u8bc9\u6211\u4eec\u4ec0\u4e48|\u5e94\u8be5\u600e\u6837\u7406\u89e3|\u53ef\u4ee5\u600e\u4e48\u505a)\s*[:\uff1a]?/gm,
      "",
    )
    .replace(
      /^A[.\u3001\uff0e\uff1a:]\s*\u7ed9\u7cd6\u524d\u8bfb\u8005\u7684\u884c\u52a8\u5efa\u8bae\s*[:\uff1a]?/gm,
      "",
    )
    .replace(
      /^B[.\u3001\uff0e\uff1a:]\s*\u7ed9\u5065\u5eb7\u79d1\u6280\u884c\u4e1a\u7684\u542f\u53d1\s*[:\uff1a]?/gm,
      "",
    )
    .replace(/^\u7ed9\u7cd6\u524d\u8bfb\u8005\s*[:\uff1a]?/gm, "")
    .replace(/^\u7ed9\u5065\u5eb7\u79d1\u6280\u884c\u4e1a\s*[:\uff1a]?/gm, "")
    .replace(/\n{3,}/g, "\n\n");

export const readingBlocks = (content: string): ReadingBlock[] =>
  normalizeLooseBullets(sanitizeReaderText(content))
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block): ReadingBlock[] => {
      const lines = block
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const listItems = lines
        .filter((line) => /^[-*]\s+/.test(line))
        .map((line) => line.replace(/^[-*]\s+/, "").trim())
        .filter(Boolean);

      if (listItems.length === lines.length && listItems.length > 0) {
        return [{ type: "list", items: listItems }];
      }

      return compactParagraphs(block.replace(/\s+/g, " ")).map((text) => ({
        type: "paragraph",
        text,
      }));
    });
