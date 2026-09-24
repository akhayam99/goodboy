type Params = {
  readonly tag: string;
  readonly installed: string | null;
};

const parts = ({ version }: { version: string }): ReadonlyArray<number> =>
  version
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    ?.split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isNaN(part) ? 0 : part)) ?? [];

export const isNewerRelease = ({ tag, installed }: Params): boolean => {
  if (installed === null || installed.trim() === '') {
    return false;
  }
  const next = parts({ version: tag });
  const current = parts({ version: installed });
  const length = Math.max(next.length, current.length);
  for (let index = 0; index < length; index += 1) {
    const a = next[index] ?? 0;
    const b = current[index] ?? 0;
    if (a !== b) {
      return a > b;
    }
  }
  return false;
};
