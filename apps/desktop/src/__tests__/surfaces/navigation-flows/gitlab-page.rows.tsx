import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { IntegrationBindingId, IntegrationCredentialId, IsoDateTime } from '@goodboy/types';
import type {
  GitlabMergeRequest,
  GitlabMrApprovalState,
} from '../../../features/integrations/gitlab/client';
import {
  type Ctx,
  type Row,
  WAIT,
  click,
  heading,
  lens,
  openCrumb,
  settle,
  useAppStore,
} from './harness';
import { gitlabCalls, gitlabPageBridge, resetGitlabMr } from './gitlab-page.runner';

const HOST = 'https://gitlab.com';
const PROJECT_PATH = 'harborline/payments-api';

const stopSyncs = (): void => {
  useAppStore.setState({
    refreshSessionPr: async () => undefined,
    refreshSessionPrDetail: async () => undefined,
    recordSessionEventOnce: async () => undefined,
    updateResolveThreads: async () => undefined,
    materializeReviewThreads: async () => 0,
    reconcileResolveLane: async () => undefined,
    reconcileHandReplies: async () => 0,
    syncSourceSnapshots: async () => undefined,
  });
};

const readMergeRequest = async (): Promise<GitlabMergeRequest> =>
  (await gitlabPageBridge('gitlab_get_mr')) as GitlabMergeRequest;

const readApprovals = async (): Promise<GitlabMrApprovalState> =>
  (await gitlabPageBridge('gitlab_mr_approval_state')) as GitlabMrApprovalState;

const rereadMergeRequest = async ({ ctx }: { readonly ctx: Ctx }): Promise<void> => {
  const state = useAppStore.getState();
  const mount = state.sessionProjectMounts[ctx.sessionId]?.[0];
  const entry = mount === undefined ? undefined : state.mountGitlabMr[mount.mountId];
  if (mount === undefined || entry === undefined) {
    return;
  }
  const mr = await readMergeRequest();
  const next = { ...entry, mr, mrs: [mr] };
  useAppStore.setState({
    mountGitlabMr: { ...state.mountGitlabMr, [mount.mountId]: next },
    sessionGitlabMr: {
      ...state.sessionGitlabMr,
      [ctx.sessionId]: {
        mr,
        approvals: entry.approvals ?? null,
        fetchedAt: entry.fetchedAt,
        loading: false,
        error: null,
      },
    },
  });
};

const becomeGitlabSession = async (ctx: Ctx): Promise<void> => {
  resetGitlabMr();
  stopSyncs();
  const state = useAppStore.getState();
  const mount = state.sessionProjectMounts[ctx.sessionId]?.[0];
  const session = state.sessions.find((candidate) => candidate.id === ctx.sessionId);
  if (mount === undefined || session === undefined) {
    throw new Error('the seed has no mount to put a merge request on');
  }
  const mr = await readMergeRequest();
  const approvals = await readApprovals();
  const stamp = '2026-09-04T10:00:00.000Z' as IsoDateTime;
  const entry = {
    mountId: mount.mountId,
    projectId: mount.projectId,
    revision: mount.revision,
    host: HOST,
    projectPath: PROJECT_PATH,
    branch: mount.branch,
    mrs: [mr],
    links: [],
    mr,
    approvals,
    fetchedAt: stamp,
    loading: false,
    error: null,
  };
  useAppStore.setState({
    workspaceIntegrations: {
      ...state.workspaceIntegrations,
      [session.workspaceId]: [
        {
          id: 'gitlab-binding' as IntegrationBindingId,
          workspaceId: session.workspaceId,
          projectId: null,
          credentialId: 'gitlab-credential' as IntegrationCredentialId,
          createdAt: stamp,
          updatedAt: stamp,
          provider: 'gitlab',
          config: { userName: 'nadia-p', userId: '3', host: HOST },
        },
      ],
    },
    mountGitlabMr: { ...state.mountGitlabMr, [mount.mountId]: entry },
    sessionGitlabMr: {
      ...state.sessionGitlabMr,
      [ctx.sessionId]: { mr, approvals, fetchedAt: stamp, loading: false, error: null },
    },
    refreshSessionMr: async () => rereadMergeRequest({ ctx }),
  });
};

const openMergeRequestPage = async (ctx: Ctx): Promise<void> => {
  await becomeGitlabSession(ctx);
  await openCrumb(/^Branch/);
  await lens('branch')(ctx);
};

const tabLabels = (): ReadonlyArray<string> =>
  screen.getAllByRole('tab').map((tab) => tab.textContent ?? '');

const activity = (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Activity' }, WAIT);

const selectedBranchTab = (ctx: Ctx): string | undefined =>
  useAppStore.getState().branchTab[ctx.sessionId];

export const GITLAB_PAGE_ROWS: ReadonlyArray<Row> = [
  {
    name: 'gitlab page: a GitLab branch lands on the Merge request tab, first of the five, with its number',
    covers: ['navigate', 'tab:pr', 'gitlab-page:identity'],
    seed: 'issue',
    open: openMergeRequestPage,
    lands: async (ctx) => {
      await heading(/Stop retried webhooks/);
      await waitFor(() => {
        expect(selectedBranchTab(ctx)).toBe('pr');
        expect(tabLabels()[0]).toMatch(/^Merge request/);
        expect(tabLabels()).toHaveLength(5);
      }, WAIT);
      expect(await screen.findByText('MR !42', undefined, WAIT)).toBeDefined();
      expect(screen.queryByText(/pull request/i)).toBeNull();
    },
  },
  {
    name: 'gitlab page: edit the description, Save, and the activity shows the edit',
    covers: ['navigate', 'tab:pr', 'gitlab-page:description'],
    seed: 'issue',
    open: async (ctx) => {
      await openMergeRequestPage(ctx);
      await activity();
      const description = await screen.findByRole('region', { name: 'Description' }, WAIT);
      await click(within(description).getByRole('button', { name: 'Edit' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Description, markdown' }), {
        target: { value: 'Retried webhooks no longer post a second credit.' },
      });
      await click(screen.getByRole('button', { name: 'Save' }));
    },
    lands: async () => {
      expect(
        await within(await activity()).findByText(/edited the description/, undefined, WAIT),
      ).toBeDefined();
      expect(gitlabCalls({ command: 'gitlab_update_mr' })).toEqual([
        expect.objectContaining({
          mrIid: 42,
          projectPath: 'harborline/payments-api',
          description: 'Retried webhooks no longer post a second credit.',
        }),
      ]);
      expect(screen.queryByRole('textbox', { name: 'Description, markdown' })).toBeNull();
      expect(
        await screen.findByText(/no longer post a second credit/, undefined, WAIT),
      ).toBeDefined();
    },
  },
  {
    name: 'gitlab page: Merge asks for a method, the project forbids two, and it merges once',
    covers: ['navigate', 'tab:pr', 'gitlab-page:merge'],
    seed: 'issue',
    open: async (ctx) => {
      await openMergeRequestPage(ctx);
      await settle();
      await click(
        await waitFor(() => {
          const button = document.querySelector<HTMLElement>(
            '[data-branch-primary="pullRequest.merge"]',
          );
          expect(button).not.toBeNull();
          return button as HTMLElement;
        }, WAIT),
      );
      const methods = await screen.findByRole('tablist', { name: 'Merge method' }, WAIT);
      for (const name of [/Squash and merge/, /Rebase and merge/]) {
        const tab = within(methods).getByRole('tab', { name });
        expect(tab.hasAttribute('disabled')).toBe(true);
        expect(within(tab).getByText('Set by the project')).toBeDefined();
      }
      const confirm = within(screen.getByRole('group', { name: /^Merge !42 into main/ }));
      await click(confirm.getByRole('button', { name: 'Merge' }));
      await settle(8);
    },
    lands: async () => {
      await waitFor(
        () =>
          expect(gitlabCalls({ command: 'gitlab_merge_mr' })).toEqual([
            expect.objectContaining({ mrIid: 42, method: 'merge' }),
          ]),
        WAIT,
      );
      expect(await screen.findAllByText(/^Merged !42 into main$/, undefined, WAIT)).toHaveLength(1);
    },
  },
];
