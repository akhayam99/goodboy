// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import type {
  MountRequestView,
  MountRowView,
} from '../../../../../store/slices/project-mounts/mountRowModel';
import { MountRequestLink } from './MountRequestLink';

const SESSION = 'session-1' as SessionId;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const requestOf = (over: Partial<MountRequestView>): MountRequestView => ({
  provider: 'github',
  identity: null,
  number: 9914,
  state: 'open',
  isDraft: false,
  checks: 'success',
  reviewDecision: 'review_required',
  url: 'https://github.com/harborline/payments-api/pull/9914',
  title: 'Encode signup intents as opaque aliases',
  label: 'PR #9914',
  ...over,
});

const rowOf = (request: MountRequestView, isFinished: boolean): MountRowView => ({
  mountId: 'mount-1' as MountId,
  projectId: 'project-1' as ProjectId,
  projectName: 'payments-api',
  projectKind: 'repo',
  mountName: 'payments-api',
  branch: 'harborline/opaque-aliases',
  baseBranch: 'main',
  worktreePath: '/tmp/payments-api/opaque-aliases',
  lastWorktreePath: null,
  repoRoot: '/tmp/payments-api',
  isAttached: true,
  isMainCheckout: false,
  isOnDisk: true,
  revision: 1,
  parallelIndex: 0,
  request,
  series: null,
  observation: null,
  observedBranchHolder: null,
  isFinished,
});

const renderLink = (request: MountRequestView, isFinished = false) =>
  render(
    <MountRequestLink sessionId={SESSION} row={rowOf(request, isFinished)} label="payments-api" />,
  );

describe('MountRequestLink', () => {
  it('reads a closed pull request as Closed even when GitHub still flags it as a draft', () => {
    renderLink(requestOf({ state: 'closed', isDraft: true }));

    expect(screen.getByText('Closed')).toBeDefined();
    expect(screen.queryByText('Draft')).toBeNull();
    expect(screen.getByLabelText('Closed')).toBeDefined();
  });

  it('reads a merged pull request as Merged even when GitHub still flags it as a draft', () => {
    renderLink(requestOf({ state: 'merged', isDraft: true }));

    expect(screen.getByText('Merged')).toBeDefined();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('reads a finished row as one muted phrase with the number and the state', () => {
    const { unmount } = renderLink(requestOf({ state: 'merged' }), true);
    expect(screen.getByText('PR #9914 merged')).toBeDefined();
    unmount();

    renderLink(requestOf({ state: 'closed', isDraft: true }), true);
    expect(screen.getByText('PR #9914 closed')).toBeDefined();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('reads a live draft as Draft and a queued pull request as Queued', () => {
    const { unmount } = renderLink(requestOf({ state: 'open', isDraft: true }));
    expect(screen.getByText('Draft')).toBeDefined();
    unmount();

    renderLink(requestOf({ state: 'queued', isDraft: false }));
    expect(screen.getByText('Queued')).toBeDefined();
  });
});
