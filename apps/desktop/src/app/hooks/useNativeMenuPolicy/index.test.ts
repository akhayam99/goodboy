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

  it('keeps the native menu when text is selected inside the clicked element', () => {
    const host = mount('<p>Speed up the payout export for Harborline</p>');
    const paragraph = host.querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.addRange(range);
    expect(keepsNativeMenu({ target: paragraph, selection: window.getSelection() })).toBe(true);
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
});
