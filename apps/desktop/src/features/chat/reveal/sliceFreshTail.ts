import type { FreshTail } from '@goodboy/ui';

type Params = {
  readonly tail: FreshTail;
  readonly skip: number;
  readonly length: number;
};

export const sliceFreshTail = ({ tail, skip, length }: Params): FreshTail | undefined => {
  const total = tail.pieces.reduce((sum, piece) => sum + piece.length, 0);
  const end = total - skip;
  const start = Math.max(0, end - length);
  if (end <= 0 || length <= 0) {
    return undefined;
  }
  const pieces: Array<FreshTail['pieces'][number]> = [];
  let pieceStart = 0;
  for (const piece of tail.pieces) {
    const pieceEnd = pieceStart + piece.length;
    const from = Math.max(pieceStart, start);
    const to = Math.min(pieceEnd, end);
    if (to > from) {
      pieces.push({ key: piece.key, length: to - from });
    }
    pieceStart = pieceEnd;
  }
  return pieces.length === 0 ? undefined : { ...tail, pieces };
};
