// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS, STORAGE_PREFIXES, migrateLegacyStorageKeys } from './storage-keys';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('migrateLegacyStorageKeys', () => {
  it('moves legacy direct keys to the new prefix', () => {
    localStorage.setItem('kayam:theme', 'light');
    localStorage.setItem('kayam:archived-tasks', '{"a":true}');
    localStorage.setItem('pricing-sort-key', 'expensive');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem('kayam:theme')).toBeNull();
    expect(localStorage.getItem('kayam:archived-tasks')).toBeNull();
    expect(localStorage.getItem('pricing-sort-key')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('light');
    expect(localStorage.getItem(STORAGE_KEYS.archivedTasks)).toBe('{"a":true}');
    expect(localStorage.getItem(STORAGE_KEYS.pricingSortKey)).toBe('expensive');
  });

  it('moves legacy prefixed keys (verbosity, effort, model, provider, context-panel-open)', () => {
    localStorage.setItem('kayam:verbosity:session-1', 'brief');
    localStorage.setItem('kayam:effort:session-1', 'low');
    localStorage.setItem('kayam:model:session-1', 'claude-sonnet-4-6');
    localStorage.setItem('kayam:provider:session-1', 'cursor');
    localStorage.setItem('kayam:context-panel-open:session-1', '1');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem(`${STORAGE_PREFIXES.verbosity}session-1`)).toBe('brief');
    expect(localStorage.getItem(`${STORAGE_PREFIXES.effort}session-1`)).toBe('low');
    expect(localStorage.getItem(`${STORAGE_PREFIXES.model}session-1`)).toBe('claude-sonnet-4-6');
    expect(localStorage.getItem(`${STORAGE_PREFIXES.provider}session-1`)).toBe('cursor');
    expect(localStorage.getItem(`${STORAGE_PREFIXES.contextPanelOpen}session-1`)).toBe('1');
    expect(localStorage.getItem('kayam:verbosity:session-1')).toBeNull();
  });

  it('keeps the new key when both legacy and new exist (user already migrated)', () => {
    localStorage.setItem('kayam:theme', 'light');
    localStorage.setItem(STORAGE_KEYS.theme, 'dark');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
    expect(localStorage.getItem('kayam:theme')).toBeNull();
  });

  it('is a no-op when there are no legacy keys', () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'light');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('light');
    expect(localStorage.length).toBe(1);
  });
});
