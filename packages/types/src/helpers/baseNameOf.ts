type Params = {
  readonly path: string;
};

export const baseNameOf = ({ path }: Params): string => {
  let end = path.length;
  while (end > 0 && path[end - 1] === '/') {
    end -= 1;
  }
  const trimmed = path.slice(0, end);
  const name = trimmed.slice(trimmed.lastIndexOf('/') + 1);
  return name === '' ? path : name;
};
