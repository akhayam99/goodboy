import { describe, expect, it } from 'vitest';
import { filterLabelOf } from './fixCommentsCopy';

describe('filterLabelOf', () => {
  it.each([
    ['github', 'On GitHub'],
    ['gitlab', 'On GitLab'],
    ['bitbucket', 'On Bitbucket'],
  ] as const)('names the %s host filter after its host', (host, label) => {
    expect(filterLabelOf({ host })).toEqual({ all: 'All', notes: 'Notes', host: label });
  });
});
