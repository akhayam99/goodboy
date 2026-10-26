// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { DemoRunScene } from '../../scenes/demo/DemoRunScene';
import { createHintEngine } from '../director/createHintEngine';
import type { DemoHintReport } from '../director/demoProtocol';
import { installDemoIpc } from '../director/installDemoIpc';
import { installPresetActions } from '../director/installPresetActions';
import { ORCHESTRATE_HINTS } from './orchestrateHints';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
  window.history.replaceState({}, '', '/?scene=demo-run&director=1');
  installDemoIpc();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
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
  await settle({ ms: 300 });
};

const SETTLED: ReadonlyArray<string> = ['auto-start', 'auto-approve', 'auto-child'];
const MENU = 'button[aria-label$="run actions"]';
const ITEM = 'button[role="menuitem"][data-menu-label="Save as preset"]';

describe('the save-as-preset step', () => {
  it('sits last in Orchestrate, on the finished run frame', () => {
    const last = ORCHESTRATE_HINTS.at(-1);
    expect(last?.id).toBe('run-save');
    expect(last?.beat).toBe(1);
    expect(last?.progress).toBeDefined();
  });

  it('credits the step only once the preset is saved, then shows it in the Workflows studio', async () => {
    render(
      <ToastProvider>
        <DemoRunScene />
      </ToastProvider>,
    );
    await settle({ ms: 2000 });
    act(() => {
      installPresetActions({ store });
    });
    const reports: DemoHintReport[] = [];
    const engine = createHintEngine({
      store,
      view: window,
      generation: () => 0,
      hintsOf: () => ORCHESTRATE_HINTS,
      onReport: ({ report }) => reports.push(report),
    });
    engine.setTrack({ chapterId: 'orchestrate', settledIds: SETTLED });
    const tried = (): ReadonlyArray<string> =>
      reports.flatMap((report) => (report.type === 'tried' ? [report.hintId] : []));
    await settle({ ms: 300 });
    const before = Object.values(store.getState().phaseTemplates).flat().length;
    await visitorClick({ selector: MENU });
    expect(tried()).toEqual([]);
    await visitorClick({ selector: ITEM });
    expect(tried()).toEqual(['run-save']);
    const presets = Object.values(store.getState().phaseTemplates).flat();
    expect(presets).toHaveLength(before + 1);
    expect(presets[0]?.name).toBe('Webhook credit fix');
    expect(presets[0]?.steps).toHaveLength(4);
    expect(store.getState().appStudio).toBeNull();
    await settle({ ms: 1200 });
    expect(store.getState().appStudio?.kind).toBe('workflow');
    expect(screen.getAllByText('Webhook credit fix').length).toBeGreaterThan(0);
    engine.dispose();
  });
});
