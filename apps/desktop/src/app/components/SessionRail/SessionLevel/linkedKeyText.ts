type Params = {
  readonly key: string;
};

const MAX_CHARS = 10;

export const linkedKeyText = ({ key }: Params): string => {
  if (key.length <= MAX_CHARS) {
    return key;
  }
  const head = Math.ceil((MAX_CHARS - 1) / 2);
  const tail = MAX_CHARS - 1 - head;
  return `${key.slice(0, head)}…${key.slice(key.length - tail)}`;
};
