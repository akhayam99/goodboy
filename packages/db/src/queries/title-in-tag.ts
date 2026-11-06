const OPEN_TAG = '<title>';

const CLOSE_TAG = '</title>';

type Params = {
  readonly text: string;
};

export const titleInTag = ({ text }: Params): string => {
  const openAt = text.indexOf(OPEN_TAG);
  if (openAt === -1) {
    return '';
  }
  const start = openAt + OPEN_TAG.length;
  const closeAt = text.indexOf(CLOSE_TAG, start);
  if (closeAt === -1) {
    return '';
  }
  const inner = text.slice(start, closeAt);
  if (inner.includes(OPEN_TAG)) {
    return '';
  }
  return inner.trim();
};
