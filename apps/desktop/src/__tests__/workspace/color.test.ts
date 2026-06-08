import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { WORKSPACE_ACCENTS, workspaceAccent } from '../../features/workspace/color';

describe('workspace color', () => {
  it('is deterministic for a given id', () => {
    const id = 'ws-abc' as WorkspaceId;
    expect(workspaceAccent(id)).toBe(workspaceAccent(id));
  });

  it('always returns a color from the curated palette', () => {
    for (const raw of ['a', 'workspace-1', 'ZZZ', '', crypto.randomUUID()]) {
      expect(WORKSPACE_ACCENTS).toContain(workspaceAccent(raw as WorkspaceId));
    }
  });

  it('spreads distinct ids across the palette', () => {
    const ids = Array.from({ length: 24 }, () => crypto.randomUUID() as WorkspaceId);
    const distinct = new Set(ids.map(workspaceAccent));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
