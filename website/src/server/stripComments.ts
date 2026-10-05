const OPEN = '<!--';
const CLOSES = ['-->', '--!>'];
const ABRUPT_CLOSES = ['>', '->'];

type Params = {
  readonly source: string;
};

type EndParams = {
  readonly source: string;
  readonly from: number;
};

const commentEnd = ({ source, from }: EndParams) => {
  const abrupt = ABRUPT_CLOSES.find((close) => source.startsWith(close, from));
  if (abrupt !== undefined) {
    return from + abrupt.length;
  }
  const ends = CLOSES.map((close) => {
    const at = source.indexOf(close, from);
    return at === -1 ? Number.POSITIVE_INFINITY : at + close.length;
  });
  const end = Math.min(...ends);
  return Number.isFinite(end) ? end : null;
};

const endsWithOpen = (output: readonly string[]) =>
  output.length >= OPEN.length && output.slice(-OPEN.length).join('') === OPEN;

export const stripComments = ({ source }: Params) => {
  const output: string[] = [];
  let index = 0;
  while (index < source.length) {
    output.push(source.charAt(index));
    index += 1;
    if (endsWithOpen(output)) {
      output.splice(-OPEN.length);
      index = commentEnd({ source, from: index }) ?? index;
    }
  }
  return output.join('');
};
