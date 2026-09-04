import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { InboxProvider } from './types';
import {
  readInboxKindFilter,
  readInboxProviders,
  writeInboxKindFilter,
  writeInboxProviders,
} from './kindFilterStorage';

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

  it('reads a legacy bare kind filter written before providers were persisted', () => {
    localStorage.setItem('goodboy:inbox-kind-filter:workspace-1', 'issue');

    expect(readInboxKindFilter({ workspaceId })).toBe('issue');
    expect(readInboxProviders({ workspaceId })).toEqual([]);
  });
});

describe('inbox provider filter storage', () => {
  it('returns an empty selection when nothing was persisted yet', () => {
    expect(readInboxProviders({ workspaceId })).toEqual([]);
  });

  it('round-trips a written provider selection', () => {
    writeInboxProviders({ workspaceId, providers: new Set<InboxProvider>(['slack', 'github']) });

    expect(readInboxProviders({ workspaceId })).toEqual(['github', 'slack']);
  });

  it('keeps the kind filter and the providers side by side', () => {
    writeInboxKindFilter({ workspaceId, kindFilter: 'thread' });
    writeInboxProviders({ workspaceId, providers: new Set<InboxProvider>(['slack']) });

    expect(readInboxKindFilter({ workspaceId })).toBe('thread');
    expect(readInboxProviders({ workspaceId })).toEqual(['slack']);
  });

  it('scopes the persisted providers per workspace', () => {
    const other = 'workspace-2' as WorkspaceId;
    writeInboxProviders({ workspaceId, providers: new Set<InboxProvider>(['jira']) });

    expect(readInboxProviders({ workspaceId: other })).toEqual([]);
  });
});
