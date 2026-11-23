// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type IsoDateTime, type MountId, type PullRequestState } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { aMountGithub } from '../../../../store/slices/github/testing/aMountGithub';
import { SESSION_ID } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { seedResolveGitlabScene } from '../../../../app/components/MockScene/scenes/resolveGitlabSeed';
import type { PullRequestDrawerTab } from '../../../../store/slices/drawer/state';
import { DeskPr } from '.';

const MOUNT_ID = brandId<MountId>({ value: 'mount-payments-api' });

const PR: PullRequestState = {
  number: 318,
  title: 'Guard the settlement batch',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'failure',
  baseBranch: 'main',
  headBranch: 'ak/fix-credit',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' }),
};

let store: StoryStore;
let refreshSessionPrDetail: Mock<ReturnType<StoryStore['getState']>['refreshSessionPrDetail']>;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  refreshSessionPrDetail = vi.fn<ReturnType<StoryStore['getState']>['refreshSessionPrDetail']>(
    async () => undefined,
  );
});

afterEach(() => {
  cleanup();
});

type ShowParams = {
  readonly tab: PullRequestDrawerTab;
};

const show = ({ tab }: ShowParams) =>
  render(
    <DeskPr sessionId={SESSION_ID} mountId={MOUNT_ID} tab={tab} check={null} onClose={() => {}} />,
  );

type GithubParams = {
  readonly detailError: string | null;
  readonly detailFetchedAt: IsoDateTime | null;
};

const seedGithub = ({ detailError, detailFetchedAt }: GithubParams) => {
  seedResolveGitlabScene({ selected: 'github' });
  store.setState({
    mountGithub: {
      [MOUNT_ID]: { ...aMountGithub({ mountId: MOUNT_ID }), pr: PR, detailError, detailFetchedAt },
    },
    refreshSessionPrDetail,
  });
};

describe('the pull request panel on the Desk', () => {
  it('asks for the detail of its pull request when none is loaded', () => {
    seedGithub({ detailError: null, detailFetchedAt: null });

    show({ tab: 'conversation' });

    expect(refreshSessionPrDetail).toHaveBeenCalledWith(SESSION_ID, { mountId: MOUNT_ID });
    expect(screen.getByRole('status').textContent).toBe('Reading the comments');
    expect(screen.queryByText('No comments yet.')).toBeNull();
  });

  it('shows a failed read with Retry instead of an empty conversation', () => {
    seedGithub({
      detailError: 'GitHub refused the request',
      detailFetchedAt: brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' }),
    });

    show({ tab: 'conversation' });
    expect(screen.queryByText('No comments yet.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(refreshSessionPrDetail).toHaveBeenLastCalledWith(SESSION_ID, {
      force: true,
      mountId: MOUNT_ID,
    });
  });

  it('shows a failed checks read with Retry instead of empty checks', () => {
    seedGithub({
      detailError: 'GitHub refused the request',
      detailFetchedAt: brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' }),
    });

    show({ tab: 'checks' });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(refreshSessionPrDetail).toHaveBeenLastCalledWith(SESSION_ID, {
      force: true,
      mountId: MOUNT_ID,
    });
  });

  it('reads a GitLab merge request and its comments instead of saying there is none', () => {
    seedResolveGitlabScene({ selected: 'gitlab' });
    store.setState({ refreshSessionPrDetail });

    show({ tab: 'conversation' });

    expect(screen.queryByText('No pull request on this branch yet.')).toBeNull();
    expect(screen.getAllByText('theo-v').length).toBeGreaterThan(0);
    expect(refreshSessionPrDetail).not.toHaveBeenCalled();
  });
});
