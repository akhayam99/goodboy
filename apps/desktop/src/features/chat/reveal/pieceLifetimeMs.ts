import { REVEAL_PACE } from './revealNumbers';

const TABLE_LINE = /^\s*\|/;

type Params = {
  readonly text: string;
};

const staggeredRows = ({ text }: Params): number => {
  if (!text.includes('|')) {
    return 0;
  }
  const tableLines = text.split('\n').filter((line) => TABLE_LINE.test(line)).length;
  return Math.min(Math.max(tableLines - 2, 0), REVEAL_PACE.maxStaggerRows);
};

export const pieceLifetimeMs = ({ text }: Params): number =>
  REVEAL_PACE.fadeMs + staggeredRows({ text }) * REVEAL_PACE.rowStaggerMs;
