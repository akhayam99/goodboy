// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  updateProjectIdentity: vi.fn(async () => undefined),
  projectLinkRemote: vi.fn(async ({ remoteUrl }: { remoteUrl: string }) => ({
    remoteUrl,
    added: true,
  })),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    updateProjectIdentity: h.updateProjectIdentity,
  }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../shared/lib/repo', () => ({ projectLinkRemote: h.projectLinkRemote }));

import { linkProjectRemote } from './linkProjectRemote';

const PROJECT_ID = 'proj-cascadia' as ProjectId;
const ADDRESS = 'https://example.com/dana/cascadia.git';

const makeStore = (kind: 'repo' | 'folder') => {
  const store: { state: AppStore } = {
    state: {
      ...useAppStore.getState(),
      projects: [aProject({ id: PROJECT_ID, kind, rootPath: '/games/cascadia' })],
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

describe('linkProjectRemote', () => {
  it('adds the address to a repository project and stores it', async () => {
    const { store, set, get } = makeStore('repo');

    const updated = await linkProjectRemote(
      set,
      get,
    )({
      projectId: PROJECT_ID,
      remoteUrl: ` ${ADDRESS} `,
    });

    expect(h.projectLinkRemote).toHaveBeenCalledWith({
      projectPath: '/games/cascadia',
      remoteUrl: ADDRESS,
    });
    expect(h.updateProjectIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJECT_ID, remoteUrl: ADDRESS }),
    );
    expect(updated.remoteUrl).toBe(ADDRESS);
    expect(store.state.projects[0]?.remoteUrl).toBe(ADDRESS);
  });

  it('refuses an empty address without touching git', async () => {
    const { set, get } = makeStore('repo');

    await expect(
      linkProjectRemote(set, get)({ projectId: PROJECT_ID, remoteUrl: '   ' }),
    ).rejects.toThrow('paste the address');
    expect(h.projectLinkRemote).not.toHaveBeenCalled();
  });

  it('refuses a folder project without touching git', async () => {
    const { set, get } = makeStore('folder');

    await expect(
      linkProjectRemote(set, get)({ projectId: PROJECT_ID, remoteUrl: ADDRESS }),
    ).rejects.toThrow('only a repository project');
    expect(h.projectLinkRemote).not.toHaveBeenCalled();
  });

  it('keeps the stored project when git refuses the address', async () => {
    const { store, set, get } = makeStore('repo');
    h.projectLinkRemote.mockRejectedValueOnce(
      new Error('this project already has a different origin'),
    );

    await expect(
      linkProjectRemote(set, get)({ projectId: PROJECT_ID, remoteUrl: ADDRESS }),
    ).rejects.toThrow('different origin');
    expect(h.updateProjectIdentity).not.toHaveBeenCalled();
    expect(store.state.projects[0]?.remoteUrl).toBeUndefined();
  });
});
