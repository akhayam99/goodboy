// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountPullRequestLink, SessionEvent } from '@goodboy/types';

const h = vi.hoisted(() => ({
  insertEvent: vi.fn(async (_params: { readonly event: SessionEvent }) => undefined),
  upsertLink: vi.fn(async (_params: { readonly link: MountPullRequestLink }) => true),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({
    findPrSeriesMembership: vi.fn(async () => null),
    listMountPullRequestLinks: vi.fn(async () => []),
    upsertMountPullRequestLink: h.upsertLink,
    insertSessionEvent: h.insertEvent,
  }),
);

import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { gitlabMrFixture } from './testing/gitlabMrFixture';

const { session, ledgerMount, relayMount, makeMr } = gitlabMrFixture;

let useAppStore: StoryStore;

const { invokeCalls: invokes, recordOf } = gitlabMrFixture;

const stubHost = ({ create }: { readonly create: (args: unknown) => unknown }) => {
  stubStoryInvoke({
    worktree_remote_url: gitlabMrFixture.remoteUrlOf,
    gitlab_create_mr: create,
    gitlab_mr_for_branch: null,
    gitlab_get_mr: null,
    gitlab_mr_approval_state: null,
  });
};

const createdMrFor = (args: unknown) => {
  const sourceBranch = String(recordOf({ value: args }).sourceBranch);
  return makeMr({ iid: 12, name: sourceBranch.replace('ak/', '') });
};

const errorTitles = (): ReadonlyArray<string> =>
  useAppStore
    .getState()
    .notifications.filter((notification) => notification.kind === 'error')
    .map((notification) => notification.title);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.insertEvent.mockClear();
  h.upsertLink.mockClear();
  useAppStore.setState(gitlabMrFixture.seedState());
  stubHost({ create: createdMrFor });
});

describe('createMrForSession on the real store', () => {
  it('creates the merge request on the mount it names, not the active one', async () => {
    await useAppStore.getState().createMrForSession({
      sessionId: session.id,
      mountId: relayMount,
      title: 'Relay change',
      description: 'Retry notify-relay deliveries',
    });

    expect(invokes({ command: 'gitlab_create_mr' })).toHaveLength(1);
    expect(invokes({ command: 'gitlab_create_mr' })[0]?.args).toMatchObject({
      workspaceId: gitlabMrFixture.workspace.id,
      host: 'gitlab.com',
      projectPath: 'acme/notify-relay',
      sourceBranch: 'ak/notify-relay',
      targetBranch: 'main',
      title: 'Relay change',
      draft: true,
    });
    expect(h.upsertLink).toHaveBeenCalledTimes(1);
    expect(h.upsertLink.mock.calls[0]?.[0]).toMatchObject({
      sessionId: session.id,
      link: { mountId: relayMount, repoSlug: 'acme/notify-relay', prNumber: 12 },
    });
  });

  it('keeps the active mount when no mount is named', async () => {
    await useAppStore.getState().createMrForSession({ sessionId: session.id });

    expect(invokes({ command: 'gitlab_create_mr' })[0]?.args).toMatchObject({
      projectPath: 'acme/ledger-core',
      sourceBranch: 'ak/ledger-core',
      title: session.goal,
    });
    expect(h.upsertLink.mock.calls[0]?.[0]).toMatchObject({ link: { mountId: ledgerMount } });
  });

  it('records the creation once against the mount that owns it and refreshes only that mount', async () => {
    await useAppStore.getState().createMrForSession({ sessionId: session.id, mountId: relayMount });

    const created = h.insertEvent.mock.calls.filter(
      ([params]) => params.event.kind === 'pr_created',
    );
    expect(created).toHaveLength(1);
    expect(created[0]?.[0].event.payload?.mountId).toBe(relayMount);
    expect(
      invokes({ command: 'gitlab_mr_for_branch' }).map((call) => call.args.sourceBranch),
    ).toEqual(['ak/notify-relay', 'ak/notify-relay']);
  });

  it('opens no push step: the branch is not pushed before the host call', async () => {
    await useAppStore.getState().createMrForSession({ sessionId: session.id });

    expect(storySpies.gitPush).not.toHaveBeenCalled();
    expect(invokes({ command: 'git_push' })).toHaveLength(0);
  });

  it('stops before the host when no GitLab binding exists', async () => {
    useAppStore.setState(gitlabMrFixture.seedState({ hasGitlab: false }));

    await expect(
      useAppStore.getState().createMrForSession({ sessionId: session.id, mountId: relayMount }),
    ).rejects.toThrow('No GitLab project is linked to this session yet');

    expect(invokes({ command: 'gitlab_create_mr' })).toHaveLength(0);
    expect(h.upsertLink).not.toHaveBeenCalled();
    expect(h.insertEvent).not.toHaveBeenCalled();
  });

  it('leaves the state alone when the host refuses, and says so loudly', async () => {
    stubHost({
      create: () => Promise.reject(new Error('403 Forbidden: token lacks api scope')),
    });
    const before = useAppStore.getState().mountGitlabMr;

    await expect(
      useAppStore.getState().createMrForSession({ sessionId: session.id, mountId: relayMount }),
    ).rejects.toThrow('403 Forbidden');

    expect(useAppStore.getState().mountGitlabMr).toBe(before);
    expect(useAppStore.getState().mountGitlabMr[relayMount]).toBeUndefined();
    expect(h.upsertLink).not.toHaveBeenCalled();
    expect(h.insertEvent).not.toHaveBeenCalled();
    expect(invokes({ command: 'gitlab_mr_for_branch' })).toHaveLength(1);
    expect(errorTitles()).toEqual(["Couldn't create the merge request"]);
    const notification = useAppStore
      .getState()
      .notifications.find((candidate) => candidate.kind === 'error');
    expect(notification?.body).toContain('403 Forbidden');
    expect(notification?.sessionId).toBe(session.id);
  });

  it('creates the merge request on a retry after the host refused once', async () => {
    stubHost({ create: () => Promise.reject(new Error('502 Bad Gateway')) });
    await expect(
      useAppStore.getState().createMrForSession({ sessionId: session.id, mountId: relayMount }),
    ).rejects.toThrow('502 Bad Gateway');

    stubHost({ create: createdMrFor });
    await useAppStore.getState().createMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(h.upsertLink).toHaveBeenCalledTimes(1);
    expect(h.upsertLink.mock.calls[0]?.[0]).toMatchObject({
      link: { mountId: relayMount, prNumber: 12 },
    });
  });
});

describe('createMrForSession, a create whose outcome was uncertain', () => {
  const OPEN_RELAY_MR = () => makeMr({ iid: 12, name: 'notify-relay' });

  const warnings = (): ReadonlyArray<string> =>
    useAppStore
      .getState()
      .notifications.filter((notification) => notification.severity === 'warning')
      .map((notification) => notification.title);

  it('returns the opened number with a warning when the link could not be saved', async () => {
    h.upsertLink.mockRejectedValueOnce(new Error('database is locked'));

    const created = await useAppStore
      .getState()
      .createMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(created).toEqual({
      number: 12,
      url: 'https://gitlab.com/acme/notify-relay/-/merge_requests/12',
    });
    expect(warnings()).toEqual(['Opened !12, but Goodboy could not save the link']);
    expect(invokes({ command: 'gitlab_create_mr' })).toHaveLength(1);
  });

  it('adopts the open merge request of the branch instead of opening a second', async () => {
    stubHost({ create: createdMrFor });
    stubStoryInvoke({
      worktree_remote_url: gitlabMrFixture.remoteUrlOf,
      gitlab_create_mr: createdMrFor,
      gitlab_mr_for_branch: OPEN_RELAY_MR,
      gitlab_get_mr: null,
      gitlab_mr_approval_state: null,
    });

    const adopted = await useAppStore
      .getState()
      .createMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(adopted.number).toBe(12);
    expect(invokes({ command: 'gitlab_create_mr' })).toHaveLength(0);
    expect(h.upsertLink.mock.calls[0]?.[0]).toMatchObject({
      link: { mountId: relayMount, prNumber: 12 },
    });
  });

  it('opens a new one when the only merge request of the branch is merged', async () => {
    stubStoryInvoke({
      worktree_remote_url: gitlabMrFixture.remoteUrlOf,
      gitlab_create_mr: createdMrFor,
      gitlab_mr_for_branch: () => ({ ...OPEN_RELAY_MR(), state: 'merged' }),
      gitlab_get_mr: null,
      gitlab_mr_approval_state: null,
    });

    await useAppStore.getState().createMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(invokes({ command: 'gitlab_create_mr' })).toHaveLength(1);
  });

  it('opens once when the first create landed but could not be recorded and the form is retried', async () => {
    h.upsertLink.mockRejectedValueOnce(new Error('database is locked'));
    await useAppStore.getState().createMrForSession({ sessionId: session.id, mountId: relayMount });
    stubStoryInvoke({
      worktree_remote_url: gitlabMrFixture.remoteUrlOf,
      gitlab_create_mr: createdMrFor,
      gitlab_mr_for_branch: OPEN_RELAY_MR,
      gitlab_get_mr: null,
      gitlab_mr_approval_state: null,
    });

    const retried = await useAppStore
      .getState()
      .createMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(retried.number).toBe(12);
    expect(invokes({ command: 'gitlab_create_mr' })).toHaveLength(1);
    expect(h.upsertLink.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(h.upsertLink.mock.calls[1]?.[0]).toMatchObject({
      link: { mountId: relayMount, prNumber: 12 },
    });
  });

  it('still opens when the lookup of the branch fails, and the create reports the real failure', async () => {
    stubStoryInvoke({
      worktree_remote_url: gitlabMrFixture.remoteUrlOf,
      gitlab_create_mr: () => Promise.reject(new Error('403 Forbidden')),
      gitlab_mr_for_branch: () => Promise.reject(new Error('offline')),
      gitlab_get_mr: null,
      gitlab_mr_approval_state: null,
    });

    await expect(
      useAppStore.getState().createMrForSession({ sessionId: session.id, mountId: relayMount }),
    ).rejects.toThrow('403 Forbidden');
  });
});
