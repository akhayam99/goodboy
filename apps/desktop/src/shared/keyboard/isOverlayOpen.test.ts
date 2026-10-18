import { afterEach, describe, expect, it } from 'vitest';
import { isOverlayOpen } from './isOverlayOpen';

describe('isOverlayOpen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is false on an empty page', () => {
    expect(isOverlayOpen({})).toBe(false);
  });

  it('is false for a persistent multi select list such as the sessions rail', () => {
    document.body.innerHTML =
      '<ul role="listbox" aria-multiselectable="true" aria-label="Sessions"></ul>';
    expect(isOverlayOpen({})).toBe(false);
  });

  it('is true for a popup listbox', () => {
    document.body.innerHTML = '<ul role="listbox" aria-label="Models"></ul>';
    expect(isOverlayOpen({})).toBe(true);
  });

  it('is true for a dialog, a menu and a dropdown portal', () => {
    for (const markup of [
      '<div role="dialog"></div>',
      '<div role="menu"></div>',
      '<div data-dropdown-portal></div>',
    ]) {
      document.body.innerHTML = markup;
      expect(isOverlayOpen({})).toBe(true);
    }
  });

  it('stays true for a multi select listbox inside a dropdown portal', () => {
    document.body.innerHTML =
      '<div data-dropdown-portal><ul role="listbox" aria-multiselectable="true"></ul></div>';
    expect(isOverlayOpen({})).toBe(true);
  });
});
