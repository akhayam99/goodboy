import { caretLineOf, type CaretLine } from './caretLineOf';

type Params = {
  readonly field: HTMLTextAreaElement;
};

type ScrollerParams = {
  readonly element: HTMLElement;
};

type RevealParams = {
  readonly scroller: HTMLElement;
  readonly top: number;
  readonly bottom: number;
  readonly margin: number;
};

const FIELD_MARGIN_PX = 4;
const SCROLLER_MARGIN_PX = 40;
const SCROLLING = new Set(['auto', 'scroll', 'overlay']);

const nearestScrollerOf = ({ element }: ScrollerParams): HTMLElement | null => {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    const isScrolling = SCROLLING.has(getComputedStyle(node).overflowY);
    if (isScrolling && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
};

const reveal = ({ scroller, top, bottom, margin }: RevealParams): void => {
  const hiddenBelow = bottom + margin - scroller.clientHeight;
  if (hiddenBelow > 0) {
    scroller.scrollTop += Math.max(0, Math.min(hiddenBelow, top));
    return;
  }
  const hiddenAbove = margin - top;
  if (hiddenAbove > 0) {
    scroller.scrollTop = Math.max(0, scroller.scrollTop - hiddenAbove);
  }
};

type LineParams = {
  readonly field: HTMLTextAreaElement;
  readonly scroller: HTMLElement;
  readonly line: CaretLine;
};

const lineInScrollerOf = ({ field, scroller, line }: LineParams): CaretLine => {
  const viewTop = scroller.getBoundingClientRect().top + scroller.clientTop;
  const top =
    field.getBoundingClientRect().top + field.clientTop + line.top - field.scrollTop - viewTop;
  return { top, bottom: top + (line.bottom - line.top) };
};

export const keepCaretVisible = ({ field }: Params): void => {
  const line = caretLineOf({ field });
  reveal({
    scroller: field,
    top: line.top - field.scrollTop,
    bottom: line.bottom - field.scrollTop,
    margin: FIELD_MARGIN_PX,
  });
  const scroller = nearestScrollerOf({ element: field });
  if (scroller === null) {
    return;
  }
  const shown = lineInScrollerOf({ field, scroller, line });
  reveal({ scroller, top: shown.top, bottom: shown.bottom, margin: SCROLLER_MARGIN_PX });
};
