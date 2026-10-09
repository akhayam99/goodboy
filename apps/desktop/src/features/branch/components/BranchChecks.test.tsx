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

describe('Checks tab on another host', () => {
  it('says Goodboy does not show GitLab pipelines yet and links the merge request', async () => {
    seedResolveGitlabScene({ selected: 'gitlab' });

    await show();

    expect(screen.getByText("Goodboy doesn't show GitLab pipelines yet")).toBeDefined();
    expect(screen.queryByText(/GitHub/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /View on GitLab/ }));
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('/merge_requests/57'));
  });

  it('says Goodboy does not show Bitbucket checks yet', async () => {
    seedResolveBitbucketScene({ selected: 'bitbucket' });

    await show();

    expect(screen.getByText("Goodboy doesn't show Bitbucket checks yet")).toBeDefined();
    expect(screen.getByRole('button', { name: /View on Bitbucket/ })).toBeDefined();
    expect(screen.queryByText(/GitHub/)).toBeNull();
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
    capabilities.canReadChecks = false;
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

  it('keeps the host notice while the flag is off', async () => {
    capabilities.canReadChecks = false;
    useAppStore.setState({ pullRequestViews: viewEntry(VIEW), loadPullRequestView: vi.fn() });

    await show();

    expect(screen.getByText("Goodboy doesn't show GitLab pipelines yet")).toBeDefined();
    expect(screen.queryByText('rspec')).toBeNull();
  });
});
