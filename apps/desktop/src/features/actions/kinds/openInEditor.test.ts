import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { ActionDefinition, ActionEnv } from '../types';
import { DIFF_KIND, type DiffFacts } from './diff';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';
import { SESSION_KIND, type SessionFacts } from './session';

const { openTargetOrThrow } = vi.hoisted(() => ({
  openTargetOrThrow: vi.fn(async (_params: unknown) => undefined),
}));

vi.mock('../../open/openTargetOrThrow', () => ({ openTargetOrThrow }));

const env = {} as unknown as ActionEnv;

const mountFacts: MountFacts = {
  sessionId: 'session-harborline' as SessionId,
  mountId: 'mount-payments' as MountId,
  projectId: 'project-payments' as ProjectId,
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

const diffFacts: DiffFacts = { ...mountFacts, patch: 'diff --git a/a b/a', rebaseConflicts: 0 };

const sessionFacts: SessionFacts = {
  session: aSession({ id: mountFacts.sessionId }),
  sessionId: 'session-harborline' as SessionId,
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

type Surface = {
  readonly name: string;
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
}): Surface['run'] => {
  const action = actions.find((candidate) => candidate.id === id);
  if (action === undefined) {
    throw new Error(`missing action ${id}`);
  }
  return ({ env }) => action.run({ facts, env, choice: null });
};

const SURFACES: ReadonlyArray<Surface> = [
  {
    name: 'session menu',
    run: runOf({ actions: SESSION_KIND.actions, id: 'session.editor', facts: sessionFacts }),
  },
  {
    name: 'diff menu',
    run: runOf({ actions: DIFF_KIND.actions, id: 'diff.openInEditor', facts: diffFacts }),
  },
  {
    name: 'mount menu',
    run: runOf({ actions: MOUNT_KIND.actions, id: 'mount.openInEditor', facts: mountFacts }),
  },
];

describe('open in editor from actions', () => {
  beforeEach(() => {
    openTargetOrThrow.mockClear();
  });

  it.each(SURFACES)('$name opens the worktree folder through the router', async ({ run }) => {
    await run({ env });

    expect(openTargetOrThrow).toHaveBeenCalledWith({
      target: { kind: 'folder', path: '/work/payments-api', editor: null },
      sessionId: 'session-harborline',
      event: { metaKey: false, ctrlKey: false },
    });
  });

  it.each(SURFACES)('$name hands a failure back to the run line', async ({ run }) => {
    openTargetOrThrow.mockRejectedValueOnce(new Error("editor binary 'zed' not found in PATH"));

    await expect(run({ env })).rejects.toThrow('not found in PATH');
  });

  it('mount menu keeps the submenu choice', async () => {
    const action = MOUNT_KIND.actions.find((candidate) => candidate.id === 'mount.openInEditor');

    await action?.run({ facts: mountFacts, env, choice: 'cursor' });

    expect(openTargetOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { kind: 'folder', path: '/work/payments-api', editor: 'cursor' },
      }),
    );
  });
});
