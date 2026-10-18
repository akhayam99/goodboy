// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));
const { terminals } = vi.hoisted(() => ({
  terminals: [] as Array<{ options: Record<string, unknown> }>,
}));
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    options: Record<string, unknown>;
    unicode = { activeVersion: '' };
    constructor(options: Record<string, unknown>) {
      this.options = { ...options };
      terminals.push(this);
    }
    loadAddon() {}
    open() {}
    attachCustomKeyEventHandler() {}
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

import { resetStorySpies, stubStoryInvoke, storySpies } from '../../../store/storyHarness';
import { GenericTerminalPanel, type TerminalDriver } from './index';

const driver: TerminalDriver = {
  write: () => undefined,
  resize: () => undefined,
  onOutput: async () => () => undefined,
  onExit: async () => () => undefined,
};

type AgentParams = {
  readonly userAgent: string;
};

const useAgent = ({ userAgent }: AgentParams): void => {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
};

const answerPlatform = (): void => {
  stubStoryInvoke({
    app_platform: {
      os: 'windows',
      osVersion: '10.0.22631',
      arch: 'x86_64',
      buildSha: null,
      windowsBuild: 22631,
    },
  });
};

afterEach(() => {
  cleanup();
  terminals.splice(0);
  resetStorySpies();
});

describe('the terminal panel on Windows', () => {
  it('tells xterm it talks to ConPTY on this build of Windows', async () => {
    useAgent({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    answerPlatform();

    render(<GenericTerminalPanel terminalId="payments-api::t1" driver={driver} isActive />);

    await waitFor(() =>
      expect(terminals[0]?.options.windowsPty).toEqual({ backend: 'conpty', buildNumber: 22631 }),
    );
  });

  it('leaves line endings to the pty', () => {
    useAgent({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    answerPlatform();

    render(<GenericTerminalPanel terminalId="payments-api::t1" driver={driver} isActive />);

    expect(terminals[0]?.options.convertEol).toBeUndefined();
  });

  it('asks nothing on macOS', async () => {
    useAgent({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)' });
    answerPlatform();

    render(<GenericTerminalPanel terminalId="payments-api::t1" driver={driver} isActive />);

    await Promise.resolve();
    expect(terminals[0]?.options.windowsPty).toBeUndefined();
    expect(storySpies.tauriInvoke.mock.calls.some(([name]) => name === 'app_platform')).toBe(false);
  });
});
