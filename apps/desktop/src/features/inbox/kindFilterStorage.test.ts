import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { readInboxKindFilter, writeInboxKindFilter } from './kindFilterStorage';

const workspaceId = 'workspace-1' as WorkspaceId;

afterEach(() => {
  localStorage.clear();
});

describe('inbox kind filter storage', () => {
  it('returns null when nothing was persisted yet', () => {
    expect(readInboxKindFilter({ workspaceId })).toBeNull();
  });

  it('round-trips a written kind filter', () => {
    writeInboxKindFilter({ workspaceId, kindFilter: 'thread' });

    expect(readInboxKindFilter({ workspaceId })).toBe('thread');
  });

  it('scopes the persisted filter per workspace', () => {
    const other = 'workspace-2' as WorkspaceId;
    writeInboxKindFilter({ workspaceId, kindFilter: 'error' });

    expect(readInboxKindFilter({ workspaceId: other })).toBeNull();
  });

  it('ignores a corrupted value instead of throwing', () => {
    localStorage.setItem('goodboy:inbox-kind-filter:workspace-1', 'not-a-real-filter');

    expect(readInboxKindFilter({ workspaceId })).toBeNull();
  });
});
