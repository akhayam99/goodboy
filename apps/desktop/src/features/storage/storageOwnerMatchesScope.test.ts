import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { storageOwnerMatchesScope } from './storageOwnerMatchesScope';

const WS = 'ws-1' as WorkspaceId;
const OTHER = 'ws-2' as WorkspaceId;

describe('storageOwnerMatchesScope', () => {
  it('matches everything for the all scope', () => {
    expect(storageOwnerMatchesScope({ ownerWorkspace: WS, scope: { kind: 'all' } })).toBe(true);
    expect(storageOwnerMatchesScope({ ownerWorkspace: null, scope: { kind: 'all' } })).toBe(true);
  });

  it('matches only ownerless folders for the removed scope', () => {
    expect(storageOwnerMatchesScope({ ownerWorkspace: null, scope: { kind: 'removed' } })).toBe(
      true,
    );
    expect(storageOwnerMatchesScope({ ownerWorkspace: WS, scope: { kind: 'removed' } })).toBe(
      false,
    );
  });

  it('matches only the named workspace for a workspace scope', () => {
    expect(
      storageOwnerMatchesScope({ ownerWorkspace: WS, scope: { kind: 'workspace', id: WS } }),
    ).toBe(true);
    expect(
      storageOwnerMatchesScope({ ownerWorkspace: OTHER, scope: { kind: 'workspace', id: WS } }),
    ).toBe(false);
    expect(
      storageOwnerMatchesScope({ ownerWorkspace: null, scope: { kind: 'workspace', id: WS } }),
    ).toBe(false);
  });
});
