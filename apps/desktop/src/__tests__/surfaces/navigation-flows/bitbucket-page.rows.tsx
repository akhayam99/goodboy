import { expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
  useAppStore.setState({
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

const sidebarTones = async (ctx: Ctx): Promise<ReadonlyArray<string | null>> => {
  const rows = await screen.findAllByRole('button', { name: goalOf(ctx) }, WAIT);
  return rows.map(
    (row) => row.querySelector('[data-node-tone]')?.getAttribute('data-node-tone') ?? null,
  );
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
        expect(screen.queryByText(/GitHub/)).toBeNull();
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
      await click(await screen.findByTitle('Edit title (E)', undefined, WAIT));
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
    name: 'bitbucket page: a failed status turns the sidebar mark red',
    covers: ['bitbucket-page:marks'],
    seed: 'issue',
    open: async (ctx) => {
      await connectBitbucket({ ctx, statuses: ['FAILED'] });
    },
    lands: async (ctx) => {
      await waitFor(async () => expect(await sidebarTones(ctx)).toContain('danger'), WAIT);
    },
  },
  {
    name: 'bitbucket page: green statuses and an approval mark the sidebar row ready, never red',
    covers: ['bitbucket-page:marks'],
    seed: 'issue',
    open: async (ctx) => {
      await connectBitbucket({ ctx, statuses: ['SUCCESSFUL'] });
    },
    lands: async (ctx) => {
      await waitFor(async () => expect(await sidebarTones(ctx)).toContain('success'), WAIT);
      expect(await sidebarTones(ctx)).not.toContain('danger');
    },
  },
];
