// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../chat/turn', async () =>
  (await import('../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../worktree/worktree', async () =>
  (await import('../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../providers/routing', async () =>
  (await import('../../../store/storyHarness')).routingModuleMock(),
);

vi.mock('../../permissions/permissions', async () =>
  (await import('../../../store/storyHarness')).permissionsModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { insertSession, insertWorkspace } from '@goodboy/db';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { ToastProvider } from '../../../shared/components/Toast';
import { checksAnalyzeSeed } from '../../../app/components/MockScene/scenes/u24/checksAnalyzeSeed';
import { BranchChecks } from '../components/BranchChecks';
import { analyzeFailingChecks } from './analyzeFailingChecks';
import { resetWorktreeStatusCache } from '../../../store/runtime/worktreeStatuses/cache';
import { useSuggestionActions } from '../../suggestions/useSuggestionActions';
import {
  brandId,
  type IsoDateTime,
  type ProviderRunId,
  type PullRequestView,
} from '@goodboy/types';
import { startCheckFix } from './startCheckFix';
import { stopRequests } from '../../../store/slices/turn/stopRequests';
import { withPullRequestViewEntry } from '../../../store/slices/pull-request-view/pullRequestViewAt';
import type { SessionDiff } from '../../diff/hooks/useSessionDiff';
import type { BranchReviewCounts } from '../branchPrimary';
import { BranchCheckWorkLine } from '../components/BranchCheckWorkLine';
import { BranchHeader } from '../components/BranchHeader';
import { useBranchControls } from '../hooks/useBranchControls';
import { useFixLaunch } from '../../resolve/components/FixCommentsDrawer/useFixLaunch';

let store: StoryStore;
let seed: ReturnType<typeof checksAnalyzeSeed>;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  vi.clearAllMocks();
  await resetStoryStore();
  resetWorktreeStatusCache();
  const status = await storySpies.worktreeStatus('/mock/payments-api');
  storySpies.worktreeStatus.mockResolvedValue(
    Object.assign({}, status, { mainDistance: { kind: 'known', behind: 0, ahead: 0 } }),
  );
  storySpies.worktreeChangedFiles.mockResolvedValue(
    Object.assign(
      { files: [], numstat: '' },
      { paths: ['src/ledger.ts'], entries: [], additions: 0, deletions: 0 },
    ),
  );
  seed = checksAnalyzeSeed({ phase: 'failing' });
  const db = await openStorySqlite();
  const session = store.getState().sessions.find((row) => row.id === seed.sessionId);
  if (session === undefined) {
    throw new Error('The seeded session is missing');
  }
  await insertWorkspace({ db, workspace: buildStoryWorkspace({ id: session.workspaceId }) });
  await insertSession(db, aSession({ id: session.id, workspaceId: session.workspaceId }));
  storySpies.tauriInvoke.mockImplementation(async (command, args) => {
    if (command === 'gh_run') {
      const input: unknown = args;
      const hasFiles =
        typeof input === 'object' &&
        input !== null &&
        'args' in input &&
        Array.isArray(input.args) &&
        input.args.includes('files');
      return {
        stdout: hasFiles ? 'src/ledger.ts\nsrc/ledger.test.ts\n' : 'Assertion failed',
        stderr: '',
        exitCode: 0,
      };
    }
    return null;
  });
});
afterEach(async () => {
  await waitFor(() =>
    expect(Object.values(store.getState().sessionCreations).flat().length).toBe(0),
  );
  await waitFor(() =>
    expect(
      Object.values(store.getState().agentTurnState).some(
        (turn) => turn.kind === 'starting' || turn.kind === 'running',
      ),
    ).toBe(false),
  );
  cleanup();
  vi.restoreAllMocks();
});

type ShowParams = { readonly phase?: 'failing' | 'running' | 'proposal' | 'no-fix' };

const STEP_REVIEW: BranchReviewCounts = {
  accepted: 0,
  replies: 0,
  failed: 0,
  isPushing: false,
  push: { state: 'idle', count: 0 },
};

const stepDiff = (): SessionDiff => ({
  files: [],
  patch: '',
  loading: false,
  isRefreshing: false,
  bodies: null,
  error: null,
  view: { kind: 'branch' },
  setView: vi.fn(),
  alternate: null,
  commits: [],
  status: null,
  metaError: null,
  refresh: vi.fn(),
  viewed: { stateOf: () => 'none', onToggle: vi.fn() },
  focusPath: null,
  focusThreadId: null,
  clearFocus: vi.fn(),
});

const StepHeader = () => {
  const controls = useBranchControls({
    sessionId: seed.sessionId,
    worktreePath: seed.repo.worktreePath,
    pr: seed.pullRequest,
    diff: stepDiff(),
    review: STEP_REVIEW,
    facts: { checks: 'failing', hasConflicts: false },
    mergeLabel: 'Squash and merge',
  });
  return (
    <>
      <BranchHeader
        sessionId={seed.sessionId}
        pr={seed.pullRequest}
        fallbackTitle={seed.repo.branch}
        controls={controls}
        isPushBusy={false}
        isPrimaryYielding={false}
        tab="files"
        canEditTitle={false}
        onMutated={() => undefined}
      />
      {controls.checkWork.agentId === null ? null : (
        <BranchCheckWorkLine
          sessionId={seed.sessionId}
          agentId={controls.checkWork.agentId}
          isFixing={controls.checkWork.chain === 'fixing'}
          checkName={controls.checkWork.checkName}
        />
      )}
      <span data-testid="step-note">{controls.primary?.note ?? ''}</span>
    </>
  );
};

const showStep = ({ phase = 'failing' }: ShowParams = {}) => {
  if (phase !== 'failing') {
    seed = checksAnalyzeSeed({ phase });
  }
  return render(
    <ToastProvider>
      <StepHeader />
    </ToastProvider>,
  );
};

const headerStep = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-branch-primary]');

type PortHost = 'gitlab' | 'bitbucket';

const portJobUrl = (host: PortHost, job: number): string =>
  `https://${host}.example/northwind/payments-api/jobs/${job}`;

type PortViewParams = {
  readonly host: PortHost;
  readonly runs: PullRequestView['checks']['runs'];
};

const seedPortView = ({ host, runs }: PortViewParams): void => {
  const github = store.getState().mountGithub[seed.repo.mountId];
  if (github === undefined) {
    throw new Error('The seeded branch is missing');
  }
  const view: PullRequestView = {
    host,
    number: seed.pullRequest.number,
    title: seed.pullRequest.title,
    body: '',
    url: `https://${host}.example/northwind/payments-api/pull/${seed.pullRequest.number}`,
    state: 'open',
    isDraft: false,
    author: null,
    baseBranch: seed.pullRequest.baseBranch,
    headBranch: seed.pullRequest.headBranch,
    headSha: null,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-06T10:00:00Z',
    mergedAt: null,
    mergeable: null,
    reviewDecision: null,
    reviewers: [],
    resolves: [],
    checks: { read: 'ok', error: null, runs },
    files: { count: 0, first: [] },
    commits: [],
    mergeMethods: ['squash'],
    mergeMethodReasons: {},
  };
  store.setState({
    mountGithub: { [seed.repo.mountId]: { ...github, pr: null, detail: null } },
    pullRequestViews: withPullRequestViewEntry({
      views: {},
      sessionId: seed.sessionId,
      entry: {
        prNumber: seed.pullRequest.number,
        mountId: seed.repo.mountId,
        view,
        isLoading: false,
        error: null,
        fetchedAt: brandId<IsoDateTime>({ value: '2026-10-07T09:00:00.000Z' }),
        edits: [],
      },
    }),
  });
};

describe('the branch header step runs the Overview chain on any tab', () => {
  it('starts one Debugger at the first Fix checks and ignores a second press while it starts', async () => {
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
    showStep();
    expect(headerStep()?.textContent).toBe('Fix checks');
    expect(screen.getByTestId('step-note').textContent).toMatch(
      /^Starts a Debugger on the failing checks with .+ at \w+ effort$/,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fix checks' }));
    fireEvent.click(headerStep() ?? document.body);

    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    expect(spawn).toHaveBeenCalledWith(
      seed.sessionId,
      expect.objectContaining({ kindOverride: 'ci-debugger', sourceKind: 'failed_check' }),
    );
  });

  it('names a failed start, keeps the agents, and starts on the next press', async () => {
    injectDbFault({ match: /INSERT INTO agents/, message: 'Could not create the Debugger' });
    showStep();

    fireEvent.click(screen.getByRole('button', { name: 'Fix checks' }));

    await waitFor(() =>
      expect(
        store
          .getState()
          .notifications.some((notice) => notice.title === "Couldn't start the Debugger"),
      ).toBe(true),
    );
    expect(store.getState().sessionPhaseRuns[seed.sessionId]).toEqual([]);
    await waitFor(() => expect(headerStep()?.hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Fix checks' }));
    await waitFor(() => expect(store.getState().sessionPhaseRuns[seed.sessionId]?.length).toBe(1));
  });

  it('moves on to Start fix once the Debugger proposed one, and starts the fixer', async () => {
    showStep({ phase: 'proposal' });
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');

    expect(headerStep()?.textContent).toBe('Start fix');
    fireEvent.click(screen.getByRole('button', { name: 'Start fix' }));

    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    expect(spawn).toHaveBeenCalledWith(
      seed.sessionId,
      expect.objectContaining({ kindOverride: 'ci-fixer' }),
    );
  });

  it.each(['gitlab', 'bitbucket'] as const)(
    'reads the failing checks of a %s pull request and starts one Debugger on them',
    async (host) => {
      seedPortView({
        host,
        runs: [
          { name: 'unit', conclusion: 'success', detailsUrl: null, durationMs: 61000 },
          {
            name: 'lint',
            conclusion: 'failure',
            detailsUrl: portJobUrl(host, 7),
            durationMs: 12000,
          },
        ],
      });
      const spawn = vi.spyOn(store.getState(), 'spawnAgent');
      render(
        <ToastProvider>
          <StepHeader />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Fix checks' }));

      await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
      expect(spawn.mock.calls[0]?.[1].initialPrompt).toContain('lint');
      expect(spawn.mock.calls[0]?.[1].initialPrompt).not.toContain('Check: unit');
    },
  );

  it.each(['gitlab', 'bitbucket'] as const)(
    'starts the fixer on a %s pull request from the header',
    async (host) => {
      seed = checksAnalyzeSeed({ phase: 'proposal' });
      seedPortView({
        host,
        runs: [
          {
            name: 'test',
            conclusion: 'failure',
            detailsUrl: seed.check.detailsUrl,
            durationMs: 12000,
          },
        ],
      });
      const startFollowUp = vi.spyOn(store.getState(), 'startFollowUp');
      render(
        <ToastProvider>
          <StepHeader />
        </ToastProvider>,
      );

      expect(headerStep()?.textContent).toBe('Start fix');
      fireEvent.click(screen.getByRole('button', { name: 'Start fix' }));

      await waitFor(() => expect(startFollowUp).toHaveBeenCalledTimes(1));
      expect(startFollowUp).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceAgentId: seed.agent.id,
          kind: 'ci-fixer',
          mountId: seed.repo.mountId,
          origin: { sourceKind: 'failed_check', sourceCommentUrl: seed.check.detailsUrl },
        }),
      );
      expect(
        store
          .getState()
          .notifications.some((notice) => notice.title === "Couldn't start the Implementer"),
      ).toBe(false);
    },
  );

  it.each(['gitlab', 'bitbucket'] as const)(
    'pushes the check fix on a %s pull request from the header',
    async (host) => {
      seed = checksAnalyzeSeed({ phase: 'proposal' });
      seedPortView({
        host,
        runs: [
          {
            name: 'test',
            conclusion: 'failure',
            detailsUrl: seed.check.detailsUrl,
            durationMs: 12000,
          },
        ],
      });
      const fix = anAgent({
        sessionId: seed.sessionId,
        parentAgentId: seed.agent.id,
        ordinal: 2,
        status: 'completed',
        sourceKind: 'failed_check',
        sourceCommentUrl: seed.check.detailsUrl ?? '',
      });
      store.setState({
        sessionPhaseRuns: { [seed.sessionId]: [seed.agent, fix] },
        agentTurnState: {
          ...store.getState().agentTurnState,
          [fix.id]: { kind: 'ended', endedAt: seed.agent.startedAt ?? seed.events[0]!.at },
        },
        checkFixCommits: {
          [fix.id]: {
            kind: 'found',
            sha: 'b24cd5e',
            subject: 'Guard the retry',
            count: 1,
            unpushed: 1,
          },
        },
      });
      const pushBranch = vi.spyOn(store.getState(), 'pushBranch').mockResolvedValue({ ok: true });
      const readCheckFixCommit = vi
        .spyOn(store.getState(), 'readCheckFixCommit')
        .mockResolvedValue(undefined);
      render(
        <ToastProvider>
          <StepHeader />
        </ToastProvider>,
      );

      expect(headerStep()?.textContent).toBe('Push fix');
      readCheckFixCommit.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Push fix' }));

      await waitFor(() => expect(pushBranch).toHaveBeenCalledTimes(1));
      expect(pushBranch).toHaveBeenCalledWith({
        sessionId: seed.sessionId,
        mountId: seed.repo.mountId,
        mode: 'plain',
      });
      await waitFor(() =>
        expect(readCheckFixCommit).toHaveBeenCalledWith({
          sessionId: seed.sessionId,
          mountId: seed.repo.mountId,
          fixAgentId: fix.id,
        }),
      );
    },
  );

  it('draws no Fix checks while the pushed fix waits for a new run, then reads the new run', () => {
    seed = checksAnalyzeSeed({ phase: 'proposal' });
    const fix = anAgent({
      sessionId: seed.sessionId,
      parentAgentId: seed.agent.id,
      ordinal: 2,
      status: 'completed',
      sourceKind: 'failed_check',
      sourceCommentUrl: seed.check.detailsUrl ?? '',
    });
    store.setState({
      sessionPhaseRuns: { [seed.sessionId]: [seed.agent, fix] },
      agentTurnState: {
        ...store.getState().agentTurnState,
        [fix.id]: { kind: 'ended', endedAt: seed.agent.startedAt ?? seed.events[0]!.at },
      },
      checkFixCommits: {
        [fix.id]: {
          kind: 'found',
          sha: 'b24cd5e',
          subject: 'Guard the retry',
          count: 1,
          unpushed: 0,
        },
      },
    });
    vi.spyOn(store.getState(), 'readCheckFixCommit').mockResolvedValue(undefined);
    const view = render(
      <ToastProvider>
        <StepHeader />
      </ToastProvider>,
    );

    expect(headerStep()).toBeNull();

    const github = store.getState().mountGithub[seed.repo.mountId];
    const detail = github?.detail;
    if (github === undefined || detail == null) {
      throw new Error('The seeded branch is missing');
    }
    act(() =>
      store.setState({
        mountGithub: {
          [seed.repo.mountId]: {
            ...github,
            detail: {
              ...detail,
              checks: detail.checks.map((check) =>
                check.conclusion === 'failure'
                  ? { ...check, detailsUrl: `${check.detailsUrl}/rerun` }
                  : check,
              ),
            },
          },
        },
      }),
    );

    expect(headerStep()?.textContent).toBe('Fix checks');
    view.unmount();
  });

  it('starts the fixer on the check the header shows, not on the latest analyzed one', async () => {
    seed = checksAnalyzeSeed({ phase: 'proposal' });
    const github = store.getState().mountGithub[seed.repo.mountId];
    if (github?.detail == null) {
      throw new Error('The seeded branch is missing');
    }
    const lintUrl = 'https://github.com/harborline/payments-api/actions/runs/31/job/99';
    const lint = anAgent({
      sessionId: seed.sessionId,
      ordinal: 2,
      status: 'completed',
      sourceKind: 'failed_check',
      sourceCommentUrl: lintUrl,
    });
    store.setState({
      sessionPhaseRuns: { [seed.sessionId]: [seed.agent, lint] },
      agentTurnState: {
        ...store.getState().agentTurnState,
        [lint.id]: { kind: 'ended', endedAt: seed.agent.startedAt ?? seed.events[0]!.at },
      },
      transcripts: {
        ...store.getState().transcripts,
        [lint.id]: seed.events.map((event) =>
          event.kind === 'user_text'
            ? { ...event, text: event.text.replaceAll(seed.check.name, 'payments-api / lint') }
            : event,
        ),
      },
      mountGithub: {
        [seed.repo.mountId]: {
          ...github,
          detail: {
            ...github.detail,
            checks: [
              ...github.detail.checks.filter((check) => check.conclusion === 'failure'),
              { ...seed.check, name: 'payments-api / lint', detailsUrl: lintUrl },
            ],
          },
        },
      },
    });
    const startFollowUp = vi.spyOn(store.getState(), 'startFollowUp');
    render(
      <ToastProvider>
        <StepHeader />
      </ToastProvider>,
    );

    expect(headerStep()?.textContent).toBe('Start fix');
    fireEvent.click(screen.getByRole('button', { name: 'Start fix' }));

    await waitFor(() => expect(startFollowUp).toHaveBeenCalledTimes(1));
    expect(startFollowUp).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAgentId: seed.agent.id,
        origin: { sourceKind: 'failed_check', sourceCommentUrl: seed.check.detailsUrl },
      }),
    );
  });

  it('counts an action_required check as failing, so Fix checks starts a Debugger on it', async () => {
    const github = store.getState().mountGithub[seed.repo.mountId];
    if (github?.detail == null) {
      throw new Error('The seeded branch is missing');
    }
    store.setState({
      mountGithub: {
        [seed.repo.mountId]: {
          ...github,
          detail: {
            ...github.detail,
            checks: github.detail.checks.map((check) =>
              check.conclusion === 'failure'
                ? { ...check, conclusion: 'action_required' as const }
                : check,
            ),
          },
        },
      },
    });
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
    showStep();

    fireEvent.click(screen.getByRole('button', { name: 'Fix checks' }));

    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    expect(spawn.mock.calls[0]?.[1].initialPrompt).toContain(seed.check.name);
  });

  it('offers Fix checks again after an empty finding', () => {
    showStep({ phase: 'no-fix' });

    expect(headerStep()?.textContent).toBe('Fix checks');
  });

  it('draws no fill while the Debugger works, and a line under the tabs stops it', () => {
    const cancelCurrentTurn = vi
      .spyOn(store.getState(), 'cancelCurrentTurn')
      .mockResolvedValue(undefined);
    showStep({ phase: 'running' });

    expect(headerStep()).toBeNull();
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(0);
    expect(screen.getByTestId('branch-check-work').textContent).toContain(
      `Analyzing ${seed.check.name}`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(cancelCurrentTurn).toHaveBeenCalledWith(seed.sessionId, seed.agent.id, 'user');
    act(() =>
      store.setState({
        agentTurnState: {
          [seed.agent.id]: { kind: 'ended', endedAt: seed.agent.startedAt ?? seed.events[0]!.at },
        },
      }),
    );
  });
});

const LINT_URL = 'https://github.com/harborline/payments-api/actions/runs/31/job/99';
const LINT_NAME = 'payments-api / lint';
const ANALYZING = 'A Debugger is analyzing payments-api / test';

const addFailingLintFirst = (): void => {
  const github = store.getState().mountGithub[seed.repo.mountId];
  if (github?.detail == null) {
    throw new Error('The seeded branch is missing');
  }
  const detail = {
    ...github.detail,
    checks: [{ ...seed.check, name: LINT_NAME, detailsUrl: LINT_URL }, ...github.detail.checks],
  };
  const session = store.getState().sessionGithub[seed.sessionId];
  store.setState({
    mountGithub: { [seed.repo.mountId]: { ...github, detail } },
    ...(session === undefined
      ? {}
      : { sessionGithub: { [seed.sessionId]: { ...session, detail } } }),
  });
};

describe('one agent per branch, whichever door starts it', () => {
  afterEach(() => {
    cleanup();
    store.setState({ agentTurnState: {} });
  });

  it('draws the work line and no fill while a Debugger works on the second check', () => {
    seed = checksAnalyzeSeed({ phase: 'running' });
    addFailingLintFirst();
    render(
      <ToastProvider>
        <StepHeader />
      </ToastProvider>,
    );

    expect(headerStep()).toBeNull();
    expect(screen.getByTestId('branch-check-work').textContent).toContain(
      `Analyzing ${seed.check.name}`,
    );
    expect(screen.getAllByRole('button', { name: 'Stop' })).toHaveLength(1);
  });

  it('refuses Analyze on another check while a Debugger works, and starts nothing', async () => {
    seed = checksAnalyzeSeed({ phase: 'running' });
    addFailingLintFirst();
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');

    await expect(
      analyzeFailingChecks({
        sessionId: seed.sessionId,
        mountId: seed.repo.mountId,
        pullRequest: seed.pullRequest,
        checks: [{ ...seed.check, name: LINT_NAME, detailsUrl: LINT_URL }],
      }),
    ).rejects.toThrow(ANALYZING);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('offers Stop again once a stop request stalled, and reads working, not stopping', () => {
    seed = checksAnalyzeSeed({ phase: 'running' });
    const turn = store.getState().agentTurnState[seed.agent.id];
    if (turn?.kind !== 'running') {
      throw new Error('The seeded Debugger is not running');
    }
    render(
      <ToastProvider>
        <BranchCheckWorkLine
          sessionId={seed.sessionId}
          agentId={seed.agent.id}
          isFixing={false}
          checkName={seed.check.name}
        />
      </ToastProvider>,
    );

    act(() => stopRequests.request({ agentId: seed.agent.id, runId: turn.runId, at: Date.now() }));
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();

    act(() =>
      stopRequests.request({ agentId: seed.agent.id, runId: turn.runId, at: Date.now() - 10_000 }),
    );
    expect(screen.getAllByRole('button', { name: 'Stop' })).toHaveLength(1);
    expect(screen.getByTestId('branch-check-work').textContent).toContain(
      `Analyzing ${seed.check.name}`,
    );
    act(() => stopRequests.settle({ agentId: seed.agent.id }));
  });

  it('disables the row Analyze of another check', () => {
    seed = checksAnalyzeSeed({ phase: 'running' });
    addFailingLintFirst();
    render(
      <ToastProvider>
        <BranchChecks sessionId={seed.sessionId} />
      </ToastProvider>,
    );

    expect(screen.getByRole('button', { name: 'Analyze' }).hasAttribute('disabled')).toBe(true);
  });

  it('disables the Overview card verb and names what runs', async () => {
    seed = checksAnalyzeSeed({ phase: 'running' });
    addFailingLintFirst();
    const session = store.getState().sessions[0];
    if (session === undefined) {
      throw new Error('The session is missing');
    }
    const { result } = renderHook(
      () => useSuggestionActions({ session, agents: [], onSelectQuestions: () => undefined }),
      { wrapper: ToastProvider },
    );

    const actions = result.current({
      suggestion: {
        id: 'fix-checks',
        kind: 'fix-checks',
        sessionId: session.id,
        priority: 0,
        band: 1,
        title: 'Fix failing checks',
        fingerprint: 'failed',
        targetKey: null,
        payload: {
          mountId: seed.repo.mountId,
          projectName: 'payments-api',
          prNumber: seed.pullRequest.number,
        },
      },
    });

    expect(actions.primary?.isDisabled).toBe(true);
    expect(actions.primary?.blockedReason).toBe(ANALYZING);
    await expect(actions.primary?.run()).rejects.toThrow(ANALYZING);
  });

  it('refuses Start fix on one check while a Debugger works on another', async () => {
    seed = checksAnalyzeSeed({ phase: 'proposal' });
    const lint = anAgent({
      sessionId: seed.sessionId,
      ordinal: 2,
      status: 'running',
      sourceKind: 'failed_check',
      sourceCommentUrl: LINT_URL,
      mountId: seed.repo.mountId,
    });
    const startedAt = brandId<IsoDateTime>({ value: '2026-10-10T09:41:00.000Z' });
    store.setState({
      sessionPhaseRuns: { [seed.sessionId]: [seed.agent, lint] },
      agentTurnState: {
        ...store.getState().agentTurnState,
        [lint.id]: {
          kind: 'running',
          runId: brandId<ProviderRunId>({ value: 'run-lint' }),
          startedAt,
        },
      },
    });
    const startFollowUp = vi.spyOn(store.getState(), 'startFollowUp');

    await expect(
      startCheckFix({
        sessionId: seed.sessionId,
        url: seed.check.detailsUrl ?? '',
        mountId: seed.repo.mountId,
      }),
    ).rejects.toThrow('A Debugger is analyzing a failing check');
    expect(startFollowUp).not.toHaveBeenCalled();
    store.setState({ agentTurnState: {} });
  });

  it('blocks the Fix comments launch while a Debugger works on the branch', async () => {
    seed = checksAnalyzeSeed({ phase: 'running' });
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
    const { result } = renderHook(() =>
      useFixLaunch({
        sessionId: seed.sessionId,
        mountId: seed.repo.mountId,
        routing: { provider: 'anthropic', model: 'sonnet-5.5', effort: 'medium' },
        threadIds: ['thread-1'],
        hint: '',
        onStarted: () => undefined,
      }),
    );

    expect(result.current.blockedReason).toBe(ANALYZING);
    await act(async () => {
      await result.current.start('apply');
    });

    expect(result.current.error).toBe(ANALYZING);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('starts one Debugger when two checks are analyzed at once from this window', async () => {
    addFailingLintFirst();
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
    const first = analyzeFailingChecks({
      sessionId: seed.sessionId,
      mountId: seed.repo.mountId,
      pullRequest: seed.pullRequest,
      checks: [seed.check],
    });

    await expect(
      analyzeFailingChecks({
        sessionId: seed.sessionId,
        mountId: seed.repo.mountId,
        pullRequest: seed.pullRequest,
        checks: [{ ...seed.check, name: LINT_NAME, detailsUrl: LINT_URL }],
      }),
    ).rejects.toThrow('A Debugger is already starting on another check of this branch');
    await first;
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
