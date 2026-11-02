// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../shared/lib/dbBoot', async () =>
  (await import('../../storyHarness')).dbBootModuleMock(),
);
vi.mock('../../../features/onboarding/onboardingSettings', async () =>
  (await import('../../storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../shared/lib/editor', async () =>
  (await import('../../storyHarness')).editorModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);
vi.mock('../../../features/integrations/linear/client', async () =>
  (await import('../../storyHarness')).linearClientModuleMock(),
);
vi.mock('../../../features/integrations/github/github', async () =>
  (await import('../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core', async (importOriginal) =>
  (await import('../../storyHarness')).coreModuleMock(importOriginal),
);
vi.mock('../../../features/scripts/scripts', async () =>
  (await import('../../storyHarness')).scriptsModuleMock(),
);
vi.mock('../../../features/terminal/terminal', async () =>
  (await import('../../storyHarness')).terminalModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

type Deferred = {
  readonly promise: Promise<void>;
  readonly release: () => void;
};

const deferred = (): Deferred => {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

describe('hydrate independent reads', () => {
  it('starts the four independent hydrations before any of them settles', async () => {
    const started: Array<string> = [];
    const gate = deferred();
    const gated = (name: string) => async () => {
      started.push(name);
      await gate.promise;
    };
    useAppStore.setState({
      hydrateBootstrapPhases: gated('bootstrap'),
      hydrateFolderPurposes: gated('folders'),
      hydrateChangelogSeen: gated('changelog'),
      hydrateCliRequirements: gated('cli'),
    });

    const booting = useAppStore.getState().hydrate();

    await vi.waitFor(() => {
      expect(started.sort()).toEqual(['bootstrap', 'changelog', 'cli', 'folders']);
    });
    expect(useAppStore.getState().hydrated).toBe(false);
    gate.release();
    await booting;
    expect(useAppStore.getState().hydrated).toBe(true);
  });

  it('fails the boot when one independent read fails', async () => {
    useAppStore.setState({
      hydrateFolderPurposes: async () => {
        throw new Error('folder purposes unreadable');
      },
    });

    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().bootPhase).toBe('error');
    expect(useAppStore.getState().error).toBe('folder purposes unreadable');
  });
});

describe('hydrate order of repairs', () => {
  it('adopts legacy keys before it loads the integration credentials', async () => {
    const order: Array<string> = [];
    const invokeImpl = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (command?: unknown, args?: unknown) => {
      if (command === 'integration_credentials_adopt') {
        order.push('adopt');
      }
      return invokeImpl?.(command, args);
    });
    useAppStore.setState({
      loadIntegrationCredentials: async () => {
        order.push('load');
      },
    });

    await useAppStore.getState().hydrate();

    expect(order).toEqual(['adopt', 'load']);
  });

  it('stops ghost agents before the board is ready and repairs orphan worktrees after', async () => {
    const { stopGhostAgents } = await import('@goodboy/db');
    let isReadyWhenGhostsStop: boolean | null = null;
    let isReadyWhenOrphansRepair: boolean | null = null;
    vi.mocked(stopGhostAgents).mockImplementation(async () => {
      isReadyWhenGhostsStop = useAppStore.getState().hydrated;
      return 0;
    });
    useAppStore.setState({
      reconcileOrphanWorktrees: async () => {
        isReadyWhenOrphansRepair = useAppStore.getState().hydrated;
      },
    });

    await useAppStore.getState().hydrate();

    expect(isReadyWhenGhostsStop).toBe(false);
    expect(isReadyWhenOrphansRepair).toBe(true);
  });
});
