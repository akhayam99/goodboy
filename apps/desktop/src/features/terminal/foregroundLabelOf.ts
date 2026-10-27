type Params = {
  readonly command: string;
};

type TokenParams = {
  readonly token: string;
};

const MAX_LABEL_CHARS = 60;
const INTERPRETERS = new Set(['node', 'python', 'python3', 'ruby', 'deno', 'tsx', 'ts-node']);

const lastSegmentOf = ({ token }: TokenParams): string => token.split('/').pop() ?? token;

const shortToken = ({ token }: TokenParams): string =>
  token.startsWith('/') || token.startsWith('./') ? lastSegmentOf({ token }) : token;

export const foregroundLabelOf = ({ command }: Params): string => {
  const [first, ...others] = command.split(/\s+/).filter((token) => token !== '');
  if (first === undefined) {
    return '';
  }
  const [second, ...rest] = others;
  const head = lastSegmentOf({ token: first }).replace(/^-/, '');
  const isScriptRun = INTERPRETERS.has(head) && second !== undefined && second.includes('/');
  const words = isScriptRun
    ? [
        lastSegmentOf({ token: second }).replace(/\.(?:c|m)?js$/, ''),
        ...rest.map((token) => shortToken({ token })),
      ]
    : [head, ...others.map((token) => shortToken({ token }))];
  const label = words.join(' ');
  return label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label;
};
