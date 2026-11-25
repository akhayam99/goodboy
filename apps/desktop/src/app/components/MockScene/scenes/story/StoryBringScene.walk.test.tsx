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
import { installStoryDirection } from '../../demo/director/installStoryDirection';
import { BRING_HINTS } from '../../demo/hints/bringHints';
import { StoryBringScene } from './StoryBringScene';
import { STORY_SESSION_ID } from './storyWorld';

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
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    command === 'check_provider_budget'
      ? Promise.resolve(OPEN_BUDGET)
      : sceneInvoke({ command: String(command), args }),
  );
  store.setState({ loadProjectGitStatus: async () => undefined });
});

afterEach(() => {
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

describe('walking the bring your work group', () => {
  it('lets the visitor through the five steps and blocks everything else', async () => {
    render(
      <ToastProvider>
        <StoryBringScene />
      </ToastProvider>,
    );
    await screen.findByLabelText('API key', {}, { timeout: 5000 });
    installStoryDirection({ store: store });
    const reports: Array<DemoHintReport> = [];
    engine = createHintEngine({
      store: store,
      view: window,
      generation: () => 0,
      hintsOf: () => BRING_HINTS,
      onReport: ({ report }) => reports.push(report),
    });
    engine.setTrack({ chapterId: 'bring', settledIds: [], isGuarding: true });
    const tried = (): ReadonlyArray<string> =>
      reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
    const blocked = (): ReadonlyArray<string> =>
      reports.flatMap((report) => (report.type === 'blocked' ? [report.hintId] : []));

    expect(
      await visitorClick({ element: await found({ selector: 'button[type="button"]' }) }),
    ).toBe(true);
    expect(blocked()).toContain('bring-connect');

    act(() => engine?.offer({ hintId: 'bring-connect' }));
    await waitFor(() => expect(tried()).toEqual(['bring-connect']), { timeout: 8000 });

    await visitorClick({
      element: await found({ selector: 'button[aria-label="More Linear actions"]' }),
    });
    await visitorClick({
      element: await found({ selector: '[role="menuitem"][data-menu-label="Open in Tasks"]' }),
    });
    await waitFor(() => expect(tried()).toContain('bring-tasks'), { timeout: 8000 });

    const other = await found({ selector: '[role="option"][aria-label^="HBL-409 "]' });
    expect(await visitorClick({ element: other })).toBe(true);
    await visitorClick({
      element: await found({ selector: '[role="option"][aria-label^="HBL-412 "]' }),
    });
    await waitFor(() => expect(tried()).toContain('bring-open'), { timeout: 8000 });

    await visitorClick({ element: await found({ selector: '[data-demo-anchor="task-start"]' }) });
    await waitFor(() => expect(tried()).toContain('bring-session'), { timeout: 8000 });

    await visitorClick({ element: await found({ selector: '[data-demo-anchor="draft-start"]' }) });
    await waitFor(() => expect(tried()).toEqual(BRING_HINTS.map((hint) => hint.id)), {
      timeout: 8000,
    });
    expect(store.getState().currentSessionId).toBe(STORY_SESSION_ID);
  }, 90000);
});
