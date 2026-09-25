import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { readInboxFilters, writeInboxFilters } from './kindFilterStorage';

const workspaceId = 'workspace-1' as WorkspaceId;
const KEY = 'goodboy:inbox-kind-filter:workspace-1';

afterEach(() => {
  localStorage.clear();
});

describe('inbox filter storage', () => {
  it('returns null when nothing was persisted yet', () => {
    expect(readInboxFilters({ workspaceId })).toBeNull();
  });

  it('round-trips the type and the single source', () => {
    writeInboxFilters({ workspaceId, kind: 'thread', source: 'slack' });

    expect(readInboxFilters({ workspaceId })).toEqual({ kind: 'thread', source: 'slack' });
    expect(JSON.parse(localStorage.getItem(KEY) ?? '')).toEqual({
      kindFilter: 'thread',
      source: 'slack',
    });
  });

  it('scopes the persisted filters per workspace', () => {
    writeInboxFilters({ workspaceId, kind: 'error', source: null });

    expect(readInboxFilters({ workspaceId: 'workspace-2' as WorkspaceId })).toBeNull();
  });

  it('ignores a corrupted value instead of throwing', () => {
    localStorage.setItem(KEY, 'not-a-real-filter');

    expect(readInboxFilters({ workspaceId })).toBeNull();
  });

  it('reads a legacy bare kind filter', () => {
    localStorage.setItem(KEY, 'issue');

    expect(readInboxFilters({ workspaceId })).toEqual({ kind: 'issue', source: null });
  });

  it('keeps the first provider of a legacy multi-select as the source', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ kindFilter: 'all', providers: ['slack', 'github'] }),
    );

    expect(readInboxFilters({ workspaceId })).toEqual({ kind: 'all', source: 'github' });
  });

  it('reads an empty legacy provider list as no source', () => {
    localStorage.setItem(KEY, JSON.stringify({ kindFilter: 'error', providers: [] }));

    expect(readInboxFilters({ workspaceId })).toEqual({ kind: 'error', source: null });
  });
});
