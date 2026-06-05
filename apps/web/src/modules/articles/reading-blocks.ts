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
    .match(/[^。！？.!?；;]+[。！？.!?；;]?/g)
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
      window.lastIndexOf("，"),
      window.lastIndexOf(","),
      window.lastIndexOf("、"),
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
  const maxLength = hasCjk(paragraph) ? 135 : 230;
  const parts = sentenceParts(paragraph).flatMap((sentence) =>
    splitOversizedSentence(sentence, maxLength),
  );
  const chunks: string[] = [];
  let current = "";

  parts.forEach((part) => {
    const next = current ? `${current} ${part}` : part;

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
    .replace(/([。！？.!?；;])\s+[-*]\s+/g, "$1\n- ")
    .replace(/\n[ \t]*[-*]\s+/g, "\n- ");

export const readingBlocks = (content: string): ReadingBlock[] =>
  normalizeLooseBullets(content)
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
