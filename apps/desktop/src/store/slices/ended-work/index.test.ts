// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { brandedId } from '../../../features/history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import { SETTING_ENDED_WORK, SETTING_ENDED_WORK_SEEN } from './state';

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
vi.mock('../../../features/terminal/outputBus', async () =>
  (await import('../../storyHarness')).terminalOutputBusModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

let useAppStore: StoryStore;

const SESSION = brandedId<SessionId>({ value: 'session-1' });
const OTHER_SESSION = brandedId<SessionId>({ value: 'session-2' });

const MARKER = JSON.stringify({
  at: 2000,
  terminals: [
    { id: 'session-1::t2', command: 'node /usr/local/lib/node_modules/pnpm/bin/pnpm.cjs dev' },
    { id: 'session-1::t3', command: '' },
  ],
  scripts: [
    { scriptId: 'script-api', sessionId: SESSION, name: 'api', cwd: '/work/payments-api' },
    { scriptId: 'script-web', sessionId: OTHER_SESSION, name: 'web', cwd: '/work/ledger-core' },
    { scriptId: 7, sessionId: SESSION, name: 'broken', cwd: '/w' },
  ],
});

type AnswerParams = {
  readonly marker: string | null;
  readonly seen: string | null;
};

const answerWith = ({ marker, seen }: AnswerParams): void => {
  storySpies.getSetting.mockImplementation(async (_db, key) => {
    if (key === SETTING_ENDED_WORK) {
      return marker;
    }
    return key === SETTING_ENDED_WORK_SEEN ? seen : null;
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.setSetting.mockClear();
});

afterEach(() => {
  storySpies.getSetting.mockReset();
  storySpies.getSetting.mockResolvedValue(null);
});

describe('the work that ended when Goodboy quit', () => {
  it('reads the marker once, names each terminal by its command and keeps the valid services', async () => {
    answerWith({ marker: MARKER, seen: null });

    await useAppStore.getState().loadEndedWork();

    expect(useAppStore.getState().endedWork).toEqual({
      at: 2000,
      terminals: { 'session-1::t2': 'pnpm dev' },
      scripts: [
        { scriptId: 'script-api', sessionId: SESSION, name: 'api', cwd: '/work/payments-api' },
        { scriptId: 'script-web', sessionId: OTHER_SESSION, name: 'web', cwd: '/work/ledger-core' },
      ],
    });
    expect(storySpies.setSetting).toHaveBeenCalledWith(
      expect.anything(),
      SETTING_ENDED_WORK_SEEN,
      '2000',
    );
  });

  it('shows nothing on the launch after the one that saw it', async () => {
    answerWith({ marker: MARKER, seen: '2000' });

    await useAppStore.getState().loadEndedWork();

    expect(useAppStore.getState().endedWork).toBeNull();
    expect(storySpies.setSetting).not.toHaveBeenCalled();
  });

  it('shows nothing for a missing marker or one of the wrong shape', async () => {
    answerWith({ marker: null, seen: null });
    await useAppStore.getState().loadEndedWork();
    expect(useAppStore.getState().endedWork).toBeNull();

    answerWith({ marker: '[1,2]', seen: null });
    await useAppStore.getState().loadEndedWork();
    expect(useAppStore.getState().endedWork).toBeNull();
  });

  it('reports a corrupt marker and shows nothing', async () => {
    answerWith({ marker: '{not json', seen: null });

    await useAppStore.getState().loadEndedWork();

    expect(useAppStore.getState().endedWork).toBeNull();
    expect(storySpies.setSetting).not.toHaveBeenCalled();
  });

  it('keeps the old state and says so when the marker cannot be read', async () => {
    storySpies.getSetting.mockRejectedValue(new Error('database is locked'));

    await useAppStore.getState().loadEndedWork();

    expect(useAppStore.getState().endedWork).toBeNull();
  });

  it('drops one terminal when it is dismissed and one session of services when they are started', async () => {
    answerWith({ marker: MARKER, seen: null });
    await useAppStore.getState().loadEndedWork();

    useAppStore.getState().dismissEndedTerminal({ terminalId: 'session-1::t2' });
    useAppStore.getState().dismissEndedScripts({ sessionId: SESSION });

    expect(useAppStore.getState().endedWork).toEqual({
      at: 2000,
      terminals: {},
      scripts: [
        { scriptId: 'script-web', sessionId: OTHER_SESSION, name: 'web', cwd: '/work/ledger-core' },
      ],
    });
  });
});
