// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { askReplyDetail } from './askReplyDetail';

describe('askReplyDetail', () => {
  it('gives the cost and the files read as rows', () => {
    expect(askReplyDetail({ readCount: 2, costUsd: 0.04 })).toEqual([
      { label: 'Cost', value: '$0.04' },
      { label: 'Read', value: '2 files' },
    ]);
  });

  it('leaves a row out when its fact is unknown', () => {
    expect(askReplyDetail({ readCount: 1, costUsd: null })).toEqual([
      { label: 'Read', value: '1 file' },
    ]);
    expect(askReplyDetail({ readCount: 0, costUsd: 0.04 })).toEqual([
      { label: 'Cost', value: '$0.04' },
    ]);
  });

  it('is empty with nothing to say, so the footer has no card', () => {
    expect(askReplyDetail({ readCount: 0, costUsd: null })).toEqual([]);
  });
});
