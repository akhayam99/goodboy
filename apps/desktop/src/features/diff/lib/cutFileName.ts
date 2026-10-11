type Params = {
  readonly name: string;
  readonly maxLength: number;
};

const ELLIPSIS = '…';
const TAIL_STEPS: ReadonlyArray<number> = [6, 4, 2, 0];

type SplitParams = {
  readonly name: string;
};

type Split = {
  readonly stem: string;
  readonly chain: string;
};

const splitName = ({ name }: SplitParams): Split => {
  const dot = name.indexOf('.', 1);
  if (dot < 0) {
    return { stem: name, chain: '' };
  }
  return { stem: name.slice(0, dot), chain: name.slice(dot) };
};

export const cutFileName = ({ name, maxLength }: Params): string => {
  if (name.length <= maxLength) {
    return name;
  }
  const { stem, chain } = splitName({ name });
  for (const step of TAIL_STEPS) {
    const tailLength = Math.min(step, stem.length);
    const head = stem.slice(0, stem.length - tailLength);
    const tail = stem.slice(stem.length - tailLength) + chain;
    if (head === '') {
      if (tail.length <= maxLength) {
        return tail;
      }
      continue;
    }
    const room = maxLength - ELLIPSIS.length - tail.length;
    if (room >= 2) {
      return head.slice(0, room) + ELLIPSIS + tail;
    }
  }
  const keep = Math.max(1, maxLength - ELLIPSIS.length);
  return ELLIPSIS + name.slice(name.length - keep);
};
