import { expect } from 'vitest';
import { act } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import { brandId, type IsoDateTime, type SessionProjectMount } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import type { MountGitlabMrState } from '../../../store/slices/gitlab-mr/state';
import { branchPlace, sessionPlace } from '../../../store/slices/navigation/place';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { selectActiveMountId } from '../../../store/slices/project-mounts/selectors';
import { type Ctx, type Row, WAIT, both, branchTab, lens, settle, useAppStore } from './harness';

type Mounts = {
  readonly first: SessionProjectMount;
  readonly second: SessionProjectMount;
};

const mountsOf = ({ sessionId }: Ctx): Mounts => {
  const [first, second] = useAppStore.getState().sessionProjectMounts[sessionId] ?? [];
  if (first === undefined || second === undefined) {
    throw new Error('the pull request seed has no session with two mounts');
  }
  return { first, second };
};

const go = async (run: () => void | Promise<void>): Promise<void> => {
  await act(async () => {
    await run();
  });
  await settle();
};

const shownPath = ({ sessionId }: Ctx): string | null =>
  useAppStore.getState().diffMountPath[sessionId] ?? null;

const topEntryMount = (): string | null => {
  const state = useAppStore.getState();
  const stack = state.navigation[state.currentWorkspaceId ?? ''];
  const place = stack?.entries[stack.index]?.place;
  const target = place?.at === 'session' ? place.view.target : null;
  return target?.kind === 'branch' ? target.mountPath : null;
};

const showsMount =
  ({ pick }: { readonly pick: (mounts: Mounts) => SessionProjectMount }) =>
  async (ctx: Ctx): Promise<void> => {
    const expected = pick(mountsOf(ctx)).worktreePath;
    await waitFor(() => expect(shownPath(ctx)).toBe(expected), WAIT);
  };

const viewFirstMountFiles = async (ctx: Ctx): Promise<void> => {
  const { first } = mountsOf(ctx);
  await go(() =>
    useAppStore.getState().navigate({
      to: branchPlace({ sessionId: ctx.sessionId, mountPath: first.worktreePath, tab: 'files' }),
    }),
  );
  expect(shownPath(ctx)).toBe(first.worktreePath);
};

const GITLAB_MR: GitlabMergeRequest = {
  id: 7701,
  iid: 77,
  projectId: 9,
  title: 'Retry the relay on 503',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/northwind/notify-relay/-/merge_requests/77',
  sourceBranch: 'hl/relay-retry',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' }),
};

const seedGitlabWriteDestination = (ctx: Ctx): void => {
  const { first, second } = mountsOf(ctx);
  const state = useAppStore.getState();
  const shownGithub = state.mountGithub[first.mountId];
  if (shownGithub === undefined) {
    throw new Error('the pull request seed has no GitHub mount');
  }
  const writeMr: MountGitlabMrState = {
    mountId: second.mountId,
    projectId: second.projectId,
    revision: 1,
    host: 'https://gitlab.com',
    projectPath: 'northwind/notify-relay',
    branch: second.branch,
    mrs: [GITLAB_MR],
    links: [],
    mr: GITLAB_MR,
    approvals: null,
    fetchedAt: brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' }),
    loading: false,
    error: null,
  };
  useAppStore.setState({
    mountGitlabMr: { ...state.mountGitlabMr, [second.mountId]: writeMr },
    sessionActiveMount: { ...state.sessionActiveMount, [ctx.sessionId]: second.mountId },
  });
};

const branchPaneText = (): string =>
  document.querySelector('[data-branch-pane]')?.textContent ?? '';

export const TARGET_IDENTITY_ROWS: ReadonlyArray<Row> = [
  {
    name: 'view mount A, open the Pull request door on mount B: the address names B',
    covers: ['navigate', 'target:door-names-its-mount'],
    open: async (ctx) => {
      await viewFirstMountFiles(ctx);
      const { second } = mountsOf(ctx);
      await go(() => {
        const state = useAppStore.getState();
        state.navigate({
          to: lensPlace({
            state,
            sessionId: ctx.sessionId,
            lens: 'pr',
            mountPath: second.worktreePath,
          }),
        });
      });
    },
    lands: both(lens('branch'), showsMount({ pick: (mounts) => mounts.second })),
  },
  {
    name: 'view mount A, open the Files door on mount B: B wins over the mount on screen',
    covers: ['navigate', 'target:files-door-names-its-mount'],
    open: async (ctx) => {
      await viewFirstMountFiles(ctx);
      const { second } = mountsOf(ctx);
      await go(() => {
        const state = useAppStore.getState();
        state.navigate({
          to: lensPlace({
            state,
            sessionId: ctx.sessionId,
            lens: 'files',
            mountPath: second.worktreePath,
          }),
        });
      });
    },
    lands: both(branchTab('files'), showsMount({ pick: (mounts) => mounts.second })),
  },
  {
    name: 'view mount A, open mount B from its row: the Files page shows B',
    covers: ['openMountDiff', 'target:row-names-its-mount'],
    open: async (ctx) => {
      await viewFirstMountFiles(ctx);
      const { second } = mountsOf(ctx);
      await go(() => useAppStore.getState().openMountDiff(ctx.sessionId, second.worktreePath));
    },
    lands: both(branchTab('files'), showsMount({ pick: (mounts) => mounts.second })),
  },
  {
    name: 'view mount A, open the stopped rebase of mount B by its id: the Commits page shows B',
    covers: ['openMountCommits', 'target:stop-names-its-mount'],
    open: async (ctx) => {
      await viewFirstMountFiles(ctx);
      const { second } = mountsOf(ctx);
      await go(() => {
        useAppStore
          .getState()
          .openMountCommits({ sessionId: ctx.sessionId, mountId: second.mountId });
      });
    },
    lands: both(branchTab('commits'), showsMount({ pick: (mounts) => mounts.second })),
  },
  {
    name: 'a request without a mount stays without one: the stored address does not copy mount A',
    covers: ['navigate', 'target:no-fill'],
    open: async (ctx) => {
      await viewFirstMountFiles(ctx);
      await go(() =>
        useAppStore
          .getState()
          .navigate({ to: branchPlace({ sessionId: ctx.sessionId, tab: 'comments' }) }),
      );
    },
    lands: async (ctx) => {
      await lens('branch')(ctx);
      expect(shownPath(ctx)).toBeNull();
      expect(topEntryMount()).toBeNull();
    },
  },
  {
    name: 'Back to an address with no mount leaves the write destination on B',
    covers: ['navigate', 'back', 'target:back-keeps-destination'],
    open: async (ctx) => {
      const { first, second } = mountsOf(ctx);
      await act(async () => {
        await useAppStore
          .getState()
          .setSessionActiveMount({ sessionId: ctx.sessionId, mountId: first.mountId });
      });
      await go(() =>
        useAppStore
          .getState()
          .navigate({ to: branchPlace({ sessionId: ctx.sessionId, tab: 'files' }) }),
      );
      await act(async () => {
        await useAppStore
          .getState()
          .setSessionActiveMount({ sessionId: ctx.sessionId, mountId: second.mountId });
      });
      await go(() =>
        useAppStore.getState().navigate({ to: sessionPlace({ sessionId: ctx.sessionId }) }),
      );
      await go(() => useAppStore.getState().back());
    },
    lands: async (ctx) => {
      const { second } = mountsOf(ctx);
      await lens('branch')(ctx);
      await waitFor(
        () =>
          expect(
            selectActiveMountId({ state: useAppStore.getState(), sessionId: ctx.sessionId }),
          ).toBe(second.mountId),
        WAIT,
      );
    },
  },
  {
    name: 'GitHub mount on screen, GitLab mount written to: the page speaks GitHub, not GitLab',
    covers: ['navigate', 'target:shown-mount-names-host'],
    open: async (ctx) => {
      seedGitlabWriteDestination(ctx);
      const { first } = mountsOf(ctx);
      await go(() =>
        useAppStore.getState().navigate({
          to: branchPlace({ sessionId: ctx.sessionId, mountPath: first.worktreePath, tab: 'pr' }),
        }),
      );
    },
    lands: async (ctx) => {
      const { first, second } = mountsOf(ctx);
      const shownPr = useAppStore.getState().mountGithub[first.mountId]?.pr?.number;
      await lens('branch')(ctx);
      await waitFor(() => expect(branchPaneText()).toContain(`#${shownPr}`), WAIT);
      expect(branchPaneText()).not.toContain(`!${GITLAB_MR.iid}`);
      expect(branchPaneText()).not.toMatch(/merge request/i);
      expect(selectActiveMountId({ state: useAppStore.getState(), sessionId: ctx.sessionId })).toBe(
        second.mountId,
      );
    },
  },
  {
    name: 'Back to a branch address with a mount leaves the write destination where it is',
    covers: ['navigate', 'back', 'target:back-keeps-destination-with-mount'],
    open: async (ctx) => {
      const { first, second } = mountsOf(ctx);
      await act(async () => {
        await useAppStore
          .getState()
          .setSessionActiveMount({ sessionId: ctx.sessionId, mountId: second.mountId });
      });
      await go(() =>
        useAppStore.getState().navigate({
          to: branchPlace({
            sessionId: ctx.sessionId,
            mountPath: first.worktreePath,
            tab: 'files',
          }),
        }),
      );
      await go(() =>
        useAppStore.getState().navigate({ to: sessionPlace({ sessionId: ctx.sessionId }) }),
      );
      await go(() => useAppStore.getState().back());
    },
    lands: async (ctx) => {
      const { second } = mountsOf(ctx);
      await showsMount({ pick: (mounts) => mounts.first })(ctx);
      expect(selectActiveMountId({ state: useAppStore.getState(), sessionId: ctx.sessionId })).toBe(
        second.mountId,
      );
    },
  },
];
