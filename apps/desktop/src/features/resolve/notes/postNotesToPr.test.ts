// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { DiffComment, IsoDateTime, SessionId } from '@goodboy/types';
import { FILE_LEVEL_LINE } from '../../../store/slices/review-drafts/fileLevel';
import { moveNotesLabel, postNotesResultMessage, postNotesToPr } from './postNotesToPr';

const SESSION_ID = 'session' as SessionId;

const TARGET = { provider: 'github', repo: 'harborline/ledger-core', prNumber: 318 } as const;

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
  it('turns an anchored note into a draft review comment and closes it', async () => {
    const addReviewDraft = vi.fn(async () => undefined);
    const closed: Array<string> = [];

    const result = await postNotesToPr({
      sessionId: SESSION_ID,
      target: TARGET,
      notes: [noteOf({ anchor: { side: 'new', lineNumber: 40, endLineNumber: 44 } })],
      addReviewDraft,
      closeNote: async (noteId) => {
        closed.push(noteId);
      },
    });

    expect(addReviewDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      target: TARGET,
      path: 'src/ledger.ts',
      line: 44,
      startLine: 40,
      side: 'new',
      body: 'Round half even',
    });
    expect(closed).toEqual(['rounding']);
    expect(result).toEqual({ posted: 1 });
  });

  it('turns a note on a whole file into one file-level draft instead of skipping it', async () => {
    const addReviewDraft = vi.fn(async () => undefined);
    const closed: Array<string> = [];

    const result = await postNotesToPr({
      sessionId: SESSION_ID,
      target: TARGET,
      notes: [noteOf({ id: 'file-level', body: 'Split this module' })],
      addReviewDraft,
      closeNote: async (noteId) => {
        closed.push(noteId);
      },
    });

    expect(addReviewDraft).toHaveBeenCalledTimes(1);
    expect(addReviewDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      target: TARGET,
      path: 'src/ledger.ts',
      line: FILE_LEVEL_LINE,
      startLine: null,
      side: 'new',
      body: 'Split this module',
    });
    expect(closed).toEqual(['file-level']);
    expect(result).toEqual({ posted: 1 });
  });

  it('says what moved and names the action by the count', () => {
    expect(postNotesResultMessage({ posted: 1 })).toBe('1 note moved to your review draft');
    expect(postNotesResultMessage({ posted: 3 })).toBe('3 notes moved to your review draft');
    expect(moveNotesLabel({ count: 2 })).toBe('Move 2 to review draft');
  });
});
