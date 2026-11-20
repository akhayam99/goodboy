// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionExternalTask,
  type SessionId,
  type SessionProjectMount,
  type WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { MountGithubState } from '../../../../store/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { WriteReview } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-write-review-page' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-payments' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-payments' });
const STAMP = brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' });
const REPO = 'harborline/payments-api';
const GONE = 318;
const OPEN = 322;

const session = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });

const mount: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: '/tmp/harborline/payments-api',
  lastWorktreePath: null,
  repoRoot: '/tmp/harborline/payments-api',
  branch: 'hl/review-credits',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const github: MountGithubState = {
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  repository: REPO,
  host: 'github.com',
  branch: 'hl/review-credits',
  prs: [],
  links: [],
  pr: null,
  linkedIssues: [],
  fetchedAt: STAMP,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
};

type LinkParams = {
  readonly number: number;
};

const linkOf = ({ number }: LinkParams): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider: 'github',
  externalId: String(number),
  identifier: `#${number}`,
  url: `https://github.com/${REPO}/pull/${number}`,
  title: 'Linked request',
  createdAt: STAMP,
});

type DiffArgs = {
  readonly pr?: number;
};

let useAppStore: StoryStore;
let requestedDiffs: Array<number | undefined> = [];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  requestedDiffs = [];
  stubStoryInvoke({
    db_select: [],
    gh_pr_diff: async ({ pr }: DiffArgs = {}) => {
      requestedDiffs.push(pr);
      if (pr === GONE) {
        throw new Error('HTTP 404: Not Found');
      }
      return '';
    },
  });
  useAppStore.setState({
    sessions: [session],
    workspaces: [aWorkspace({ id: WORKSPACE_ID })],
    projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID })],
    sessionProjectMounts: { [SESSION_ID]: [mount] },
    mountGithub: { [MOUNT_ID]: github },
    sessionExternalTasks: {
      [SESSION_ID]: [linkOf({ number: GONE }), linkOf({ number: OPEN })],
    },
  });
});

afterEach(cleanup);

describe('Write review on the page', () => {
  it('keeps the request choice when the diff of the picked request fails to load', async () => {
    render(
      <ToastProvider>
        <WriteReview session={session} />
      </ToastProvider>,
    );

    await screen.findByRole('button', { name: 'Retry' });
    const choice = screen.getByRole('tablist', { name: 'Review goes to' });
    fireEvent.click(within(choice).getByRole('tab', { name: new RegExp(`#${OPEN}`) }));

    await waitFor(() => expect(requestedDiffs).toEqual([GONE, OPEN]));
    expect(useAppStore.getState().reviewSubmission[SESSION_ID]?.chosenTarget).toMatchObject({
      repo: REPO,
      prNumber: OPEN,
    });
  });
});
