import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PrReviewDraft, SessionId } from '@goodboy/types';
import { FILE_LEVEL_LINE } from '../../../store/slices/review-drafts/fileLevel';
import { draftThread } from './draftThreads';

const draftOf = (overrides: Partial<PrReviewDraft> = {}): PrReviewDraft => ({
  id: 'draft-1',
  sessionId: 'session-1' as SessionId,
  provider: 'github',
  repo: 'harborline/ledger-core',
  prNumber: 318,
  path: 'src/ledger/export/page.tsx',
  line: 12,
  startLine: null,
  side: 'new',
  body: 'Guard the empty range',
  status: 'draft',
  stale: false,
  origin: 'user',
  createdAt: '2026-10-05T08:00:00.000Z' as IsoDateTime,
  ...overrides,
});

describe('draftThread', () => {
  it('anchors a line draft on its line', () => {
    expect(draftThread(draftOf()).anchor).toEqual({ side: 'new', lineNumber: 12 });
  });

  it('anchors a range draft from its first to its last line', () => {
    expect(draftThread(draftOf({ startLine: 8, line: 12 })).anchor).toEqual({
      side: 'new',
      lineNumber: 8,
      endLineNumber: 12,
    });
  });

  it('gives a file-level draft no anchor, so it sits under the file header', () => {
    const thread = draftThread(draftOf({ line: FILE_LEVEL_LINE }));

    expect(thread.anchor).toBeNull();
    expect(thread).toMatchObject({ filePath: 'src/ledger/export/page.tsx', canEdit: true });
  });

  it('marks a stale draft as skipped on submit', () => {
    expect(draftThread(draftOf({ stale: true })).statusLabel).toBe('Stale, skipped on submit');
  });
});
