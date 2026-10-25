import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { TerminalTabId } from '../../../shared/types/terminal';

const SESSION_ID = nextSessionId();
const OTHER_SESSION_ID = nextSessionId();
const TAB_ID: TerminalTabId = JSON.parse(JSON.stringify(`${SESSION_ID}::t1`));

const FINISH = { terminalId: TAB_ID, title: 'zsh', command: 'pnpm test', durationMs: 42_000 };

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('terminal finishes', () => {
  it('keeps the last finished command per session', () => {
    const { noteTerminalFinished } = useAppStore.getState();
    noteTerminalFinished({ sessionId: SESSION_ID, finish: FINISH });
    noteTerminalFinished({ sessionId: SESSION_ID, finish: { ...FINISH, command: 'pnpm build' } });
    noteTerminalFinished({ sessionId: OTHER_SESSION_ID, finish: FINISH });

    expect(useAppStore.getState().terminalFinishes[SESSION_ID]?.command).toBe('pnpm build');
    expect(useAppStore.getState().terminalFinishes[OTHER_SESSION_ID]?.command).toBe('pnpm test');
  });

  it('clears only the session it was asked about', () => {
    const { noteTerminalFinished, clearTerminalFinished } = useAppStore.getState();
    noteTerminalFinished({ sessionId: SESSION_ID, finish: FINISH });
    noteTerminalFinished({ sessionId: OTHER_SESSION_ID, finish: FINISH });

    clearTerminalFinished({ sessionId: SESSION_ID });

    expect(useAppStore.getState().terminalFinishes[SESSION_ID]).toBeUndefined();
    expect(useAppStore.getState().terminalFinishes[OTHER_SESSION_ID]).toEqual(FINISH);
  });

  it('leaves the state alone when there is nothing to clear', () => {
    const before = useAppStore.getState().terminalFinishes;

    useAppStore.getState().clearTerminalFinished({ sessionId: SESSION_ID });

    expect(useAppStore.getState().terminalFinishes).toBe(before);
  });
});
