// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { DiffComment, IsoDateTime, SessionId } from '@goodboy/types';
import { postNotesResultMessage, postNotesToPr } from './postNotesToPr';

const SESSION_ID = 'session' as SessionId;

const noteOf = (patch: Partial<DiffComment>): DiffComment => ({
  id: 'rounding',
  sessionId: SESSION_ID,
  filePath: 'src/ledger.ts',
  body: 'Round half even',
  status: 'open',
  createdAt: '2026-09-26T10:00:00.000Z' as IsoDateTime,
  authorKind: 'user',
  ...patch,
});

describe('postNotesToPr', () => {
  it('turns anchored notes into draft review comments and closes them', async () => {
    const addReviewDraft = vi.fn(async () => undefined);
    const resolveDiffComment = vi.fn(async () => undefined);

    const result = await postNotesToPr({
      sessionId: SESSION_ID,
      notes: [
        noteOf({ anchor: { side: 'new', lineNumber: 40, endLineNumber: 44 } }),
        noteOf({ id: 'file-level' }),
      ],
      addReviewDraft,
      resolveDiffComment,
    });

    expect(addReviewDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      path: 'src/ledger.ts',
      line: 44,
      startLine: 40,
      side: 'new',
      body: 'Round half even',
    });
    expect(resolveDiffComment).toHaveBeenCalledWith(SESSION_ID, 'rounding');
    expect(resolveDiffComment).not.toHaveBeenCalledWith(SESSION_ID, 'file-level');
    expect(result).toEqual({ posted: 1, skipped: 1 });
    expect(postNotesResultMessage(result)).toBe(
      '1 note is now a draft review comment. 1 without a line stayed as notes',
    );
  });
});
