// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    options = {};
    unicode = { activeVersion: '' };
    loadAddon(addon: { readonly isWebgl?: boolean }) {
      if (addon.isWebgl === true) {
        throw new Error('WebGL2 not supported');
      }
    }
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
    isWebgl = true;
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

import { GenericTerminalPanel, type TerminalDriver } from './index';

const driver: TerminalDriver = {
  write: () => undefined,
  resize: () => undefined,
  onOutput: async () => () => undefined,
  onExit: async () => () => undefined,
};

afterEach(cleanup);

describe('the terminal panel without WebGL2', () => {
  it('keeps the terminal on the default renderer instead of crashing', () => {
    render(<GenericTerminalPanel terminalId="payments-api::t1" driver={driver} isActive />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
