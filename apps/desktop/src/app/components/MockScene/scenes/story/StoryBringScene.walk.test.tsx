// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { createHintEngine, type HintEngine } from '../../demo/director/createHintEngine';
import type { DemoHintReport } from '../../demo/director/demoProtocol';
import { demoRuns } from '../../demo/director/demoRunRegistry';
import { BRING_HINTS } from '../../demo/hints/bringHints';
import { StoryBringScene } from './StoryBringScene';
import { STORY_PLANNER_ID, STORY_SESSION_ID } from './storyWorld';

let engine: HintEngine | null = null;

const OPEN_BUDGET = {
  remainingUsd: null,
  pct: 0,
  exceeded: false,
  overThreshold: false,
  spentUsd: 0,
  capUsd: null,
  thresholdPct: null,
  windowStartMs: 0,
  windowEndMs: 0,
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (command === 'check_provider_budget') {
      return Promise.resolve(OPEN_BUDGET);
    }
    if (command === 'worktree_remote_url') {
      return Promise.resolve(null);
    }
    return sceneInvoke({ command: String(command), args });
  });
  store.setState({ loadProjectGitStatus: async () => undefined });
});

afterEach(() => {
  demoRuns.cancelAll();
  engine?.dispose();
  engine = null;
  cleanup();
  clearSceneInvoke();
});

type ClickParams = {
  readonly element: Element;
};

const visitorClick = async ({ element }: ClickParams): Promise<boolean> => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  });
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'isTrusted', { value: true });
  await act(async () => {
    element.dispatchEvent(event);
  });
  return event.defaultPrevented;
};

type FindParams = {
  readonly selector: string;
};

type StepParams = FindParams & {
  readonly until: string;
};

const visitorStep = async ({ selector, until }: StepParams): Promise<void> => {
  const deadline = Date.now() + 20000;
  while (document.querySelector(until) === null) {
    if (Date.now() > deadline) {
      throw new Error(`waiting for ${until}`);
    }
    const element = document.querySelector(selector);
    if (element !== null) {
      await visitorClick({ element });
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 400);
    });
  }
};

const found = async ({ selector }: FindParams): Promise<Element> =>
  waitFor(
    () => {
      const element = document.querySelector(selector);
      if (element === null) {
        throw new Error(`no ${selector}`);
      }
      return element;
    },
    { timeout: 8000 },
  );

const SIGN_IN = '[data-step="agents"] [data-demo-anchor="setup-agent-signin"]';
const AGENTS_CONTINUE = '[data-step="agents"] [data-demo-anchor="setup-continue"]';
const CREATE = '[data-step="workspace"] [data-demo-anchor="setup-create"]';
const OPEN_TOOLS = '[data-step="first-session"] [data-demo-anchor="setup-open-tools"]';
const CONNECT_LINEAR = '[data-step="tools"] button[aria-label="Connect Linear"]';
const KEY_FIELD = '#linear-api-key';
const TOOLS_CONTINUE = '[data-step="tools"] [data-demo-anchor="setup-continue"]';
const WIZARD = '[aria-label="Goodboy setup"]';
const TASK_ROW = '[role="option"][aria-label^="HBL-412 "]';

const startEngine = ({ reports }: ReportsParams): void => {
  engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: () => BRING_HINTS,
    onReport: ({ report }) => reports.push(report),
  });
  engine.setTrack({ chapterId: 'bring', settledIds: [], isGuarding: true });
};

type ReportsParams = {
  readonly reports: Array<DemoHintReport>;
};

const triedOf = ({ reports }: ReportsParams): ReadonlyArray<string> =>
  reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));

const blockedOf = ({ reports }: ReportsParams): ReadonlyArray<string> =>
  reports.flatMap((report) => (report.type === 'blocked' ? [report.hintId] : []));

const walkSetup = async ({ reports }: ReportsParams): Promise<void> => {
  await found({ selector: SIGN_IN });
  const other = await found({
    selector: '[data-step="agents"] button[type="button"]:not([data-demo-anchor])',
  });
  expect(await visitorClick({ element: other })).toBe(true);
  expect(blockedOf({ reports })).toContain('setup-agent-signin');
  await visitorClick({ element: await found({ selector: SIGN_IN }) });
  await waitFor(() => expect(triedOf({ reports })).toContain('setup-agent-signin'), {
    timeout: 8000,
  });
  await visitorStep({ selector: AGENTS_CONTINUE, until: CREATE });
  await visitorStep({ selector: CREATE, until: OPEN_TOOLS });
  await visitorStep({ selector: OPEN_TOOLS, until: CONNECT_LINEAR });
  await visitorStep({ selector: CONNECT_LINEAR, until: KEY_FIELD });
  act(() => engine?.offer({ hintId: 'bring-connect' }));
  await waitFor(() => expect(triedOf({ reports })).toContain('bring-connect'), { timeout: 12000 });
  await found({ selector: `${WIZARD}[data-step="tools"] [data-demo-anchor="setup-continue"]` });
  await waitFor(
    () =>
      expect(
        Object.values(store.getState().workspaceIntegrations)
          .flat()
          .some((binding) => binding.provider === 'linear'),
      ).toBe(true),
    { timeout: 12000 },
  );
};

describe('walking the bring your work group', () => {
  it('lets the visitor through the ten steps and blocks everything else', async () => {
    render(
      <ToastProvider>
        <StoryBringScene />
      </ToastProvider>,
    );
    const reports: Array<DemoHintReport> = [];
    startEngine({ reports });
    await walkSetup({ reports });

    await visitorClick({ element: await found({ selector: TOOLS_CONTINUE }) });
    await waitFor(() => expect(document.querySelector(WIZARD)).toBeNull(), { timeout: 30000 });
    await waitFor(() => expect(triedOf({ reports })).toContain('setup-tools'), { timeout: 8000 });
    expect(store.getState().sessions).toEqual([]);

    const other = await found({ selector: '[role="option"][aria-label^="HBL-409 "]' });
    expect(await visitorClick({ element: other })).toBe(true);
    await visitorClick({ element: await found({ selector: TASK_ROW }) });
    await waitFor(() => expect(triedOf({ reports })).toContain('bring-open'), { timeout: 8000 });

    await visitorClick({ element: await found({ selector: '[data-demo-anchor="task-start"]' }) });
    await waitFor(() => expect(triedOf({ reports })).toContain('bring-session'), { timeout: 8000 });

    await visitorClick({
      element: await found({ selector: '[data-demo-anchor="draft-start"]:not([disabled])' }),
    });
    await waitFor(() => expect(store.getState().currentSessionId).toBe(STORY_SESSION_ID), {
      timeout: 8000,
    });
    const isAsked = (): boolean =>
      (store.getState().sessionOpenQuestions[STORY_SESSION_ID] ?? []).length > 0;
    await waitFor(
      () => expect(store.getState().transcripts[STORY_PLANNER_ID]?.length ?? 0).toBeGreaterThan(0),
      { timeout: 8000 },
    );
    expect(isAsked()).toBe(false);
    expect(triedOf({ reports })).not.toContain('bring-start');
    await waitFor(() => expect(isAsked()).toBe(true), { timeout: 12000 });
    await found({ selector: '[data-oq-anchor] button[role="radio"]' });
    expect(store.getState().agentTurnState[STORY_PLANNER_ID]?.kind).toBe('idle');
    expect(
      (store.getState().autoTreeViews[STORY_SESSION_ID] ?? [])
        .flatMap((view) => view.delegations)
        .find((entry) => entry.childAgentId === STORY_PLANNER_ID)?.state,
    ).toBe('paused');
    await waitFor(() => expect(triedOf({ reports })).toEqual(BRING_HINTS.map((hint) => hint.id)), {
      timeout: 8000,
    });
    expect(store.getState().currentSessionId).toBe(STORY_SESSION_ID);
  }, 150000);
});

describe('getting back to HBL-412 after the pane moved away', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('points at the HBL-412 row, blocks the other Start session and accepts the row again', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 200, 40, 24),
    );
    render(
      <ToastProvider>
        <StoryBringScene />
      </ToastProvider>,
    );
    const reports: Array<DemoHintReport> = [];
    startEngine({ reports });
    await walkSetup({ reports });
    await visitorClick({ element: await found({ selector: TOOLS_CONTINUE }) });
    await waitFor(() => expect(document.querySelector(WIZARD)).toBeNull(), { timeout: 30000 });
    await visitorClick({ element: await found({ selector: TASK_ROW }) });
    await waitFor(() => expect(triedOf({ reports })).toContain('bring-open'), { timeout: 8000 });

    const other = await found({ selector: '[role="option"][aria-label^="HBL-409 "]' });
    act(() => {
      if (other instanceof HTMLElement) {
        other.click();
      }
    });
    await waitFor(() => expect(other.getAttribute('aria-selected')).toBe('true'), {
      timeout: 8000,
    });
    const startOther = await found({ selector: '[data-demo-anchor="task-start"]' });
    expect(await visitorClick({ element: startOther })).toBe(true);
    expect(triedOf({ reports })).not.toContain('bring-session');
    await waitFor(
      () =>
        expect(
          reports.some(
            (report) =>
              report.type === 'anchor' &&
              report.hintId === 'bring-session' &&
              report.isRecovering === true,
          ),
        ).toBe(true),
      { timeout: 8000 },
    );

    await visitorClick({ element: await found({ selector: TASK_ROW }) });
    await visitorClick({ element: await found({ selector: '[data-demo-anchor="task-start"]' }) });
    await waitFor(() => expect(triedOf({ reports })).toContain('bring-session'), { timeout: 8000 });
  }, 150000);
});
