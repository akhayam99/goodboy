// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { sceneInvoke } from '../../../../../test/sceneInvoke';
import { DemoIssueScene } from '../../scenes/demo/DemoIssueScene';
import { createHintEngine } from '../director/createHintEngine';
import type { DemoHintReport } from '../director/demoProtocol';
import { installDemoIpc } from '../director/installDemoIpc';
import { installIssueStart } from '../director/installIssueStart';
import { AGENT_HINTS } from './agentHints';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
  window.history.replaceState({}, '', '/?scene=demo-issue&director=1');
  installDemoIpc();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'Date',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 200, 40, 24),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
});

type SettleParams = {
  readonly ms: number;
};

const settle = async ({ ms }: SettleParams): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

type ElementParams = {
  readonly selector: string;
};

const visitorClick = async ({ selector }: ElementParams): Promise<void> => {
  const target = document.querySelector<HTMLElement>(selector);
  if (target === null) {
    throw new Error(`no element ${selector}`);
  }
  await act(async () => {
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'isTrusted', { value: true });
    target.dispatchEvent(event);
  });
  await settle({ ms: 500 });
};

const TASK_START = '[data-demo-anchor="task-start"]';
const DRAFT_START = '[data-demo-anchor="draft-start"]';

describe('the start-from-the-issue step', () => {
  it('opens the group, on the Tasks frame, with a progress line for the draft', () => {
    const first = AGENT_HINTS[0];
    expect(first?.id).toBe('agent-issue');
    expect(first?.beat).toBe(0);
    expect(first?.progress).toBeDefined();
    expect(AGENT_HINTS.slice(1).every((hint) => hint.beat === 1)).toBe(true);
  });

  it('credits the step only when the session from HBL-412 exists, then shows it linked', async () => {
    render(
      <ToastProvider>
        <DemoIssueScene />
      </ToastProvider>,
    );
    await vi.dynamicImportSettled();
    await settle({ ms: 2000 });
    await vi.dynamicImportSettled();
    await settle({ ms: 2000 });
    act(() => {
      installIssueStart({ store });
    });
    const reports: DemoHintReport[] = [];
    const engine = createHintEngine({
      store,
      view: window,
      generation: () => 0,
      hintsOf: () => AGENT_HINTS,
      onReport: ({ report }) => reports.push(report),
    });
    engine.setTrack({ chapterId: 'agent', settledIds: [] });
    const tried = (): ReadonlyArray<string> =>
      reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
    await settle({ ms: 300 });
    const before = store.getState().sessions.length;
    await visitorClick({ selector: TASK_START });
    expect(store.getState().openSessionDraftWorkspaceId).not.toBeNull();
    expect(tried()).toEqual([]);
    await visitorClick({ selector: DRAFT_START });
    await settle({ ms: 1000 });
    expect(tried()).toEqual(['agent-issue']);
    const state = store.getState();
    expect(state.sessions).toHaveLength(before + 1);
    const created = state.sessions.find((session) => session.id === state.currentSessionId);
    if (created === undefined) {
      throw new Error('no session was started');
    }
    expect(created.goal).toBe('Stop retried webhooks posting a second credit');
    const identifiers = (state.sessionExternalTasks[created.id] ?? []).map(
      (task) => task.identifier,
    );
    expect(identifiers).toEqual(['HBL-412']);
    engine.dispose();
  });
});
