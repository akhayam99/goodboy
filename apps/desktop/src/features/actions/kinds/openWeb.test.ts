// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type PullRequestState, type SessionId } from '@goodboy/types';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStorySession,
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { SETTING_LINKS_OPEN } from '../../../shared/lib/linksOpenSetting';
import type { ActionDefinition, ActionEnv } from '../types';
import { ISSUE_CANDIDATE_KIND, type IssueCandidateFacts } from './issueCandidate';
import { LINK_KIND, type LinkFacts } from './link';
import { PORT_KIND, type PortKindFacts } from './port';
import { PULL_REQUEST_KIND } from './pullRequest';
import type { PullRequestFacts } from './pullRequestFacts';
import { RECORD_KIND, type RecordFacts } from './record';
import { REVIEW_COMMENT_KIND, type ReviewCommentFacts } from './reviewComment';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const PR_URL = 'https://github.com/harborline/payments-api/pull/318';
const COMMENT_URL = `${PR_URL}#discussion_r1`;
const ISSUE_URL = 'https://linear.app/harborline/issue/HBL-501';
const COMMIT_SHA = '6c20f48a9e1d';

const PR: PullRequestState = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: PR_URL,
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'hl/fix-duplicate-credit',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-09-20T10:00:00Z',
  author: 'nadia-p',
  headSha: COMMIT_SHA,
};

const pullRequestFacts: PullRequestFacts = {
  sessionId: SESSION_ID,
  mountId: null,
  isRebaseStopOpen: false,
  unpushed: 0,
  host: 'github',
  pr: PR,
  number: 318,
  phase: 'open',
  checks: 'failing',
  failingChecks: [],
  runningChecks: 0,
  failingLogUrl: 'https://ci.harborline.dev/runs/9',
  review: 'approved',
  changesRequestedBy: [],
  hasConflicts: false,
  openComments: 0,
  isOwn: true,
  writeInFlight: null,
  isScribeWriting: false,
  commentsNeedYou: 0,
  commentsUnresolved: 0,
  isFixRunLive: false,
  mergeMethods: ['squash', 'merge', 'rebase'],
  mergeMethodReasons: {},
  commitCount: 5,
};

const reviewCommentFacts: ReviewCommentFacts = {
  sessionId: SESSION_ID,
  threadId: 'thread',
  itemId: 'item',
  revision: 2,
  state: 'new',
  isNote: false,
  hasPr: true,
  provider: 'GitHub',
  host: 'github',
  canResolve: true,
  agentId: brandId<AgentId>({ value: 'resolver' }),
  path: 'src/webhooks/retryPolicy.ts',
  url: COMMENT_URL,
  reply: '',
  approval: 'none',
  remote: 'looks_fixed',
  elsewhereSha: COMMIT_SHA,
  prUrl: PR_URL,
  verdict: null,
  isChecking: false,
  isPushedMissing: false,
  remoteReply: null,
  isReplyOnly: false,
  isReplyFailure: false,
  hasFixOnBranch: false,
  laneAcceptCount: 1,
  laneAcceptNotes: 0,
};

const linkFacts: LinkFacts = { href: 'https://docs.harborline.dev/tax' };

const issueCandidateFacts: IssueCandidateFacts = {
  identifier: 'HBL-501',
  url: ISSUE_URL,
  isSelected: false,
  onToggle: () => undefined,
  onPickAlone: () => undefined,
};

const portFacts: PortKindFacts = {
  port: 5173,
  layer: 'goodboy',
  description: 'ledger-core preview',
  stopProgress: null,
};

const recordFacts: RecordFacts = {
  identifier: 'HBL-501',
  title: 'Round half cents the same way twice',
  url: ISSUE_URL,
  providerLabel: 'Linear',
  sessionId: SESSION_ID,
  isStarred: null,
  onOpen: null,
  launchLabel: null,
  onLaunch: null,
  onToggleStar: null,
  onRefresh: null,
  verbs: [],
  sessionVerbs: [],
  destructive: [],
};

type Row = {
  readonly name: string;
  readonly url: string;
  readonly run: (params: { readonly env: ActionEnv }) => unknown;
};

const runOf = <F>({
  actions,
  id,
  facts,
}: {
  readonly actions: ReadonlyArray<ActionDefinition<F>>;
  readonly id: string;
  readonly facts: F;
}): Row['run'] => {
  const action = actions.find((candidate) => candidate.id === id);
  if (action === undefined) {
    throw new Error(`missing action ${id}`);
  }
  return ({ env }) => action.run({ facts, env, choice: null });
};

const ROWS: ReadonlyArray<Row> = [
  {
    name: 'link.open',
    url: linkFacts.href,
    run: runOf({ actions: LINK_KIND.actions, id: 'link.open', facts: linkFacts }),
  },
  {
    name: 'issueCandidate.openLink',
    url: ISSUE_URL,
    run: runOf({
      actions: ISSUE_CANDIDATE_KIND.actions,
      id: 'issueCandidate.openLink',
      facts: issueCandidateFacts,
    }),
  },
  {
    name: 'port.openInBrowser',
    url: 'http://localhost:5173',
    run: runOf({ actions: PORT_KIND.actions, id: 'port.openInBrowser', facts: portFacts }),
  },
  {
    name: 'record.openInProvider',
    url: ISSUE_URL,
    run: runOf({ actions: RECORD_KIND.actions, id: 'record.openInProvider', facts: recordFacts }),
  },
  {
    name: 'pullRequest.openOnGithub',
    url: PR_URL,
    run: runOf({
      actions: PULL_REQUEST_KIND.actions,
      id: 'pullRequest.openOnGithub',
      facts: pullRequestFacts,
    }),
  },
  {
    name: 'pullRequest.checkLog',
    url: 'https://ci.harborline.dev/runs/9',
    run: runOf({
      actions: PULL_REQUEST_KIND.actions,
      id: 'pullRequest.checkLog',
      facts: pullRequestFacts,
    }),
  },
  {
    name: 'reviewComment.openOnGithub',
    url: COMMENT_URL,
    run: runOf({
      actions: REVIEW_COMMENT_KIND.actions,
      id: 'reviewComment.openOnGithub',
      facts: reviewCommentFacts,
    }),
  },
  {
    name: 'reviewComment.openCommit',
    url: `https://github.com/harborline/payments-api/commit/${COMMIT_SHA}`,
    run: runOf({
      actions: REVIEW_COMMENT_KIND.actions,
      id: 'reviewComment.openCommit',
      facts: reviewCommentFacts,
    }),
  },
];

type TabOpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};

let store: StoryStore;
let outside: string[];
let tabs: TabOpenArgs['args'][];
let isOutsideRefused: boolean;
const reportError = vi.fn(async () => undefined);

const envOf = (): ActionEnv => ({
  getState: () => store.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'button',
  anchorKey: null,
  viewing: null,
});

const stubHost = () => {
  stubStoryInvoke({
    open_url: ({ url }: { readonly url: string }) => {
      if (isOutsideRefused) {
        throw new Error('no browser is installed');
      }
      outside = [...outside, url];
      return null;
    },
    browser_tab_rows_list: () => [],
    browser_tab_row_save: null,
    browser_tab_open: ({ args }: TabOpenArgs) => {
      tabs = [...tabs, args];
      return {
        id: `live-${tabs.length}`,
        sessionId: args.sessionId,
        url: args.url,
        title: '',
        state: 'live',
        isShown: false,
        hiddenSinceMs: null,
        openerId: null,
        isPasskeyBlocked: false,
      };
    },
    browser_tab_list: () => [],
    browser_tab_place: null,
    browser_tab_show: null,
    browser_tab_hide: null,
    browser_tab_close: null,
  });
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  outside = [];
  tabs = [];
  isOutsideRefused = false;
  reportError.mockClear();
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    reportError,
  });
  stubHost();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(ROWS)('$name', ({ url, run }) => {
  it('opens beside the session when Links says In Goodboy', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'goodboy' } });

    await run({ env: envOf() });

    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({ sessionId: SESSION_ID });
    expect(tabs[0]?.url).toBe(url);
    expect(outside).toEqual([]);
  });

  it('opens in your browser when Links says so', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'browser' } });

    await run({ env: envOf() });

    expect(outside).toEqual([url]);
    expect(tabs).toEqual([]);
  });

  it('returns the failure to the run line and reports nothing itself', async () => {
    store.setState({ settings: { [SETTING_LINKS_OPEN]: 'browser' } });
    isOutsideRefused = true;

    await expect(Promise.resolve(run({ env: envOf() }))).rejects.toThrow('no browser is installed');

    expect(reportError).not.toHaveBeenCalled();
  });
});
