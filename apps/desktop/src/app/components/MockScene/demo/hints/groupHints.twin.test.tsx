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
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { sceneInvoke } from '../../../../../test/sceneInvoke';
import { U25_C08_PRESET_RUN_SCENES } from '../../scenes/u25/c08-preset-run';
import { U25_C07_AUTO_SCENES } from '../../scenes/u25/c07-auto';
import { U25_B_RESOLVE_FIX_SCENES } from '../../scenes/u25/b-resolve-fix';
import { BoardShellScene } from '../../scenes/BoardShellScene';
import { ArtifactsLensShellScene, ResolveQueueShellScene } from '../../scenes/SurfaceAuditScenes';
import { BrandDiffScene } from '../../scenes/brand/DiffScene';
import { autoTimeline } from '../director/autoTimeline';
import { createHintEngine } from '../director/createHintEngine';
import { createReplyRuns } from '../director/createReplyRuns';
import { createSimulatedSend } from '../director/createSimulatedSend';
import type { DemoHintReport } from '../director/demoProtocol';
import { installBoardActions } from '../director/installBoardActions';
import { installDemoIpc } from '../director/installDemoIpc';
import { installDemoWorld } from '../director/installDemoWorld';
import { installResolveActions } from '../director/installResolveActions';
import { installRunActions } from '../director/runActions';
import type { DemoHint } from './demoHintTypes';
import { FIND_HINTS } from './findHints';
import { ORCHESTRATE_HINTS } from './orchestrateHints';
import { REVIEW_HINTS } from './reviewHints';
import { DEMO_CHAPTERS } from '../demoChapters';
import { hintTally } from './hintTally';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
  window.history.replaceState({}, '', '/?scene=demo-twin&director=1');
  installDemoIpc();
}, STORE_IMPORT_TIMEOUT_MS);

const resetScene = async (): Promise<void> => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
};

beforeEach(async () => {
  await resetScene();
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
});

afterEach(() => {
  vi.useRealTimers();
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
  readonly hints: ReadonlyArray<DemoHint>;
};

const track = ({ hints }: TrackParams) => {
  const reports: DemoHintReport[] = [];
  const engine = createHintEngine({
    store,
    view: window,
    generation: () => 0,
    hintsOf: () => hints,
    placeOf: () => null,
    onReport: ({ report }) => reports.push(report),
  });
  engine.setTrack({ chapterId: 'twin', settledIds: [] });
  const tried = (): ReadonlyArray<string> =>
    reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
  return { engine, tried };
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

type ButtonParams = {
  readonly name: string | RegExp;
};

const button = ({ name }: ButtonParams): HTMLElement => {
  const [found] = screen.getAllByRole('button', { name });
  if (found === undefined) {
    throw new Error(`no button ${String(name)}`);
  }
  return found;
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

describe('the Orchestrate hints', () => {
  it('lists Auto first, then the saved workflow', () => {
    expect(ORCHESTRATE_HINTS.map((hint) => hint.id)).toEqual([
      'auto-start',
      'auto-approve',
      'auto-child',
      'run-approve',
      'run-step',
      'run-model',
      'run-report',
    ]);
  });

  it('credits starting Auto, approving its plan and following a helper, in order', async () => {
    await mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-start'] });
    withSimulatedSend();
    act(() => {
      autoTimeline({ state: store.getState() })?.setup?.({ store });
    });
    const { engine, tried } = track({ hints: ORCHESTRATE_HINTS });
    await settle({ ms: 100 });
    expect(tried()).toEqual([]);
    await typeInto({
      selector: 'textarea[aria-label="Start a run"]',
      text: 'Check ledger-core for the same duplicate credit risk',
    });
    await click({ target: button({ name: 'Start' }) });
    await settle({ ms: 500 });
    expect(tried()).toEqual(['auto-start']);
    await settle({ ms: 30000 });
    await click({ target: element({ selector: '[data-demo-anchor="auto-approve"]' }) });
    await settle({ ms: 1000 });
    expect(tried()).toEqual(['auto-start', 'auto-approve']);
    await click({
      target: element({
        selector: 'ul[aria-label="Delegations"] > li[data-delegation] > span > button',
      }),
    });
    expect(store.getState().drawer?.kind).toBe('auto-child');
    expect(tried()).toEqual(['auto-start', 'auto-approve', 'auto-child']);
    engine.dispose();
  });

  it('credits the run approval, an opened step and a picked model', async () => {
    await mount({ Scene: U25_C08_PRESET_RUN_SCENES['c08-run-approval'] });
    act(() => {
      installRunActions({ store });
    });
    const { engine, tried } = track({ hints: ORCHESTRATE_HINTS });
    await settle({ ms: 100 });
    expect(tried()).toEqual([]);
    await click({ target: element({ selector: '[data-demo-anchor="run-approve-plan"]' }) });
    await settle({ ms: 500 });
    expect(tried()).toEqual(['run-approve']);
    await click({ target: element({ selector: '[role="treeitem"][data-tree-id]' }) });
    expect(store.getState().drawer?.kind).toBe('spawned');
    expect(tried()).toEqual(['run-approve', 'run-step']);
    await click({ target: element({ selector: 'button[aria-label^="Model routing"]' }) });
    await click({ target: button({ name: 'Opus' }) });
    await settle({ ms: 500 });
    expect(tried()).toEqual(['run-approve', 'run-step', 'run-model']);
    engine.dispose();
  });
});

describe('the Find work and results hints', () => {
  it('credits a board filter and the card that needs you', async () => {
    await import('../../scenes/BoardSessionView');
    await mount({ Scene: BoardShellScene });
    act(() => {
      installBoardActions({ store });
    });
    const { engine, tried } = track({ hints: FIND_HINTS });
    await settle({ ms: 100 });
    expect(tried()).toEqual([]);
    await click({
      target: element({ selector: '[data-page="board"] button[aria-label="Filter sessions"]' }),
    });
    await click({
      target: element({
        selector: '[role="dialog"][aria-label="Filter sessions"] input[aria-label^="notify-relay"]',
      }),
    });
    expect(tried()).toEqual(['board-filter']);
    const card = screen
      .getAllByRole('button', { name: /Warn merchants before a payout hold/ })
      .at(-1);
    if (card === undefined) {
      throw new Error('no card');
    }
    await click({ target: card });
    await settle({ ms: 1000 });
    expect(tried()).toEqual(['board-filter', 'board-open']);
    engine.dispose();
  });

  it('credits a comment only once a plan from the library is open', async () => {
    await mount({ Scene: ArtifactsLensShellScene });
    act(() => {
      installDemoWorld({ store });
    });
    const { engine, tried } = track({ hints: FIND_HINTS });
    await settle({ ms: 100 });
    await click({
      target: element({ selector: 'button[data-artifact-row][aria-label^="Plan "]' }),
    });
    await settle({ ms: 500 });
    expect(tried()).toEqual(['plan-open']);
    const sessionId = store.getState().currentSessionId;
    if (sessionId === null) {
      throw new Error('no session');
    }
    const plan = (store.getState().sessionPlans[sessionId] ?? [])[0];
    if (plan === undefined) {
      throw new Error('no plan');
    }
    await act(async () => {
      await store.getState().addArtifactComment({
        sessionId,
        artifactId: plan.id,
        revision: 1,
        anchor: { kind: 'block', order: 0, text: 'Approach' },
        body: 'Read the ledger-core cache first',
      });
    });
    await settle({ ms: 100 });
    expect(tried()).toEqual(['plan-open', 'plan-comment']);
    engine.dispose();
  });
});

describe('walking Orchestrate and Find work and results', () => {
  it('counts 6 of 6 across Auto and then the saved run', async () => {
    const chapter = DEMO_CHAPTERS.find((entry) => entry.id === 'orchestrate');
    if (chapter === undefined) {
      throw new Error('no orchestrate chapter');
    }
    await mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-start'] });
    withSimulatedSend();
    act(() => {
      autoTimeline({ state: store.getState() })?.setup?.({ store });
    });
    const first = track({ hints: ORCHESTRATE_HINTS });
    await settle({ ms: 100 });
    await typeInto({
      selector: 'textarea[aria-label="Start a run"]',
      text: 'Check ledger-core for the same duplicate credit risk',
    });
    await click({ target: button({ name: 'Start' }) });
    await settle({ ms: 500 });
    await settle({ ms: 30000 });
    await click({ target: element({ selector: '[data-demo-anchor="auto-approve"]' }) });
    await settle({ ms: 1000 });
    await click({
      target: element({
        selector: 'ul[aria-label="Delegations"] > li[data-delegation] > span > button',
      }),
    });
    const triedIds = [...first.tried()];
    first.engine.dispose();
    cleanup();
    await resetScene();
    await mount({ Scene: U25_C08_PRESET_RUN_SCENES['c08-run-approval'] });
    act(() => {
      installRunActions({ store });
    });
    const second = track({ hints: ORCHESTRATE_HINTS });
    await settle({ ms: 100 });
    await click({ target: element({ selector: '[data-demo-anchor="run-approve-plan"]' }) });
    await settle({ ms: 500 });
    await click({ target: element({ selector: '[role="treeitem"][data-tree-id]' }) });
    await click({ target: element({ selector: 'button[aria-label^="Model routing"]' }) });
    await click({ target: button({ name: 'Opus' }) });
    await settle({ ms: 500 });
    triedIds.push(...second.tried());
    second.engine.dispose();
    const progress = { orchestrate: { tried: triedIds, skipped: [], epoch: 0 } };
    expect(hintTally({ chapter, progress })).toEqual({ tried: 6, total: 6 });
  });

  it('counts 3 of 3 across the board and the library', async () => {
    const chapter = DEMO_CHAPTERS.find((entry) => entry.id === 'find');
    if (chapter === undefined) {
      throw new Error('no find chapter');
    }
    await import('../../scenes/BoardSessionView');
    await mount({ Scene: BoardShellScene });
    act(() => {
      installBoardActions({ store });
    });
    const first = track({ hints: FIND_HINTS });
    await settle({ ms: 100 });
    await click({
      target: element({ selector: '[data-page="board"] button[aria-label="Filter sessions"]' }),
    });
    await click({
      target: element({
        selector: '[role="dialog"][aria-label="Filter sessions"] input[aria-label^="notify-relay"]',
      }),
    });
    const card = screen
      .getAllByRole('button', { name: /Warn merchants before a payout hold/ })
      .at(-1);
    if (card === undefined) {
      throw new Error('no card');
    }
    await click({ target: card });
    await settle({ ms: 1000 });
    const triedIds = [...first.tried()];
    first.engine.dispose();
    cleanup();
    await resetScene();
    await mount({ Scene: ArtifactsLensShellScene });
    act(() => {
      installDemoWorld({ store });
    });
    const second = track({ hints: FIND_HINTS });
    await settle({ ms: 100 });
    await click({
      target: element({ selector: 'button[data-artifact-row][aria-label^="Plan "]' }),
    });
    await settle({ ms: 500 });
    const sessionId = store.getState().currentSessionId;
    const plan =
      sessionId === null ? undefined : (store.getState().sessionPlans[sessionId] ?? [])[0];
    if (sessionId === null || plan === undefined) {
      throw new Error('no plan');
    }
    await act(async () => {
      await store.getState().addArtifactComment({
        sessionId,
        artifactId: plan.id,
        revision: 1,
        anchor: { kind: 'block', order: 0, text: 'Approach' },
        body: 'Read the ledger-core cache first',
      });
    });
    await settle({ ms: 100 });
    triedIds.push(...second.tried());
    second.engine.dispose();
    const progress = { find: { tried: triedIds, skipped: [], epoch: 0 } };
    expect(hintTally({ chapter, progress })).toEqual({ tried: 3, total: 3 });
  });
});

describe('the Review and ship hints', () => {
  it('lists the diff first, then the review comment fix', () => {
    expect(REVIEW_HINTS.map((hint) => hint.id)).toEqual([
      'diff-file',
      'diff-note',
      'resolve-pick',
      'resolve-fix',
      'resolve-start',
      'resolve-read',
      'resolve-keep',
    ]);
  });

  it('credits opening the webhook handler and leaving a line note', async () => {
    await mount({ Scene: BrandDiffScene });
    act(() => {
      installDemoWorld({ store });
    });
    const { engine, tried } = track({ hints: REVIEW_HINTS });
    await settle({ ms: 100 });
    expect(tried()).toEqual([]);
    await click({
      target: element({
        selector: '[role="treeitem"][data-tree-row="src/webhooks/applyWebhook.ts"] > button',
      }),
    });
    expect(tried()).toEqual(['diff-file']);
    const gutter = element({
      selector: '[data-file-path="src/webhooks/applyWebhook.ts"] button[data-gutter="new:13"]',
    });
    await act(async () => {
      fireEvent.keyDown(gutter, { key: 'Enter' });
    });
    await typeInto({
      selector: 'textarea[aria-label="Note on line 13"]',
      text: 'Keep the credit and the event row in one transaction',
    });
    await click({ target: button({ name: 'Add note' }) });
    await settle({ ms: 300 });
    expect(tried()).toEqual(['diff-file', 'diff-note']);
    engine.dispose();
  });

  it('credits a fix only once it is ready with a drafted reply, then its approval', async () => {
    await mount({ Scene: ResolveQueueShellScene });
    withSimulatedSend();
    act(() => {
      installResolveActions({ store });
    });
    const { engine, tried } = track({ hints: REVIEW_HINTS });
    await settle({ ms: 100 });
    const row = '[data-thread-id="PRRT_thread_retry_constant"]';
    await click({ target: element({ selector: row }) });
    expect(tried()).toEqual(['resolve-pick']);
    await click({
      target: element({ selector: 'button[data-review-verb="reviewComment.draft"]' }),
    });
    expect(tried()).toEqual(['resolve-pick', 'resolve-fix']);
    await click({ target: element({ selector: '[data-demo-anchor="resolve-start"]' }) });
    await settle({ ms: 500 });
    expect(tried()).toEqual(['resolve-pick', 'resolve-fix']);
    await settle({ ms: 8000 });
    expect(tried()).toEqual(['resolve-pick', 'resolve-fix', 'resolve-start', 'resolve-read']);
    await click({ target: element({ selector: row }) });
    await click({
      target: element({ selector: 'button[data-review-verb="reviewComment.accept"]' }),
    });
    await settle({ ms: 500 });
    expect(tried()).toEqual([
      'resolve-pick',
      'resolve-fix',
      'resolve-start',
      'resolve-read',
      'resolve-keep',
    ]);
    engine.dispose();
  });

  it('counts 3 of 3 after the diff then the comments', async () => {
    const chapter = DEMO_CHAPTERS.find((entry) => entry.id === 'review');
    if (chapter === undefined) {
      throw new Error('no review chapter');
    }
    const triedIds: string[] = [];
    await mount({ Scene: BrandDiffScene });
    act(() => {
      installDemoWorld({ store });
    });
    const first = track({ hints: REVIEW_HINTS });
    await settle({ ms: 100 });
    await click({
      target: element({
        selector: '[role="treeitem"][data-tree-row="src/webhooks/applyWebhook.ts"] > button',
      }),
    });
    const gutter = element({
      selector: '[data-file-path="src/webhooks/applyWebhook.ts"] button[data-gutter="new:13"]',
    });
    await act(async () => {
      fireEvent.keyDown(gutter, { key: 'Enter' });
    });
    await typeInto({
      selector: 'textarea[aria-label="Note on line 13"]',
      text: 'Keep the credit and the event row in one transaction',
    });
    await click({ target: button({ name: 'Add note' }) });
    triedIds.push(...first.tried());
    first.engine.dispose();
    cleanup();
    await resetScene();
    await mount({ Scene: ResolveQueueShellScene });
    withSimulatedSend();
    act(() => {
      installResolveActions({ store });
    });
    const second = track({ hints: REVIEW_HINTS });
    await settle({ ms: 100 });
    const row = '[data-thread-id="PRRT_thread_retry_constant"]';
    await click({ target: element({ selector: row }) });
    await click({
      target: element({ selector: 'button[data-review-verb="reviewComment.draft"]' }),
    });
    await click({ target: element({ selector: '[data-demo-anchor="resolve-start"]' }) });
    await settle({ ms: 8500 });
    await click({ target: element({ selector: row }) });
    await click({
      target: element({ selector: 'button[data-review-verb="reviewComment.accept"]' }),
    });
    await settle({ ms: 500 });
    triedIds.push(...second.tried());
    second.engine.dispose();
    const progress = { review: { tried: triedIds, skipped: [], epoch: 0 } };
    expect(hintTally({ chapter, progress })).toEqual({ tried: 3, total: 3 });
  });

  it('counts 3 of 3 for a visitor who steps to the Ready beat, where every fix is already drafted', async () => {
    const chapter = DEMO_CHAPTERS.find((entry) => entry.id === 'review');
    if (chapter === undefined) {
      throw new Error('no review chapter');
    }
    const triedIds: string[] = [];
    await mount({ Scene: BrandDiffScene });
    act(() => {
      installDemoWorld({ store });
    });
    const first = track({ hints: REVIEW_HINTS });
    await settle({ ms: 100 });
    await click({
      target: element({
        selector: '[role="treeitem"][data-tree-row="src/webhooks/applyWebhook.ts"] > button',
      }),
    });
    await act(async () => {
      fireEvent.keyDown(
        element({
          selector: '[data-file-path="src/webhooks/applyWebhook.ts"] button[data-gutter="new:13"]',
        }),
        { key: 'Enter' },
      );
    });
    await typeInto({
      selector: 'textarea[aria-label="Note on line 13"]',
      text: 'Keep the credit and the event row in one transaction',
    });
    await click({ target: button({ name: 'Add note' }) });
    triedIds.push(...first.tried());
    first.engine.dispose();
    cleanup();
    await resetScene();
    await mount({ Scene: U25_B_RESOLVE_FIX_SCENES['resolve-fix-ready'] });
    withSimulatedSend();
    act(() => {
      installResolveActions({ store });
    });
    const second = track({ hints: REVIEW_HINTS });
    await settle({ ms: 100 });
    expect(second.tried()).toEqual([]);
    await click({ target: element({ selector: '[data-thread-id="PRRT_thread_retry_backoff"]' }) });
    expect(second.tried()).toEqual(['resolve-pick', 'resolve-read']);
    await click({
      target: element({ selector: 'button[data-review-verb="reviewComment.accept"]' }),
    });
    await settle({ ms: 500 });
    expect(second.tried()).toEqual(['resolve-pick', 'resolve-read', 'resolve-keep']);
    triedIds.push(...second.tried());
    second.engine.dispose();
    const progress = { review: { tried: triedIds, skipped: [], epoch: 0 } };
    expect(hintTally({ chapter, progress })).toEqual({ tried: 3, total: 3 });
  });

  it('keeps a drafted reply from counting before a drafted comment is opened', async () => {
    await mount({ Scene: ResolveQueueShellScene });
    withSimulatedSend();
    act(() => {
      installResolveActions({ store });
    });
    const { engine, tried } = track({ hints: REVIEW_HINTS });
    await settle({ ms: 500 });
    expect(tried()).toEqual([]);
    engine.dispose();
  });
});
