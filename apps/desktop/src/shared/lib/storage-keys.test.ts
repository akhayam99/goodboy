import { describe, expect, it } from 'vitest';
import { LEFT_SIDEBAR_STORAGE_KEY, RIGHT_SIDEBAR_STORAGE_KEY } from '@goodboy/ui';
import { STORAGE_KEYS } from './storage-keys';

describe('storage keys', () => {
  it('registers the shell sidebar width keys used by AppShell', () => {
    expect(STORAGE_KEYS.leftSidebarWidth).toBe(LEFT_SIDEBAR_STORAGE_KEY);
    expect(STORAGE_KEYS.rightSidebarWidth).toBe(RIGHT_SIDEBAR_STORAGE_KEY);
  });

  it('keeps every registered key under the goodboy namespace', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key.startsWith('goodboy:')).toBe(true);
    }
  });
});
