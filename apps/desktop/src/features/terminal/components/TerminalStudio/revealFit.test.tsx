// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';

const fits = vi.hoisted(() => ({ count: 0 }));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    options = {};
    unicode = { activeVersion: '' };
    loadAddon() {}
    open() {}
    attachCustomKeyEventHandler() {}
    buffer = { active: { length: 0, getLine: () => undefined } };
    hasSelection() {
      return false;
    }
    onSelectionChange() {
      return { dispose() {} };
    }
    registerLinkProvider() {
      return { dispose() {} };
    }
    onData() {
      return { dispose() {} };
    }
    write() {}
    writeln() {}
    dispose() {}
    focus() {}
  },
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {
      fits.count += 1;
    }
  },
}));
vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class {
    onContextLoss() {}
    dispose() {}
  },
}));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: class {} }));
vi.mock('@xterm/addon-clipboard', () => ({ ClipboardAddon: class {} }));
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: class {} }));
vi.mock('@xterm/addon-search', () => ({
  SearchAddon: class {
    onDidChangeResults() {
      return { dispose() {} };
    }
  },
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

vi.mock('../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', async () => {
  const panel = await import('../../../../shared/components/GenericTerminalPanel');
  return { LazyGenericTerminalPanel: panel.GenericTerminalPanel };
});

import { TerminalStudio } from './index';
import { brandedId } from '../../../../features/history/testing/brandedId';

type Observed = {
  readonly callback: ResizeObserverCallback;
  readonly observer: ResizeObserver;
  readonly targets: Set<Element>;
};

const observers = new Set<Observed>();

class ScopedResizeObserver implements ResizeObserver {
  private readonly entry: Observed;

  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback, observer: this, targets: new Set() };
    observers.add(this.entry);
  }

  observe(target: Element) {
    this.entry.targets.add(target);
  }

  unobserve(target: Element) {
    this.entry.targets.delete(target);
  }

  disconnect() {
    this.entry.targets.clear();
    observers.delete(this.entry);
  }
}

type ScopeParams = {
  readonly scope: Element;
};

const resizeWithin = ({ scope }: ScopeParams): void => {
  act(() => {
    [...observers].forEach((entry) => {
      if ([...entry.targets].some((target) => scope.contains(target))) {
        entry.callback([], entry.observer);
      }
    });
  });
};

const SESSION_ID = brandedId<SessionId>({ value: 'session-1' });
const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-1' });
const NOW = brandedId<IsoDateTime>({ value: '2026-10-10T09:12:00.000Z' });
const TAB_ID = brandedId<TerminalTabId>({ value: 'session-1::t1' });

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Round settlement totals to minor units',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const TAB: TerminalTab = {
  id: TAB_ID,
  owner: { kind: 'session', sessionId: SESSION_ID },
  title: 'pnpm dev',
  cwd: '/work/payments-api',
  status: 'running',
  createdAt: 0,
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

type ElementParams = {
  readonly node: Element | null | undefined;
};

const htmlElementOf = ({ node }: ElementParams): HTMLElement => {
  if (!(node instanceof HTMLElement)) {
    throw new Error('html element not found');
  }
  return node;
};

type SizeParams = {
  readonly element: HTMLElement;
  readonly scrollHeight: number;
  readonly clientHeight: number;
};

const size = ({ element, scrollHeight, clientHeight }: SizeParams): void => {
  Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true });
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    terminal_open: null,
    terminal_resize: null,
    terminal_list_live: [],
    db_execute: { rowsAffected: 0 },
    db_select: [],
    monitor_snapshot: { listeners: [], processes: [], takenAt: 0, isPlatformSupported: true },
    process_ledger_list: [],
    monitor_watched_ports: [],
  });
  observers.clear();
  fits.count = 0;
  vi.stubGlobal('ResizeObserver', ScopedResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
  store.setState({ sessions: [SESSION], terminalTabs: { [SESSION_ID]: [TAB] } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('terminal output and the list reveal', () => {
  it('never refits the terminal when the list scroll steps its toolbar aside', async () => {
    render(
      <TerminalStudio
        workspaceId={WORKSPACE_ID}
        terminalId={TAB_ID}
        sessionId={SESSION_ID}
        onClose={() => undefined}
      />,
    );
    await flush();

    const rail = screen.getByRole('complementary', { name: 'Terminals' });
    const region = htmlElementOf({ node: rail.querySelector('[data-slot="reveal-region"]') });
    const terminalBody = htmlElementOf({ node: document.querySelector('[data-terminal-body]') });
    expect(region.contains(terminalBody)).toBe(false);
    within(region).getByRole('button', { name: /new terminal/i });

    resizeWithin({ scope: terminalBody });
    expect(fits.count).toBeGreaterThan(0);
    const before = fits.count;

    const viewport = htmlElementOf({ node: rail.querySelector('[data-page-scroller]') });
    size({ element: viewport, scrollHeight: 2000, clientHeight: 300 });
    fireEvent.wheel(viewport, { deltaY: 200 });
    viewport.scrollTop = 200;
    fireEvent.scroll(viewport);
    resizeWithin({ scope: region });

    expect(region.getAttribute('data-reveal-header')).toBe('hidden');
    expect(fits.count).toBe(before);
  });
});
