type PreviousBuildBlob = {
  readonly name: string;
  readonly kind: string;
  readonly blob: object;
};

type ExpectedBlob = PreviousBuildBlob & {
  readonly expected: unknown;
};

const WS = 'ws-harborline';
const SESSION = 'session-ledger-core';
const WORKTREE = '/work/ledger-core';
const SAVED_AT = 1_762_000_000_000;

const BOARD_PLACE = { at: 'board' };

const SESSION_PLACE = {
  at: 'session',
  sessionId: SESSION,
  view: { lens: null, agentId: null, target: null },
};

type BlobParams = {
  readonly place: object;
  readonly studio?: object | null;
  readonly drawer?: object | null;
  readonly scroll?: Readonly<Record<string, number>>;
};

const blobOf = ({ place, studio = null, drawer = null, scroll = {} }: BlobParams): object => ({
  workspaceId: WS,
  location: { workspaceId: WS, place, studio, focus: { drawer, scroll } },
  at: SAVED_AT,
});

const STUDIOS: Readonly<Record<string, object>> = {
  settings: { kind: 'settings', focus: { scope: 'app', section: 'shortcuts' } },
  guide: { kind: 'guide' },
  addWorkspace: { kind: 'addWorkspace' },
  workflow: { kind: 'workflow' },
  inbox: {
    kind: 'inbox',
    focus: { provider: 'github', kind: 'issue', recordKey: 'payments-api#12', sessionId: null },
  },
  impact: { kind: 'impact', scope: { kind: 'session', sessionId: SESSION } },
  changelog: { kind: 'changelog' },
  notifications: { kind: 'notifications' },
  monitoring: {
    kind: 'monitoring',
    target: { workspaceId: WS, projectId: 'project-ledger-core', branch: 'main' },
  },
  chat: { kind: 'chat', chatId: 'chat-northwind' },
  browser: { kind: 'browser', sessionId: SESSION, tabId: 'tab-checkout' },
  terminal: { kind: 'terminal', terminalId: 'terminal-1', sessionId: SESSION, worktree: null },
};

const DRAWERS: Readonly<Record<string, unknown>> = {
  ask: null,
  context: { section: 'goal', view: 'current' },
  explore: null,
  scripts: { projectId: 'project-ledger-core' },
  spawned: null,
  terminal: { terminalId: 'terminal-1' },
  browser: null,
  'explore-file': {
    sessionDir: WORKTREE,
    entry: {
      name: 'index.ts',
      relPath: 'src/index.ts',
      isDir: false,
      sizeBytes: 120,
      modifiedAt: null,
    },
  },
  scriptRun: { scriptKey: 'test', mountId: null },
  question: { questionId: 'question-1' },
  new: { form: 'report' },
  'fix-comments': { mountId: null },
  artifact: { artifactId: 'artifact-1', tab: 'details' },
  'artifact-document': { artifactId: 'artifact-1', revision: null },
  'plan-part': { planId: 'artifact-2', index: 0 },
  'check-analysis': {
    sessionId: SESSION,
    mountId: 'mount-1',
    checkUrl: 'https://acme.test/checks/1',
  },
  conversation: { threadId: 'thread-1' },
  transcript: { agentId: 'agent-1' },
  'session-log': { focusEntryId: null },
  'history-versions': { mountId: 'mount-1', worktreePath: WORKTREE },
  'file-diff': { source: { kind: 'worktree', worktreePath: WORKTREE }, path: 'src/index.ts' },
  'identifier-peek': {
    worktreePath: WORKTREE,
    word: 'ledger',
    selected: { path: 'src/index.ts', line: 3 },
  },
};

const STUDIO_BLOBS: ReadonlyArray<ExpectedBlob> = Object.entries(STUDIOS).map(([kind, studio]) => ({
  name: `studio ${kind}`,
  kind,
  blob: blobOf({ place: SESSION_PLACE, studio }),
  expected: studio,
}));

const DRAWER_BLOBS: ReadonlyArray<ExpectedBlob> = Object.entries(DRAWERS).map(
  ([kind, payload]) => ({
    name: `drawer ${kind}`,
    kind,
    blob: blobOf({
      place: SESSION_PLACE,
      drawer: { kind, sessionId: SESSION, payload },
    }),
    expected: { kind, sessionId: SESSION, payload },
  }),
);

const PLACE_BLOBS: ReadonlyArray<PreviousBuildBlob> = [
  { name: 'board', kind: 'board', blob: blobOf({ place: BOARD_PLACE, scroll: { queue: 12 } }) },
  {
    name: 'session',
    kind: 'session',
    blob: blobOf({
      place: {
        at: 'session',
        sessionId: SESSION,
        view: { lens: 'review', agentId: 'agent-1', target: null },
      },
      scroll: { review: 40 },
    }),
  },
  {
    name: 'settings studio over the board',
    kind: 'settings',
    blob: blobOf({ place: BOARD_PLACE, studio: STUDIOS.settings ?? null }),
  },
];

const DRAFT_BLOB: PreviousBuildBlob = {
  name: 'session draft',
  kind: 'session-draft',
  blob: blobOf({ place: { at: 'session-draft' } }),
};

const FORMER_BLOBS: ReadonlyArray<PreviousBuildBlob> = [
  {
    name: 'companion studio of an older build',
    kind: 'companion',
    blob: blobOf({ place: BOARD_PLACE, studio: { kind: 'companion' } }),
  },
  {
    name: 'retired agents lens of an older build',
    kind: 'agents',
    blob: blobOf({
      place: {
        at: 'session',
        sessionId: SESSION,
        view: { lens: 'agents', agentId: null, target: null },
      },
    }),
  },
  {
    name: 'retired run-step drawer of an older build',
    kind: 'run-step',
    blob: blobOf({
      place: SESSION_PLACE,
      drawer: { kind: 'run-step', sessionId: SESSION, payload: null },
    }),
  },
];

const TERMINAL_DOCK_WITHOUT_SESSION: PreviousBuildBlob = {
  name: 'terminal dock without a session',
  kind: 'terminal',
  blob: blobOf({
    place: BOARD_PLACE,
    drawer: { kind: 'terminal', sessionId: null, payload: { terminalId: 'terminal-1' } },
  }),
};

export const PREVIOUS_BUILD_BLOBS = {
  studios: STUDIO_BLOBS,
  drawers: DRAWER_BLOBS,
  places: PLACE_BLOBS,
  draft: DRAFT_BLOB,
  former: FORMER_BLOBS,
  terminalDockWithoutSession: TERMINAL_DOCK_WITHOUT_SESSION,
} as const;
