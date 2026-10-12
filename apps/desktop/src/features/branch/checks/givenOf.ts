type Params = {
  readonly text: string;
};

type GivenCheck = {
  readonly name: string;
  readonly conclusion: string | null;
  readonly url: string | null;
  readonly log: string | null;
};

export type Given = {
  readonly pullRequest: string | null;
  readonly head: string | null;
  readonly checks: ReadonlyArray<GivenCheck>;
  readonly paths: ReadonlyArray<string>;
};

type MutableCheck = { -readonly [Key in keyof GivenCheck]: GivenCheck[Key] };

type ValueParams = {
  readonly line: string;
  readonly label: string;
};

const valueOf = ({ line, label }: ValueParams) =>
  line.startsWith(`${label}: `) ? line.slice(label.length + 2).trim() : null;

export const givenOf = ({ text }: Params): Given => {
  let pullRequest: string | null = null;
  let head: string | null = null;
  let isPaths = false;
  const checks: MutableCheck[] = [];
  const paths: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const current = checks.at(-1);
    const check = valueOf({ line, label: 'Check' });
    if (check !== null) {
      isPaths = false;
      checks.push({ name: check, conclusion: null, url: null, log: null });
      continue;
    }
    if (line === 'Paths:') {
      isPaths = true;
      continue;
    }
    if (isPaths) {
      if (line.startsWith('- ')) {
        paths.push(line.slice(2).trim());
      }
      continue;
    }
    pullRequest = valueOf({ line, label: 'Pull request' }) ?? pullRequest;
    head = valueOf({ line, label: 'Head' }) ?? head;
    if (current === undefined) {
      continue;
    }
    current.conclusion = valueOf({ line, label: 'Conclusion' }) ?? current.conclusion;
    current.url = valueOf({ line, label: 'Check URL' }) ?? current.url;
    current.log = valueOf({ line, label: 'Log' }) ?? current.log;
  }
  return { pullRequest, head, checks, paths };
};
