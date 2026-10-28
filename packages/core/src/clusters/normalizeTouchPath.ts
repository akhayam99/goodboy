type Params = Readonly<{
  path: string;
}>;

export const normalizeTouchPath = ({ path }: Params): string => {
  const slashed = path.trim().replace(/\\/g, '/');
  return slashed
    .split('/')
    .filter((part) => part.length > 0 && part !== '.')
    .join('/');
};
