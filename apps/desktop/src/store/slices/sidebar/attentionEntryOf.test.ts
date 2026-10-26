// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import type { WorkspaceAttentionRow } from '../../../features/workflows/workflows';
import { attentionEntryOf } from './attentionEntryOf';

const rowOf = (
  overrides: Partial<WorkspaceAttentionRow> & Pick<WorkspaceAttentionRow, 'reasons'>,
): WorkspaceAttentionRow => ({
  workspaceId: brandId<WorkspaceId>({ value: 'ws-northwind' }),
  count: 2,
  tone: 'warning',
  ...overrides,
});

describe('attentionEntryOf', () => {
  it('words each reason with the sentence the sessions list gives it', () => {
    const entry = attentionEntryOf({
      row: rowOf({
        tone: 'danger',
        reasons: ['push-failed', 'open-question', 'ci-failed'],
      }),
    });

    expect(entry).toEqual({
      count: 2,
      tone: 'danger',
      reasonWords: ["1 comment didn't go out", '1 question for you', 'Checks failing'],
    });
  });

  it('leaves out a reason this version does not know', () => {
    const entry = attentionEntryOf({
      row: rowOf({
        reasons: ['something-new', 'open-question'],
      }),
    });

    expect(entry.reasonWords).toEqual(['1 question for you']);
  });
});
