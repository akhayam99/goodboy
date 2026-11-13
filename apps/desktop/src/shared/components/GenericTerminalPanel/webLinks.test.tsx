// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { IViewportRange } from '@xterm/xterm';

type Handler = (event: MouseEvent, uri: string) => void;
type Options = {
  readonly hover: (event: MouseEvent, uri: string, location: IViewportRange) => void;
  readonly leave: (event: MouseEvent, uri: string) => void;
};

type Harness = {
  handler: Handler | null;
  options: Options | null;
  opened: string[];
};

const h = vi.hoisted((): Harness => ({ handler: null, options: null, opened: [] }));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    options = {};
    unicode = { activeVersion: '' };
    element: HTMLElement | null = null;
    buffer = { active: { length: 0, getLine: () => undefined } };
    loadAddon() {}
    open(container: HTMLElement) {
      const screen = document.createElement('div');
      screen.className = 'xterm-screen';
      screen.getBoundingClientRect = () => new DOMRect(10, 20, 800, 480);
      container.appendChild(screen);
      this.element = container;
    }
    attachCustomKeyEventHandler() {}
    hasSelection() {
      return false;
    }
    onSelectionChange() {
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
vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: class {
    constructor(handler: Handler, options: Options) {
      h.handler = handler;
      h.options = options;
    }
  },
}));
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

const ADDRESS = 'http://localhost:5173/';

const onOpenLink = (event: Event): void => {
  const url = event instanceof CustomEvent ? Reflect.get(event.detail, 'url') : null;
  if (typeof url === 'string') {
    h.opened.push(url);
  }
};

beforeEach(() => {
  h.handler = null;
  h.options = null;
  h.opened = [];
  window.addEventListener('goodboy:open-link', onOpenLink);
});

afterEach(() => {
  cleanup();
  window.removeEventListener('goodboy:open-link', onOpenLink);
});

describe('the terminal panel web links', () => {
  it('hands the click and its modifier to the opener it was given', () => {
    const onOpenWebLink = vi.fn();
    render(
      <GenericTerminalPanel
        terminalId="ledger-core::t1"
        driver={driver}
        isActive
        onOpenWebLink={onOpenWebLink}
      />,
    );
    const event = new MouseEvent('click', { metaKey: true });

    h.handler?.(event, ADDRESS);

    expect(onOpenWebLink).toHaveBeenCalledWith({ url: ADDRESS, event });
    expect(h.opened).toEqual([]);
  });

  it('asks the open router for the link when no opener was given', () => {
    render(<GenericTerminalPanel terminalId="ledger-core::t2" driver={driver} isActive />);

    h.handler?.(new MouseEvent('click'), ADDRESS);

    expect(h.opened).toEqual([ADDRESS]);
  });

  it('reports the row a link rests on and then that it left', () => {
    const onWebLinkHover = vi.fn();
    render(
      <GenericTerminalPanel
        terminalId="ledger-core::t3"
        driver={driver}
        isActive
        onWebLinkHover={onWebLinkHover}
      />,
    );
    const event = new MouseEvent('mousemove');

    h.options?.hover(event, ADDRESS, { start: { x: 9, y: 4 }, end: { x: 29, y: 4 } });
    h.options?.leave(event, ADDRESS);

    expect(onWebLinkHover).toHaveBeenNthCalledWith(1, {
      url: ADDRESS,
      rect: { top: 80, bottom: 100, left: 90, right: 300 },
    });
    expect(onWebLinkHover).toHaveBeenNthCalledWith(2, null);
  });
});
