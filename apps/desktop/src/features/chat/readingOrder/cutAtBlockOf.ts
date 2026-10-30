const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, pre, table, blockquote';

type Params = {
  readonly box: HTMLElement;
  readonly lines: number;
};

export const cutAtBlockOf = ({ box, lines }: Params): number | null => {
  const lineHeight = Number.parseFloat(getComputedStyle(box).lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    return null;
  }
  const limit = lineHeight * lines;
  const top = box.getBoundingClientRect().top;
  const bottoms = [...box.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)]
    .map((block) => block.getBoundingClientRect().bottom - top)
    .filter((bottom) => bottom <= limit);
  const best = bottoms.length > 0 ? Math.max(...bottoms) : 0;
  return best >= lineHeight * 2 ? best : null;
};
