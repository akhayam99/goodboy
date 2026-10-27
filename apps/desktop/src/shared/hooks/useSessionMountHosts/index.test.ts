// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  brandId,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { aMountGithub } from '../../../store/slices/github/testing/aMountGithub';

let store: StoryStore;
let useSessionMountHosts: typeof import('./index').useSessionMountHosts;

beforeAll(async () => {
  store = await importStore();
  ({ useSessionMountHosts } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const SESSION_ID = brandId<SessionId>({ value: 'session-payments' });
const OWN = brandId<MountId>({ value: 'mount-own' });
const OTHER = brandId<MountId>({ value: 'mount-other' });
const EXTRA = brandId<MountId>({ value: 'mount-extra' });
const PROJECT_ID = brandId<ProjectId>({ value: 'project-payments-api' });

const mountOf = ({ mountId }: { readonly mountId: MountId }): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: `/worktrees/${mountId}`,
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch: 'ak/fix-credit',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const showHook = ({ extraMountIds }: { readonly extraMountIds?: ReadonlyArray<string> } = {}) => {
  store.setState({ sessionProjectMounts: { [SESSION_ID]: [mountOf({ mountId: OWN })] } });
  let renders = 0;
  const view = renderHook(() => {
    renders += 1;
    return useSessionMountHosts({
      sessionId: SESSION_ID,
      ...(extraMountIds === undefined ? {} : { extraMountIds }),
    });
  });
  return { view, rendersOf: () => renders };
};

describe('useSessionMountHosts', () => {
  it('hands back the hosts of the mounts of this session', () => {
    const own = aMountGithub({ mountId: OWN });
    store.setState({ mountGithub: { [OWN]: own, [OTHER]: aMountGithub({ mountId: OTHER }) } });

    const { view } = showHook();

    expect(Object.keys(view.result.current.mountGithub)).toEqual([OWN]);
    expect(view.result.current.mountGithub[OWN]).toBe(own);
  });

  it('does not render again when a mount of another session is written', () => {
    store.setState({ mountGithub: { [OWN]: aMountGithub({ mountId: OWN }) } });
    const { view, rendersOf } = showHook();
    const before = view.result.current;
    const rendersBefore = rendersOf();

    act(() => {
      store.setState((state) => ({
        mountGithub: { ...state.mountGithub, [OTHER]: aMountGithub({ mountId: OTHER }) },
      }));
    });

    expect(rendersOf()).toBe(rendersBefore);
    expect(view.result.current.mountGithub).toBe(before.mountGithub);
  });

  it('renders again when a mount of this session is written', () => {
    store.setState({ mountGithub: { [OWN]: aMountGithub({ mountId: OWN }) } });
    const { view, rendersOf } = showHook();
    const rendersBefore = rendersOf();
    const next = aMountGithub({ mountId: OWN, fetchedAt: '2026-10-07T09:00:00.000Z' });

    act(() => {
      store.setState((state) => ({ mountGithub: { ...state.mountGithub, [OWN]: next } }));
    });

    expect(rendersOf()).toBeGreaterThan(rendersBefore);
    expect(view.result.current.mountGithub[OWN]).toBe(next);
  });

  it('also reads the mounts it was told about, such as the mount of an agent', () => {
    const extra = aMountGithub({ mountId: EXTRA });
    store.setState({ mountGithub: { [EXTRA]: extra } });

    const { view } = showHook({ extraMountIds: [EXTRA] });

    expect(view.result.current.mountGithub[EXTRA]).toBe(extra);
  });
});
