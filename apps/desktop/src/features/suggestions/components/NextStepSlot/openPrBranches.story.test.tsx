// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listNudgeEvents: vi.fn(async () => []),
  }),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type MountId,
  type PullRequestState,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../store/slices/worktreeStatuses/cache';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { MountGithubState } from '../../../../store/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { NextStepSlot } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
});

afterEach(() => {
  cleanup();
});

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const SESSION = aSession({ id: SESSION_ID });
const PROJECT = aProject({ name: 'payments-api', baseBranch: 'main' });

type BranchSpec = {
  readonly branch: string;
  readonly ahead: number;
  readonly prNumber?: number;
};

const mountIdOf = ({ branch }: { readonly branch: string }): MountId =>
  brandId<MountId>({ value: `mount-${branch.replace('/', '-')}` });

const worktreePathOf = ({ branch }: { readonly branch: string }): string =>
  `/w/payments-api/${branch.replace('/', '-')}`;

const mountOf = ({ branch }: BranchSpec): SessionProjectMount => ({
  mountId: mountIdOf({ branch }),
  sessionId: SESSION_ID,
  projectId: PROJECT.id,
  mountName: 'payments-api',
  worktreePath: worktreePathOf({ branch }),
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const prOf = ({ branch, number }: { readonly branch: string; readonly number: number }) =>
  ({
    number,
    title: 'Ledger export',
    url: `https://github.com/harborline/payments-api/pull/${number}`,
    state: 'open',
    mergeable: true,
    checks: 'pending',
    baseBranch: 'main',
    headBranch: branch,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-10-18T00:00:00.000Z',
  }) satisfies PullRequestState;

const githubOf = ({ branch, prNumber }: BranchSpec): MountGithubState => ({
  mountId: mountIdOf({ branch }),
  projectId: PROJECT.id,
  revision: 1,
  repository: null,
  host: null,
  branch,
  prs: [],
  links: [],
  pr: prNumber === undefined ? null : prOf({ branch, number: prNumber }),
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

const statusFor =
  ({ branches }: { readonly branches: ReadonlyArray<BranchSpec> }) =>
  (args: unknown) => {
    const path =
      typeof args === 'object' && args !== null && 'worktreePath' in args
        ? String(args.worktreePath)
        : '';
    const spec = branches.find((candidate) => worktreePathOf(candidate) === path);
    return {
      branch: spec?.branch ?? 'main',
      head: 'head',
      headSubject: 'Acme export',
      upstream: `origin/${spec?.branch ?? 'main'}`,
      mainDistance: { kind: 'known', ahead: spec?.ahead ?? 0, behind: 0 },
      upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
      workingTree: {
        kind: 'known',
        staged: 0,
        unstaged: 0,
        untracked: 0,
        unmerged: 0,
        changed: 0,
      },
      inProgress: null,
    };
  };

const seed = ({ branches }: { readonly branches: ReadonlyArray<BranchSpec> }) => {
  const navigate = vi.fn();
  useAppStore.setState({
    projects: [PROJECT],
    sessions: [SESSION],
    navigate,
    sessionProjectMounts: { [SESSION_ID]: branches.map(mountOf) },
    mountGithub: Object.fromEntries(
      branches.map((spec) => [mountIdOf(spec), githubOf(spec)] as const),
    ),
  });
  stubStoryInvoke({ worktree_status: statusFor({ branches }) });
  return { navigate };
};

const renderSlot = () =>
  render(
    <ToastProvider>
      <AutoReleaseContext.Provider value={false}>
        <NextStepSlot session={SESSION} onSelectLens={vi.fn()} />
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );

const openPrRows = () => screen.queryAllByText(/^Open a pull request for /);

describe('the open pull request card with several branches of one project', () => {
  const BRANCHES: ReadonlyArray<BranchSpec> = [
    { branch: 'hl/ledger-export', ahead: 2 },
    { branch: 'hl/refund-retry', ahead: 5 },
    { branch: 'hl/payout-banner', ahead: 4, prNumber: 9993 },
    { branch: 'hl/webhook-dedupe', ahead: 2 },
    { branch: 'hl/fx-rounding', ahead: 6, prNumber: 9994 },
  ];

  it('shows one card that names the branch furthest ahead without a pull request', async () => {
    seed({ branches: BRANCHES });
    renderSlot();

    const row = await screen.findByTestId(
      `next-step-open-pr:${mountIdOf({ branch: 'hl/refund-retry' })}`,
    );
    expect(row.textContent).toContain('Open a pull request for hl/refund-retry');
    expect(row.textContent).toContain('5 commits ahead');
    expect(openPrRows()).toHaveLength(1);
  });

  it('opens the pull request form of exactly the branch the card names', async () => {
    const { navigate } = seed({ branches: BRANCHES });
    renderSlot();
    await screen.findByText('Open a pull request for hl/refund-retry');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open PR' }));
    });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      to: branchPlace({
        sessionId: SESSION_ID,
        mountPath: worktreePathOf({ branch: 'hl/refund-retry' }),
        tab: 'pr',
      }),
    });
  });

  it('lists every branch without a pull request in the menu and opens the one you pick', async () => {
    const { navigate } = seed({ branches: BRANCHES });
    renderSlot();
    await screen.findByText('Open a pull request for hl/refund-retry');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'More options for Open a pull request for hl/refund-retry',
      }),
    );
    const menu = screen.getByRole('menu');

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent ?? ''),
    ).toEqual([
      'hl/refund-retrypayments-api, 5 commits ahead',
      'hl/ledger-exportpayments-api, 2 commits ahead',
      'hl/webhook-dedupepayments-api, 2 commits ahead',
    ]);
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: /hl\/webhook-dedupe/ }));
    });

    expect(navigate).toHaveBeenCalledWith({
      to: branchPlace({
        sessionId: SESSION_ID,
        mountPath: worktreePathOf({ branch: 'hl/webhook-dedupe' }),
        tab: 'pr',
      }),
    });
  });
});

describe('the open pull request card with one branch', () => {
  it('keeps its title, names the branch and opens it, with no menu', async () => {
    const { navigate } = seed({ branches: [{ branch: 'hl/ledger-export', ahead: 3 }] });
    renderSlot();

    const row = await screen.findByTestId(
      `next-step-open-pr:${mountIdOf({ branch: 'hl/ledger-export' })}`,
    );
    expect(row.textContent).toContain('Open a pull request for payments-api');
    expect(row.textContent).toContain('hl/ledger-export · 3 commits ahead');
    expect(openPrRows()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^More options for / })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open PR' }));
    });

    expect(navigate).toHaveBeenCalledWith({
      to: branchPlace({
        sessionId: SESSION_ID,
        mountPath: worktreePathOf({ branch: 'hl/ledger-export' }),
        tab: 'pr',
      }),
    });
  });
});
