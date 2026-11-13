// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../shared/lib/storage-keys';
import { browserTabListPref } from './browserTabListPref';

afterEach(() => {
  browserTabListPref.clear();
});

describe('the tab list preference', () => {
  it('reads the old boolean as a list or hidden', () => {
    localStorage.setItem(STORAGE_KEYS.browserTabList, 'true');
    expect(browserTabListPref.read()).toBe('list');

    localStorage.setItem(STORAGE_KEYS.browserTabList, 'false');
    expect(browserTabListPref.read()).toBe('hidden');
  });

  it('round-trips the three widths', () => {
    for (const mode of ['list', 'rail', 'hidden'] as const) {
      browserTabListPref.write({ mode });
      expect(browserTabListPref.read()).toBe(mode);
    }
  });

  it('falls back to hidden on a word it does not know', () => {
    localStorage.setItem(STORAGE_KEYS.browserTabList, '"wide"');
    expect(browserTabListPref.read()).toBe('hidden');
  });
});
