// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { sceneInvoke } from '../../../../../test/sceneInvoke';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { U25_B_RESOLVE_FIX_SCENES } from '../../scenes/u25/b-resolve-fix';
import { BrandDiffScene } from '../../scenes/brand/DiffScene';
import { DemoStorageScene } from '../../scenes/demo/DemoStorageScene';
import { createHintEngine } from '../director/createHintEngine';
import { createReplyRuns } from '../director/createReplyRuns';
import { createSimulatedSend } from '../director/createSimulatedSend';
import type { DemoHintReport } from '../director/demoProtocol';
import { installDemoIpc } from '../director/installDemoIpc';
import { installDemoWorld } from '../director/installDemoWorld';
import { installResolveActions } from '../director/installResolveActions';
import { installStorageActions } from '../director/installStorageActions';
import { REVIEW_HINTS } from './reviewHints';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
  window.history.replaceState({}, '', '/?scene=demo-review&director=1');
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

type MountParams = {
  readonly Scene: ComponentType;
};

type SettleParams = {
  readonly ms: number;
};

const settle = async ({ ms }: SettleParams): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const mount = async ({ Scene }: MountParams): Promise<void> => {
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle({ ms: 2000 });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

type TrackParams = {
  readonly settledIds: ReadonlyArray<string>;
};

const track = ({ settledIds }: TrackParams) => {
  const reports: DemoHintReport[] = [];
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: () => REVIEW_HINTS,
    onReport: ({ report }) => reports.push(report),
  });
  engine.setTrack({ chapterId: 'review', settledIds });
  const tried = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
  const shown = (): string | null =>
    reports.flatMap((report) => (report.type === 'anchor' ? [report.hintId] : [])).at(-1) ?? null;
  return { engine, tried, shown };
};

type ElementParams = {
  readonly selector: string;
};

const element = ({ selector }: ElementParams): HTMLElement => {
  const found = document.querySelector<HTMLElement>(selector);
  if (found === null) {
    throw new Error(`no element ${selector}`);
  }
  return found;
};

type ClickParams = {
  readonly target: HTMLElement;
};

const click = async ({ target }: ClickParams): Promise<void> => {
  await act(async () => {
    fireEvent.click(target);
  });
  await settle({ ms: 300 });
};

const visitorClick = async ({ selector }: ElementParams): Promise<void> => {
  await act(async () => {
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'isTrusted', { value: true });
    element({ selector }).dispatchEvent(event);
  });
  await settle({ ms: 300 });
};

type TypeParams = ElementParams & {
  readonly text: string;
};

const typeInto = async ({ selector, text }: TypeParams): Promise<void> => {
  await act(async () => {
    fireEvent.change(element({ selector }), { target: { value: text } });
  });
  await settle({ ms: 300 });
};

const withSimulatedSend = (): void => {
  act(() => {
    store.setState({
      sendTurn: createSimulatedSend({
        store,
        reply: 'On it.',
        now: () => nowIso({}),
        shouldClearDraft: true,
        runs: createReplyRuns(),
      }),
    });
  });
};

const HANDLER = '[role="treeitem"][data-tree-row="src/webhooks/applyWebhook.ts"] > button';
const LINE = '[data-file-path="src/webhooks/applyWebhook.ts"] button[data-gutter="new:13"]';
const THREAD = '[data-thread-id="PRRT_thread_retry_constant"]';
const DRAFT = 'button[data-review-verb="reviewComment.draft"]';
const ACCEPT = 'button[data-review-verb="reviewComment.accept"]';
const SETTLED: ReadonlyArray<string> = ['diff-file', 'diff-note'];
const PUSHED: ReadonlyArray<string> = REVIEW_HINTS.slice(0, -1).map((hint) => hint.id);

describe('the Review and ship steps', () => {
  it('lists the diff, the comment fix and the push in order', () => {
    expect(REVIEW_HINTS.map((hint) => hint.id)).toEqual([
      'diff-file',
      'diff-note',
      'resolve-pick',
      'resolve-fix',
      'resolve-start',
      'resolve-keep',
      'review-push',
      'review-storage',
    ]);
  });

  it('shows a progress line for the steps that wait for a second press', () => {
    const progressIds = REVIEW_HINTS.filter((hint) => hint.progress !== undefined).map(
      (hint) => hint.id,
    );
    expect(progressIds).toEqual(['diff-note', 'resolve-start', 'review-storage']);
  });

  it('credits the storage cleanup only once the folders are removed, and shows the result', async () => {
    await mount({ Scene: DemoStorageScene });
    act(() => {
      installStorageActions({ store });
    });
    const { engine, tried, shown } = track({ settledIds: PUSHED });
    await settle({ ms: 300 });
    expect(shown()).toBe('review-storage');
    expect(store.getState().storageFolders).toHaveLength(4);
    await visitorClick({ selector: '[data-demo-anchor="storage-remove"]' });
    expect(tried()).toEqual([]);
    await visitorClick({ selector: 'button[data-confirm-action="true"]' });
    expect(tried()).toEqual([]);
    await settle({ ms: 1500 });
    expect(tried()).toEqual(['review-storage']);
    expect(store.getState().storageFolders.map((folder) => folder.origin)).toEqual(['in-use']);
    screen.getByText(/Removed 3 folders/);
    engine.dispose();
  });

  it('credits opening the handler and leaving a line note, one at a time', async () => {
    await mount({ Scene: BrandDiffScene });
    act(() => {
      installDemoWorld({ store });
    });
    const { engine, tried, shown } = track({ settledIds: [] });
    await settle({ ms: 100 });
    expect(tried()).toEqual([]);
    expect(shown()).toBe('diff-file');
    await click({ target: element({ selector: HANDLER }) });
    expect(tried()).toEqual(['diff-file']);
    await settle({ ms: 3000 });
    expect(shown()).toBe('diff-note');
    await act(async () => {
      fireEvent.keyDown(element({ selector: LINE }), { key: 'Enter' });
    });
    await typeInto({
      selector: 'textarea[aria-label="Note on line 13"]',
      text: 'Keep the credit and the event row in one transaction',
    });
    expect(tried()).toEqual(['diff-file']);
    const [add] = screen.getAllByRole('button', { name: 'Add note' });
    if (add === undefined) {
      throw new Error('no Add note');
    }
    await click({ target: add });
    expect(tried()).toEqual(['diff-file', 'diff-note']);
    engine.dispose();
  });

  it('credits a drafted fix only after its own result, then the approval', async () => {
    await mount({ Scene: U25_B_RESOLVE_FIX_SCENES['resolve-fix-ready'] });
    withSimulatedSend();
    act(() => {
      installResolveActions({ store });
    });
    const { engine, tried } = track({ settledIds: SETTLED });
    await settle({ ms: 100 });
    expect(tried()).toEqual([]);
    await click({ target: element({ selector: THREAD }) });
    expect(tried()).toEqual(['resolve-pick']);
    await settle({ ms: 3000 });
    await click({ target: element({ selector: DRAFT }) });
    expect(tried()).toEqual(['resolve-pick', 'resolve-fix']);
    await settle({ ms: 3000 });
    await click({ target: element({ selector: '[data-demo-anchor="resolve-start"]' }) });
    await settle({ ms: 500 });
    expect(tried()).toEqual(['resolve-pick', 'resolve-fix']);
    await settle({ ms: 9000 });
    expect(tried()).toEqual(['resolve-pick', 'resolve-fix', 'resolve-start']);
    await settle({ ms: 3000 });
    await click({ target: element({ selector: THREAD }) });
    await click({ target: element({ selector: ACCEPT }) });
    await settle({ ms: 500 });
    expect(tried()).toEqual(['resolve-pick', 'resolve-fix', 'resolve-start', 'resolve-keep']);
    await settle({ ms: 3000 });
    await visitorClick({ selector: 'button[data-branch-secondary="review.push"]' });
    expect(tried().at(-1)).toBe('review-push');
    engine.dispose();
  });

  it('keeps a drafted reply from counting before its comment is opened', async () => {
    await mount({ Scene: U25_B_RESOLVE_FIX_SCENES['resolve-fix-ready'] });
    withSimulatedSend();
    act(() => {
      installResolveActions({ store });
    });
    const { engine, tried } = track({ settledIds: SETTLED });
    await settle({ ms: 500 });
    expect(tried()).toEqual([]);
    engine.dispose();
  });
});
