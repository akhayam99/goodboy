// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import type { GetFn, SetFn } from '../../slice-types';
import { selectBootstrapRemoteProbe } from './selectors';

const h = vi.hoisted(() => ({ projectRemoteProbe: vi.fn() }));

vi.mock('@goodboy/db', async () => (await import('../../../test/dbMock')).createDbMock({}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../shared/lib/repo', () => ({ projectRemoteProbe: h.projectRemoteProbe }));

import { probeProjectRemote } from './probeProjectRemote';

const PROJECT_ID = 'proj-cascadia' as ProjectId;

const makeStore = () => {
  const store: { state: AppStore } = {
    state: {
      ...useAppStore.getState(),
      projects: [aProject({ id: PROJECT_ID, kind: 'repo', rootPath: '/games/cascadia' })],
      bootstrapRemoteProbe: {},
    },
  };
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(store.state) : partial;
    store.state = { ...store.state, ...next };
  };
  const get: GetFn = () => store.state;
  return { store, set, get };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('probeProjectRemote', () => {
  it('stores the answer with the time it was read', async () => {
    h.projectRemoteProbe.mockResolvedValue({ kind: 'main-present', branch: 'main', sha: 'abc' });
    const { store, set, get } = makeStore();

    const probe = await probeProjectRemote(set, get)({ projectId: PROJECT_ID });

    expect(probe).toEqual({ kind: 'main-present', branch: 'main', sha: 'abc' });
    const entry = selectBootstrapRemoteProbe(store.state, PROJECT_ID);
    expect(entry?.probe).toEqual(probe);
    expect(entry?.readAt).toBeDefined();
  });

  it('fails closed: a thrown command is unreachable, never main present', async () => {
    h.projectRemoteProbe.mockRejectedValue(new Error('git timed out'));
    const { store, set, get } = makeStore();

    const probe = await probeProjectRemote(set, get)({ projectId: PROJECT_ID });

    expect(probe).toEqual({ kind: 'unreachable', reason: 'git timed out' });
    expect(selectBootstrapRemoteProbe(store.state, PROJECT_ID)?.probe.kind).toBe('unreachable');
  });

  it('skips a project that is not a repository without asking git', async () => {
    const { set, get } = makeStore();

    const probe = await probeProjectRemote(set, get)({ projectId: 'proj-missing' as ProjectId });

    expect(probe).toEqual({ kind: 'no-remote' });
    expect(h.projectRemoteProbe).not.toHaveBeenCalled();
  });
});
