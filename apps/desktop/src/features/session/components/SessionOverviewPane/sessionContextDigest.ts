import { parseDecisions, parseSummaryDocument } from '@goodboy/core';

export type DigestEntry = {
  readonly count: number;
  readonly excerpt: string;
};

export type ContextDigest = {
  readonly decisions: DigestEntry;
  readonly summary: DigestEntry;
};

type LineParams = {
  readonly text: string;
};

const firstLine = ({ text }: LineParams): string => {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed !== '') {
      return trimmed;
    }
  }
  return '';
};

type Params = {
  readonly decisions: string;
  readonly summary: string;
};

export const sessionContextDigest = ({ decisions, summary }: Params): ContextDigest => {
  const rows = parseDecisions({ text: decisions }).rows;
  const blocks = parseSummaryDocument({ text: summary }).blocks.filter(
    (block) => firstLine({ text: block.body ?? '' }) !== '',
  );
  const firstBlock = blocks[0];

  return {
    decisions: {
      count: rows.length,
      excerpt: rows.length === 0 ? '' : firstLine({ text: rows[0]?.text ?? '' }),
    },
    summary: {
      count: blocks.length,
      excerpt: firstBlock === undefined ? '' : firstLine({ text: firstBlock.body ?? '' }),
    },
  };
};
