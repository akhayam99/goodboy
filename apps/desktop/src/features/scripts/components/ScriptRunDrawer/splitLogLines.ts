export type LogLine = {
  readonly stream: 'stdout' | 'stderr';
  readonly text: string;
};

type Params = {
  readonly stdout: string;
  readonly stderr: string;
};

const linesOf = ({ text }: { readonly text: string }): ReadonlyArray<string> => {
  if (text === '') {
    return [];
  }
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
};

export const splitLogLines = ({ stdout, stderr }: Params): ReadonlyArray<LogLine> => [
  ...linesOf({ text: stdout }).map((text): LogLine => ({ stream: 'stdout', text })),
  ...linesOf({ text: stderr }).map((text): LogLine => ({ stream: 'stderr', text })),
];
