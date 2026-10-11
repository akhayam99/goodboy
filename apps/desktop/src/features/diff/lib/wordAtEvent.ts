export type PeekAnchor = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type WordHit = {
  readonly word: string;
  readonly anchor: PeekAnchor;
  readonly range: Range;
};

type Params = {
  readonly clientX: number;
  readonly clientY: number;
  readonly target: Element;
  readonly isFromSelection: boolean;
};

type CaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
};

const WORD_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]{1,127}$/;
const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/;

const caretAt = ({ clientX, clientY }: Pick<Params, 'clientX' | 'clientY'>) => {
  const doc: CaretDocument = document;
  const range = doc.caretRangeFromPoint?.(clientX, clientY) ?? null;
  if (range !== null) {
    return { node: range.startContainer, offset: range.startOffset };
  }
  const position = doc.caretPositionFromPoint?.(clientX, clientY) ?? null;
  return position === null ? null : { node: position.offsetNode, offset: position.offset };
};

type CaretParams = { readonly node: Node; readonly offset: number };

type TrimParams = { readonly range: Range };

const rangeAround = ({ node, offset }: CaretParams): Range | null => {
  if (node.nodeType !== Node.TEXT_NODE) {
    return null;
  }
  const text = node.textContent ?? '';
  let start = Math.min(offset, text.length);
  let end = start;
  while (start > 0 && IDENTIFIER_CHAR.test(text.charAt(start - 1))) {
    start -= 1;
  }
  while (end < text.length && IDENTIFIER_CHAR.test(text.charAt(end))) {
    end += 1;
  }
  if (end <= start) {
    return null;
  }
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
};

const selectedRange = (): Range | null => {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  return selection.getRangeAt(0);
};

const trimmed = ({ range }: TrimParams): Range => {
  const text = range.toString();
  const lead = text.length - text.trimStart().length;
  const tail = text.length - text.trimEnd().length;
  if (lead === 0 && tail === 0) {
    return range;
  }
  const clone = range.cloneRange();
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    clone.setStart(range.startContainer, range.startOffset + lead);
  }
  if (range.endContainer.nodeType === Node.TEXT_NODE) {
    clone.setEnd(range.endContainer, range.endOffset - tail);
  }
  return clone;
};

export const wordAtEvent = ({
  clientX,
  clientY,
  target,
  isFromSelection,
}: Params): WordHit | null => {
  const picked = isFromSelection ? selectedRange() : null;
  const caret = picked === null ? caretAt({ clientX, clientY }) : null;
  const range =
    picked === null ? (caret === null ? null : rangeAround(caret)) : trimmed({ range: picked });
  if (range === null) {
    return null;
  }
  const word = range.toString();
  const container = range.commonAncestorContainer;
  const host = container instanceof Element ? container : container.parentElement;
  if (!WORD_PATTERN.test(word) || host === null || !target.contains(host)) {
    return null;
  }
  const rect = range.getBoundingClientRect();
  return {
    word,
    anchor: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    range,
  };
};
