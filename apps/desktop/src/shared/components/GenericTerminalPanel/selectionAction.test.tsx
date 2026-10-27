// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

type Harness = {
  selection: string;
  changed: (() => void) | null;
  rows: string[];
};

const h = vi.hoisted((): Harness => ({ selection: '', changed: null, rows: [] }));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    options = {};
    unicode = { activeVersion: '' };
    get buffer() {
      return {
        active: {
          length: h.rows.length,
          getLine: (index: number) => {
            const text = h.rows[index];
            return text === undefined
              ? undefined
              : { isWrapped: false, translateToString: () => text };
          },
        },
      };
    }
    loadAddon() {}
    open() {}
    attachCustomKeyEventHandler() {}
    hasSelection() {
      return h.selection !== '';
    }
    getSelection() {
      return h.selection;
    }
    onSelectionChange(listener: () => void) {
      h.changed = listener;
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

import { GenericTerminalPanel, type TerminalDriver } from './index';
import { readTerminalTail } from './terminalText';

const driver: TerminalDriver = {
  write: () => undefined,
  resize: () => undefined,
  onOutput: async () => () => undefined,
  onExit: async () => () => undefined,
};

afterEach(() => {
  cleanup();
  h.selection = '';
  h.changed = null;
  h.rows = [];
});

const select = (text: string) => {
  h.selection = text;
  act(() => h.changed?.());
};

describe('the terminal panel selection action', () => {
  it('offers the action only while text is selected and hands the selected text over', () => {
    const onAct = vi.fn();
    render(
      <GenericTerminalPanel
        terminalId="ledger-core::t1"
        driver={driver}
        isActive
        selectionAction={{ label: 'Ask the agent about this', onAct }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Ask the agent about this' })).toBeNull();

    select('FAIL postings/rounding.test.ts');
    fireEvent.click(screen.getByRole('button', { name: 'Ask the agent about this' }));

    expect(onAct).toHaveBeenCalledWith({ text: 'FAIL postings/rounding.test.ts' });

    select('');
    expect(screen.queryByRole('button', { name: 'Ask the agent about this' })).toBeNull();
  });

  it('does not offer the action without one', () => {
    render(<GenericTerminalPanel terminalId="ledger-core::t1" driver={driver} isActive />);
    select('FAIL postings');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lets the last output be read while it is mounted and not after', () => {
    h.rows = ['$ pnpm test', 'FAIL postings', ''];
    const view = render(
      <GenericTerminalPanel terminalId="ledger-core::t2" driver={driver} isActive />,
    );
    expect(readTerminalTail({ terminalId: 'ledger-core::t2' })).toBe('$ pnpm test\nFAIL postings');

    view.unmount();

    expect(readTerminalTail({ terminalId: 'ledger-core::t2' })).toBeNull();
  });
});
