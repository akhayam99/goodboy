// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useNativeMenuPolicy } from './index';
import { keepsNativeMenu } from './keepsNativeMenu';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

const mount = (html: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
};

const selectContents = ({ element }: { readonly element: Element }): void => {
  const range = document.createRange();
  range.selectNodeContents(element);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
};

const press = (target: Element): void => {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 }));
};

const rightClick = (target: Element): MouseEvent => {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 40,
    clientY: 50,
  });
  target.dispatchEvent(event);
  return event;
};

describe('keepsNativeMenu', () => {
  it('keeps the native menu in editable fields and the composer', () => {
    const host = mount('<textarea></textarea><div contenteditable="true"><span>draft</span></div>');
    expect(keepsNativeMenu({ target: host.querySelector('textarea'), selection: null })).toBe(true);
    expect(keepsNativeMenu({ target: host.querySelector('span'), selection: null })).toBe(true);
  });

  it('keeps the native menu in the terminal, which owns selection and paste', () => {
    const host = mount('<div class="xterm"><div class="xterm-screen">ledger-core $</div></div>');
    expect(keepsNativeMenu({ target: host.querySelector('.xterm-screen'), selection: null })).toBe(
      true,
    );
  });

  it('keeps the native menu when text is selected inside a reading region', () => {
    const host = mount(
      '<div data-reading-region=""><p>Speed up the payout export for Harborline</p></div>',
    );
    const paragraph = host.querySelector('p')!;
    selectContents({ element: paragraph });
    expect(keepsNativeMenu({ target: paragraph, selection: window.getSelection() })).toBe(true);
  });

  it('never keeps it for a selection on chrome, outside a reading region', () => {
    const host = mount('<button><span>Center the member layout</span></button>');
    const label = host.querySelector('span')!;
    selectContents({ element: label });
    expect(keepsNativeMenu({ target: label, selection: window.getSelection() })).toBe(false);
  });

  it('treats a checkbox or radio row as a row, not a text field', () => {
    const host = mount(
      '<label><input type="checkbox" /><span>Retry the payments-api webhook</span></label><input type="radio" />',
    );
    expect(
      keepsNativeMenu({ target: host.querySelector('input[type="checkbox"]'), selection: null }),
    ).toBe(false);
    expect(
      keepsNativeMenu({ target: host.querySelector('input[type="radio"]'), selection: null }),
    ).toBe(false);
  });

  it('does not keep it on a plain row with nothing selected', () => {
    const host = mount('<button>Northwind session</button>');
    expect(keepsNativeMenu({ target: host.querySelector('button'), selection: null })).toBe(false);
  });
});

describe('useNativeMenuPolicy', () => {
  it('suppresses the webview menu, and its Reload, on blank areas', () => {
    const onLink = vi.fn();
    renderHook(() => useNativeMenuPolicy({ onLink }));
    const host = mount('<section><h2>Board</h2></section>');
    expect(rightClick(host.querySelector('h2')!).defaultPrevented).toBe(true);
    expect(onLink).not.toHaveBeenCalled();
  });

  it('lets the native menu through for an editable field', () => {
    renderHook(() => useNativeMenuPolicy({ onLink: vi.fn() }));
    const host = mount('<input value="notify-relay" />');
    expect(rightClick(host.querySelector('input')!).defaultPrevented).toBe(false);
  });

  it('opens our link menu on an external link, never the webview Open Link', () => {
    const onLink = vi.fn();
    renderHook(() => useNativeMenuPolicy({ onLink }));
    const host = mount('<a href="https://linear.app/acme/issue/HAR-231">HAR-231</a>');
    const event = rightClick(host.querySelector('a')!);
    expect(event.defaultPrevented).toBe(true);
    expect(onLink).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'https://linear.app/acme/issue/HAR-231',
        point: { x: 40, y: 50 },
      }),
    );
  });

  it('opens our row menu when the right click itself selected the row label', () => {
    renderHook(() => useNativeMenuPolicy({ onLink: vi.fn() }));
    const host = mount('<div data-row=""><span>Move member home</span></div>');
    const onRowMenu = vi.fn((event: Event) => event.preventDefault());
    host.querySelector('[data-row]')!.addEventListener('contextmenu', onRowMenu);
    const label = host.querySelector('span')!;
    press(label);
    selectContents({ element: label });
    expect(rightClick(label).defaultPrevented).toBe(true);
    expect(onRowMenu).toHaveBeenCalledTimes(1);
  });

  it('ignores the word the press selected in prose and opens our menu', () => {
    renderHook(() => useNativeMenuPolicy({ onLink: vi.fn() }));
    const host = mount('<div data-reading-region=""><p>Cap the attempts at three.</p></div>');
    const prose = host.querySelector('p')!;
    const onMessageMenu = vi.fn((event: Event) => event.preventDefault());
    host.addEventListener('contextmenu', onMessageMenu);
    press(prose);
    selectContents({ element: prose });
    expect(rightClick(prose).defaultPrevented).toBe(true);
    expect(onMessageMenu).toHaveBeenCalledTimes(1);
  });

  it('keeps the native menu for prose the user selected before the right click', () => {
    renderHook(() => useNativeMenuPolicy({ onLink: vi.fn() }));
    const host = mount('<div data-reading-region=""><p>Cap the attempts at three.</p></div>');
    const prose = host.querySelector('p')!;
    const onMessageMenu = vi.fn((event: Event) => event.preventDefault());
    host.addEventListener('contextmenu', onMessageMenu);
    selectContents({ element: prose });
    press(prose);
    expect(rightClick(prose).defaultPrevented).toBe(false);
    expect(onMessageMenu).not.toHaveBeenCalled();
  });

  it('keeps the native menu in the terminal and skips our menus there', () => {
    renderHook(() => useNativeMenuPolicy({ onLink: vi.fn() }));
    const host = mount('<div class="xterm"><div class="xterm-screen">ledger-core $</div></div>');
    const onPaneMenu = vi.fn((event: Event) => event.preventDefault());
    host.addEventListener('contextmenu', onPaneMenu);
    const screen = host.querySelector('.xterm-screen')!;
    press(screen);
    expect(rightClick(screen).defaultPrevented).toBe(false);
    expect(onPaneMenu).not.toHaveBeenCalled();
  });
});
