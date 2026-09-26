import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { resolveStorageScope } from './resolveStorageScope';

const WS = 'ws-1' as WorkspaceId;

describe('resolveStorageScope', () => {
  it('keeps an explicitly stored scope', () => {
    expect(resolveStorageScope({ storedScope: { kind: 'all' }, currentWorkspaceId: WS })).toEqual({
      kind: 'all',
    });
  });

  it('defaults to the current window workspace when nothing is stored', () => {
    expect(resolveStorageScope({ storedScope: null, currentWorkspaceId: WS })).toEqual({
      kind: 'workspace',
      id: WS,
    });
  });

  it('defaults to all workspaces without a current window workspace', () => {
    expect(resolveStorageScope({ storedScope: null, currentWorkspaceId: null })).toEqual({
      kind: 'all',
    });
  });
});
