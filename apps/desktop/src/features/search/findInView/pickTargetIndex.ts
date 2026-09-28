import { foldText } from './foldText';

const BLOCK = '[data-find-item], li, p, h1, h2, h3, h4, h5, h6, td, pre, blockquote';

type NormalizeParams = {
  readonly text: string;
};

const normalize = ({ text }: NormalizeParams): string =>
  foldText({ text })
    .folded.replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

type BlockParams = {
  readonly range: Range;
};

const blockText = ({ range }: BlockParams): string => {
  const parent = range.startContainer.parentElement;
  const block = parent?.closest(BLOCK) ?? parent;
  return block?.textContent ?? '';
};

type Params = {
  readonly ranges: ReadonlyArray<Range>;
  readonly target: string | null;
};

export const pickTargetIndex = ({ ranges, target }: Params): number => {
  if (target === null || ranges.length === 0) {
    return 0;
  }
  const needle = normalize({ text: target });
  if (needle.length === 0) {
    return 0;
  }
  const words = new Set(needle.split(' '));
  let best = 0;
  let bestScore = -1;
  for (const [index, range] of ranges.entries()) {
    const hay = normalize({ text: blockText({ range }) });
    if (hay.includes(needle)) {
      return index;
    }
    const score = hay.split(' ').filter((word) => words.has(word)).length;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  return best;
};
