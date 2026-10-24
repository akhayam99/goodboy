// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { MountGithubState } from '../../../store/types';
import type { MountId, ProjectId, PullRequestState, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { ToastProvider } from '../../../shared/components/Toast';
import { useActionControls } from './index';

vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);

type StoreState = ReturnType<StoryStore['getState']>;

const WORKSPACE = aWorkspace();
const PROJECT = aProject({ workspaceId: WORKSPACE.id, name: 'payments-api' });
const SESSION_A = aSession({ workspaceId: WORKSPACE.id });
const SESSION_B = aSession({ workspaceId: WORKSPACE.id });

const PR: PullRequestState = {
  number: 318,
  title: 'Ledger export',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'closed',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'feat/export',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-07T08:00:00Z',
};

const githubOf = ({
  projectId,
  number,
}: {
  readonly projectId: ProjectId;
  readonly number: number;
}): MountGithubState => ({
  mountId: MOUNT,
  projectId,
  revision: 1,
  repository: null,
  host: null,
  branch: PR.headBranch,
  prs: [],
  links: [],
  pr: { ...PR, number },
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const LATER_NUMBER = 319;
const mountOf = ({ name }: { readonly name: string }): MountId => JSON.parse(JSON.stringify(name));
const MOUNT = mountOf({ name: 'mount-payments-api' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const Wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
};

const deferred = (): Deferred => {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    workspaces: [WORKSPACE],
    projects: [PROJECT],
    sessions: [SESSION_A, SESSION_B],
    sessionGithub: {
      [SESSION_A.id]: githubOf({ projectId: PROJECT.id, number: PR.number }),
      [SESSION_B.id]: githubOf({ projectId: PROJECT.id, number: LATER_NUMBER }),
    },
    refreshSessionPrDetail: vi.fn<StoreState['refreshSessionPrDetail']>(async () => undefined),
    loadPullRequestView: vi.fn<StoreState['loadPullRequestView']>(async () => undefined),
  });
});

afterEach(() => {
  cleanup();
});

type ControlsParams = {
  readonly sessionId: SessionId;
  readonly scopeKey: string;
};

const useControls = ({ sessionId, scopeKey }: ControlsParams) =>
  useActionControls({
    target: {
      kind: 'pullRequest',
      sessionId,
      prNumber: sessionId === SESSION_A.id ? PR.number : LATER_NUMBER,
    },
    scopeKey,
  });

const REOPEN = 'pullRequest.reopen';

const mockReopen = (impl: StoreState['reopenPr']) => {
  const reopenPr = vi.fn<StoreState['reopenPr']>(impl);
  store.setState({ reopenPr });
  return reopenPr;
};

describe('useActionControls feedback', () => {
  it('reports the action as pending with its word while it runs, then clears it', async () => {
    const gate = deferred();
    mockReopen(() => gate.promise);
    const { result } = renderHook(
      () => useControls({ sessionId: SESSION_A.id, scopeKey: SESSION_A.id }),
      { wrapper: Wrapper },
    );
    expect(result.current.actions.find((action) => action.id === REOPEN)?.pendingLabel).toBe(
      'Reopening…',
    );

    act(() => result.current.trigger({ actionId: REOPEN }));

    expect(result.current.pendingId).toBe(REOPEN);
    await act(async () => gate.resolve());
    await waitFor(() => expect(result.current.pendingId).toBeNull());
  });

  it('runs once when the button is pressed twice in the same tick', async () => {
    const gate = deferred();
    const reopenPr = mockReopen(() => gate.promise);
    const { result } = renderHook(
      () => useControls({ sessionId: SESSION_A.id, scopeKey: SESSION_A.id }),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.trigger({ actionId: REOPEN });
      result.current.trigger({ actionId: REOPEN });
    });
    act(() => result.current.trigger({ actionId: REOPEN }));

    expect(reopenPr).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve());
    await waitFor(() => expect(result.current.pendingId).toBeNull());
  });

  it('keeps one outcome line after success, and the next action clears it', async () => {
    const reopenPr = mockReopen(async () => undefined);
    const { result } = renderHook(
      () => useControls({ sessionId: SESSION_A.id, scopeKey: SESSION_A.id }),
      { wrapper: Wrapper },
    );

    act(() => result.current.trigger({ actionId: REOPEN }));
    await waitFor(() => expect(result.current.outcome?.message).toBe('Reopened #318.'));
    expect(result.current.failure).toBeNull();
    expect(result.current.outcome?.actionId).toBe(REOPEN);

    const gate = deferred();
    reopenPr.mockImplementationOnce(() => gate.promise);
    act(() => result.current.trigger({ actionId: REOPEN }));
    expect(result.current.outcome).toBeNull();
    await act(async () => gate.resolve());
    await waitFor(() => expect(result.current.outcome?.message).toBe('Reopened #318.'));

    act(() => result.current.dismissOutcome());
    expect(result.current.outcome).toBeNull();
  });

  it('shows the failure and no outcome when the action throws, and Retry runs it again', async () => {
    const reopenPr = mockReopen(async () => {
      throw new Error('GitHub said no');
    });
    const { result } = renderHook(
      () => useControls({ sessionId: SESSION_A.id, scopeKey: SESSION_A.id }),
      { wrapper: Wrapper },
    );

    act(() => result.current.trigger({ actionId: REOPEN }));
    await waitFor(() => expect(result.current.failure?.message).toBe('GitHub said no'));
    expect(result.current.outcome).toBeNull();
    expect(result.current.pendingId).toBeNull();

    reopenPr.mockImplementationOnce(async () => undefined);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.outcome?.message).toBe('Reopened #318.'));
    expect(result.current.failure).toBeNull();
    expect(reopenPr).toHaveBeenCalledTimes(2);
  });

  it('drops the late finish of an old scope and keeps the newer outcome', async () => {
    const oldGate = deferred();
    const reopenPr = mockReopen(() => oldGate.promise);
    const { result, rerender } = renderHook(useControls, {
      wrapper: Wrapper,
      initialProps: { sessionId: SESSION_A.id, scopeKey: SESSION_A.id },
    });

    act(() => result.current.trigger({ actionId: REOPEN }));
    expect(result.current.pendingId).toBe(REOPEN);

    reopenPr.mockImplementationOnce(async () => undefined);
    rerender({ sessionId: SESSION_B.id, scopeKey: SESSION_B.id });
    expect(result.current.pendingId).toBeNull();

    act(() => result.current.trigger({ actionId: REOPEN }));
    await waitFor(() => expect(result.current.outcome?.message).toBe('Reopened #319.'));
    expect(reopenPr).toHaveBeenNthCalledWith(2, SESSION_B.id, LATER_NUMBER, {});

    await act(async () => oldGate.resolve());
    expect(result.current.outcome?.message).toBe('Reopened #319.');
    expect(result.current.pendingId).toBeNull();
  });

  it('drops the late failure of an old scope instead of showing it on the new one', async () => {
    const oldGate = deferred();
    mockReopen(() => oldGate.promise);
    const { result, rerender } = renderHook(useControls, {
      wrapper: Wrapper,
      initialProps: { sessionId: SESSION_A.id, scopeKey: SESSION_A.id },
    });

    act(() => result.current.trigger({ actionId: REOPEN }));
    rerender({ sessionId: SESSION_B.id, scopeKey: SESSION_B.id });
    await act(async () => oldGate.reject(new Error('late failure')));

    expect(result.current.failure).toBeNull();
    expect(result.current.outcome).toBeNull();
  });
});
