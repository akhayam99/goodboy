type Params = {
  readonly root: string;
  readonly path: string;
};

const trimTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 1 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
};

export const pathContains = ({ root, path }: Params): boolean => {
  const base = trimTrailingSlashes(root);
  const target = trimTrailingSlashes(path);
  if (base.length === 0) {
    return false;
  }
  if (target === base) {
    return true;
  }
  if (base === '/') {
    return target.startsWith('/');
  }
  return target.startsWith(`${base}/`);
};
