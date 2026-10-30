// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { brandedId } from '../../history/testing/brandedId';
import type { ActionDefinition, ActionEnv } from '../types';
import { EXPLORE_FILE_KIND, type ExploreFileFacts } from './exploreFile';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';
import { SESSION_KIND, type SessionFacts } from './session';
import { WORKTREE_KIND, type WorktreeFacts } from './worktree';

let store: StoryStore;
const reportError = vi.fn(async () => undefined);

const envOf = (): ActionEnv => ({
  getState: () => store.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
});

const opensOf = () =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === 'open_in_external_terminal')
    .map(([, args]) => args);

const noop = () => undefined;

const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });

const mountFacts: MountFacts = {
  sessionId: SESSION_ID,
  mountId: brandedId<MountId>({ value: 'mount-payments' }),
  projectId: brandedId<ProjectId>({ value: 'project-payments' }),
  label: 'hl/fix-duplicate-credit',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  mountBaseBranch: null,
  worktreePath: '/work/payments-api',
  keptPath: '/work/payments-api',
  isRepo: true,
  isClosed: false,
  isBranchGone: false,
  canRestoreBranch: false,
  pr: 'open',
  requestLabel: 'PR #318',
  requestNumber: 318,
  requestProvider: 'github',
  createProvider: 'github',
  ahead: 5,
  unpushed: 0,
  behind: 0,
  dirty: 0,
  isDiverged: false,
  onlyOnline: null,
  isRebasing: false,
  rebaseConflict: null,
  autoBlockedReason: null,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
  pinnedRunIds: [],
  pinnedRunLabel: null,
  editors: [],
};

const sessionFacts: SessionFacts = {
  session: aSession({ id: SESSION_ID }),
  sessionId: SESSION_ID,
  title: 'Fix duplicate credit',
  behindMountIds: [],
  mergedMountIds: [],
  mergedBranches: [],
  rebaseAllRunId: null,
  isRebaseAllRunning: false,
  isArchived: false,
  isPinned: false,
  isRefreshing: false,
  canMovePinUp: false,
  canMovePinDown: false,
  isBranchless: false,
  hasMount: true,
  hasLinkedIssues: false,
  branch: 'hl/fix-duplicate-credit',
  worktreePath: '/work/payments-api',
  mounts: [],
  worktreePaths: ['/work/payments-api'],
  prUrl: null,
  runningAgentCount: 0,
  hasUnread: false,
  canMarkUnread: false,
};

const worktreeFacts: WorktreeFacts = {
  path: '/work/payments-api',
  isInUse: false,
  isKept: false,
  removeIntent: 'safe',
  onReveal: noop,
  onEditor: noop,
  onKeep: noop,
  onStopKeeping: noop,
  onRemove: noop,
  onLearn: noop,
};

const folderFacts: ExploreFileFacts = {
  name: 'payments-api',
  relPath: 'apps/payments-api',
  absolutePath: '/work/settlement/apps/payments-api',
  isDir: true,
  openLabel: 'Open in editor',
  editorLabel: 'VS Code',
  onAsk: null,
  onOpen: noop,
  onReveal: noop,
};

type Surface = {
  readonly name: string;
  readonly path: string;
  readonly run: () => unknown;
};

const runOf = <F>({
  actions,
  id,
  facts,
}: {
  readonly actions: ReadonlyArray<ActionDefinition<F>>;
  readonly id: string;
  readonly facts: F;
}): Surface['run'] => {
  const action = actions.find((candidate) => candidate.id === id);
  if (action === undefined) {
    throw new Error(`missing action ${id}`);
  }
  return () => action.run({ facts, env: envOf(), choice: null });
};

const SURFACES: ReadonlyArray<Surface> = [
  {
    name: 'session menu',
    path: '/work/payments-api',
    run: runOf({ actions: SESSION_KIND.actions, id: 'session.terminalApp', facts: sessionFacts }),
  },
  {
    name: 'mount menu',
    path: '/work/payments-api',
    run: runOf({ actions: MOUNT_KIND.actions, id: 'mount.openInTerminalApp', facts: mountFacts }),
  },
  {
    name: 'worktree menu',
    path: '/work/payments-api',
    run: runOf({
      actions: WORKTREE_KIND.actions,
      id: 'worktree.terminalApp',
      facts: worktreeFacts,
    }),
  },
  {
    name: 'files folder menu',
    path: '/work/settlement/apps/payments-api',
    run: runOf({
      actions: EXPLORE_FILE_KIND.actions,
      id: 'exploreFile.openInTerminalApp',
      facts: folderFacts,
    }),
  },
];

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('open in terminal app from actions', () => {
  beforeEach(async () => {
    await resetStoryStore();
    reportError.mockClear();
    store.setState({ reportError });
    stubStoryInvoke({ open_in_external_terminal: null });
  });

  afterEach(() => {
    storySpies.tauriInvoke.mockClear();
  });

  it.each(SURFACES)('$name opens that folder in the terminal app', async ({ run, path }) => {
    await run();

    expect(opensOf()).toEqual([{ path }]);
  });

  it.each(SURFACES)('$name reports a failed handoff instead of swallowing it', async ({ run }) => {
    stubStoryInvoke({
      open_in_external_terminal: () => {
        throw new Error('cannot open /work/payments-api');
      },
    });

    await run();

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
  });

  it('keeps the files menu entry to folders', () => {
    const action = EXPLORE_FILE_KIND.actions.find(
      (candidate) => candidate.id === 'exploreFile.openInTerminalApp',
    );

    expect(action?.when({ facts: folderFacts })).toBe(true);
    expect(action?.when({ facts: { ...folderFacts, isDir: false } })).toBe(false);
  });
});
