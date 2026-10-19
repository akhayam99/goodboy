import { parseMarkdown, type Block, type MarkdownDocument } from './parseMarkdown';

export type BlockCache = ReadonlyMap<string, Block>;

type Params = {
  readonly text: string;
  readonly previous: BlockCache;
};

type Result = {
  readonly document: MarkdownDocument;
  readonly cache: BlockCache;
};

export const parseStableMarkdown = ({ text, previous }: Params): Result => {
  const parsed = parseMarkdown({ text });
  const cache = new Map<string, Block>();
  const stableOf = new Map<Block, Block>();
  const blocks = parsed.blocks.map((block, index) => {
    const key = `${index}\u0000${JSON.stringify(block)}`;
    const stable = previous.get(key) ?? block;
    cache.set(key, stable);
    stableOf.set(block, stable);
    return stable;
  });
  const sections = parsed.sections.map((section) =>
    section.map((block) => stableOf.get(block) ?? block),
  );
  return { document: { blocks, sections }, cache };
};
