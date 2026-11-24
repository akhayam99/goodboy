import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
} from '@goodboy/types';
import {
  type Ctx,
  type Row,
  WAIT,
  both,
  branchTab,
  click,
  heading,
  openCrumb,
  settle,
  useAppStore,
} from './harness';
import { aMountGithub } from '../../../store/slices/github/testing/aMountGithub';
import { bitbucketWrites, resetBitbucketBridge } from './bitbucket-page.runner';

const TITLE = 'Stop retried webhooks posting a second credit';

const NOW = '2026-10-06T09:30:00.000Z' as IsoDateTime;

type Status = 'SUCCESSFUL' | 'FAILED';

const connectBitbucket = async ({
  ctx,
  statuses,
}: {
  readonly ctx: Ctx;
  readonly statuses: ReadonlyArray<Status>;
}): Promise<void> => {
  const state = useAppStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === ctx.sessionId);
  const mount = state.sessionProjectMounts[ctx.sessionId]?.[0];
  if (session === undefined || mount === undefined) {
    throw new Error('the board seed has no session with a mount');
  }
  const binding: IntegrationBinding = {
    id: 'journey-bitbucket-binding' as IntegrationBindingId,
    workspaceId: session.workspaceId,
    projectId: null,
    credentialId: 'journey-bitbucket-credential' as IntegrationCredentialId,
    createdAt: NOW,
    updatedAt: NOW,
    provider: 'bitbucket',
    config: { workspaceSlug: 'harborline', email: 'nadia@harborline.test' },
  };
  resetBitbucketBridge({ branch: mount.branch, statuses });
  const siblingMounts = Object.values(state.sessionProjectMounts)
    .flat()
    .flatMap((candidate) =>
      candidate.mountId === undefined || candidate.mountId === mount.mountId
        ? []
        : [{ mountId: candidate.mountId, projectId: candidate.projectId }],
    );
  useAppStore.setState({
    mountGithub: {
      ...state.mountGithub,
      ...Object.fromEntries(
        siblingMounts.map(({ mountId, projectId }) => [
          mountId,
          aMountGithub({ mountId, projectId }),
        ]),
      ),
    },
    workspaceIntegrations: { ...state.workspaceIntegrations, [session.workspaceId]: [binding] },
    refreshSessionPr: async () => undefined,
    refreshSessionPrDetail: async () => undefined,
    recordSessionEventOnce: async () => undefined,
    updateResolveThreads: async () => undefined,
    materializeReviewThreads: async () => 0,
    reconcileResolveLane: async () => undefined,
    reconcileHandReplies: async () => 0,
    syncSourceSnapshots: async () => undefined,
  });
  await useAppStore.getState().refreshSessionBitbucketPr(ctx.sessionId, { force: true });
  await settle();
};

const goalOf = (ctx: Ctx): string => {
  const goal = useAppStore
    .getState()
    .sessions.find((session) => session.id === ctx.sessionId)?.goal;
  if (goal === undefined) {
    throw new Error('the board seed lost its session');
  }
  return goal;
};

const sessionsMarks = async (ctx: Ctx): Promise<ReadonlyArray<string | null>> => {
  if (document.querySelector('[role="listbox"][aria-label="Sessions"]') === null) {
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
  }
  const list = await screen.findByRole('listbox', { name: 'Sessions' }, WAIT);
  const row = within(list)
    .getAllByRole('option')
    .find((option) => option.textContent?.startsWith(goalOf(ctx)) === true);
  return [row?.querySelector('[data-status-mark]')?.getAttribute('data-status-state') ?? null];
};

export const BITBUCKET_PAGE_ROWS: ReadonlyArray<Row> = [
  {
    name: 'bitbucket page: a Bitbucket session lands on the Pull request tab with its title and no draft control',
    covers: ['navigate', 'tab:pr', 'bitbucket-page:landing'],
    seed: 'issue',
    open: async (ctx) => {
      await connectBitbucket({ ctx, statuses: ['SUCCESSFUL'] });
      await openCrumb(/^Branch/);
    },
    lands: both(
      branchTab('pr'),
      () => heading(TITLE),
      async () => {
        expect(screen.queryByRole('button', { name: /Mark ready|Convert to draft/ })).toBeNull();
        expect(
          screen
            .queryAllByText(/GitHub/)
            .filter((node) => node.closest('[data-select-id]') === null),
        ).toEqual([]);
      },
    ),
  },
  {
    name: 'bitbucket page: edit the title, Save, and Bitbucket gets one update that the page then shows',
    covers: ['navigate', 'tab:pr', 'bitbucket-page:title'],
    seed: 'issue',
    open: async (ctx) => {
      await connectBitbucket({ ctx, statuses: ['SUCCESSFUL'] });
      await openCrumb(/^Branch/);
      await branchTab('pr')(ctx);
      await heading(TITLE);
      await click(await screen.findByRole('button', { name: TITLE }, WAIT));
      const input = await screen.findByRole('textbox', { name: 'Pull request title' }, WAIT);
      fireEvent.change(input, { target: { value: 'Key the credit guard on the event id' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await settle();
    },
    lands: async () => {
      await heading('Key the credit guard on the event id');
      await waitFor(() => {
        const updates = bitbucketWrites().filter(
          (write) => write.command === 'bitbucket_update_pull_request',
        );
        expect(updates).toHaveLength(1);
        expect(updates[0]?.args).toMatchObject({
          title: 'Key the credit guard on the event id',
          pullRequestId: 42,
        });
      }, WAIT);
    },
  },
  {
    name: 'bitbucket page: a failed status turns the Sessions mark to failed',
    covers: ['bitbucket-page:marks'],
    seed: 'issue',
    open: async (ctx) => {
      await connectBitbucket({ ctx, statuses: ['FAILED'] });
    },
    lands: async (ctx) => {
      await waitFor(async () => expect(await sessionsMarks(ctx)).toContain('failed'), WAIT);
    },
  },
  {
    name: 'bitbucket page: green statuses and an approval mark the Sessions row ready, never failed',
    covers: ['bitbucket-page:marks'],
    seed: 'issue',
    open: async (ctx) => {
      await connectBitbucket({ ctx, statuses: ['SUCCESSFUL'] });
    },
    lands: async (ctx) => {
      await waitFor(async () => expect(await sessionsMarks(ctx)).toContain('approved'), WAIT);
      expect(await sessionsMarks(ctx)).not.toContain('failed');
    },
  },
];
