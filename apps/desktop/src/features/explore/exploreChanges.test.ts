import { describe, expect, it } from 'vitest';
import type { ChangedEntry } from '../worktree/worktree';
import { buildExploreChanges, NO_EXPLORE_CHANGES } from './exploreChanges';

const modified = (path: string): ChangedEntry => ({ path, status: 'modified', from: null });

describe('buildExploreChanges', () => {
  it('counts a change once and once per folder above it', () => {
    const changes = buildExploreChanges({
      entries: [modified('src/a/x.ts'), modified('src/a/y.ts'), modified('src/z.ts')],
    });

    expect(changes.count).toBe(3);
    expect(changes.countByFolder.get('src')).toBe(3);
    expect(changes.countByFolder.get('src/a')).toBe(2);
    expect(changes.countByFolder.has('src/a/x.ts')).toBe(false);
  });

  it('drops a duplicate path and reads an empty list as nothing', () => {
    expect(buildExploreChanges({ entries: [modified('a.ts'), modified('a.ts')] }).count).toBe(1);
    expect(buildExploreChanges({ entries: [] })).toEqual(NO_EXPLORE_CHANGES);
  });
});
