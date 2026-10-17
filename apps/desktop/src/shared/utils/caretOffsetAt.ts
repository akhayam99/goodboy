type Params = {
  readonly root: Element;
  readonly clientX: number;
  readonly clientY: number;
};

type CaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
};

type CaretPoint = {
  readonly node: Node;
  readonly offset: number;
};

const caretPointAt = ({ clientX, clientY }: Omit<Params, 'root'>): CaretPoint | null => {
  const doc: CaretDocument = document;
  const range = doc.caretRangeFromPoint?.(clientX, clientY) ?? null;
  if (range !== null) {
    return { node: range.startContainer, offset: range.startOffset };
  }
  const position = doc.caretPositionFromPoint?.(clientX, clientY) ?? null;
  return position === null ? null : { node: position.offsetNode, offset: position.offset };
};

export const caretOffsetAt = ({ root, clientX, clientY }: Params): number | null => {
  const point = caretPointAt({ clientX, clientY });
  if (point === null || !root.contains(point.node)) {
    return null;
  }
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(point.node, point.offset);
  return range.toString().length;
};
