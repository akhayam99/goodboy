// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '@goodboy/core';
import { LARGE_PATCH } from '../../../app/components/MockScene/scenes/brand/largeDiffPatch';
import { buildChangeTree } from './changeTree';

describe('a 512-file change', () => {
  it('has the file count the scene promises', () => {
    expect(parseUnifiedDiff(LARGE_PATCH)).toHaveLength(512);
  });

  it('becomes a tree with one file row per file', () => {
    const tree = buildChangeTree({ files: parseUnifiedDiff(LARGE_PATCH) });

    expect(tree.rows.filter((row) => row.kind === 'file')).toHaveLength(512);
  });
});
