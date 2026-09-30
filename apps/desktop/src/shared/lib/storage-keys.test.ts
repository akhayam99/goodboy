// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEFT_SIDEBAR_STORAGE_KEY } from '@goodboy/ui';
import { STORAGE_KEYS, STORAGE_PREFIXES, persistedPref } from './storage-keys';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe('storage keys', () => {
  it('registers the shell sidebar width key used by AppShell', () => {
    expect(STORAGE_KEYS.leftSidebarWidth).toBe(LEFT_SIDEBAR_STORAGE_KEY);
  });

  it('keeps every registered key under the goodboy namespace', () => {
    for (const key of [...Object.values(STORAGE_KEYS), ...Object.values(STORAGE_PREFIXES)]) {
      expect(key.startsWith('goodboy:')).toBe(true);
    }
  });

  it('keeps the strings that moved into the registry, so saved values still load', () => {
    expect(STORAGE_KEYS.zoom).toBe('goodboy:zoom');
    expect(STORAGE_KEYS.activityFilter).toBe('goodboy:activity-filter');
    expect(STORAGE_KEYS.windowReloadIntent).toBe('goodboy:window-reload-intent');
    expect(STORAGE_PREFIXES.turnCursor).toBe('goodboy:turn-cursor:');
    expect(STORAGE_PREFIXES.scriptsGroupsCollapsed).toBe('goodboy:scripts-groups-collapsed:v1:');
    expect(STORAGE_PREFIXES.scriptsPackagesCollapsed).toBe(
      'goodboy:scripts-packages-collapsed:v1:',
    );
  });
});

const numberPref = (area: 'local' | 'session' = 'local') =>
  persistedPref<number>({
    key: 'goodboy:test-pref',
    parse: (raw) => {
      const value: unknown = JSON.parse(raw);
      return typeof value === 'number' ? value : undefined;
    },
    fallback: 7,
    area,
  });

describe('persistedPref', () => {
  it('reads back what it wrote', () => {
    const pref = numberPref();
    pref.write(12);

    expect(localStorage.getItem('goodboy:test-pref')).toBe('12');
    expect(pref.read()).toBe(12);
  });

  it('gives the fallback when nothing is stored', () => {
    expect(numberPref().read()).toBe(7);
  });

  it('gives the fallback for a value the parser rejects or cannot parse', () => {
    localStorage.setItem('goodboy:test-pref', '"text"');
    expect(numberPref().read()).toBe(7);

    localStorage.setItem('goodboy:test-pref', '{not json');
    expect(numberPref().read()).toBe(7);
  });

  it('keeps working when storage refuses to read or write', () => {
    const refuse = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: refuse, setItem: refuse, removeItem: refuse });
    const pref = numberPref();

    expect(pref.read()).toBe(7);
    expect(() => pref.write(3)).not.toThrow();
    expect(() => pref.clear()).not.toThrow();
  });

  it('clears the stored value', () => {
    const pref = numberPref();
    pref.write(4);
    pref.clear();

    expect(localStorage.getItem('goodboy:test-pref')).toBeNull();
    expect(pref.read()).toBe(7);
  });

  it('uses the serializer it is given', () => {
    const pref = persistedPref<boolean>({
      key: 'goodboy:test-flag',
      parse: (raw) => raw === '1',
      serialize: (value) => (value ? '1' : '0'),
      fallback: false,
    });
    pref.write(true);

    expect(localStorage.getItem('goodboy:test-flag')).toBe('1');
    expect(pref.read()).toBe(true);
  });

  it('keeps session prefs out of local storage', () => {
    numberPref('session').write(9);

    expect(sessionStorage.getItem('goodboy:test-pref')).toBe('9');
    expect(localStorage.getItem('goodboy:test-pref')).toBeNull();
    expect(numberPref('session').read()).toBe(9);
  });
});
