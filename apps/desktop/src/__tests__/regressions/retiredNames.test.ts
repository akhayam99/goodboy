// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RETIRED_NAMES } from './retiredNames';

type Params = {
  readonly text: string;
};

const retiredIdsIn = ({ text }: Params): ReadonlyArray<string> =>
  RETIRED_NAMES.filter((retired) => retired.pattern.test(text)).map((retired) => retired.id);

describe('retired names match whatever the casing', () => {
  it.each(['Close inbox', 'Refresh inbox', 'refresh inbox', 'INBOX'])('flags %s', (text) => {
    expect(retiredIdsIn({ text })).toContain('inbox-door');
  });

  it('flags a lowercase worktree name', () => {
    expect(retiredIdsIn({ text: 'remove worktree' })).toContain('remove-worktree');
  });

  it('leaves a data attribute alone', () => {
    expect(retiredIdsIn({ text: '[data-inbox-key="a"]' })).toEqual([]);
  });
});
