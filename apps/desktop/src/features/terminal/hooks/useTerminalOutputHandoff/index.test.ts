// @vitest-environment happy-dom

const showToast = vi.hoisted(() => vi.fn());

vi.mock('../../../../shared/components/Toast/useShowToast', () => ({
  useShowToast: () => showToast,
}));
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { nextAgentId, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStoryAgent,
  buildStorySession,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { registerTerminalText } from '../../../../shared/components/GenericTerminalPanel/terminalText';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import { useTerminalOutputHandoff } from '.';

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const AGENT_ID = nextAgentId();
const TAB_ID: TerminalTabId = JSON.parse(JSON.stringify(`${SESSION_ID}::t1`));

const TAB: TerminalTab = {
  id: TAB_ID,
  owner: { kind: 'session', sessionId: SESSION_ID },
  title: 'zsh',
  cwd: '/w/ledger',
  status: 'running',
  createdAt: 0,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  showToast.mockClear();
  useAppStore.setState({
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: {
      [SESSION_ID]: [buildStoryAgent({ id: AGENT_ID, sessionId: SESSION_ID })],
    },
  });
});

afterEach(cleanup);

const mount = () =>
  renderHook(() =>
    useTerminalOutputHandoff({
      sessionId: SESSION_ID,
      tab: TAB,
      projectName: 'ledger-core',
      branch: 'nw/fix-settlement-replay',
    }),
  );

describe('useTerminalOutputHandoff', () => {
  it('sends the tab output as an attachment for the agent and presses nothing', () => {
    const unregister = registerTerminalText({
      terminalId: TAB_ID,
      reader: () => '$ pnpm test\nFAIL postings/rounding.test.ts',
    });
    const { result } = mount();

    result.current.sendLastOutput();

    const queued = useAppStore.getState().outputHandoffs[AGENT_ID];
    expect(queued).toHaveLength(1);
    expect(queued?.[0]?.title).toBe(
      'Output of terminal zsh, ledger-core on nw/fix-settlement-replay',
    );
    expect(queued?.[0]?.text).toContain('FAIL postings/rounding.test.ts');
    unregister();
  });

  it('says so and queues nothing when the terminal has no output', () => {
    const unregister = registerTerminalText({ terminalId: TAB_ID, reader: () => '   ' });
    const { result } = mount();

    result.current.sendLastOutput();

    expect(useAppStore.getState().outputHandoffs).toEqual({});
    expect(showToast).toHaveBeenCalledWith({
      kind: 'warning',
      message: 'This terminal has no output to send yet.',
    });
    unregister();
  });

  it('sends only the selected text for a selection', () => {
    const { result } = mount();

    result.current.sendSelection({ text: 'Error: replay mismatch at row 14' });

    const queued = useAppStore.getState().outputHandoffs[AGENT_ID];
    expect(queued?.[0]?.text).toContain('Error: replay mismatch at row 14');
    expect(queued?.[0]?.text).not.toContain('pnpm test');
  });

  it('hides the verb once the session is archived', () => {
    useAppStore.setState({
      sessions: [
        buildStorySession({
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          archivedAt: STORY_NOW,
        }),
      ],
    });
    const { result } = mount();

    expect(result.current.canHandOff).toBe(false);
  });
});
