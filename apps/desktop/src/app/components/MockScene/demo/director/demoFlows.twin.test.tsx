// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { U25_C08_PRESET_RUN_SCENES } from '../../scenes/u25/c08-preset-run';
import { U25_C07_AUTO_SCENES } from '../../scenes/u25/c07-auto';
import { C08_IMPLEMENTER_ID, C08_SESSION_ID } from '../../scenes/u25/c08RunSeed';
import { AUTO_ROOT_ID, AUTO_SESSION } from '../../scenes/u24/autoSceneSeed';
import { BoardShellScene } from '../../scenes/BoardShellScene';
import { ResolveQueueShellScene } from '../../scenes/SurfaceAuditScenes';
import { SESSION_ID } from '../../scenes/resolveSeed';
import { autoTimeline } from './autoTimeline';
import { createSimulatedSend } from './createSimulatedSend';
import { createReplyRuns } from './createReplyRuns';
import { installBoardActions } from './installBoardActions';
import { installDemoIpc } from './installDemoIpc';
import { installResolveActions } from './installResolveActions';
import { installRunActions } from './runActions';

const SETTLE_MS = 2_000;

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
  window.history.replaceState({}, '', '/?scene=demo-twin&director=1');
  installDemoIpc();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

type MountParams = {
  readonly Scene: ComponentType;
};

const mount = async ({ Scene }: MountParams): Promise<void> => {
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle({ ms: SETTLE_MS });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

type SettleParams = {
  readonly ms: number;
};

const settle = async ({ ms }: SettleParams): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

type ButtonParams = {
  readonly name: string | RegExp;
};

const click = async ({ name }: ButtonParams): Promise<void> => {
  const [button] = screen.getAllByRole('button', { name });
  if (button === undefined) {
    throw new Error(`no button ${String(name)}`);
  }
  await act(async () => {
    fireEvent.click(button);
  });
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

describe('the workflow run in the demo', () => {
  it('approves the plan and runs the next step to its end', async () => {
    await mount({ Scene: U25_C08_PRESET_RUN_SCENES['c08-run-approval'] });
    act(() => {
      installRunActions({ store });
    });
    await click({ name: 'Approve plan' });
    await settle({ ms: 500 });
    expect(store.getState().agentTurnState[C08_IMPLEMENTER_ID]?.kind).toBe('running');
    await settle({ ms: 8000 });
    const implementer = store
      .getState()
      .sessionPhaseRuns[C08_SESSION_ID]?.find((agent) => agent.id === C08_IMPLEMENTER_ID);
    expect(implementer?.status).toBe('completed');
    expect(screen.getAllByRole('button', { name: /Start step 3/ }).length).toBeGreaterThan(0);
  });
});

describe('Auto in the demo', () => {
  it('approves the plan from its card and finishes the helpers', async () => {
    await mount({ Scene: U25_C07_AUTO_SCENES['c07-auto-plan'] });
    withSimulatedSend();
    act(() => {
      autoTimeline({ state: store.getState() })?.setup?.({ store });
    });
    await settle({ ms: 100 });
    await click({ name: 'Approve plan' });
    await settle({ ms: 1000 });
    expect(
      store
        .getState()
        .transcripts[AUTO_ROOT_ID]?.some(
          (event) => event.kind === 'user_text' && event.text === 'Approved plan v1.',
        ),
    ).toBe(true);
    await settle({ ms: 30000 });
    expect(store.getState().autoTreeViews[AUTO_SESSION.id]?.[0]?.tree.phase).toBe('done');
    expect(screen.queryByText(/Couldn't approve the plan/)).toBeNull();
  });
});

describe('the board in the demo', () => {
  it('opens the session behind a card with its reason', async () => {
    await import('../../scenes/BoardSessionView');
    await mount({ Scene: BoardShellScene });
    act(() => {
      installBoardActions({ store });
    });
    const card = screen
      .getAllByRole('button', { name: /Warn merchants before a payout hold/ })
      .at(-1);
    if (card === undefined) {
      throw new Error('no card');
    }
    await act(async () => {
      fireEvent.click(card);
    });
    await settle({ ms: 1000 });
    expect(store.getState().currentSessionId).not.toBeNull();
    screen.getByText(/Should the warning go out by email/);
  });
});

describe('review comments in the demo', () => {
  it('fixes one comment, drafts the reply and applies the fix locally', async () => {
    await mount({ Scene: ResolveQueueShellScene });
    withSimulatedSend();
    act(() => {
      installResolveActions({ store });
    });
    const row = document.querySelector<HTMLElement>(
      '[data-thread-id="PRRT_thread_retry_constant"]',
    );
    if (row === null) {
      throw new Error('no comment row');
    }
    await act(async () => {
      fireEvent.click(row);
    });
    await settle({ ms: 500 });
    await click({ name: /^Fix/ });
    await settle({ ms: 500 });
    await click({ name: 'Start fix for 1' });
    await settle({ ms: 500 });
    const working = store
      .getState()
      .sessionResolveQueueItems[SESSION_ID]?.find(
        (entry) => entry.thread.threadId === 'PRRT_thread_retry_constant',
      );
    expect(working?.thread.stage).toBe('working');
    await settle({ ms: 8000 });
    const ready = store
      .getState()
      .sessionResolveQueueItems[SESSION_ID]?.find(
        (entry) => entry.thread.threadId === 'PRRT_thread_retry_constant',
      );
    expect(ready?.thread.stage).toBe('proposed');
    expect(ready?.thread.replyDraft?.length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
