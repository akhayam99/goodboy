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
import { aSession } from '@goodboy/types/testing';
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
import { analyzeFailingChecks } from './analyzeFailingChecks';
import { resetWorktreeStatusCache } from '../../../store/slices/worktreeStatuses/cache';
import { useSuggestionActions } from '../../suggestions/useSuggestionActions';

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
  it('spawns one Debugger from a failing row with the check kickoff', async () => {
    const spawn = vi.spyOn(store.getState(), 'spawnAgent');
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    expect(spawn).toHaveBeenCalledWith(
      seed.sessionId,
      expect.objectContaining({
        kindOverride: 'debugger',
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
    expect(await rowsOf({ sql: 'SELECT source_kind FROM agents' })).toEqual([
      { source_kind: 'failed_check' },
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
    { phase: 'running' as const, label: 'Debugger is analyzing', canRetry: false },
    { phase: 'proposal' as const, label: 'Debugger proposes a fix', canRetry: false },
    { phase: 'no-fix' as const, label: 'Debugger found no fix', canRetry: true },
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
