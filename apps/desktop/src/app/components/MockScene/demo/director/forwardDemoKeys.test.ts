// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, describe, expect, it } from 'vitest';
import { forwardDemoKeys } from './forwardDemoKeys';

type StageParams = {
  readonly isFramed?: boolean;
};

type KeyParams = {
  readonly key: string;
  readonly target?: string;
  readonly isMeta?: boolean;
};

const stage = ({ isFramed = true }: StageParams = {}) => {
  const host = document.createElement('iframe');
  document.body.append(host);
  const view = host.contentWindow;
  if (view === null) {
    throw new Error('no frame window');
  }
  Object.defineProperty(view, 'frameElement', { value: isFramed ? host : null });
  view.document.body.innerHTML = '<button type="button">Open</button><textarea></textarea>';
  const listeners = new AbortController();
  forwardDemoKeys({ view, signal: listeners.signal });
  const forwarded: string[] = [];
  host.addEventListener('keydown', (event) => forwarded.push(event.key));
  const press = ({ key, target = 'button', isMeta = false }: KeyParams): boolean => {
    const event = new view.KeyboardEvent('keydown', {
      key,
      metaKey: isMeta,
      bubbles: true,
      cancelable: true,
    });
    view.document.querySelector(target)?.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { forwarded, press, listeners };
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('keys pressed inside the demo frame', () => {
  it('reach the playground for chapter arrows and the hint key', () => {
    const { forwarded, press, listeners } = stage();
    expect(press({ key: 'ArrowRight' })).toBe(true);
    press({ key: 'ArrowLeft' });
    press({ key: 'h' });
    press({ key: 'H' });
    expect(forwarded).toEqual(['ArrowRight', 'ArrowLeft', 'h', 'H']);
    listeners.abort();
  });

  it('stay in the frame while the visitor types, uses a shortcut or presses Escape', () => {
    const { forwarded, press, listeners } = stage();
    expect(press({ key: 'ArrowRight', target: 'textarea' })).toBe(false);
    press({ key: 'ArrowRight', isMeta: true });
    press({ key: 'Escape' });
    press({ key: 'r' });
    expect(forwarded).toEqual([]);
    listeners.abort();
  });

  it('stay where they are when the app runs on its own, outside the playground', () => {
    const { forwarded, press, listeners } = stage({ isFramed: false });
    expect(press({ key: 'ArrowRight' })).toBe(false);
    expect(forwarded).toEqual([]);
    listeners.abort();
  });

  it('do nothing once the director is gone', () => {
    const { forwarded, press, listeners } = stage();
    listeners.abort();
    press({ key: 'ArrowRight' });
    expect(forwarded).toEqual([]);
  });
});
