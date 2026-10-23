import { describe, expect, it } from 'vitest';
import { pullRequestPrefillOf } from './pullRequestPrefillOf';

const BRANCH = 'hl/member-nav-copy';

type CommitParams = {
  readonly subject: string;
  readonly timestamp: number;
};

const commit = ({ subject, timestamp }: CommitParams) => ({ subject, timestamp });

const COMMITS = [
  commit({ subject: 'Update the nav snapshot tests', timestamp: 300 }),
  commit({ subject: 'Move the nav copy into navLabels', timestamp: 200 }),
  commit({ subject: 'Shorten the member nav labels', timestamp: 100 }),
];

const LINEAR = {
  provider: 'linear' as const,
  identifier: 'HL-1372',
  title: 'Member nav labels overflow',
  branch: BRANCH,
};

describe('pullRequestPrefillOf', () => {
  it('takes the headline of a single commit as the title', () => {
    expect(
      pullRequestPrefillOf({
        commits: [commit({ subject: 'Shorten the member nav labels', timestamp: 1 })],
        tasks: [],
        branch: BRANCH,
      }),
    ).toEqual({ title: 'Shorten the member nav labels', body: '' });
  });

  it('names the issue and the first headline when the branch has several commits', () => {
    const prefill = pullRequestPrefillOf({ commits: COMMITS, tasks: [LINEAR], branch: BRANCH });

    expect(prefill.title).toBe('HL-1372: Shorten the member nav labels');
    expect(prefill.body).toBe(
      [
        '- Shorten the member nav labels',
        '- Move the nav copy into navLabels',
        '- Update the nav snapshot tests',
        '',
        'Closes HL-1372',
      ].join('\n'),
    );
  });

  it('keeps the first headline when no issue is linked', () => {
    expect(pullRequestPrefillOf({ commits: COMMITS, tasks: [], branch: BRANCH }).title).toBe(
      'Shorten the member nav labels',
    );
  });

  it('leaves GitHub issues to the closing references the form adds', () => {
    const prefill = pullRequestPrefillOf({
      commits: COMMITS,
      tasks: [{ provider: 'github', identifier: '#412', title: 'Nav overflow', branch: BRANCH }],
      branch: BRANCH,
    });

    expect(prefill.title).toBe('#412: Shorten the member nav labels');
    expect(prefill.body).not.toContain('Closes');
  });

  it('skips an issue of another branch and one the branch is only part of', () => {
    const prefill = pullRequestPrefillOf({
      commits: COMMITS,
      tasks: [
        { ...LINEAR, branch: 'hl/other' },
        { ...LINEAR, identifier: 'HL-1300', relation: 'part-of' },
      ],
      branch: BRANCH,
    });

    expect(prefill.title).toBe('Shorten the member nav labels');
    expect(prefill.body).not.toContain('Closes');
  });

  it('falls back to the issue title when the branch has no commit yet', () => {
    expect(pullRequestPrefillOf({ commits: [], tasks: [LINEAR], branch: BRANCH })).toEqual({
      title: 'HL-1372: Member nav labels overflow',
      body: 'Closes HL-1372',
    });
  });
});
