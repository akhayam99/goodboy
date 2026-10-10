import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, Session, SessionId } from '@goodboy/types';
import { SETTING_EDITOR_BINARY } from '../../settings/settings';
import type { ActionDefinition, ActionEnv } from '../types';
import { DIFF_KIND, type DiffFacts } from './diff';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';
import { SESSION_KIND, type SessionFacts } from './session';

const { openInEditor, reportError } = vi.hoisted(() => ({
  openInEditor: vi.fn(async () => undefined),
  reportError: vi.fn(async () => undefined),
}));

vi.mock('../../../shared/lib/editor', () => ({ openInEditor }));

const envWith = ({ settings }: { readonly settings: Record<string, string> }): ActionEnv =>
  ({
    getState: () => ({ settings, reportError }),
  }) as unknown as ActionEnv;

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
  isRebasing: false,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
  editors: [],
};

const diffFacts: DiffFacts = { ...mountFacts, patch: 'diff --git a/a b/a', rebaseConflicts: 0 };

const sessionFacts: SessionFacts = {
  session: { id: 'session-harborline' } as Session,
  sessionId: 'session-harborline' as SessionId,
  title: 'Fix duplicate credit',
  isArchived: false,
  isPinned: false,
  canMovePinUp: false,
  canMovePinDown: false,
  isBranchless: false,
  hasMount: true,
  branch: 'hl/fix-duplicate-credit',
  worktreePath: '/work/payments-api',
  mounts: [],
  worktreePaths: ['/work/payments-api'],
  prUrl: null,
};

type Surface = {
  readonly name: string;
  readonly run: (params: { readonly env: ActionEnv }) => void | Promise<void>;
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
    openInEditor.mockClear();
    reportError.mockClear();
  });

  it.each(SURFACES)('$name opens the editor chosen in settings', async ({ run }) => {
    await run({ env: envWith({ settings: { [SETTING_EDITOR_BINARY]: 'zed' } }) });

    expect(openInEditor).toHaveBeenCalledWith({ path: '/work/payments-api', editor: 'zed' });
  });

  it.each(SURFACES)('$name falls back to code when nothing is chosen', async ({ run }) => {
    await run({ env: envWith({ settings: {} }) });

    expect(openInEditor).toHaveBeenCalledWith({ path: '/work/payments-api', editor: 'code' });
  });

  it.each(SURFACES)('$name reports a missing editor instead of swallowing it', async ({ run }) => {
    openInEditor.mockRejectedValueOnce(new Error("editor binary 'zed' not found in PATH"));

    await run({ env: envWith({ settings: { [SETTING_EDITOR_BINARY]: 'zed' } }) });

    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
  });

  it('mount menu keeps the submenu choice over the settings', async () => {
    const action = MOUNT_KIND.actions.find((candidate) => candidate.id === 'mount.openInEditor');

    await action?.run({
      facts: mountFacts,
      env: envWith({ settings: { [SETTING_EDITOR_BINARY]: 'zed' } }),
      choice: 'cursor',
    });

    expect(openInEditor).toHaveBeenCalledWith({ path: '/work/payments-api', editor: 'cursor' });
  });
});
