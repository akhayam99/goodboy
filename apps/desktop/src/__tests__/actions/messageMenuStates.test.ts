// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../features/actions/dispatchAfterNavigation', () => ({
  dispatchAfterNavigation: () => undefined,
}));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { bindTarget, runObjectAction } from '../../features/actions/registry';
import type { ActionEnv, ActionViewing, ObjectTarget } from '../../features/actions/types';
import { AGENT, SESSION, seedActionState } from '../helpers/actionFixtures';
import { standalone } from '../helpers/agentMenuStates';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const copies: Array<string> = [];

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: () => undefined,
  copyText: async ({ text }) => {
    copies.push(text);
  },
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

type MessageParams = {
  readonly agentId: AgentId | null;
  readonly text: string;
};

const message = ({ agentId, text }: MessageParams): ObjectTarget => ({
  kind: 'message',
  text,
  sessionId: SESSION,
  agentId,
});

type MatrixParams = {
  readonly target: ObjectTarget;
  readonly viewing?: ActionViewing | null;
};

const matrixOf = ({ target, viewing = null }: MatrixParams): ReadonlyArray<string> =>
  (bindTarget({ state: useAppStore.getState(), target })?.resolve({ viewing }) ?? []).map(
    (action) => action.id,
  );

describe('transcript message menu', () => {
  it('offers open, quote and both copies on a message of a live agent', () => {
    seedActionState({ useAppStore, seed: standalone({ status: 'completed' }) });
    expect(
      matrixOf({
        target: message({ agentId: AGENT, text: 'The **ledger-core** join is unindexed.' }),
      }),
    ).toEqual(['message.openAgent', 'message.quote', 'message.copy', 'message.copyMarkdown']);
  });

  it('leaves out Open agent on the page of that agent, and keeps it for another agent', () => {
    seedActionState({ useAppStore, seed: standalone({ status: 'completed' }) });
    const target = message({ agentId: AGENT, text: 'The ledger-core join is unindexed.' });
    const other = brandId<AgentId>({ value: 'agent-northwind-reviewer' });

    expect(matrixOf({ target, viewing: { kind: 'agent', id: AGENT } })).toEqual([
      'message.quote',
      'message.copy',
      'message.copyMarkdown',
    ]);
    expect(matrixOf({ target, viewing: { kind: 'agent', id: other } })).toContain(
      'message.openAgent',
    );
  });

  it('offers only the copies when no agent can take a reply', () => {
    seedActionState({ useAppStore, seed: {} });
    expect(
      matrixOf({ target: message({ agentId: null, text: 'Northwind asked for half even.' }) }),
    ).toEqual(['message.copy', 'message.copyMarkdown']);
  });

  it('copies plain text or the markdown source, and quotes into the draft', async () => {
    seedActionState({ useAppStore, seed: standalone({ status: 'completed' }) });
    copies.length = 0;
    const target = message({ agentId: AGENT, text: 'The **ledger-core** join is `unindexed`.' });
    await runObjectAction({ target, actionId: 'message.copy', env, choice: null });
    await runObjectAction({ target, actionId: 'message.copyMarkdown', env, choice: null });
    expect(copies).toEqual([
      'The ledger-core join is unindexed.',
      'The **ledger-core** join is `unindexed`.',
    ]);
    await runObjectAction({ target, actionId: 'message.quote', env, choice: null });
    expect(useAppStore.getState().agentDraft[AGENT]).toBe(
      '> The **ledger-core** join is `unindexed`.\n\n',
    );
  });
});
