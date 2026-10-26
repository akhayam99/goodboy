import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { bindTarget } from '../registry';
import type { ActionEnv } from '../types';
import type { TerminalTabFacts } from './terminalTab';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const SESSION_ID = nextSessionId();

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const env = (): ActionEnv => ({
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'overflow',
  anchorKey: null,
  viewing: null,
});

const bound = ({ facts }: { readonly facts: TerminalTabFacts }) => {
  const found = bindTarget({
    state: useAppStore.getState(),
    target: { kind: 'terminalTab', facts },
  });
  if (found === null) {
    throw new Error('the terminal tab target did not bind');
  }
  return found;
};

const BASE: TerminalTabFacts = {
  path: '/w/ledger',
  isWorkspace: false,
  sessionId: SESSION_ID,
  onOpenSession: vi.fn(),
};

describe('the terminal tab kind, Send last output', () => {
  it('lists Send last output between Open session and Copy worktree path', () => {
    const facts: TerminalTabFacts = {
      ...BASE,
      sendOutput: { label: 'Send last output', blockedReason: null, onSend: vi.fn() },
    };

    expect(
      bound({ facts })
        .resolve()
        .map((action) => action.id),
    ).toEqual(['terminalTab.openSession', 'terminalTab.sendLastOutput', 'terminalTab.copyPath']);
  });

  it('leaves the verb out when the session cannot take the output', () => {
    expect(
      bound({ facts: BASE })
        .resolve()
        .map((action) => action.id),
    ).toEqual(['terminalTab.openSession', 'terminalTab.copyPath']);
  });

  it('sends the last output when run', async () => {
    const onSend = vi.fn();
    const facts: TerminalTabFacts = {
      ...BASE,
      sendOutput: { label: 'Send last output', blockedReason: null, onSend },
    };

    await bound({ facts }).run({ actionId: 'terminalTab.sendLastOutput', env: env() });

    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
