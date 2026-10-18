import { brandId, type SessionId } from '@goodboy/types';
import type {
  FolderReadResult,
  FolderRestoreResult,
  FolderTurnManifest,
} from '../../../../../features/file-versions/fileVersions';

export const CHANGES_NOTES_PATH = '/mock/Documents/acme-notes';
export const CHANGES_SESSION_ID = brandId<SessionId>({ value: 'mock-nogit-session-launch-memo' });

const MINUTE = 60_000;

type ChangeSpec = Readonly<{
  relativePath: string;
  change: FolderTurnManifest['changes'][number]['change'];
}>;

type TurnSpec = Readonly<{
  runId: string;
  minutesAgo: number;
  kind?: FolderTurnManifest['kind'];
  restoresRunId?: string | null;
  changes: ReadonlyArray<ChangeSpec>;
}>;

const turnOf = ({
  runId,
  minutesAgo,
  kind = 'turn',
  restoresRunId = null,
  changes,
}: TurnSpec): FolderTurnManifest => {
  const finishedAtMs = Date.now() - minutesAgo * MINUTE;
  return {
    version: 1,
    sessionId: CHANGES_SESSION_ID,
    runId,
    folderId: null,
    folderPath: CHANGES_NOTES_PATH,
    kind,
    restoresRunId,
    startedAtMs: finishedAtMs - 2 * MINUTE,
    finishedAtMs,
    changes: changes.map(({ relativePath, change }) => ({
      relativePath,
      change,
      beforeHash: change === 'added' ? null : `${runId}-before-${relativePath}`,
      afterHash: change === 'deleted' ? null : `${runId}-after-${relativePath}`,
      beforeSizeBytes: change === 'added' ? null : 2_048,
      afterSizeBytes: change === 'deleted' ? null : 2_112,
      versionId: change === 'added' ? null : `${runId}-${relativePath}`,
      storedName: change === 'added' ? null : `${runId}-${relativePath}`,
      isPruned: false,
    })),
    skipped: [],
  };
};

type MemoParams = Readonly<{ intro: string; claim: string; audience: string }>;

const memoOf = ({ intro, claim, audience }: MemoParams): string =>
  [
    '# Acme Notes launch memo',
    '',
    intro,
    claim,
    '',
    '## Why now',
    '',
    'Teams already write more than they meet. Most of that writing is lost in chat.',
    '',
    'Acme Notes gives every page an owner and a date, so stale notes are easy to spot.',
    '',
    '## What ships',
    '',
    '- Pages that open in under a second',
    '- Sharing a single page by link',
    '- Offline edits that sync when you are back',
    '',
    '## Who it is for',
    '',
    audience,
    '',
    '## Pricing',
    '',
    'The team plan is per seat. See pricing.md for the numbers.',
    '',
  ].join('\n');

const MEMO_FIRST = memoOf({
  intro:
    'Acme Notse is a new way for teams to keep there notes in one place, and it is very fast and also easy to use for everyone.',
  claim: 'We think this will change how poeple work.',
  audience: 'Teams of all sizes who write a lot.',
});

const MEMO_TYPOS_FIXED = memoOf({
  intro:
    'Acme Notes is a new way for teams to keep there notes in one place, and it is very fast and also easy to use for everyone.',
  claim: 'We think this will change how people work.',
  audience: 'Teams of all sizes who write a lot.',
});

const MEMO_TIGHT = memoOf({
  intro: 'Acme Notes keeps a team’s notes in one place and opens any page in under a second.',
  claim: 'It ships to every Acme customer on 4 November.',
  audience: 'Teams of 5 to 200 people who write a lot and share most of it.',
});

const FAQ_BEFORE = [
  '# FAQ',
  '',
  '## Is there a free plan?',
  '',
  'Yes, for up to three people.',
  '',
  '## How does pricing work?',
  '',
  'The team plan costs the same for every team.',
  '',
].join('\n');

const FAQ_AFTER = FAQ_BEFORE.replace(
  'The team plan costs the same for every team.',
  'The team plan is per seat, as in pricing.md, and billed monthly.',
);

const SUMMARY = [
  '# What people told us',
  '',
  '1. Search is slow once a team has more than a few hundred pages.',
  '2. Notes do not sync between laptop and phone without a refresh.',
  '3. There is no way to share a single page outside the team.',
  '4. Tables break when pasted from a spreadsheet.',
  '5. Offline edits are lost when two people change the same page.',
  '',
  '## Who said it',
  '',
  'Nine of the fourteen people at Northwind and Cascadia raised search first.',
  '',
].join('\n');

const PRICING_BEFORE = '# Pricing\n\nThe team plan is $8 per seat per month.\n';
const PRICING_AFTER = '# Pricing\n\nThe team plan is $9 per seat per month.\n';

const TEXTS: ReadonlyMap<string, string> = new Map([
  ['run-memo-3 launch-memo.md before', MEMO_TYPOS_FIXED],
  ['run-memo-3 launch-memo.md after', MEMO_TIGHT],
  ['run-memo-3 faq.md before', FAQ_BEFORE],
  ['run-memo-3 faq.md after', FAQ_AFTER],
  ['run-memo-2 interviews/summary.md after', SUMMARY],
  ['run-memo-1 launch-memo.md before', MEMO_FIRST],
  ['run-memo-1 launch-memo.md after', MEMO_TYPOS_FIXED],
  ['run-memo-1 pricing.md before', PRICING_BEFORE],
  ['run-memo-1 pricing.md after', PRICING_AFTER],
]);

type TurnTitle = Readonly<{ runId: string; text: string; reply: string }>;

export const CHANGES_TITLES: ReadonlyArray<TurnTitle> = [
  {
    runId: 'run-memo-1',
    text: 'Fix typos',
    reply: 'Fixed two typos in the launch memo and the seat price in pricing.md.',
  },
  {
    runId: 'run-memo-2',
    text: 'Summarize the interviews',
    reply:
      'I read the 14 interviews and wrote the five most common complaints into interviews/summary.md.',
  },
  {
    runId: 'run-memo-3',
    text: 'Tighten the intro',
    reply:
      'I shortened the intro to two sentences and moved the speed claim up. In the FAQ, the pricing answer now says the team plan is per seat, as in pricing.md.',
  },
];

type World = {
  turns: Array<FolderTurnManifest>;
  changedSince: Array<string>;
  restores: number;
};

export const changesWorld = (): World => ({
  turns: [
    turnOf({
      runId: 'run-memo-3',
      minutesAgo: 2,
      changes: [
        { relativePath: 'launch-memo.md', change: 'modified' },
        { relativePath: 'faq.md', change: 'modified' },
      ],
    }),
    turnOf({
      runId: 'restore-pricing',
      minutesAgo: 20,
      kind: 'restore',
      restoresRunId: 'run-memo-1',
      changes: [{ relativePath: 'pricing.md', change: 'modified' }],
    }),
    turnOf({
      runId: 'run-memo-2',
      minutesAgo: 14,
      changes: [{ relativePath: 'interviews/summary.md', change: 'added' }],
    }),
    turnOf({
      runId: 'run-memo-1',
      minutesAgo: 60,
      changes: [
        { relativePath: 'launch-memo.md', change: 'modified' },
        { relativePath: 'pricing.md', change: 'modified' },
      ],
    }),
  ],
  changedSince: [],
  restores: 0,
});

type ReadParams = Readonly<{ runId: string; relativePath: string; side: string }>;

export const changesRead = ({ runId, relativePath, side }: ReadParams): FolderReadResult => {
  const text = TEXTS.get(`${runId} ${relativePath} ${side}`);
  return text === undefined
    ? { kind: 'missing', text: null, sizeBytes: null }
    : { kind: 'text', text, sizeBytes: text.length };
};

type RestoreParams = Readonly<{
  world: World;
  runId: string;
  restoreRunId: string;
  isForced: boolean;
  relativePaths: ReadonlyArray<string> | null;
}>;

export const changesRestore = ({
  world,
  runId,
  restoreRunId,
  isForced,
  relativePaths,
}: RestoreParams): FolderRestoreResult => {
  const target = world.turns.find((turn) => turn.runId === runId);
  const paths = relativePaths ?? target?.changes.map((change) => change.relativePath) ?? [];
  const blocked = world.changedSince.filter((path) => paths.includes(path));
  if (blocked.length > 0 && !isForced) {
    return { status: 'changedSince', changedSince: blocked, turn: null, kept: [] };
  }
  world.changedSince = [];
  world.restores += 1;
  const manifest = turnOf({
    runId: restoreRunId,
    minutesAgo: 0,
    kind: 'restore',
    restoresRunId: runId,
    changes: paths.map((relativePath) => ({ relativePath, change: 'modified' })),
  });
  world.turns = [manifest, ...world.turns];
  return { status: 'restored', changedSince: blocked, turn: manifest, kept: [] };
};
