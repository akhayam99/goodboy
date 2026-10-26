// @vitest-environment happy-dom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { SessionTools } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

const SESSION_ID = nextSessionId();
const TAB_ID: TerminalTabId = JSON.parse(JSON.stringify(`${SESSION_ID}::t1`));

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ terminal_list_live: [] });
  useAppStore.setState({
    currentSessionId: SESSION_ID,
    terminalFinishes: {
      [SESSION_ID]: {
        terminalId: TAB_ID,
        title: 'zsh',
        command: 'pnpm test',
        durationMs: 42_000,
      },
    },
  });
});

afterEach(cleanup);

const renderTools = () =>
  render(
    <ToastProvider>
      <SessionTools sessionId={SESSION_ID} />
    </ToastProvider>,
  );

const terminal = () => screen.getByTestId('pane-toggle-terminal');

describe('the Terminal tool dot', () => {
  it('says a command finished after more than ten seconds, with no exit status', () => {
    renderTools();

    expect(terminal().getAttribute('aria-label')).toBe('Terminal, pnpm test finished after 42s');
    expect(
      terminal().closest('.relative')?.querySelector('[data-signal]')?.getAttribute('data-signal'),
    ).toBe('changed');
  });

  it('clears once the terminal drawer is open', () => {
    renderTools();

    act(() => {
      useAppStore.getState().openDrawer({
        kind: 'terminal',
        sessionId: SESSION_ID,
        payload: { terminalId: TAB_ID },
      });
    });

    expect(terminal().getAttribute('aria-label')).toBe('Terminal');
    expect(useAppStore.getState().terminalFinishes[SESSION_ID]).toBeUndefined();
  });

  it('has no dot when nothing finished', () => {
    useAppStore.setState({ terminalFinishes: {} });
    renderTools();

    expect(terminal().getAttribute('aria-label')).toBe('Terminal');
  });
});
