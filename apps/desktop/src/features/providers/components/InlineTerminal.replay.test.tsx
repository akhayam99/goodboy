// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../test/fakeResizeObserver';

type Listener = (event: { payload: unknown }) => void;

type Harness = {
  writes: string[];
  listeners: Map<string, Listener[]>;
};

const harness = vi.hoisted((): Harness => ({
  writes: [],
  listeners: new Map(),
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
  invoke: vi.fn(async () => undefined),
}));

vi.mock('../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', async () => {
  const panel = await import('../../../shared/components/GenericTerminalPanel');
  return { LazyGenericTerminalPanel: panel.GenericTerminalPanel };
});

import { InlineTerminal } from './InlineTerminal';
import { invokeProviderLifecycleRun } from '../provider-lifecycle';
import { lifecycleOutputBuffer } from '../lifecycleOutputBuffer';

const RUN_ID = 'login-run-1';

type EmitParams = {
  readonly text: string;
};

const emitOutput = ({ text }: EmitParams): void => {
  for (const handler of harness.listeners.get('provider-lifecycle-output') ?? []) {
    handler({
      payload: { runId: RUN_ID, providerId: 'opencode', action: 'login', data: btoa(text) },
    });
  }
};

const emitExit = (): void => {
  for (const handler of harness.listeners.get('provider-lifecycle-exit') ?? []) {
    handler({
      payload: {
        runId: RUN_ID,
        providerId: 'opencode',
        action: 'login',
        exitCode: 0,
        status: 'ready',
        auth: 'authenticated',
      },
    });
  }
};

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const startRun = async (): Promise<void> => {
  await invokeProviderLifecycleRun({
    providerId: 'opencode',
    action: 'login',
    command: 'opencode auth login',
    runId: RUN_ID,
    cols: 80,
    rows: 24,
  });
};

beforeEach(() => {
  installFakeResizeObserver();
  harness.writes.length = 0;
});

afterEach(() => {
  cleanup();
  lifecycleOutputBuffer.release({ runId: RUN_ID });
});

describe('provider login terminal replay', () => {
  it('shows everything the run printed once after a remount, then keeps streaming', async () => {
    await startRun();
    const first = render(<InlineTerminal runId={RUN_ID} isActive />);
    await flush();
    emitOutput({ text: 'open https://example.test/device\n' });
    emitOutput({ text: 'code ABCD-1234\n' });
    await flush();
    first.unmount();
    emitOutput({ text: 'waiting\n' });
    harness.writes.length = 0;

    render(<InlineTerminal runId={RUN_ID} isActive />);
    await flush();
    emitOutput({ text: 'done\n' });
    await flush();

    const shown = harness.writes.join('');
    expect(shown).toBe('open https://example.test/device\ncode ABCD-1234\nwaiting\ndone\n');
  });

  it('keeps only the last 256KB of a long run', async () => {
    await startRun();
    for (let index = 0; index < 1100; index++) {
      emitOutput({ text: 'x'.repeat(1024) });
    }

    const snapshot = lifecycleOutputBuffer.snapshotOf({ runId: RUN_ID });

    expect(snapshot?.bytes.length).toBe(262_144);
    expect(snapshot?.offset).toBe(1100 * 1024 - 262_144);
  });

  it('replays an exited run to a remount and drops it once that terminal unmounts', async () => {
    await startRun();
    emitOutput({ text: 'logged in\n' });
    emitExit();

    const mounted = render(<InlineTerminal runId={RUN_ID} isActive />);
    await flush();

    expect(harness.writes.join('')).toBe('logged in\n');
    expect(lifecycleOutputBuffer.snapshotOf({ runId: RUN_ID })?.exitCode).toBe(0);

    mounted.unmount();

    expect(lifecycleOutputBuffer.snapshotOf({ runId: RUN_ID })).toBeNull();
  });
});
