import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '@goodboy/core';
import type { IsoDateTime, PrReviewDraft, SessionId } from '@goodboy/types';
import { computeStaleDrafts } from './computeStaleDrafts';

const DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,4 +1,4 @@',
  ' line one',
  '-removed line',
  '+added line',
  ' line three',
  ' line four',
  '',
].join('\n');

type MakeDraftParams = {
  readonly overrides?: Partial<PrReviewDraft>;
};

const makeDraft = ({ overrides = {} }: MakeDraftParams): PrReviewDraft => ({
  id: 'draft-1',
  sessionId: 's1' as SessionId,
  provider: 'github',
  repo: 'acme/web',
  prNumber: 42,
  path: 'src/a.ts',
  line: 2,
  startLine: null,
  side: 'new',
  body: 'finding',
  status: 'draft',
  stale: false,
  origin: 'agent',
  createdAt: '2026-07-23T10:00:00.000Z' as IsoDateTime,
  ...overrides,
});

describe('computeStaleDrafts', () => {
  const files = parseUnifiedDiff(DIFF);

  it('keeps drafts anchored on add or context lines fresh', () => {
    const drafts = [
      makeDraft({}),
      makeDraft({ overrides: { id: 'draft-2', line: 3 } }),
    ];
    const { fresh, stale } = computeStaleDrafts({ drafts, files });
    expect(fresh.map((draft) => draft.id)).toEqual(['draft-1', 'draft-2']);
    expect(stale).toEqual([]);
  });

  it('marks drafts on unknown paths or lines as stale', () => {
    const drafts = [
      makeDraft({ overrides: { id: 'draft-2', line: 99 } }),
      makeDraft({ overrides: { id: 'draft-3', path: 'src/other.ts' } }),
    ];
    const { fresh, stale } = computeStaleDrafts({ drafts, files });
    expect(fresh).toEqual([]);
    expect(stale.map((draft) => draft.id)).toEqual(['draft-2', 'draft-3']);
    expect(stale.every((draft) => draft.stale)).toBe(true);
  });

  it('anchors old-side drafts on deleted or context old lines only', () => {
    const drafts = [
      makeDraft({ overrides: { id: 'draft-del', line: 2, side: 'old' } }),
      makeDraft({ overrides: { id: 'draft-gone', line: 99, side: 'old' } }),
    ];
    const { fresh, stale } = computeStaleDrafts({ drafts, files });
    expect(fresh.map((draft) => draft.id)).toEqual(['draft-del']);
    expect(stale.map((draft) => draft.id)).toEqual(['draft-gone']);
  });
});
