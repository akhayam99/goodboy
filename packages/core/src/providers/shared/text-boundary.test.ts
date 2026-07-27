import { describe, expect, it } from 'vitest';
import type { ProviderRunId } from '@goodboy/types';
import { blockBoundaryPrefix, resetTextBoundary } from './text-boundary';

const RUN_ID = 'run_boundary' as ProviderRunId;

describe('blockBoundaryPrefix', () => {
  it('adds no prefix for the first block of a run', () => {
    resetTextBoundary({ runId: RUN_ID });
    expect(blockBoundaryPrefix({ runId: RUN_ID, text: 'final report.' })).toBe('');
  });

  it('inserts a blank line before the next block when the prior text has no trailing newline', () => {
    resetTextBoundary({ runId: RUN_ID });
    blockBoundaryPrefix({ runId: RUN_ID, text: 'final report.' });
    expect(blockBoundaryPrefix({ runId: RUN_ID, text: 'Now let me read the file.' })).toBe('\n\n');
  });

  it('does not double the blank line when the prior text already ends with one', () => {
    resetTextBoundary({ runId: RUN_ID });
    blockBoundaryPrefix({ runId: RUN_ID, text: 'final report.\n\n' });
    expect(blockBoundaryPrefix({ runId: RUN_ID, text: 'Now let me read the file.' })).toBe('');
  });

  it('resets state so the next block is treated as the first again', () => {
    blockBoundaryPrefix({ runId: RUN_ID, text: 'partial' });
    resetTextBoundary({ runId: RUN_ID });
    expect(blockBoundaryPrefix({ runId: RUN_ID, text: 'new turn' })).toBe('');
  });
});
