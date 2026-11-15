type Params = {
  readonly text: string;
};

export const lineCountOf = ({ text }: Params): number => {
  if (text === '') {
    return 0;
  }
  const lines = text.split('\n').length;
  return text.endsWith('\n') ? lines - 1 : lines;
};
