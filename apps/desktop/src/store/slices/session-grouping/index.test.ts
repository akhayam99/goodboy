// @vitest-environment node
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

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../storyHarness';
import { selectGroupBy } from './selectGroupBy';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION = nextSessionId();
const OTHER = nextSessionId();

afterEach(() => {
  useAppStore.setState({ groupBySession: {} });
});

type ChoiceParams = {
  readonly branchCount: number;
  readonly sessionId?: typeof SESSION;
};

const choiceOf = ({ branchCount, sessionId = SESSION }: ChoiceParams) =>
  selectGroupBy({ state: useAppStore.getState(), sessionId, branchCount });

describe('session grouping', () => {
  it('starts on By branch with two or more branches and on By state with fewer', () => {
    expect(choiceOf({ branchCount: 2 })).toBe('branch');
    expect(choiceOf({ branchCount: 1 })).toBe('state');
    expect(choiceOf({ branchCount: 0 })).toBe('state');
  });

  it('remembers the choice for one session only', () => {
    useAppStore.getState().setGroupBy({ sessionId: SESSION, groupBy: 'state' });

    expect(choiceOf({ branchCount: 3 })).toBe('state');
    expect(choiceOf({ branchCount: 3, sessionId: OTHER })).toBe('branch');
  });

  it('ignores the stored choice while the session has one branch', () => {
    useAppStore.getState().setGroupBy({ sessionId: SESSION, groupBy: 'branch' });

    expect(choiceOf({ branchCount: 1 })).toBe('state');
  });

  it('keeps the same state object when the choice does not change', () => {
    useAppStore.getState().setGroupBy({ sessionId: SESSION, groupBy: 'state' });
    const before = useAppStore.getState().groupBySession;
    useAppStore.getState().setGroupBy({ sessionId: SESSION, groupBy: 'state' });

    expect(useAppStore.getState().groupBySession).toBe(before);
  });
});
