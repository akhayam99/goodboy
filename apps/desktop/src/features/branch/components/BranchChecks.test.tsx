// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../shared/lib/editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/lib/editor')>()),
  openUrl: vi.fn(async () => undefined),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core';
import type {
  GhTokenStatus,
  IntegrationBinding,
  IsoDateTime,
  PrCheckRun,
  PrDetail,
  PullRequestView,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { SessionGithubState } from '../../../store/types';
import { ToastProvider } from '../../../shared/components/Toast';
import { openUrl } from '../../../shared/lib/editor';
import { seedResolveBitbucketScene } from '../../../app/components/MockScene/scenes/resolveBitbucketSeed';
import { seedResolveGitlabScene } from '../../../app/components/MockScene/scenes/resolveGitlabSeed';
import { SESSION, seedResolveScene } from '../../../app/components/MockScene/scenes/resolveSeed';
import { BranchChecks } from './BranchChecks';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

let refresh = vi.fn(async () => undefined);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveScene({ expandedThreadId: null });
  refresh = vi.fn(async () => undefined);
  useAppStore.setState({ refreshSessionPrDetail: refresh });
  vi.mocked(openUrl).mockClear();
});

afterEach(() => {
  cleanup();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const github = (patch: Partial<SessionGithubState>): void => {
  act(() => {
    useAppStore.setState((state) => ({
      sessionGithub: {
        ...state.sessionGithub,
        [SESSION.id]: { ...state.sessionGithub[SESSION.id]!, ...patch },
      },
    }));
  });
};

const PR_NUMBER = 318;

const run = (patch: Partial<PrCheckRun> & Pick<PrCheckRun, 'name' | 'conclusion'>): PrCheckRun => ({
  detailsUrl: null,
  durationMs: null,
  ...patch,
});

const detail = (patch: Partial<PrDetail> = {}): PrDetail => ({
  prNumber: PR_NUMBER,
  comments: [],
  reviews: [],
  reviewRequests: [],
  checks: [],
  checksRead: 'ok',
  checksError: null,
  ...patch,
});

const SAML_LINE = 'HTTP 403: Resource protected by organization SAML enforcement.';

const show = async (): Promise<void> => {
  render(
    <ToastProvider>
      <BranchChecks sessionId={SESSION.id} />
    </ToastProvider>,
  );
  await settle();
};

const PAT_STATUS: GhTokenStatus = {
  available: true,
  mode: 'pat',
  version: '2.60.0',
  user: 'mara-l',
  scopes: [],
  scoped: false,
};

describe('Checks tab without a pull request', () => {
  beforeEach(() => {
    github({ pr: null, detail: null });
  });

  it('says the checks run once the pull request exists, and offers to create it', async () => {
    await show();

    expect(screen.getByText('Checks run once the pull request exists')).toBeDefined();
    expect(screen.queryByText(/No checks have reported/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Create pull request' })).toBeDefined();
  });

  it('opens the create form through the pull request action', async () => {
    await show();

    fireEvent.click(screen.getByRole('button', { name: 'Create pull request' }));
    await settle();

    expect(useAppStore.getState().pullRequestModes[SESSION.id]).toBe('create_pr');
  });

  it('does not read a detail for a pull request that does not exist', async () => {
    await show();

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('Checks tab while the detail is loading', () => {
  it('reads the checks on mount when no detail is loaded, without forcing', async () => {
    github({ detail: null, detailLoading: true });

    await show();

    expect(screen.getByRole('status').textContent).toBe('Reading checks');
    expect(screen.queryByText(/No checks have reported/)).toBeNull();
    expect(screen.queryByText(/No CI runs/)).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(SESSION.id);
  });

  it('does not read again when the detail of this pull request is already there', async () => {
    github({ detail: detail({ checks: [run({ name: 'build', conclusion: 'success' })] }) });

    await show();

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('Checks tab with runs', () => {
  beforeEach(() => {
    github({
      detail: detail({
        checks: [
          run({ name: 'build', conclusion: 'success' }),
          run({ name: 'unit tests', conclusion: 'failure', detailsUrl: 'https://ci.invalid/3' }),
          run({ name: 'lint', conclusion: 'pending' }),
        ],
      }),
    });
  });

  it('reads one rollup line and the runs grouped by outcome', async () => {
    await show();

    expect(screen.getByTestId('checks-rollup').textContent).toBe(
      '1 failing · 1 running · 1 passed',
    );
    expect(screen.getByRole('list', { name: 'Failing checks' })).toBeDefined();
    expect(
      within(screen.getByRole('list', { name: 'Failing checks' })).getByText('unit tests'),
    ).toBeDefined();
  });

  it('opens the log of a run on its host', async () => {
    await show();

    fireEvent.click(screen.getByRole('button', { name: /unit tests/ }));

    expect(openUrl).toHaveBeenCalledWith('https://ci.invalid/3');
  });
});

describe('Checks tab when nothing has reported', () => {
  it('says no checks have reported yet, never that the repository runs none', async () => {
    github({ detail: detail() });

    await show();

    expect(screen.getByText('No checks have reported on this pull request yet')).toBeDefined();
    expect(screen.queryByText(/runs no checks/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /View on GitHub/ }));
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('/pull/318'));
  });
});

describe('Checks tab when the access cannot read checks', () => {
  beforeEach(() => {
    github({ detail: detail({ checksRead: 'denied', checksError: SAML_LINE }) });
  });

  it('names the repository and says what the access cannot do', async () => {
    await show();

    expect(screen.getByText("Goodboy can't read checks for payments-api")).toBeDefined();
    expect(screen.getByText("The GitHub access Goodboy uses can't read checks.")).toBeDefined();
    expect(screen.queryByText(/No checks have reported/)).toBeNull();
  });

  it('points a bound token at Settings', async () => {
    useAppStore.setState({ githubWorkspaceStatus: { [SESSION.workspaceId]: PAT_STATUS } });
    const opened: Array<unknown> = [];
    const onOpen = (event: Event): void => {
      opened.push(event instanceof CustomEvent ? event.detail : null);
    };
    window.addEventListener('goodboy:open-settings', onOpen);

    await show();

    expect(
      screen.getByText('Give the token read access to checks and commit statuses.'),
    ).toBeDefined();
    expect(screen.queryByText('gh auth refresh -s repo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open GitHub settings' }));
    window.removeEventListener('goodboy:open-settings', onOpen);
    expect(opened).toEqual([{ scope: 'tools', tool: 'github' }]);
  });

  it('treats a GitHub binding of the workspace as a bound token too', async () => {
    const binding: IntegrationBinding = {
      id: 'binding-github' as IntegrationBinding['id'],
      workspaceId: SESSION.workspaceId,
      projectId: null,
      credentialId: 'credential-github' as IntegrationBinding['credentialId'],
      createdAt: SESSION.createdAt,
      updatedAt: SESSION.updatedAt,
      provider: 'github',
      config: {},
    };
    useAppStore.setState({ workspaceIntegrations: { [SESSION.workspaceId]: [binding] } });

    await show();

    expect(screen.getByRole('button', { name: 'Open GitHub settings' })).toBeDefined();
  });

  it('gives the gh command in a copy chip when no token is bound', async () => {
    await show();

    expect(screen.getByText('gh auth refresh -s repo')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copy command' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open GitHub settings' })).toBeNull();
  });

  it('checks again by forcing the read', async () => {
    await show();
    refresh.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

    expect(refresh).toHaveBeenCalledWith(SESSION.id, { force: true });
  });

  it('keeps the stderr line one click away', async () => {
    await show();

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByText(SAML_LINE)).toBeDefined();
  });
});

describe('Checks tab when the read failed', () => {
  it('says it could not read checks and offers Retry with the details', async () => {
    github({
      detail: detail({ checksRead: 'failed', checksError: 'gh: something new went wrong' }),
    });

    await show();

    expect(screen.getByRole('alert').textContent).toContain("Couldn't read checks");
    expect(screen.queryByText(/No checks have reported/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('gh: something new went wrong')).toBeDefined();
    refresh.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refresh).toHaveBeenCalledWith(SESSION.id, { force: true });
  });

  it('says the same when the whole detail read failed', async () => {
    github({ detail: null, detailLoading: false, detailError: 'gh run failed: spawn' });

    await show();

    expect(screen.getByRole('alert').textContent).toContain("Couldn't read checks");
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('gh run failed: spawn')).toBeDefined();
  });
});

describe('Checks tab on Bitbucket', () => {
  const VIEW: PullRequestView = {
    host: 'bitbucket',
    number: 12,
    title: 'Guard the empty cart',
    body: '',
    url: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12',
    state: 'open',
    isDraft: false,
    author: null,
    baseBranch: 'main',
    headBranch: 'nw/cart-guard',
    headSha: null,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-06T10:00:00Z',
    mergedAt: null,
    mergeable: null,
    reviewDecision: null,
    reviewers: [],
    resolves: [],
    checks: {
      read: 'ok',
      error: null,
      runs: [
        { name: 'unit', conclusion: 'success', detailsUrl: null, durationMs: 61000 },
        { name: 'lint', conclusion: 'failure', detailsUrl: null, durationMs: 12000 },
      ],
    },
    files: { count: 0, first: [] },
    commits: [],
    mergeMethods: ['squash', 'merge', 'rebase'],
    mergeMethodReasons: {},
  };

  const viewEntry = (view: PullRequestView | null) => ({
    [SESSION.id]: {
      prNumber: 12,
      mountId: useAppStore.getState().sessionActiveMount?.[SESSION.id] ?? null,
      view,
      isLoading: false,
      error: null,
      fetchedAt: '2026-10-07T09:00:00.000Z' as IsoDateTime,
      edits: [],
    },
  });

  beforeEach(() => {
    seedResolveBitbucketScene({ selected: 'bitbucket' });
    github({ pr: null, detail: null });
  });

  it('lists the rows of the statuses and never says Bitbucket checks are not shown', async () => {
    useAppStore.setState({ pullRequestViews: viewEntry(VIEW), loadPullRequestView: vi.fn() });

    await show();

    expect(screen.queryByText("Goodboy doesn't show Bitbucket checks yet")).toBeNull();
    expect(screen.getByText('unit')).toBeDefined();
    expect(screen.getByText('lint')).toBeDefined();
    expect(screen.queryByText(/GitHub/)).toBeNull();
  });

  it('warns with the fix and opens the Bitbucket settings when the token cannot read statuses', async () => {
    const denied: PullRequestView = {
      ...VIEW,
      checks: { read: 'denied', error: 'The API token lacks the pull request scope', runs: [] },
    };
    const listener = vi.fn();
    window.addEventListener('goodboy:open-settings', listener);
    useAppStore.setState({ pullRequestViews: viewEntry(denied), loadPullRequestView: vi.fn() });

    await show();

    expect(screen.getByText('The API token lacks the pull request scope')).toBeDefined();
    expect(screen.queryByText(/GitHub/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Bitbucket settings' }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      detail: { scope: 'tools', tool: 'bitbucket' },
    });
    window.removeEventListener('goodboy:open-settings', listener);
  });

  it('offers Retry and Details when the statuses could not be read, and retries the port', async () => {
    const failed: PullRequestView = {
      ...VIEW,
      checks: { read: 'failed', error: 'Bitbucket did not answer, check the connection', runs: [] },
    };
    const load = vi.fn();
    useAppStore.setState({ pullRequestViews: viewEntry(failed), loadPullRequestView: load });

    await show();

    expect(screen.getByRole('alert').textContent).toContain("Couldn't read checks");
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('Bitbucket did not answer, check the connection')).toBeDefined();
    load.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ force: true }));
  });
});

describe('Checks tab on a host that reads its own checks', () => {
  const capabilities: { canReadChecks: boolean } = REVIEW_SOURCE_CAPABILITIES.gitlab;

  const VIEW: PullRequestView = {
    host: 'gitlab',
    number: 57,
    title: 'Retry dispatch with a cap',
    body: '',
    url: 'https://gitlab.example.com/harborline/notify-relay/-/merge_requests/57',
    state: 'open',
    isDraft: false,
    author: null,
    baseBranch: 'main',
    headBranch: 'hl/dispatch-retry',
    headSha: null,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-06T10:00:00Z',
    mergedAt: null,
    mergeable: true,
    reviewDecision: null,
    reviewers: [],
    resolves: [],
    checks: {
      read: 'ok',
      error: null,
      runs: [
        { name: 'rspec', conclusion: 'success', detailsUrl: null, durationMs: 61000 },
        { name: 'rubocop', conclusion: 'failure', detailsUrl: null, durationMs: 12000 },
      ],
    },
    files: { count: 0, first: [] },
    commits: [],
    mergeMethods: ['merge'],
    mergeMethodReasons: {},
  };

  const viewEntry = (view: PullRequestView | null) => ({
    [SESSION.id]: {
      prNumber: 57,
      mountId: null,
      view,
      isLoading: false,
      error: null,
      fetchedAt: '2026-10-07T09:00:00.000Z' as IsoDateTime,
      edits: [],
    },
  });

  beforeEach(() => {
    capabilities.canReadChecks = true;
    seedResolveGitlabScene({ selected: 'gitlab' });
    github({ pr: null, detail: null });
  });

  afterEach(() => {
    capabilities.canReadChecks = true;
  });

  it('lists the rows the port read, like GitHub does, and drops the host notice', async () => {
    useAppStore.setState({ pullRequestViews: viewEntry(VIEW), loadPullRequestView: vi.fn() });

    await show();

    expect(screen.queryByText("Goodboy doesn't show GitLab pipelines yet")).toBeNull();
    expect(screen.getByText('rspec')).toBeDefined();
    expect(screen.getByText('rubocop')).toBeDefined();
  });

  it('says the port is still reading while it has no answer', async () => {
    useAppStore.setState({ pullRequestViews: {}, loadPullRequestView: vi.fn() });

    await show();

    expect(screen.queryByText("Goodboy doesn't show GitLab pipelines yet")).toBeNull();
    expect(screen.queryByText('rspec')).toBeNull();
  });

  it('says what the token cannot read, names the project and reloads on Check again', async () => {
    const load = vi.fn();
    useAppStore.setState({
      pullRequestViews: viewEntry({
        ...VIEW,
        checks: { read: 'denied', error: '403 Forbidden', runs: [] },
      }),
      loadPullRequestView: load,
    });
    const opened: Array<unknown> = [];
    const listen = (event: Event): void => {
      opened.push((event as CustomEvent).detail);
    };
    window.addEventListener('goodboy:open-settings', listen);

    await show();

    expect(screen.getByText("Goodboy can't read pipelines for notify-relay")).toBeDefined();
    expect(screen.getByText(/Give it the `api` scope/)).toBeDefined();
    expect(screen.queryByText(/GitHub/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open GitLab settings' }));
    expect(opened).toEqual([{ scope: 'tools', tool: 'gitlab' }]);
    load.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(load).toHaveBeenCalledWith({ sessionId: SESSION.id, force: true });
    expect(refresh).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:open-settings', listen);
  });

  it('says it could not read the pipelines and retries through the port', async () => {
    const load = vi.fn();
    useAppStore.setState({
      pullRequestViews: viewEntry({
        ...VIEW,
        checks: { read: 'failed', error: 'http error 500: boom', runs: [] },
      }),
      loadPullRequestView: load,
    });

    await show();

    expect(screen.getByRole('alert').textContent).toContain("Couldn't read checks");
    load.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(load).toHaveBeenCalledWith({ sessionId: SESSION.id, force: true });
  });

  it('keeps the host notice while the flag is off', async () => {
    capabilities.canReadChecks = false;
    useAppStore.setState({ pullRequestViews: viewEntry(VIEW), loadPullRequestView: vi.fn() });

    await show();

    expect(screen.getByText("Goodboy doesn't show GitLab pipelines yet")).toBeDefined();
    expect(screen.queryByText('rspec')).toBeNull();
  });
});
