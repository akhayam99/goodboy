// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DemoPlayground } from './DemoPlayground';
import { DEMO_THEME_KEY } from './demoThemeKey';
import { DEMO_PROTOCOL } from './director/demoProtocol';
import { currentPlatform } from '../../../../shared/platform';

const STAGE_BOX = new DOMRect(0, 0, 1440, 900);

const visibleFrame = (): HTMLIFrameElement => {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[data-shown="true"]');
  if (frame === null) {
    throw new Error('no visible frame');
  }
  return frame;
};

type SendParams = {
  readonly frame: HTMLIFrameElement;
  readonly data: Readonly<Record<string, unknown>>;
  readonly source?: MessageEventSource | null;
  readonly origin?: string;
};

const send = ({
  frame,
  data,
  source = frame.contentWindow,
  origin = window.location.origin,
}: SendParams) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { channel: DEMO_PROTOCOL.channel, version: DEMO_PROTOCOL.version, ...data },
        origin,
        source,
      }),
    );
  });
};

const ready = ({ frame }: { readonly frame: HTMLIFrameElement }) =>
  send({
    frame,
    data: { generation: 0, type: 'ready', elapsedMs: 0, durationMs: 0, cueIndex: 0 },
  });

const rootOf = (): HTMLElement => {
  const root = screen.getByRole('heading', { level: 1 }).closest<HTMLElement>('[tabindex="-1"]');
  if (root === null) {
    throw new Error('missing playground root');
  }
  return root;
};

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(STAGE_BOX);
  window.history.replaceState(null, '', '/?scene=demo');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(Animation.prototype, 'cancel').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('demo playground chrome', () => {
  it('links the logo and a back link to the website', () => {
    render(<DemoPlayground />);
    expect(screen.getByRole('link', { name: 'Goodboy website' }).getAttribute('href')).toBe(
      'https://goodboy-ai.dev/?theme=dark',
    );
    expect(screen.getByRole('link', { name: 'goodboy-ai.dev' }).getAttribute('href')).toBe(
      'https://goodboy-ai.dev/?theme=dark',
    );
  });

  it('keeps the star and download calls to action in the rail, not the top bar', () => {
    render(<DemoPlayground />);
    const topBar = document.querySelector('header');
    expect(topBar?.textContent).not.toContain('Star on GitHub');
    expect(screen.getAllByRole('link', { name: /Star on GitHub/ })).toHaveLength(1);
    expect(topBar?.contains(screen.getByRole('link', { name: /Star on GitHub/ }))).toBe(false);
  });

  it('opens in the theme named in the url, which beats the stored one, then drops it from the url', () => {
    window.localStorage.setItem(DEMO_THEME_KEY, 'dark');
    window.history.replaceState(null, '', '/?scene=demo&theme=light#agent');
    render(<DemoPlayground />);
    expect(visibleFrame().getAttribute('src')).toContain('theme=light');
    expect(screen.queryByRole('button', { name: 'Switch to dark theme' })).not.toBeNull();
    expect(window.location.search).toBe('?scene=demo');
    expect(window.location.hash).toBe('#agent');
    expect(window.localStorage.getItem(DEMO_THEME_KEY)).toBe('dark');
  });

  it('opens in the stored theme when the url names none', () => {
    window.localStorage.setItem(DEMO_THEME_KEY, 'light');
    render(<DemoPlayground />);
    expect(visibleFrame().getAttribute('src')).toContain('theme=light');
  });

  it('stores the theme the visitor picks and survives blocked storage', () => {
    render(<DemoPlayground />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(window.localStorage.getItem(DEMO_THEME_KEY)).toBe('light');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(screen.queryByRole('button', { name: 'Switch to light theme' })).not.toBeNull();
  });

  it('tells every ready frame about a theme change without reloading it', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    ready({ frame });
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'theme', theme: 'light', generation: 0 }),
      window.location.origin,
    );
    expect(visibleFrame()).toBe(frame);
  });

  it('follows a theme the app inside the frame reports', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    ready({ frame });
    send({ frame, data: { generation: 0, type: 'theme', theme: 'light' } });
    expect(screen.queryByRole('button', { name: 'Switch to dark theme' })).not.toBeNull();
    expect(window.localStorage.getItem(DEMO_THEME_KEY)).toBe('light');
  });

  it('ignores a theme report from another origin, another window or with a bad value', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    ready({ frame });
    send({
      frame,
      data: { generation: 0, type: 'theme', theme: 'light' },
      origin: 'https://example.com',
    });
    send({ frame, data: { generation: 0, type: 'theme', theme: 'light' }, source: window });
    send({ frame, data: { generation: 0, type: 'theme', theme: 'sepia' } });
    expect(screen.queryByRole('button', { name: 'Switch to light theme' })).not.toBeNull();
  });

  it('hands the command palette, find and sidebar keys to the frame', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    ready({ frame });
    const isMac = currentPlatform() === 'darwin';
    fireEvent.keyDown(rootOf(), { key: 'k', code: 'KeyK', metaKey: isMac, ctrlKey: !isMac });
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'shortcut', code: 'KeyK' }),
      window.location.origin,
    );
    fireEvent.keyDown(rootOf(), { key: 'f', code: 'KeyF', metaKey: isMac, ctrlKey: !isMac });
    fireEvent.keyDown(rootOf(), { key: 'b', code: 'KeyB', metaKey: isMac, ctrlKey: !isMac });
    const codes = post.mock.calls
      .map(([message]) => (typeof message === 'object' && message !== null ? message.code : null))
      .filter((code) => code !== null && code !== undefined);
    expect(codes).toEqual(['KeyK', 'KeyF', 'KeyB']);
  });

  it('leaves a plain letter and a text field alone', () => {
    render(<DemoPlayground />);
    const frame = visibleFrame();
    const post = vi.spyOn(frame.contentWindow ?? window, 'postMessage');
    ready({ frame });
    const field = document.createElement('input');
    rootOf().appendChild(field);
    fireEvent.keyDown(field, { key: 'ArrowRight', code: 'ArrowRight' });
    fireEvent.keyDown(rootOf(), { key: 'k', code: 'KeyK' });
    expect(window.location.hash).not.toBe('#agent');
    expect(post.mock.calls.some(([message]) => message?.type === 'shortcut')).toBe(false);
  });
});
