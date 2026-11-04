import { describe, expect, it } from 'vitest';
import { attachmentAbsolutePathOf } from './attachmentAbsolutePathOf';
import { attachmentDirOf } from './attachmentDirOf';

const WORKTREE = '/repo/.worktrees/retry-budget';
const SCRATCH = '/data/scratch/6f616b42-0ed8-471e-823f-ee4aca6b7ce9';
const IN_WORKTREE = '.goodboy/attachments/att-old-trace.png';
const IN_SCRATCH = '.goodboy/attachments/scratch-att-new-trace.png';

describe('attachmentDirOf', () => {
  it('keeps a file saved in the worktree reachable once the run also has a scratch dir', () => {
    expect(
      attachmentDirOf({ relPath: IN_WORKTREE, worktreeDir: WORKTREE, scratchDir: SCRATCH }),
    ).toBe(WORKTREE);
  });

  it('keeps a file saved before the worktree existed in scratch after one is created', () => {
    expect(
      attachmentDirOf({ relPath: IN_SCRATCH, worktreeDir: WORKTREE, scratchDir: SCRATCH }),
    ).toBe(SCRATCH);
  });

  it('has no dir for a scratch file until the scratch dir is known', () => {
    expect(attachmentDirOf({ relPath: IN_SCRATCH, worktreeDir: WORKTREE, scratchDir: null })).toBe(
      null,
    );
  });

  it('builds the absolute path from the dir that holds the file', () => {
    expect(
      attachmentAbsolutePathOf({ relPath: IN_SCRATCH, worktreeDir: null, scratchDir: SCRATCH }),
    ).toBe(`${SCRATCH}/${IN_SCRATCH}`);
    expect(
      attachmentAbsolutePathOf({
        relPath: IN_WORKTREE,
        worktreeDir: `${WORKTREE}/`,
        scratchDir: null,
      }),
    ).toBe(`${WORKTREE}/${IN_WORKTREE}`);
  });
});
