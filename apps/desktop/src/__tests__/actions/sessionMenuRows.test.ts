// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuEntry } from '@goodboy/ui';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { bindTarget } from '../../features/actions/registry';
import { toMenuEntries } from '../../features/actions/toMenuEntries';
import type { ActionEnv, ActionViewing, ObjectTarget } from '../../features/actions/types';
import { SESSION, seedActionState, type ActionSeed } from '../helpers/actionFixtures';
import { SESSION_MENU_ROWS, SESSION_STATES } from '../helpers/sessionMenuStates';

type StateParams = {
  readonly state: string;
};

type DrawParams = {
  readonly viewing?: ActionViewing | null;
};

type LabelParams = {
  readonly entries: ReadonlyArray<MenuEntry>;
  readonly label: string;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const SESSION_TARGET: ObjectTarget = { kind: 'session', sessionId: SESSION };

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: () => undefined,
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const seedState = ({ state }: StateParams): void => {
  const value: ActionSeed | null = SESSION_STATES.find(([name]) => name === state)?.[1] ?? null;
  if (value !== null) {
    seedActionState({ useAppStore, seed: value });
  }
};

const resolved = ({ viewing = null }: DrawParams) =>
  bindTarget({ state: useAppStore.getState(), target: SESSION_TARGET })?.resolve({ viewing }) ?? [];

const drawn = ({ viewing = null }: DrawParams): ReadonlyArray<MenuEntry> =>
  toMenuEntries({ actions: resolved({ viewing }), env, run: async () => undefined });

const labelsOf = ({ entries }: Omit<LabelParams, 'label'>): ReadonlyArray<string> =>
  entries.flatMap((entry) => (entry.kind === 'item' ? [entry.label] : []));

const childrenOf = ({ entries, label }: LabelParams): ReadonlyArray<string> =>
  entries.flatMap((entry) =>
    entry.kind === 'item' && entry.label === label
      ? (entry.children ?? []).map((child) => child.label)
      : [],
  );

describe('the right click list of a session', () => {
  it.each(SESSION_MENU_ROWS)('is an explicit list when %s', (state, rows) => {
    seedState({ state });

    expect(labelsOf({ entries: drawn({}) })).toEqual(rows);
  });

  it('folds the open and copy rows into Open and Copy, and keeps Ask, Refresh and Select in the palette', () => {
    seedState({ state: 'needs you, with a pull request' });
    const viewing: ActionViewing = { kind: 'selection', id: SESSION };
    const entries = drawn({ viewing });

    expect(childrenOf({ entries, label: 'Open' })).toEqual([
      'Overview',
      'Comments',
      'Changes',
      'Activity',
      'Editor',
      'Terminal',
      'External terminal',
    ]);
    expect(childrenOf({ entries, label: 'Copy' })).toEqual([
      'Title',
      'Branch name',
      'Worktree path',
      'Pull request link',
    ]);
    const labels = labelsOf({ entries });
    for (const hidden of ['Ask about this session', 'Refresh session', 'Select']) {
      expect(labels).not.toContain(hidden);
    }
    expect(resolved({ viewing }).map((action) => action.id)).toEqual(
      expect.arrayContaining(['session.ask', 'session.refresh', 'session.select']),
    );
    expect(entries.filter((entry) => entry.kind === 'separator')).toHaveLength(1);
  });

  it('keeps a lone copy row flat with its full label', () => {
    seedState({ state: 'draft' });

    expect(labelsOf({ entries: drawn({}) })).toContain('Copy title');
    expect(childrenOf({ entries: drawn({}), label: 'Copy' })).toEqual([]);
  });
});
