import { cloneElement, isValidElement, type CSSProperties, type ReactNode } from 'react';

export type FreshPiece = {
  readonly key: number;
  readonly length: number;
};

export type FreshTail = {
  readonly pieces: ReadonlyArray<FreshPiece>;
  readonly fadeMs: number;
  readonly rowStaggerMs: number;
  readonly maxStaggerRows: number;
};

type RowStyle = CSSProperties & {
  readonly '--reveal-delay': string;
};

type Cursor = {
  consumed: number;
  leaves: number;
};

type WalkParams = {
  readonly node: ReactNode;
  readonly tail: FreshTail;
  readonly total: number;
  readonly cursor: Cursor;
  readonly bodyRow?: number;
};

type SplitParams = {
  readonly text: string;
  readonly tail: FreshTail;
  readonly total: number;
  readonly cursor: Cursor;
};

type FreshenParams = {
  readonly node: ReactNode;
  readonly tail: FreshTail;
};

const splitText = ({ text, tail, total, cursor }: SplitParams): ReactNode => {
  const freshLength = Math.min(text.length, total - cursor.consumed);
  if (freshLength <= 0) {
    return text;
  }
  const end = total - cursor.consumed;
  const start = end - freshLength;
  cursor.consumed += freshLength;
  const leaf = cursor.leaves;
  cursor.leaves += 1;
  const plainLength = text.length - freshLength;
  const spans: ReactNode[] = [];
  let pieceStart = 0;
  let offset = plainLength;
  for (const piece of tail.pieces) {
    const pieceEnd = pieceStart + piece.length;
    const from = Math.max(pieceStart, start);
    const to = Math.min(pieceEnd, end);
    if (to > from) {
      const length = to - from;
      spans.push(
        <span
          key={`fresh-${leaf}-${piece.key}`}
          data-fresh=""
          style={{ animationDuration: `${tail.fadeMs}ms` }}
        >
          {text.slice(offset, offset + length)}
        </span>,
      );
      offset += length;
    }
    pieceStart = pieceEnd;
  }
  return [plainLength > 0 ? text.slice(0, plainLength) : null, ...spans];
};

type RowStyleParams = {
  readonly tail: FreshTail;
  readonly bodyRow: number;
};

const rowStyle = ({ tail, bodyRow }: RowStyleParams) => {
  const style: RowStyle = {
    '--reveal-delay': `${Math.min(bodyRow + 1, tail.maxStaggerRows) * tail.rowStaggerMs}ms`,
  };
  return style;
};

const walk = ({ node, tail, total, cursor, bodyRow }: WalkParams): ReactNode => {
  if (cursor.consumed >= total) {
    return node;
  }
  if (typeof node === 'string') {
    return splitText({ text: node, tail, total, cursor });
  }
  if (Array.isArray(node)) {
    const out: ReactNode[] = new Array<ReactNode>(node.length);
    for (let index = node.length - 1; index >= 0; index -= 1) {
      out[index] = walk({ node: node[index], tail, total, cursor, bodyRow: index });
    }
    return out;
  }
  if (isValidElement<{ children?: ReactNode; style?: CSSProperties }>(node)) {
    const children = node.props.children;
    if (children === undefined || children === null) {
      return node;
    }
    const before = cursor.consumed;
    const next = walk({ node: children, tail, total, cursor });
    if (cursor.consumed === before) {
      return node;
    }
    const props =
      node.type === 'tr' && bodyRow !== undefined
        ? { style: rowStyle({ tail, bodyRow }) }
        : undefined;
    return cloneElement(node, props, ...(Array.isArray(next) ? next : [next]));
  }
  return node;
};

export const freshenNode = ({ node, tail }: FreshenParams): ReactNode => {
  const total = tail.pieces.reduce((sum, piece) => sum + piece.length, 0);
  if (total <= 0) {
    return node;
  }
  return walk({ node, tail, total, cursor: { consumed: 0, leaves: 0 } });
};
