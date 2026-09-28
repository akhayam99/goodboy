import { findTokens, foldText } from './foldText';

const WORD_CHAR = /[\p{L}\p{N}]/u;
const SKIPPED = 'script, style, noscript, [data-find-skip]';

type Params = {
  readonly root: Element;
  readonly query: string;
};

type RootParams = {
  readonly root: Element;
};

const textNodes = ({ root }: RootParams): ReadonlyArray<Text> => {
  const nodes: Text[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (node instanceof Text && parent !== null && parent.closest(SKIPPED) === null) {
      nodes.push(node);
    }
  }
  return nodes;
};

export const findMatchRanges = ({ root, query }: Params): ReadonlyArray<Range> => {
  const tokens = findTokens({ text: query });
  if (tokens.length === 0) {
    return [];
  }
  const ranges: Range[] = [];
  for (const node of textNodes({ root })) {
    const text = node.data;
    const { folded, offsets } = foldText({ text });
    for (const token of tokens) {
      for (let at = folded.indexOf(token); at !== -1; at = folded.indexOf(token, at + 1)) {
        const start = offsets[at] ?? 0;
        const isWordStart = start === 0 || !WORD_CHAR.test(text[start - 1] ?? '');
        if (!isWordStart) {
          continue;
        }
        const range = root.ownerDocument.createRange();
        range.setStart(node, start);
        range.setEnd(node, offsets[at + token.length] ?? text.length);
        ranges.push(range);
      }
    }
  }
  return ranges.sort((a, b) => a.compareBoundaryPoints(Range.START_TO_START, b));
};
