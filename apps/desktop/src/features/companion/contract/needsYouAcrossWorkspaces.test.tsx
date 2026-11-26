// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { stageInfosOf } from '../../../store/slices/session-view/stageInfosOf';
import { needsYouOf } from '../../board/needsYou/needsYouOf';
import {
  at,
  harborline,
  openQuestionFor,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../workspace/testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const northwind = aWorkspace({ name: 'Northwind', slug: 'northwind' });

const inHarborline = sessionOf({ goal: 'Question in Harborline' });

const inNorthwind = aSession({
  workspaceId: northwind.id,
  goal: 'Question in Northwind',
  state: { kind: 'idle', lastActivityAt: at('2026-10-01T09:00:00.000Z') },
  createdAt: at('2026-09-01T09:00:00.000Z'),
  updatedAt: at('2026-10-01T09:00:00.000Z'),
});

const seedBothWorkspaces = () => {
  seedColumn({
    store: useAppStore,
    sessions: [inHarborline, inNorthwind],
    questions: [inHarborline],
    mounts: [[inHarborline, paymentsApi]],
  });
  useAppStore.setState((state) => ({
    workspaces: [harborline, northwind],
    sessionOpenQuestions: {
      ...state.sessionOpenQuestions,
      [inNorthwind.id]: [openQuestionFor({ sessionId: inNorthwind.id })],
    },
  }));
};

const movesOfStore = () => {
  const state = useAppStore.getState();
  const infos = stageInfosOf({ state, sessions: state.sessions });
  return needsYouOf({
    sessions: state.sessions,
    infos,
    openQuestions: state.sessionOpenQuestions,
  });
};

describe('needsYouOf across workspaces, spike for the companion contract', () => {
  it('counts the moves of every workspace when the store holds all their sessions', () => {
    seedBothWorkspaces();

    const result = movesOfStore();

    expect(result.sessionCount).toBe(2);
    expect(result.moves.map((move) => move.sessionId).sort()).toEqual(
      [inHarborline.id, inNorthwind.id].sort(),
    );
    expect(new Set(result.moves.map((move) => move.reason))).toEqual(new Set(['open-question']));
  });

  it('keeps only counts and words for the other workspaces in the sidebar source', () => {
    seedBothWorkspaces();
    useAppStore.setState({
      attentionFromDatabase: {
        [northwind.id]: { count: 1, tone: 'warning', reasonWords: ['1 question for you'] },
      },
    });

    const entry = useAppStore.getState().attentionFromDatabase[northwind.id];

    expect(Object.keys(entry ?? {}).sort()).toEqual(['count', 'reasonWords', 'tone']);
  });
});
