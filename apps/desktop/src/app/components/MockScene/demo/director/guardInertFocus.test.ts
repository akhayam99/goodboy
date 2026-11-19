// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { guardInertFocus } from './guardInertFocus';

afterEach(() => {
  Reflect.deleteProperty(window, 'frameElement');
  document.body.replaceChildren();
});

describe('guardInertFocus', () => {
  it('keeps a preloaded, inert frame from taking the focus from the frame the visitor works in', () => {
    const host = document.createElement('iframe');
    host.setAttribute('inert', '');
    Object.defineProperty(window, 'frameElement', { configurable: true, get: () => host });
    guardInertFocus({ view: window });
    const field = document.createElement('textarea');
    document.body.append(field);
    field.focus();
    expect(document.activeElement).not.toBe(field);
    host.removeAttribute('inert');
    field.focus();
    expect(document.activeElement).toBe(field);
  });
});
