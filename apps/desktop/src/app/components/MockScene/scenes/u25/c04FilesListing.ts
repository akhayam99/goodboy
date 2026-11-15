type MockEntry = {
  readonly name: string;
  readonly relPath: string;
  readonly isDir: boolean;
  readonly sizeBytes: number | null;
  readonly modifiedAt: string | null;
};

type EntryParams = {
  readonly relPath: string;
  readonly isDir: boolean;
};

type ListingParams = {
  readonly dirs?: ReadonlyArray<string>;
  readonly files?: ReadonlyArray<string>;
};

type Params = {
  readonly command: string;
  readonly payload: unknown;
};

type ListArgs = {
  readonly relPath?: unknown;
};

const mockEntryOf = ({ relPath, isDir }: EntryParams): MockEntry => ({
  name: relPath.slice(relPath.lastIndexOf('/') + 1),
  relPath,
  isDir,
  sizeBytes: isDir ? null : 1_204,
  modifiedAt: null,
});

const listingOf = ({ dirs = [], files = [] }: ListingParams): ReadonlyArray<MockEntry> => [
  ...dirs.map((relPath) => mockEntryOf({ relPath, isDir: true })),
  ...files.map((relPath) => mockEntryOf({ relPath, isDir: false })),
];

const LISTINGS: Readonly<Record<string, ReadonlyArray<MockEntry>>> = {
  '': listingOf({ dirs: ['src', 'test'], files: ['README.md', 'package.json', 'pnpm-lock.yaml'] }),
  src: listingOf({ dirs: ['src/ledger', 'src/webhooks'], files: ['src/index.ts'] }),
  'src/ledger': listingOf({
    files: ['src/ledger/ledgerClient.ts', 'src/ledger/postCredit.ts', 'src/ledger/rounding.ts'],
  }),
  'src/webhooks': listingOf({
    files: ['src/webhooks/applyWebhook.ts', 'src/webhooks/verifySignature.ts'],
  }),
  test: listingOf({ files: ['test/applyWebhook.test.ts', 'test/rounding.test.ts'] }),
};

const README_TEXT = [
  '# payments-api',
  '',
  'Credits, refunds and webhook replays for Harborline.',
  '',
  'Run the tests with pnpm test.',
  '',
].join('\n');

const relPathOf = ({ payload }: Pick<Params, 'payload'>): string => {
  if (typeof payload !== 'object' || payload === null) {
    return '';
  }
  const args: ListArgs = payload;
  return typeof args.relPath === 'string' ? args.relPath : '';
};

export const c04FilesIpc = ({ command, payload }: Params): unknown => {
  if (command === 'explore_list') {
    return LISTINGS[relPathOf({ payload })] ?? [];
  }
  if (command === 'explore_read') {
    return { type: 'text', text: README_TEXT, truncated: false };
  }
  return undefined;
};
