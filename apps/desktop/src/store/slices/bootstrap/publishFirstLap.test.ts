// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, PublishOutcome } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import type { GetFn, SetFn } from '../../slice-types';

const h = vi.hoisted(() => ({
  createGithubRepo: vi.fn(),
  linkProjectRemote: vi.fn(),
  publishProjectMain: vi.fn(),
  probeProjectRemote: vi.fn(),
}));

vi.mock('@goodboy/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/core')>()),
  createGithubRepo: h.createGithubRepo,
}));
vi.mock('@goodboy/db', async () => (await import('../../../test/dbMock')).createDbMock({}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { publishFirstLap } from './publishFirstLap';

const PROJECT_ID = 'proj-cascadia' as ProjectId;
const ADDRESS = 'https://github.com/dana-reyes/cascadia';

const makeStore = (kind: 'repo' | 'folder' = 'repo') => {
  const store: { state: AppStore } = {
    state: {
      ...useAppStore.getState(),
      projects: [aProject({ id: PROJECT_ID, kind, rootPath: '/games/cascadia' })],
      linkProjectRemote: h.linkProjectRemote,
      publishProjectMain: h.publishProjectMain,
      probeProjectRemote: h.probeProjectRemote,
    },
  };
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(store.state) : partial;
    store.state = { ...store.state, ...next };
  };
  const get: GetFn = () => store.state;
  return { set, get };
};

const published: PublishOutcome = { kind: 'published', branch: 'main', sha: 'abc1234' };

beforeEach(() => {
  vi.clearAllMocks();
  h.createGithubRepo.mockResolvedValue({
    kind: 'ok',
    repo: { nameWithOwner: 'dana-reyes/cascadia', url: ADDRESS, sshUrl: '', isPrivate: true },
  });
  h.linkProjectRemote.mockResolvedValue(undefined);
  h.publishProjectMain.mockResolvedValue(published);
  h.probeProjectRemote.mockResolvedValue({ kind: 'main-present', branch: 'main', sha: 'abc1234' });
});

describe('publishFirstLap with a new GitHub repository', () => {
  it('creates the repository, links its https address, pushes main and probes again', async () => {
    const { set, get } = makeStore();

    const result = await publishFirstLap(
      set,
      get,
    )({
      projectId: PROJECT_ID,
      remote: { kind: 'github', name: 'cascadia', visibility: 'private', owner: 'dana-reyes' },
    });

    expect(result).toEqual({ kind: 'published', branch: 'main', remoteUrl: ADDRESS });
    expect(h.createGithubRepo).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'cascadia', owner: 'dana-reyes', visibility: 'private' }),
    );
    expect(h.linkProjectRemote).toHaveBeenCalledWith({ projectId: PROJECT_ID, remoteUrl: ADDRESS });
    expect(h.publishProjectMain).toHaveBeenCalledWith({ projectId: PROJECT_ID });
    expect(h.probeProjectRemote).toHaveBeenCalledWith({ projectId: PROJECT_ID });
  });

  it('stops at the create step and touches nothing else when GitHub refuses', async () => {
    h.createGithubRepo.mockResolvedValue({ kind: 'failed', message: 'name already exists' });
    const { set, get } = makeStore();

    const result = await publishFirstLap(
      set,
      get,
    )({
      projectId: PROJECT_ID,
      remote: { kind: 'github', name: 'cascadia', visibility: 'public', owner: null },
    });

    expect(result).toEqual({
      kind: 'failed',
      step: 'create',
      message: 'name already exists',
      remoteUrl: null,
    });
    expect(h.linkProjectRemote).not.toHaveBeenCalled();
    expect(h.publishProjectMain).not.toHaveBeenCalled();
  });

  it('keeps the created repository address when the push fails so publishing can be retried', async () => {
    h.publishProjectMain.mockResolvedValue({
      kind: 'failed',
      step: 'push',
      message: 'remote: Permission denied',
    } satisfies PublishOutcome);
    const { set, get } = makeStore();

    const result = await publishFirstLap(
      set,
      get,
    )({
      projectId: PROJECT_ID,
      remote: { kind: 'github', name: 'cascadia', visibility: 'private', owner: 'dana-reyes' },
    });

    expect(result).toEqual({
      kind: 'failed',
      step: 'push',
      message: 'remote: Permission denied',
      remoteUrl: ADDRESS,
    });
    expect(h.probeProjectRemote).not.toHaveBeenCalled();
  });
});

describe('publishFirstLap with an address', () => {
  it('links the trimmed address and publishes', async () => {
    const { set, get } = makeStore();

    const result = await publishFirstLap(
      set,
      get,
    )({
      projectId: PROJECT_ID,
      remote: { kind: 'address', url: '  git@gitlab.example.com:dana/cascadia.git ' },
    });

    expect(result.kind).toBe('published');
    expect(h.createGithubRepo).not.toHaveBeenCalled();
    expect(h.linkProjectRemote).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      remoteUrl: 'git@gitlab.example.com:dana/cascadia.git',
    });
  });

  it('never pushes into a remote that already has main', async () => {
    h.publishProjectMain.mockResolvedValue({ kind: 'remote-has-main', branch: 'main' });
    const { set, get } = makeStore();

    const result = await publishFirstLap(
      set,
      get,
    )({
      projectId: PROJECT_ID,
      remote: { kind: 'address', url: ADDRESS },
    });

    expect(result).toEqual({ kind: 'remote-has-main', branch: 'main', remoteUrl: ADDRESS });
    expect(h.probeProjectRemote).toHaveBeenCalledTimes(1);
  });

  it('reports a different origin as a link failure', async () => {
    h.linkProjectRemote.mockRejectedValue(new Error('this project already has a different origin'));
    const { set, get } = makeStore();

    const result = await publishFirstLap(
      set,
      get,
    )({
      projectId: PROJECT_ID,
      remote: { kind: 'address', url: ADDRESS },
    });

    expect(result).toMatchObject({ kind: 'failed', step: 'link' });
    expect(h.publishProjectMain).not.toHaveBeenCalled();
  });

  it('refuses a project that is not a repository', async () => {
    const { set, get } = makeStore('folder');

    const result = await publishFirstLap(
      set,
      get,
    )({
      projectId: PROJECT_ID,
      remote: { kind: 'address', url: ADDRESS },
    });

    expect(result).toMatchObject({ kind: 'failed', step: 'link' });
    expect(h.linkProjectRemote).not.toHaveBeenCalled();
  });
});
