import { describe, expect, it } from 'vitest';
import { pathsOfPatch } from './patchPaths';

describe('listing the files a patch touches', () => {
  it('reads added, edited and deleted files and sorts them', () => {
    const patch = [
      'diff --git a/src/b.ts b/src/b.ts',
      'index 111..222 100644',
      '--- a/src/b.ts',
      '+++ b/src/b.ts',
      '@@ -1 +1 @@',
      '-x',
      '+y',
      'diff --git a/src/a.ts b/src/a.ts',
      'deleted file mode 100644',
      'index 333..000',
    ].join('\n');

    expect(pathsOfPatch({ patch })).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('lists both sides of a rename', () => {
    const patch = [
      'diff --git a/src/old.ts b/src/new.ts',
      'similarity index 90%',
      'rename from src/old.ts',
      'rename to src/new.ts',
    ].join('\n');

    expect(pathsOfPatch({ patch })).toEqual(['src/new.ts', 'src/old.ts']);
  });

  it('keeps a path with spaces and one with a b slash inside', () => {
    const patch = [
      'diff --git a/docs/the plan b/x.md b/docs/the plan b/x.md',
      'diff --git "a/odd\\"name.ts" "b/odd\\"name.ts"',
    ].join('\n');

    expect(pathsOfPatch({ patch })).toEqual(['docs/the plan b/x.md', 'odd"name.ts']);
  });

  it('returns nothing for an empty patch', () => {
    expect(pathsOfPatch({ patch: '' })).toEqual([]);
  });
});
