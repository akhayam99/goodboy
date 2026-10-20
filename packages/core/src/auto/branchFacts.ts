import {
  AUTO_FACTS_CHARS,
  AUTO_FACTS_CHECKS_MAX,
  AUTO_FACTS_COMMITS_MAX,
  AUTO_FACTS_THREAD_CHARS,
  AUTO_FACTS_THREADS_MAX,
} from './limits';

export type BranchFactsPart<Value> =
  Readonly<{ kind: 'ok'; value: Value }> | Readonly<{ kind: 'unavailable'; reason: string }>;

export type BranchFactsCommit = Readonly<{ sha: string; subject: string }>;

export type BranchFactsRequest = Readonly<{
  host: 'github' | 'gitlab' | 'bitbucket';
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  baseBranch: string;
  headBranch: string;
}>;

export type BranchFactsThread = Readonly<{
  author: string;
  path: string | null;
  body: string;
  isResolved: boolean;
}>;

export type BranchFactsCheck = Readonly<{ name: string; conclusion: string }>;

export type BranchFacts = Readonly<{
  mountLabel: string;
  commits: BranchFactsPart<ReadonlyArray<BranchFactsCommit>>;
  request: BranchFactsPart<BranchFactsRequest | null>;
  threads: BranchFactsPart<ReadonlyArray<BranchFactsThread>>;
  checks: BranchFactsPart<ReadonlyArray<BranchFactsCheck>>;
}>;

const CUT_MARK = '\n[facts cut: the cap was reached]';

const NOUN_OF = {
  github: 'Pull request',
  gitlab: 'Merge request',
  bitbucket: 'Pull request',
} as const satisfies Readonly<Record<BranchFactsRequest['host'], string>>;

type PartParams<Value> = {
  readonly label: string;
  readonly part: BranchFactsPart<Value>;
  readonly render: (value: Value) => ReadonlyArray<string>;
};

const partLines = <Value>({ label, part, render }: PartParams<Value>): ReadonlyArray<string> => {
  if (part.kind === 'unavailable') {
    return [`${label}: Facts not available: ${part.reason}`];
  }
  return render(part.value);
};

type CappedParams<Item> = {
  readonly items: ReadonlyArray<Item>;
  readonly max: number;
  readonly line: (item: Item) => string;
};

const cappedLines = <Item>({ items, max, line }: CappedParams<Item>): ReadonlyArray<string> => {
  const shown = items.slice(0, max).map((item) => `  - ${line(item)}`);
  return items.length > max ? [...shown, `  - and ${items.length - max} more`] : shown;
};

type OneLineParams = {
  readonly text: string;
  readonly max: number;
};

const oneLine = ({ text, max }: OneLineParams): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
};

const commitLines = (commits: ReadonlyArray<BranchFactsCommit>): ReadonlyArray<string> => [
  `Commits since the base: ${commits.length}`,
  ...cappedLines({
    items: commits,
    max: AUTO_FACTS_COMMITS_MAX,
    line: (commit) => `${commit.sha.slice(0, 9)} ${oneLine({ text: commit.subject, max: 120 })}`,
  }),
];

const requestLines = (request: BranchFactsRequest | null): ReadonlyArray<string> => {
  if (request === null) {
    return ['Pull request: none is open for this branch'];
  }
  const draft = request.isDraft ? ', draft' : '';
  return [
    `${NOUN_OF[request.host]}: ${request.number} "${oneLine({ text: request.title, max: 120 })}" (${request.state}${draft}, ${request.headBranch} into ${request.baseBranch}) ${request.url}`,
  ];
};

const threadLines = (threads: ReadonlyArray<BranchFactsThread>): ReadonlyArray<string> => {
  const open = threads.filter((thread) => !thread.isResolved);
  return [
    `Open review threads: ${open.length}`,
    ...cappedLines({
      items: open,
      max: AUTO_FACTS_THREADS_MAX,
      line: (thread) =>
        `${thread.path === null ? '' : `${thread.path}: `}${thread.author}: ${oneLine({ text: thread.body, max: AUTO_FACTS_THREAD_CHARS })}`,
    }),
  ];
};

const checkLines = (checks: ReadonlyArray<BranchFactsCheck>): ReadonlyArray<string> => [
  `Checks: ${checks.length}`,
  ...cappedLines({
    items: checks,
    max: AUTO_FACTS_CHECKS_MAX,
    line: (check) => `${check.name}: ${check.conclusion}`,
  }),
];

type ComposeParams = {
  readonly facts: ReadonlyArray<BranchFacts>;
};

type CapParams = {
  readonly text: string;
  readonly max: number;
};

const capText = ({ text, max }: CapParams): string =>
  text.length <= max ? text : `${text.slice(0, Math.max(0, max - CUT_MARK.length))}${CUT_MARK}`;

export const composeBranchFacts = ({ facts }: ComposeParams): string | null => {
  if (facts.length === 0) {
    return null;
  }
  const share = Math.floor(AUTO_FACTS_CHARS / facts.length);
  const blocks = facts.map((entry) =>
    capText({
      text: [
        `Mount ${entry.mountLabel}`,
        ...partLines({ label: 'Commits', part: entry.commits, render: commitLines }),
        ...partLines({ label: 'Pull request', part: entry.request, render: requestLines }),
        ...partLines({ label: 'Review threads', part: entry.threads, render: threadLines }),
        ...partLines({ label: 'Checks', part: entry.checks, render: checkLines }),
      ].join('\n'),
      max: share,
    }),
  );
  return [
    '**Facts** Goodboy read these before you started. They are the state at that moment and you cannot run commands to read more. Report from them and from the files in your mount.',
    ...blocks,
  ].join('\n\n');
};
