type Params = Readonly<{
  body: string;
}>;

const PREAMBLE = /^(set\s+-|cd\s+"?\$\(dirname\b)/;

export const extractPreviewLine = ({ body }: Params): string => {
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    if (PREAMBLE.test(trimmed)) {
      continue;
    }
    return trimmed;
  }
  return 'empty script';
};
