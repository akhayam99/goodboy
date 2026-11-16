const LONG_PATH = 36;
const ELLIPSIS = '…';

type Params = {
  readonly value: string;
};

export const shortPathOf = ({ value }: Params): string => {
  if (value.length <= LONG_PATH || /\s/.test(value)) {
    return value;
  }
  const segments = value.split('/');
  if (segments.length < 4) {
    return value;
  }
  const head = segments[0] === '' ? `/${segments[1] ?? ''}` : (segments[0] ?? '');
  const tail = segments.slice(-2).join('/');
  const twoTail = `${head}/${ELLIPSIS}/${tail}`;
  if (twoTail.length <= LONG_PATH) {
    return twoTail;
  }
  return `${head}/${ELLIPSIS}/${segments.at(-1) ?? ''}`;
};
