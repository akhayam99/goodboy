import { describe, expect, it } from 'vitest';
import type { PullRequestStateKind } from '@goodboy/types';
import { pullRequestKindOf } from './pullRequestKind';

type Row = {
  readonly state: PullRequestStateKind;
  readonly isDraft: boolean;
  readonly kind: PullRequestStateKind;
};

const ROWS: ReadonlyArray<Row> = [
  { state: 'merged', isDraft: false, kind: 'merged' },
  { state: 'merged', isDraft: true, kind: 'merged' },
  { state: 'closed', isDraft: false, kind: 'closed' },
  { state: 'closed', isDraft: true, kind: 'closed' },
  { state: 'queued', isDraft: false, kind: 'queued' },
  { state: 'queued', isDraft: true, kind: 'queued' },
  { state: 'approved', isDraft: false, kind: 'approved' },
  { state: 'open', isDraft: false, kind: 'open' },
  { state: 'open', isDraft: true, kind: 'draft' },
  { state: 'draft', isDraft: true, kind: 'draft' },
  { state: 'draft', isDraft: false, kind: 'draft' },
];

describe('pullRequestKindOf', () => {
  it.each(ROWS.map((row) => [`${row.state}, draft ${row.isDraft}`, row] as const))(
    'reads %s as its precedence word',
    (_label, row) => {
      expect(pullRequestKindOf({ state: row.state, isDraft: row.isDraft })).toBe(row.kind);
    },
  );

  it('never reads a closed or merged pull request as a draft', () => {
    expect(pullRequestKindOf({ state: 'closed', isDraft: true })).not.toBe('draft');
    expect(pullRequestKindOf({ state: 'merged', isDraft: true })).not.toBe('draft');
  });

  it('puts the merge queue above approved and approved above a draft flag', () => {
    expect(pullRequestKindOf({ state: 'queued', isDraft: false })).toBe('queued');
    expect(pullRequestKindOf({ state: 'approved', isDraft: true })).toBe('approved');
  });
});
