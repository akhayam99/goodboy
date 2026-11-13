// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { MountId, PullRequestState, SessionId, SessionProjectMount } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import type { MountGithubState } from '../../../store/types';
import { ToastProvider } from '../../../shared/components/Toast';
import { NotificationToastBridge } from '../../notifications/components/NotificationToastBridge';
import { ActionStatusLine } from '../components/ActionControls/ActionStatusLine';
import { useActionControls } from '../useActionControls';

vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);

type StoreState = ReturnType<StoryStore['getState']>;

const WORKSPACE = aWorkspace();
const PROJECT = aProject({ workspaceId: WORKSPACE.id, name: 'payments-api' });
const SESSION = aSession({ workspaceId: WORKSPACE.id });
const MOUNT: MountId = JSON.parse(JSON.stringify('mount-payments-api'));

type PrParams = {
  readonly state: PullRequestState['state'];
};

const prOf = ({ state }: PrParams): PullRequestState => ({
  number: 318,
  title: 'Ledger export',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state,
  isDraft: state === 'draft',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'harborline/ledger-export',
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-07T08:00:00Z',
});

const githubOf = ({ state }: PrParams): MountGithubState => ({
  mountId: MOUNT,
  projectId: PROJECT.id,
  revision: 1,
  repository: null,
  host: null,
  branch: 'harborline/ledger-export',
  prs: [],
  links: [],
  pr: prOf({ state }),
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

const MOUNT_ROW: SessionProjectMount = {
  mountId: MOUNT,
  sessionId: SESSION.id,
  projectId: PROJECT.id,
  mountName: 'payments-api',
  worktreePath: '/worktrees/payments-api',
  lastWorktreePath: '/worktrees/payments-api',
  repoRoot: '/repos/payments-api',
  branch: 'harborline/ledger-export',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = PrParams;

const seed = ({ state }: SeedParams) => {
  store.setState({
    workspaces: [WORKSPACE],
    projects: [PROJECT],
    sessions: [SESSION],
    sessionActiveMount: { [SESSION.id]: MOUNT },
    sessionActiveProject: { [SESSION.id]: PROJECT.id },
    sessionProjectMounts: { [SESSION.id]: [MOUNT_ROW] },
    sessionGithub: { [SESSION.id]: githubOf({ state }) },
    refreshSessionPr: vi.fn<StoreState['refreshSessionPr']>(async () => undefined),
    refreshSessionPrDetail: vi.fn<StoreState['refreshSessionPrDetail']>(async () => undefined),
    loadPullRequestView: vi.fn<StoreState['loadPullRequestView']>(async () => undefined),
  });
};

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

type SurfaceProps = {
  readonly sessionId: SessionId;
  readonly actionId: string;
};

const PullRequestSurface = ({ sessionId, actionId }: SurfaceProps) => {
  const controls = useActionControls({
    target: { kind: 'pullRequest', sessionId, prNumber: 318 },
  });
  return (
    <ToastProvider>
      <NotificationToastBridge />
      <button type="button" onClick={() => controls.trigger({ actionId })}>
        Run the action
      </button>
      <ActionStatusLine controls={controls} showReasons={false} />
    </ToastProvider>
  );
};

describe('a pull request action reports its outcome on one channel', () => {
  it('shows a refused reopen once, in place, and logs it without a toast', async () => {
    seed({ state: 'closed' });
    stubStoryInvoke({
      gh_run: { stdout: '', stderr: 'Could not reopen: the branch was deleted', exitCode: 1 },
    });
    render(<PullRequestSurface sessionId={SESSION.id} actionId="pullRequest.reopen" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run the action' }));
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('the branch was deleted');
    expect(screen.getAllByText(/the branch was deleted/)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
    await waitFor(() =>
      expect(store.getState().notifications.map((row) => row.read)).toEqual([true]),
    );
  });

  it('keeps the done line in place and drops the ready toast', async () => {
    seed({ state: 'draft' });
    stubStoryInvoke({ gh_run: { stdout: '', stderr: '', exitCode: 0 } });
    render(<PullRequestSurface sessionId={SESSION.id} actionId="pullRequest.markReady" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run the action' }));
    });

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Marked #318 ready for review.');
    expect(screen.queryByText('Marked #318 ready for review')).toBeNull();
    expect(store.getState().notifications).toEqual([]);
  });

  it('keeps a Follow link to the pull request tab in the done line', async () => {
    seed({ state: 'draft' });
    stubStoryInvoke({ gh_run: { stdout: '', stderr: '', exitCode: 0 } });
    render(<PullRequestSurface sessionId={SESSION.id} actionId="pullRequest.markReady" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run the action' }));
    });

    await screen.findByRole('status');
    expect((await screen.findByRole('button', { name: 'Follow' })).textContent).toBe('Follow');
  });

  it('logs the failure unread when the line is gone by the time the write fails', async () => {
    seed({ state: 'closed' });
    let refuse: () => void = () => undefined;
    const refused = new Promise<{ stdout: string; stderr: string; exitCode: number }>((done) => {
      refuse = () =>
        done({ stdout: '', stderr: 'Could not reopen: the branch was deleted', exitCode: 1 });
    });
    stubStoryInvoke({ gh_run: () => refused });
    const view = render(
      <PullRequestSurface sessionId={SESSION.id} actionId="pullRequest.reopen" />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run the action' }));
    });
    view.unmount();
    await act(async () => refuse());

    await waitFor(() =>
      expect(store.getState().notifications.map((row) => row.read)).toEqual([false]),
    );
    expect(store.getState().actionRuns).toEqual({});
  });
});
