// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PULL_REQUEST_NOUNS } from '@goodboy/core/review-source';
import { activityRowOf } from './activityRowOf';

type LineParams = {
  readonly open: number;
  readonly needYou: number;
};

const lineOf = ({ open, needYou }: LineParams): string => {
  const row = activityRowOf({
    item: { kind: 'comments', key: 'comments', at: '', open, needYou, hasPeople: true },
    nouns: PULL_REQUEST_NOUNS.github,
    baseBranch: 'main',
    onOpenComments: () => undefined,
    onOpenChecks: () => undefined,
  });
  return render(<>{row.line}</>).container.textContent ?? '';
};

describe('the comments line of the activity', () => {
  it('counts open threads with the merge box number, not every comment', () => {
    expect(lineOf({ open: 9, needYou: 6 })).toBe('9 open threads on files, 6 need you');
  });

  it('drops the need-you part at zero and says all resolved with nothing open', () => {
    expect(lineOf({ open: 1, needYou: 0 })).toBe('1 open thread on files');
    expect(lineOf({ open: 0, needYou: 0 })).toBe('All threads on files resolved');
  });
});
