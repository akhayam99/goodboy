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
  rowsOf,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { ToastProvider } from '../../../shared/components/Toast';
import { checksAnalyzeSeed } from '../../../app/components/MockScene/scenes/u24/checksAnalyzeSeed';
import { BranchChecks } from '../components/BranchChecks';
import { START_HINT_SCOPES } from '../../../store/slices/startHints/startHintScopes';
import { analyzeFailingChecks } from './analyzeFailingChecks';
import { resetWorktreeStatusCache } from '../../../store/runtime/worktreeStatuses/cache';
import { useSuggestionActions } from '../../suggestions/useSuggestionActions';
import { brandId, type IsoDateTime, type PullRequestView } from '@goodboy/types';
import { withPullRequestViewEntry } from '../../../store/slices/pull-request-view/pullRequestViewAt';
import type { SessionDiff } from '../../diff/hooks/useSessionDiff';
import type { BranchReviewCounts } from '../branchPrimary';
import { BranchCheckWorkLine } from '../components/BranchCheckWorkLine';
import { BranchHeader } from '../components/BranchHeader';
import { useBranchControls } from '../hooks/useBranchControls';

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
const show = ({ phase = 'failing' }: ShowParams = {}) => {
  if (phase !== 'failing') {
    seed = checksAnalyzeSeed({ phase });
  }
  return render(
    <ToastProvider>
      <BranchChecks sessionId={seed.sessionId} />
    </ToastProvider>,
  );
};

describe('Analyze with the real store and SQLite', () => {
  it('spawns one CI debugger from a failing row with the check kickoff', async () => {
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    expect(spawn).toHaveBeenCalledWith(
      seed.sessionId,
      expect.objectContaining({
        kindOverride: 'ci-debugger',
        name: `CI fix · ${seed.check.name} · #${seed.pullRequest.number}`,
        sourceKind: 'failed_check',
        sourceCommentUrl: seed.check.detailsUrl,
        mountId: seed.repo.mountId,
        focus: 'none',
        initialPrompt: expect.stringContaining(seed.check.name),
      }),
    );
    await waitFor(() => expect(store.getState().sessionPhaseRuns[seed.sessionId]?.length).toBe(1));
    await waitFor(() => expect(storySpies.runTurn).toHaveBeenCalled());
    expect(storySpies.runTurn.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ prompt: expect.stringContaining(seed.check.name) }),
    );
    expect(await rowsOf({ sql: 'SELECT kind, source_kind FROM agents' })).toEqual([
      { kind: 'ci-debugger', source_kind: 'failed_check' },
    ]);
  });
  it('captures the mount across a late log read and coalesces repeated starts', async () => {
    let release: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    storySpies.tauriInvoke.mockImplementationOnce(async () => {
      await wait;
      return { stdout: 'Assertion failed', stderr: '', exitCode: 0 };
    });
    const first = analyzeFailingChecks({
      ...seed,
      mountId: seed.repo.mountId,
      checks: [seed.check],
    });
    const second = analyzeFailingChecks({
      ...seed,
      mountId: seed.repo.mountId,
      checks: [seed.check],
    });
    const other = aSession({ workspaceId: store.getState().sessions[0]?.workspaceId });
    store.setState({
      currentSessionId: other.id,
      sessionActiveMount: {},
      sessionActiveProject: {},
    });
    release?.();
    expect(await first).toBe(await second);
    expect(store.getState().sessionPhaseRuns[seed.sessionId]?.[0]?.sourceCommentUrl).toBe(
      seed.check.detailsUrl,
    );
    expect(store.getState().selectedAgentId).toEqual({});
    const calls = storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'gh_run');
    expect(
      calls.every(
        ([, args]) =>
          typeof args === 'object' &&
          args !== null &&
          'cwd' in args &&
          args.cwd === seed.repo.worktreePath &&
          'projectId' in args &&
          args.projectId === seed.repo.projectId,
      ),
    ).toBe(true);
  });
  it('keeps agents unchanged on insertion failure and retries successfully', async () => {
    injectDbFault({ match: /INSERT INTO agents/, message: 'Could not create the Debugger' });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() =>
      expect(
        store
          .getState()
          .notifications.some((notice) => notice.title === "Couldn't start the Debugger"),
      ).toBe(true),
    );
    expect(store.getState().sessionPhaseRuns[seed.sessionId]).toEqual([]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Analyze' }).hasAttribute('disabled')).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() => expect(store.getState().sessionPhaseRuns[seed.sessionId]?.length).toBe(1));
  });
  it.each([
    { phase: 'running' as const, label: 'Analyzing', canRetry: false },
    { phase: 'proposal' as const, label: 'Fix proposed', canRetry: false },
    { phase: 'no-fix' as const, label: 'No fix found', canRetry: true },
  ])('derives $label from the agent and transcript', async ({ phase, label, canRetry }) => {
    show({ phase });
    expect(screen.getByText(label)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Analyze' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Analyze again' }) !== null).toBe(canRetry);
    if (phase === 'running') {
      act(() =>
        store.setState({
          agentTurnState: {
            [seed.agent.id]: { kind: 'ended', endedAt: seed.agent.startedAt ?? seed.events[0]!.at },
          },
        }),
      );
    }
  });
  it('Analyze again starts a new attempt after an empty finding', async () => {
    show({ phase: 'no-fix' });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze again' }));
    await waitFor(() =>
      expect(
        store
          .getState()
          .sessionPhaseRuns[seed.sessionId]?.some((agent) => agent.id !== seed.agent.id),
      ).toBe(true),
    );
  });
  it('offers no hint field on the first Analyze, which stays one click', async () => {
    show();
    expect(screen.queryByRole('button', { name: 'Add a hint' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDefined();
  });
  describe('the hint on Analyze again', () => {
    const scope = () =>
      START_HINT_SCOPES.checkAnalyze({
        mountId: seed.repo.mountId,
        url: seed.check.detailsUrl ?? '',
      });
    const draft = () => store.getState().startHints[seed.sessionId]?.[scope()]?.text;
    const writeHint = (text: string) => {
      fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Hint for the agent' }), {
        target: { value: text },
      });
    };
    it('puts the hint after the instructions, never inside the evidence, and clears the draft', async () => {
      const spawn = vi.spyOn(store.getState(), 'spawnAgent');
      show({ phase: 'no-fix' });
      writeHint('Look at the retry queue first.');
      fireEvent.click(screen.getByRole('button', { name: 'Analyze again' }));
      await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
      const prompt = spawn.mock.calls[0]?.[1].initialPrompt ?? '';
      expect(prompt.endsWith('## Operator notes\nLook at the retry queue first.')).toBe(true);
      expect(prompt.indexOf('## Operator notes')).toBeGreaterThan(
        prompt.indexOf('## Instructions'),
      );
      expect(prompt.indexOf('## Failed log tail')).toBeLessThan(prompt.indexOf('## Instructions'));
      await waitFor(() => expect(draft()).toBeUndefined());
    });
    it('keeps the hint when the start fails and sends it again on retry', async () => {
      const spawn = vi.spyOn(store.getState(), 'spawnAgent');
      injectDbFault({ match: /INSERT INTO agents/, message: 'Could not create the Debugger' });
      show({ phase: 'no-fix' });
      writeHint('Look at the retry queue first.');
      fireEvent.click(screen.getByRole('button', { name: 'Analyze again' }));
      await waitFor(() =>
        expect(
          store
            .getState()
            .notifications.some((notice) => notice.title === "Couldn't start the Debugger"),
        ).toBe(true),
      );
      expect(draft()).toBe('Look at the retry queue first.');
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Analyze again' }).hasAttribute('disabled')).toBe(
          false,
        ),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Analyze again' }));
      await waitFor(() => expect(spawn.mock.calls.length).toBeGreaterThanOrEqual(2));
      expect(spawn.mock.calls.at(-1)?.[1].initialPrompt).toContain(
        '## Operator notes\nLook at the retry queue first.',
      );
    });
  });
  it('says so instead of dropping a hint when the check is already being analyzed', async () => {
    let release: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    storySpies.tauriInvoke.mockImplementationOnce(async () => {
      await wait;
      return { stdout: 'Assertion failed', stderr: '', exitCode: 0 };
    });
    const first = analyzeFailingChecks({
      ...seed,
      mountId: seed.repo.mountId,
      checks: [seed.check],
    });
    await expect(
      analyzeFailingChecks({
        ...seed,
        mountId: seed.repo.mountId,
        checks: [seed.check],
        hint: 'Look at the retry queue first.',
      }),
    ).rejects.toThrow('A Debugger is already analyzing this check. Your hint was not applied.');
    release?.();
    await first;
  });
  it('does not create an agent when paths cannot be read and allows retry', async () => {
    storySpies.tauriInvoke.mockImplementationOnce(async () => ({
      stdout: 'Assertion failed',
      stderr: '',
      exitCode: 0,
    }));
    storySpies.tauriInvoke.mockImplementationOnce(async () => ({
      stdout: '',
      stderr: 'denied',
      exitCode: 1,
    }));
    await expect(
      analyzeFailingChecks({
        sessionId: seed.sessionId,
        mountId: seed.repo.mountId,
        pullRequest: seed.pullRequest,
        checks: [seed.check],
      }),
    ).rejects.toThrow('Could not read the pull request paths');
    expect(store.getState().sessionPhaseRuns[seed.sessionId]).toEqual([]);
    await analyzeFailingChecks({
      sessionId: seed.sessionId,
      mountId: seed.repo.mountId,
      pullRequest: seed.pullRequest,
      checks: [seed.check],
    });
    expect(store.getState().sessionPhaseRuns[seed.sessionId]?.length).toBe(1);
  });
  it.each(['gitlab.com', 'bitbucket.org'])(
    'keeps %s analysis local and marks its log unreadable',
    async (host) => {
      const pullRequest = {
        ...seed.pullRequest,
        url: `https://${host}/harborline/payments-api/pull/318`,
      };
      const check = {
        ...seed.check,
        detailsUrl: `https://${host}/harborline/payments-api/jobs/42`,
      };
      const spawn = vi.spyOn(store.getState(), 'spawnAgent');
      await analyzeFailingChecks({
        sessionId: seed.sessionId,
        mountId: seed.repo.mountId,
        pullRequest,
        checks: [check],
      });
      expect(storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'gh_run')).toEqual(
        [],
      );
      expect(storySpies.worktreeChangedFiles).toHaveBeenCalledWith({
        worktreePath: seed.repo.worktreePath,
        baseBranch: pullRequest.baseBranch,
      });
      expect(spawn.mock.calls[0]?.[1].initialPrompt).toContain(
        'The log is at this URL; it could not be read here.',
      );
    },
  );
  it('the Next action hands a failure back to the row without changing agents', async () => {
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
    injectDbFault({ match: /INSERT INTO agents/, message: 'provider unavailable' });
    await expect(actions.primary?.run()).rejects.toThrow('provider unavailable');
    expect(store.getState().sessionPhaseRuns[seed.sessionId]).toEqual([]);
  });
  it('the Next action reads missing check detail for its named mount before starting', async () => {
    const github = store.getState().mountGithub[seed.repo.mountId];
    const session = store.getState().sessions[0];
    if (github === undefined || session === undefined) {
      throw new Error('The seeded branch is missing');
    }
    store.setState({
      mountGithub: { [seed.repo.mountId]: { ...github, detail: null, detailFetchedAt: null } },
    });
    storySpies.tauriInvoke.mockImplementation(async (command, raw) => {
      if (command !== 'gh_run') {
        return null;
      }
      const input: unknown = raw;
      const args =
        typeof input === 'object' && input !== null && 'args' in input && Array.isArray(input.args)
          ? input.args
          : [];
      if (args.includes('graphql')) {
        return {
          stdout: JSON.stringify({
            data: {
              repository: {
                pullRequest: {
                  reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
                },
              },
            },
          }),
          stderr: '',
          exitCode: 0,
        };
      }
      if (args[0] === 'api') {
        return { stdout: '[]', stderr: '', exitCode: 0 };
      }
      if (args.some((arg) => typeof arg === 'string' && arg.includes('statusCheckRollup'))) {
        return {
          stdout: JSON.stringify({
            reviews: [],
            reviewRequests: [],
            statusCheckRollup: [
              {
                name: seed.check.name,
                status: 'COMPLETED',
                conclusion: 'FAILURE',
                detailsUrl: seed.check.detailsUrl,
              },
            ],
          }),
          stderr: '',
          exitCode: 0,
        };
      }
      return {
        stdout: args.includes('files') ? 'src/ledger.ts' : 'Assertion failed',
        stderr: '',
        exitCode: 0,
      };
    });
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
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
    await act(async () => {
      await actions.primary?.run();
    });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0]?.[1].initialPrompt).toContain(seed.check.name);
    expect(store.getState().mountGithub[seed.repo.mountId]?.detail?.checks[0]?.name).toBe(
      seed.check.name,
    );
  });
  it('the Next primary passes every failing check and preserves its routing override', async () => {
    const github = store.getState().mountGithub[seed.repo.mountId];
    if (github === undefined || github.detail === null) {
      throw new Error('The seeded checks are missing');
    }
    store.setState({
      mountGithub: {
        [seed.repo.mountId]: {
          ...github,
          detail: {
            ...github.detail,
            checks: [
              seed.check,
              {
                ...seed.check,
                name: 'notify-relay / test',
                conclusion: 'timed_out',
                detailsUrl: 'https://github.com/harborline/payments-api/actions/runs/31/job/43',
              },
              {
                ...seed.check,
                name: 'ledger-core / cancelled',
                conclusion: 'cancelled',
                detailsUrl: 'https://github.com/harborline/payments-api/actions/runs/31/job/44',
              },
              { ...seed.check, name: 'lint', conclusion: 'success' },
            ],
          },
        },
      },
    });
    const session = store.getState().sessions[0];
    if (session === undefined) {
      throw new Error('The session is missing');
    }
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
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
    expect(actions.primary?.label).toBe('Analyze');
    await act(async () => {
      await actions.primary?.runsOn?.runWith({
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        effort: 'high',
      });
    });
    expect(spawn).toHaveBeenCalledTimes(1);
    const prompt = spawn.mock.calls[0]?.[1].initialPrompt ?? '';
    expect(prompt).toContain('payments-api / test');
    expect(prompt).toContain('notify-relay / test');
    expect(prompt).toContain('ledger-core / cancelled');
    expect(prompt).not.toContain('Check: lint');
    expect(spawn.mock.calls[0]?.[1].effort).toBe('high');
  });
});

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
    isChecksFailing: true,
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
