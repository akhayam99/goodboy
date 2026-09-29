import { describe, expect, it } from 'vitest';
import type { PullRequestStateKind } from '@goodboy/types';
import type { InboxState } from './types';
import { requestInboxState } from './requestInboxState';

const TABLE: ReadonlyArray<readonly [PullRequestStateKind, InboxState]> = [
  ['draft', 'open'],
  ['open', 'open'],
  ['approved', 'open'],
  ['queued', 'open'],
  ['merged', 'done'],
  ['closed', 'done'],
];

describe('requestInboxState', () => {
  it.each(TABLE)('reads %s as %s', (kind, expected) => {
    expect(requestInboxState({ kind })).toBe(expected);
  });
});
