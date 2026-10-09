// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';

type Answer = (args: Record<string, unknown>) => unknown;

const h = vi.hoisted(() => ({
  answers: new Map<string, (args: Record<string, unknown>) => unknown>(),
  invoke: vi.fn(async (command: string, args?: Record<string, unknown>): Promise<unknown> => {
    const answer = h.answers.get(command);
    if (answer === undefined) {
      return null;
    }
    return answer(args ?? {});
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { MountGitlabMrState } from '../../../store/slices/gitlab-mr/state';
import { isReportedError } from '../../../store/slices/notifications/reportedError';
import type { GitlabMergeRequest } from './client';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const PROJECT_ID = 'project-payments-api' as ProjectId;
const MOUNT_ID = 'mount-payments-api' as MountId;
const STAMP = '2026-10-07T08:00:00.000Z' as IsoDateTime;

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: '/worktrees/payments-api',
  lastWorktreePath: '/worktrees/payments-api',
  repoRoot: '/repos/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const MR: GitlabMergeRequest = {
  id: 4201,
  iid: 42,
  projectId: 9,
  title: 'Stop retried webhooks posting a second credit',
  description: 'Key the guard on the event id.',
  state: 'opened',
  webUrl: 'https://gitlab.com/harborline/payments-api/-/merge_requests/42',
  sourceBranch: MOUNT.branch,
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: STAMP,
  reviewers: [{ id: 4, username: 'omar-t', name: 'Omar Tan', avatarUrl: null }],
};

const entryOf = ({ mr }: { readonly mr: GitlabMergeRequest }): MountGitlabMrState => ({
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  revision: 1,
  host: 'https://gitlab.com',
  projectPath: 'harborline/payments-api',
  branch: MOUNT.branch,
  mrs: [mr],
  links: [],
  mr,
  fetchedAt: STAMP,
  loading: false,
  error: null,
});

let useAppStore: StoryStore;

const serve = ({ command, answer }: { readonly command: string; readonly answer: Answer }) =>
  h.answers.set(command, answer);

const sentTo = ({ command }: { readonly command: string }): ReadonlyArray<unknown> =>
  h.invoke.mock.calls.filter(([name]) => name === command).map(([, args]) => args);

const seedMr = ({ mr }: { readonly mr: GitlabMergeRequest }): void =>
  useAppStore.setState({ mountGitlabMr: { [MOUNT_ID]: entryOf({ mr }) } });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.answers.clear();
  h.invoke.mockClear();
  serve({ command: 'gitlab_get_mr', answer: () => MR });
  serve({ command: 'gitlab_update_mr', answer: () => MR });
  serve({ command: 'gitlab_update_mr_state', answer: () => MR });
  serve({ command: 'gitlab_merge_mr', answer: () => MR });
  serve({ command: 'gitlab_search_project_users', answer: () => [] });
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    workspaces: [aWorkspace({ id: WORKSPACE_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api' })],
    sessionActiveMount: { [SESSION_ID]: MOUNT_ID },
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionGithub: {},
    mountGithub: {},
    workspaceIntegrations: {
      [WORKSPACE_ID]: [
        {
          id: 'binding-1' as IntegrationBindingId,
          workspaceId: WORKSPACE_ID,
          projectId: null,
          credentialId: 'credential-1' as IntegrationCredentialId,
          createdAt: STAMP,
          updatedAt: STAMP,
          provider: 'gitlab',
          config: { userName: 'nadia-p', userId: '3', host: 'https://gitlab.com' },
        },
      ],
    },
    mountGitlabMr: { [MOUNT_ID]: entryOf({ mr: MR }) },
    refreshSessionPr: async () => undefined,
    refreshSessionPrDetail: async () => undefined,
    refreshSessionMr: async () => undefined,
    recordSessionEventOnce: async () => undefined,
    emitNotification: async () => undefined,
    reportError: async () => undefined,
  });
});

describe('pull request writes on GitLab, through the store, the port and the commands', () => {
  it('edits the description with only the description', async () => {
    await useAppStore.getState().editPr(SESSION_ID, 42, { body: 'A new body', isQuiet: true });

    expect(sentTo({ command: 'gitlab_update_mr' })).toEqual([
      expect.objectContaining({ mrIid: 42, description: 'A new body' }),
    ]);
    expect(sentTo({ command: 'gitlab_update_mr' })[0]).not.toHaveProperty('title');
  });

  it('edits the title and keeps the draft prefix of a draft', async () => {
    serve({
      command: 'gitlab_get_mr',
      answer: () => ({ ...MR, draft: true, title: 'Draft: Old' }),
    });

    await useAppStore.getState().editPr(SESSION_ID, 42, { title: 'A new title' });

    expect(sentTo({ command: 'gitlab_update_mr' })).toEqual([
      expect.objectContaining({ mrIid: 42, title: 'Draft: A new title' }),
    ]);
  });

  it('marks ready by taking the prefix off the title', async () => {
    serve({
      command: 'gitlab_get_mr',
      answer: () => ({ ...MR, draft: true, title: 'Draft: Stop retried webhooks' }),
    });

    await useAppStore.getState().markPrReady(SESSION_ID, 42);

    expect(sentTo({ command: 'gitlab_update_mr' })).toEqual([
      expect.objectContaining({ mrIid: 42, title: 'Stop retried webhooks' }),
    ]);
  });

  it('converts to a draft by putting the prefix on the title', async () => {
    await useAppStore.getState().convertPrToDraft(SESSION_ID, 42);

    expect(sentTo({ command: 'gitlab_update_mr' })).toEqual([
      expect.objectContaining({
        mrIid: 42,
        title: 'Draft: Stop retried webhooks posting a second credit',
      }),
    ]);
  });

  it('closes and reopens through the state command', async () => {
    await useAppStore.getState().closePr(SESSION_ID, 42);
    seedMr({ mr: { ...MR, state: 'closed' } });
    await useAppStore.getState().reopenPr(SESSION_ID, 42);

    expect(sentTo({ command: 'gitlab_update_mr_state' })).toEqual([
      expect.objectContaining({ mrIid: 42, stateEvent: 'close' }),
      expect.objectContaining({ mrIid: 42, stateEvent: 'reopen' }),
    ]);
  });

  it('asks for a reviewer by id and keeps the ones already asked', async () => {
    serve({
      command: 'gitlab_search_project_users',
      answer: () => [{ id: 7, username: 'kenji-w', name: 'Kenji Watanabe', avatarUrl: null }],
    });

    await useAppStore.getState().requestReview(SESSION_ID, 42, ['kenji-w']);

    expect(sentTo({ command: 'gitlab_update_mr' })).toEqual([
      expect.objectContaining({ mrIid: 42, reviewerIds: [4, 7] }),
    ]);
  });

  it('merges with the chosen method', async () => {
    await useAppStore.getState().mergePr(SESSION_ID, 42, 'squash');

    expect(sentTo({ command: 'gitlab_merge_mr' })).toEqual([
      expect.objectContaining({ mrIid: 42, method: 'squash' }),
    ]);
  });

  it('keeps the host text when GitLab refuses and says it was reported', async () => {
    serve({
      command: 'gitlab_update_mr',
      answer: () => {
        throw { kind: 'http', message: 'http error 403: {"message":"403 Forbidden"}' };
      },
    });

    const error = await useAppStore
      .getState()
      .editPr(SESSION_ID, 42, { body: 'x', isQuiet: true })
      .then(
        () => null,
        (caught: unknown) => caught,
      );

    expect(isReportedError(error)).toBe(true);
    expect((error as Error).message).toBe('{"message":"403 Forbidden"}');
  });
});
