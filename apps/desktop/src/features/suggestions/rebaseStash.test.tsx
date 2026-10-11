import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { aProject, aSession } from '@goodboy/types/testing';
import { A_REBASE_SESSION_ID, A_REBASE_MOUNT_ID } from '../history/testing/aRebaseRun';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../store/slices/worktreeStatuses/cache';
import { ToastProvider } from '../../shared/components/Toast';
import { useSuggestionActions } from './useSuggestionActions';
import { deriveNextSteps } from './deriveNextSteps';
import { useSessionSuggestions } from './useSessionSuggestions';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../store/storyHarness')).dbModuleMock({
    listNudgeEvents: vi.fn(async () => []),
  }),
);

let store: Awaited<ReturnType<typeof importStore>>;
beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
});

type Props = { readonly children: ReactNode };
const wrapper = ({ children }: Props) => <ToastProvider>{children}</ToastProvider>;
const session = aSession({ id: A_REBASE_SESSION_ID });

describe('the rebase suggestion with dirty files', () => {
  it('keeps the rebase target and count while the row describes its distance', async () => {
    const project = aProject({ name: 'payments-api', baseBranch: 'main' });
    store.setState({
      projects: [project],
      sessions: [session],
      sessionProjectMounts: {
        [session.id]: [
          {
            mountId: A_REBASE_MOUNT_ID,
            sessionId: session.id,
            projectId: project.id,
            mountName: 'payments-api',
            worktreePath: '/w/payments-api',
            lastWorktreePath: null,
            repoRoot: '/repos/payments-api',
            branch: 'hl/ledger-export',
            baseBranch: 'main',
            parallelIndex: 0,
            isAttached: true,
            diskState: 'present',
            revision: 1,
          },
        ],
      },
    });
    stubStoryInvoke({
      worktree_status: () => ({
        branch: 'hl/ledger-export',
        head: 'old-head',
        headSubject: 'Acme export',
        upstream: null,
        mainDistance: { kind: 'known', ahead: 7, behind: 4 },
        upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
        workingTree: {
          kind: 'known',
          staged: 4,
          unstaged: 5,
          untracked: 2,
          unmerged: 0,
          changed: 11,
        },
        inProgress: null,
      }),
    });
    const { result } = renderHook(() => useSessionSuggestions({ session }));
    await waitFor(() => {
      const rebase = result.current.find((candidate) => candidate.kind === 'rebase-project');
      expect(rebase?.detail).toBe('4 behind');
      expect(rebase?.payload.targets[0]?.dirtyCount).toBe(11);
    });
  });
  it('offers Rebase and leaves overlap consent to the move', () => {
    const suggestions = deriveNextSteps({
      sessionId: session.id,
      workflowRuns: [],
      plans: [],
      consumedPlanIds: new Set(),
      openQuestionCount: 0,
      hasPullRequest: false,
      eligibleThreadCount: 0,
      mountEvents: [],
      projects: [
        {
          id: 'payments-api',
          mountId: A_REBASE_MOUNT_ID,
          projectId: aProject({ name: 'payments-api' }).id,
          projectName: 'payments-api',
          branch: 'hl/ledger-export',
          worktreePath: '/w/payments-api',
          baseBranch: 'main',
          mainDistance: 4,
          isClean: false,
          changedCount: 11,
        },
      ],
    });
    const suggestion = suggestions.find((candidate) => candidate.kind === 'rebase-project');
    if (suggestion === undefined) {
      throw new Error('Missing rebase suggestion');
    }
    const { result } = renderHook(
      () => useSuggestionActions({ session, agents: [], onSelectQuestions: () => undefined }),
      { wrapper },
    );
    const actions = result.current({ suggestion });
    expect(actions.primary?.label).toBe('Rebase');
    expect(actions.primary?.isDisabled).toBe(false);
    expect(actions.extras).toBeUndefined();
  });
});
