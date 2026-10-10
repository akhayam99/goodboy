// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';

type Listener = (event: { payload: unknown }) => void;

type Harness = {
  writes: string[];
  listeners: Map<string, Listener[]>;
  ring: { bytes: string; total: number };
  snapshotGate: Promise<void> | null;
};

const harness = vi.hoisted((): Harness => ({
  writes: [],
  listeners: new Map(),
  ring: { bytes: '', total: 0 },
  snapshotGate: null,
}));

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
    onData() {
      return { dispose() {} };
    }
    write(data: Uint8Array | string) {
      harness.writes.push(typeof data === 'string' ? data : new TextDecoder().decode(data));
    }
    writeln(data: string) {
      harness.writes.push(data);
    }
    dispose() {}
    focus() {}
  },
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
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

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    const group = harness.listeners.get(name) ?? [];
    group.push(handler);
    harness.listeners.set(name, group);
    return () => undefined;
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string) => {
    if (command !== 'terminal_snapshot') {
      return undefined;
    }
    await harness.snapshotGate;
    const tail = harness.ring.bytes.slice(-262_144);
    return {
      data: btoa(tail),
      offset: harness.ring.total - tail.length,
      exitCode: null,
    };
  }),
}));

vi.mock('../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', async () => {
  const panel = await import('../../../../shared/components/GenericTerminalPanel');
  return { LazyGenericTerminalPanel: panel.GenericTerminalPanel };
});

type DockState = {
  terminalTabs: Record<string, ReadonlyArray<unknown>>;
  activeTerminalTab: Record<string, string | null>;
  addTerminalTab: () => void;
  closeTerminalTab: () => void;
  setActiveTerminalTab: () => void;
  setTerminalTabStatus: () => void;
};

const { state } = vi.hoisted((): { state: DockState } => ({
  state: {
    terminalTabs: {},
    activeTerminalTab: {},
    addTerminalTab: vi.fn(),
    closeTerminalTab: vi.fn(),
    setActiveTerminalTab: vi.fn(),
    setTerminalTabStatus: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { TerminalDock } from './index';
import { terminalOutputBus } from '../../outputBus';

type IdParams = {
  readonly value: string;
};

const isSessionId = (value: string): value is SessionId => value.length > 0;
const isTabId = (value: string): value is TerminalTabId => value.length > 0;

const sessionIdOf = ({ value }: IdParams): SessionId => {
  if (!isSessionId(value)) {
    throw new Error('empty session id');
  }
  return value;
};

const tabIdOf = ({ value }: IdParams): TerminalTabId => {
  if (!isTabId(value)) {
    throw new Error('empty tab id');
  }
  return value;
};

const SESSION_ID = sessionIdOf({ value: 'session-1' });
const BACKGROUND_ID = tabIdOf({ value: 'session-1::t1' });
const FOREGROUND_ID = tabIdOf({ value: 'session-1::t2' });

const buildTab = (id: TerminalTabId): TerminalTab => ({
  id,
  sessionId: SESSION_ID,
  title: id,
  cwd: '/repo',
  status: 'running',
  createdAt: 0,
});

type EmitParams = {
  readonly terminalId: string;
  readonly text: string;
};

const emitOutput = ({ terminalId, text }: EmitParams): void => {
  const offset = harness.ring.total;
  harness.ring.bytes += text;
  harness.ring.total += text.length;
  for (const handler of harness.listeners.get('terminal-output') ?? []) {
    handler({ payload: { sessionId: terminalId, data: btoa(text), offset } });
  }
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const mountDock = (activeId: TerminalTabId) => {
  state.activeTerminalTab = { [SESSION_ID]: activeId };
  return render(<TerminalDock sessionId={SESSION_ID} isActive cwd="/repo" />);
};

beforeEach(() => {
  installFakeResizeObserver();
  harness.writes.length = 0;
  harness.ring = { bytes: '', total: 0 };
  harness.snapshotGate = null;
  state.terminalTabs = { [SESSION_ID]: [buildTab(BACKGROUND_ID), buildTab(FOREGROUND_ID)] };
});

afterEach(() => {
  cleanup();
  terminalOutputBus.forget({ terminalId: BACKGROUND_ID });
  terminalOutputBus.forget({ terminalId: FOREGROUND_ID });
});

describe('terminal output while a tab is in the background', () => {
  it('shows the last line of a tab that printed 2000 chunks with no panel mounted', async () => {
    await terminalOutputBus.register();
    const view = mountDock(FOREGROUND_ID);
    await flush();
    for (let index = 0; index < 2000; index++) {
      emitOutput({ terminalId: BACKGROUND_ID, text: `line-${index}\n` });
    }
    harness.writes.length = 0;

    state.activeTerminalTab = { [SESSION_ID]: BACKGROUND_ID };
    view.rerender(<TerminalDock sessionId={SESSION_ID} isActive cwd="/repo" />);
    await flush();

    const shown = harness.writes.join('');
    expect(shown).toContain('line-1999\n');
    expect(shown.endsWith('line-1999\n')).toBe(true);
  });

  it('writes an event inside the snapshot once and an event past it once', async () => {
    await terminalOutputBus.register();
    emitOutput({ terminalId: BACKGROUND_ID, text: 'aaaa' });
    let release: () => void = () => undefined;
    harness.snapshotGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mountDock(BACKGROUND_ID);
    await flush();

    emitOutput({ terminalId: BACKGROUND_ID, text: 'bbbb' });
    const snapshotRing = { ...harness.ring };
    emitOutput({ terminalId: BACKGROUND_ID, text: 'cccc' });
    harness.ring = snapshotRing;
    release();
    await flush();

    const shown = harness.writes.join('');
    expect(shown.split('aaaa').length - 1).toBe(1);
    expect(shown.split('bbbb').length - 1).toBe(1);
    expect(shown.split('cccc').length - 1).toBe(1);
  });
});
