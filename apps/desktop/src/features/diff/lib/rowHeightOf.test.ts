// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import { buildChangeTree } from './changeTree';
import { rowHeightOf } from './rowHeightOf';
import { layoutRows } from '../../../shared/utils/windowRows';

const ROW_PX = 28;
const ROW_WITH_SOURCE_PX = 44;

const fileAt = (path: string, extra: Partial<FileDiff> = {}): FileDiff => ({
  path,
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [],
  ...extra,
});

describe('rowHeightOf', () => {
  it('gives a renamed file the room for its source line', () => {
    const tree = buildChangeTree({
      files: [fileAt('a.ts', { status: 'renamed', oldPath: 'old/a.ts' }), fileAt('b.ts')],
    });
    const layout = layoutRows({ rows: tree.rows, heightOf: rowHeightOf });
    expect(layout.offsets).toEqual([0, ROW_WITH_SOURCE_PX]);
    expect(layout.total).toBe(ROW_WITH_SOURCE_PX + ROW_PX);
  });
});
