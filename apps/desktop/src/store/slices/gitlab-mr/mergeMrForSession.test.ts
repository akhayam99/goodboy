// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
    upsertMountPullRequestLink: vi.fn(async () => true),
  }),
);

import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { isPullRequestPortError, STALE_HEAD_MESSAGE } from '@goodboy/core';
import { CommandError } from '../../../shared/lib/invokeCommand';
import { gitlabMrFixture } from './testing/gitlabMrFixture';

const { session, ledger, relay, ledgerMount, relayMount, makeMr, mountState, reviewedHead } =
  gitlabMrFixture;

let useAppStore: StoryStore;

const { invokeCalls: invokes, recordOf } = gitlabMrFixture;

const MERGE_SETTINGS = {
  mergeMethod: 'merge',
  squashOption: 'default_off',
  onlyAllowMergeIfPipelineSucceeds: false,
};

const stubHost = ({
  merge,
  settings = () => MERGE_SETTINGS,
}: {
  readonly merge: (args: unknown) => unknown;
  readonly settings?: (args: unknown) => unknown;
}) => {
  stubStoryInvoke({
    worktree_remote_url: gitlabMrFixture.remoteUrlOf,
    gitlab_merge_mr: merge,
    gitlab_project_merge_methods: settings,
    gitlab_mr_for_branch: null,
    gitlab_get_mr: null,
    gitlab_mr_approval_state: null,
  });
};

const mergedMrFor = (args: unknown) => {
  const mrIid = Number(recordOf({ value: args }).mrIid);
  return { ...makeMr({ iid: mrIid, name: 'notify-relay' }), state: 'merged' };
};

const seedMrs = () => {
  useAppStore.setState({
    ...gitlabMrFixture.seedState(),
    mountGitlabMr: {
      [ledgerMount]: mountState({
        mountId: ledgerMount,
        projectId: ledger.id,
        name: 'ledger-core',
        mr: makeMr({ iid: 11, name: 'ledger-core' }),
      }),
      [relayMount]: mountState({
        mountId: relayMount,
        projectId: relay.id,
        name: 'notify-relay',
        mr: makeMr({ iid: 12, name: 'notify-relay' }),
      }),
    },
  });
};

const errorNotifications = () =>
  useAppStore.getState().notifications.filter((notification) => notification.kind === 'error');

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedMrs();
  stubHost({ merge: mergedMrFor });
});

describe('mergeMrForSession on the real store', () => {
  it('merges the request of the mount it names, not the active one', async () => {
    await useAppStore
      .getState()
      .mergeMrForSession({ sessionId: session.id, mountId: relayMount, method: 'rebase' });

    expect(invokes({ command: 'gitlab_merge_mr' })).toHaveLength(1);
    expect(invokes({ command: 'gitlab_merge_mr' })[0]?.args).toEqual({
      workspaceId: gitlabMrFixture.workspace.id,
      projectId: relay.id,
      host: 'gitlab.com',
      projectPath: 'acme/notify-relay',
      mrIid: 12,
      method: 'rebase',
      expectedHeadSha: reviewedHead,
    });
    expect(
      invokes({ command: 'gitlab_mr_for_branch' }).map((call) => call.args.sourceBranch),
    ).toEqual(['ak/notify-relay']);
  });

  it('keeps the active mount when no mount is named', async () => {
    await useAppStore.getState().mergeMrForSession({ sessionId: session.id, method: 'squash' });

    expect(invokes({ command: 'gitlab_merge_mr' })[0]?.args).toMatchObject({
      projectPath: 'acme/ledger-core',
      mrIid: 11,
      method: 'squash',
    });
    expect(
      invokes({ command: 'gitlab_mr_for_branch' }).map((call) => call.args.sourceBranch),
    ).toEqual(['ak/ledger-core']);
  });

  it('sends the project preference when no method is chosen', async () => {
    stubHost({
      merge: mergedMrFor,
      settings: () => ({ ...MERGE_SETTINGS, mergeMethod: 'ff' }),
    });

    await useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(invokes({ command: 'gitlab_merge_mr' })[0]?.args).toMatchObject({
      method: 'rebase',
      projectId: relay.id,
    });
  });

  it('sends the host default when the project settings are off limits', async () => {
    stubHost({
      merge: mergedMrFor,
      settings: () =>
        Promise.reject(
          new CommandError({
            kind: 'http',
            message: '403 Forbidden',
            failure: { kind: 'denied', status: 403, retryAfterSeconds: null, detail: 'Forbidden' },
          }),
        ),
    });

    await useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(invokes({ command: 'gitlab_merge_mr' })[0]?.args).toMatchObject({ method: 'merge' });
  });

  it('merges nothing and says so when the project settings cannot be reached, then merges on a retry', async () => {
    stubHost({
      merge: mergedMrFor,
      settings: () => Promise.reject(new Error('connection reset')),
    });

    await expect(
      useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: relayMount }),
    ).rejects.toThrow();

    expect(invokes({ command: 'gitlab_merge_mr' })).toHaveLength(0);
    expect(errorNotifications().map((notification) => notification.title)).toEqual([
      "Couldn't merge !12",
    ]);

    stubHost({ merge: mergedMrFor });
    await useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(invokes({ command: 'gitlab_merge_mr' })).toHaveLength(1);
  });

  it('stops before the host when the mount has no request in the store', async () => {
    useAppStore.setState({ mountGitlabMr: {} });

    await useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(invokes({ command: 'gitlab_merge_mr' })).toHaveLength(0);
    expect(errorNotifications()).toHaveLength(0);
  });

  it('stops before the host when no GitLab binding exists', async () => {
    useAppStore.setState(gitlabMrFixture.seedState({ hasGitlab: false }));

    await useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(invokes({ command: 'gitlab_merge_mr' })).toHaveLength(0);
  });

  it('leaves the state alone when the host refuses, and says so loudly', async () => {
    stubHost({ merge: () => Promise.reject(new Error('405 Method Not Allowed: not mergeable')) });
    const before = useAppStore.getState().mountGitlabMr;

    await expect(
      useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: relayMount }),
    ).rejects.toThrow('405 Method Not Allowed');

    expect(useAppStore.getState().mountGitlabMr).toBe(before);
    expect(useAppStore.getState().mountGitlabMr[relayMount]?.mr?.state).toBe('opened');
    expect(invokes({ command: 'gitlab_mr_for_branch' })).toHaveLength(0);
    expect(errorNotifications().map((notification) => notification.title)).toEqual([
      "Couldn't merge !12",
    ]);
    expect(errorNotifications()[0]?.body).toContain('405 Method Not Allowed');
    expect(errorNotifications()[0]?.sessionId).toBe(session.id);
  });

  it('merges on a retry after the host refused once, without touching the sibling mount', async () => {
    stubHost({ merge: () => Promise.reject(new Error('502 Bad Gateway')) });
    await expect(
      useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: relayMount }),
    ).rejects.toThrow('502 Bad Gateway');

    stubHost({ merge: mergedMrFor });
    await useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(invokes({ command: 'gitlab_merge_mr' }).map((call) => call.args.mrIid)).toEqual([
      12, 12,
    ]);
    expect(useAppStore.getState().mountGitlabMr[ledgerMount]?.mr?.iid).toBe(11);
  });

  it('pins the merge to the head of the request the user is looking at', async () => {
    await useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: ledgerMount });

    expect(invokes({ command: 'gitlab_merge_mr' })[0]?.args.expectedHeadSha).toBe(reviewedHead);
  });

  it('pins the merge to the head the caller names over the stored one', async () => {
    await useAppStore.getState().mergeMrForSession({
      sessionId: session.id,
      mountId: relayMount,
      expectedHeadSha: '0d9c8b7a6f5e',
    });

    expect(invokes({ command: 'gitlab_merge_mr' })[0]?.args.expectedHeadSha).toBe('0d9c8b7a6f5e');
  });

  it('merges without a pin when the stored request has no head', async () => {
    useAppStore.setState({
      mountGitlabMr: {
        [relayMount]: mountState({
          mountId: relayMount,
          projectId: relay.id,
          name: 'notify-relay',
          mr: { ...makeMr({ iid: 12, name: 'notify-relay' }), sha: null },
        }),
      },
    });

    await useAppStore.getState().mergeMrForSession({ sessionId: session.id, mountId: relayMount });

    expect(invokes({ command: 'gitlab_merge_mr' })[0]?.args).not.toHaveProperty('expectedHeadSha');
  });

  it('answers a moved head with refresh and review again, and refreshes that mount', async () => {
    stubHost({
      merge: () =>
        Promise.reject(
          new CommandError({
            kind: 'stale_head',
            message: 'the branch changed after it was reviewed: SHA does not match HEAD',
          }),
        ),
    });

    const error = await useAppStore
      .getState()
      .mergeMrForSession({ sessionId: session.id, mountId: relayMount })
      .then(
        () => null,
        (caught: unknown) => (isPullRequestPortError(caught) ? caught : null),
      );

    expect(error?.kind).toBe('stale_head');
    expect(errorNotifications().map((notification) => notification.title)).toEqual([
      "Couldn't merge !12",
    ]);
    expect(errorNotifications()[0]?.body).toBe(STALE_HEAD_MESSAGE);
    expect(
      invokes({ command: 'gitlab_mr_for_branch' }).map((call) => call.args.sourceBranch),
    ).toEqual(['ak/notify-relay']);
  });
});
