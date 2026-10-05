import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '@goodboy/core';
import {
  BRANCH_FILES_PATCH,
  DELETED_PATH,
  LOCKFILE_PATH,
  RENAMED_FROM,
  RENAMED_PATH,
} from './contextDiffPatch';
import { MANY_FILES_PATCH } from './manyFilesDiffPatch';

describe('branch-files mock patch', () => {
  const files = parseUnifiedDiff(BRANCH_FILES_PATCH);

  it('carries a rename with its old path and a deleted file', () => {
    expect(files.find((file) => file.path === RENAMED_PATH)).toMatchObject({
      status: 'renamed',
      oldPath: RENAMED_FROM,
    });
    expect(files.find((file) => file.path === DELETED_PATH)).toMatchObject({
      status: 'deleted',
      additions: 0,
      deletions: 10,
    });
  });

  it('carries a generated lockfile for the Generated row', () => {
    expect(files.some((file) => file.path === LOCKFILE_PATH)).toBe(true);
  });

  it('keeps the many-files scene at forty files', () => {
    expect(parseUnifiedDiff(MANY_FILES_PATCH)).toHaveLength(40);
  });
});
