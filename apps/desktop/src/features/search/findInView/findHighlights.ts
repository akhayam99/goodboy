const MATCH = 'find-match';
const CURRENT = 'find-current';

const registry = (): HighlightRegistry | null =>
  typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function'
    ? CSS.highlights
    : null;

type PaintParams = {
  readonly ranges: ReadonlyArray<Range>;
  readonly current: Range | null;
};

export const paintFindHighlights = ({ ranges, current }: PaintParams): void => {
  const highlights = registry();
  if (highlights === null) {
    return;
  }
  highlights.set(MATCH, new Highlight(...ranges.filter((range) => range !== current)));
  if (current === null) {
    highlights.delete(CURRENT);
    return;
  }
  highlights.set(CURRENT, new Highlight(current));
};

export const clearFindHighlights = (): void => {
  const highlights = registry();
  highlights?.delete(MATCH);
  highlights?.delete(CURRENT);
};
