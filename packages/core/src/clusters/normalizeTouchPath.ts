type Params = Readonly<{
  path: string;
}>;

export const normalizeTouchPath = ({ path }: Params): string => {
  const slashed = path.trim().replace(/\\/g, '/');
  const kept: string[] = [];
  for (const part of slashed.split('/')) {
    if (part.length === 0 || part === '.') {
      continue;
    }
    if (part !== '..') {
      kept.push(part);
      continue;
    }
    if (kept.length === 0) {
      return '';
    }
    kept.pop();
  }
  return kept.join('/');
};
