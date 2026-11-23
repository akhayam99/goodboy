// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { deskStackOf } from '../../../../../store/slices/drawer/deskStackOf';
import { U50_DESK_KINDS_SCENES } from './deskKinds';

let store: StoryStore;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});
afterEach(() => {
  cleanup();
});

type Params = { readonly name: string };

const show = async ({ name }: Params) => {
  const Scene = U50_DESK_KINDS_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown desk kinds scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await screen.findByRole('complementary', { name: 'Desk' });
  const stack = await waitForStack();
  return stack;
};

const waitForStack = async (): Promise<HTMLElement> => {
  await screen.findByText('Open pull request');
  const stack = document.querySelector<HTMLElement>('[data-desk-stack]');
  if (stack === null) {
    throw new Error('The desk stack is not drawn');
  }
  return stack;
};

const panelOf = ({ stack, kind }: { readonly stack: HTMLElement; readonly kind: string }) => {
  const panel = stack.querySelector<HTMLElement>(`[data-desk-stack-panel="${kind}"]`);
  if (panel === null) {
    throw new Error(`No ${kind} panel in the stack`);
  }
  return panel;
};

describe('the u50 desk kinds scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_DESK_KINDS_SCENES)).toEqual([
      'u50-desk-kinds-light',
      'u50-desk-kinds-dark',
    ]);
  });

  it('shows the agent and the pull request together, the agent on top', async () => {
    const stack = await show({ name: 'u50-desk-kinds-dark' });
    const [first, second] = Array.from(stack.querySelectorAll('[data-desk-stack-panel]'));

    expect(first?.getAttribute('data-desk-stack-panel')).toBe('agent');
    expect(second?.getAttribute('data-desk-stack-panel')).toBe('pr');
    within(panelOf({ stack, kind: 'agent' })).getByText('Open run');
    within(panelOf({ stack, kind: 'pr' })).getByRole('tablist', { name: 'Pull request views' });
  });

  it('gives the pull request panel one action and no rerun, send or more menu', async () => {
    const stack = await show({ name: 'u50-desk-kinds-light' });
    const pr = panelOf({ stack, kind: 'pr' });

    within(pr).getByRole('button', { name: 'Open pull request' });
    expect(within(pr).queryByRole('button', { name: /rerun/i })).toBeNull();
    expect(within(pr).queryByRole('button', { name: /^send/i })).toBeNull();
    expect(within(pr).queryByRole('button', { name: /more/i })).toBeNull();
    expect(stack.querySelector('[data-slot-back-chip]')).toBeNull();
  });

  it('keeps both panels when the pull request switches to Conversation', async () => {
    const stack = await show({ name: 'u50-desk-kinds-dark' });

    fireEvent.click(
      within(panelOf({ stack, kind: 'pr' })).getByRole('tab', { name: 'Conversation' }),
    );

    const state = store.getState();
    const pair = deskStackOf({ top: state.drawer, back: state.drawerBack });
    expect(pair?.pr.payload.tab).toBe('conversation');
    expect(pair?.agent.kind).toBe('transcript');
  });

  it('reveals the failed tool call when Failed here asks again for the open agent', async () => {
    const stack = await show({ name: 'u50-desk-kinds-dark' });
    const body = panelOf({ stack, kind: 'agent' }).querySelector('[data-desk-agent]');
    if (body === null) {
      throw new Error('The agent body is not drawn');
    }
    const toolUseId = 'toolu-harborline-failed';
    const row = document.createElement('div');
    row.setAttribute('data-tool-use-ids', toolUseId);
    body.append(row);
    const pair = deskStackOf({
      top: store.getState().drawer,
      back: store.getState().drawerBack,
    });
    if (pair === null) {
      throw new Error('The desk pair should be open');
    }
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();

    act(() => {
      store.getState().openDrawer({
        kind: 'transcript',
        sessionId: pair.agent.sessionId,
        payload: { agentId: pair.agent.payload.agentId, toolUseId },
      });
    });

    await waitFor(() => expect(scroll.mock.contexts).toContain(row));
    expect(document.querySelector('[data-desk-stack]')).not.toBeNull();
  });

  it('closes the pull request with its X and leaves the agent alone in the detail', async () => {
    const stack = await show({ name: 'u50-desk-kinds-dark' });

    fireEvent.click(within(panelOf({ stack, kind: 'pr' })).getByRole('button', { name: /close/i }));

    expect(document.querySelector('[data-desk-stack]')).toBeNull();
    await screen.findByText('Open run');
    expect(screen.queryByText('Open pull request')).toBeNull();
  });
});
