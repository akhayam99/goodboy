import { describe, expect, it, vi } from 'vitest';
import type { GhRunner } from '../gh';
import { GhCliError } from '../gh';
import { fetchLinkedIssues, parseLinkedIssuesFromBody } from '../resolver';
import type { PullRequestState } from '@goodboy/types';

const REPO_URL = 'https://github.com/org/repo/pull/42';
const REPO_BASE = 'https://github.com/org/repo';

const BASE_PR: PullRequestState = {
  number: 42,
  title: 'My PR',
  url: REPO_URL,
  state: 'open',
  mergeable: true,
  checks: null,
  baseBranch: 'main',
  headBranch: 'feature',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('parseLinkedIssuesFromBody', () => {
  const closing = [
    'close',
    'closes',
    'closed',
    'fix',
    'fixes',
    'fixed',
    'resolve',
    'resolves',
    'resolved',
  ];
  const referencing = ['ref', 'refs', 'reference', 'referenced'];

  for (const keyword of closing) {
    it(`recognises "${keyword}" as closes:true`, () => {
      const result = parseLinkedIssuesFromBody(`${keyword} #123`, REPO_URL);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ number: 123, closes: true });
    });
  }

  for (const keyword of referencing) {
    it(`recognises "${keyword}" as closes:false`, () => {
      const result = parseLinkedIssuesFromBody(`${keyword} #456`, REPO_URL);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ number: 456, closes: false });
    });
  }

  it('is case-insensitive', () => {
    const result = parseLinkedIssuesFromBody('CLOSES #10', REPO_URL);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ number: 10, closes: true });
  });

  it('prefers closes:true when same issue referenced multiple times', () => {
    const body = 'refs #99\ncloses #99';
    const result = parseLinkedIssuesFromBody(body, REPO_URL);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ number: 99, closes: true });
  });

  it('closes:false preserved when only referenced', () => {
    const body = 'refs #99\nreference #99';
    const result = parseLinkedIssuesFromBody(body, REPO_URL);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ number: 99, closes: false });
  });

  it('builds url from repo base stripping /pull/... from PR url', () => {
    const result = parseLinkedIssuesFromBody('closes #7', REPO_URL);
    expect(result[0]?.url).toBe(`${REPO_BASE}/issues/7`);
  });

  it('strips .git suffix from repo base', () => {
    const result = parseLinkedIssuesFromBody('closes #7', `${REPO_BASE}.git/pull/1`);
    expect(result[0]?.url).toBe(`${REPO_BASE}/issues/7`);
  });

  it('strips trailing segments after the PR number', () => {
    const result = parseLinkedIssuesFromBody('closes #7', `${REPO_URL}/files#diff-abc`);
    expect(result[0]?.url).toBe(`${REPO_BASE}/issues/7`);
  });

  it('leaves a repo url without /pull/ untouched', () => {
    const result = parseLinkedIssuesFromBody('closes #7', REPO_BASE);
    expect(result[0]?.url).toBe(`${REPO_BASE}/issues/7`);
  });

  it('returns sorted by issue number', () => {
    const body = 'closes #30\nfixes #10\nresolves #20';
    const result = parseLinkedIssuesFromBody(body, REPO_URL);
    expect(result.map((i) => i.number)).toEqual([10, 20, 30]);
  });

  it('returns empty array for body with no keywords', () => {
    const result = parseLinkedIssuesFromBody('nothing to see here', REPO_URL);
    expect(result).toHaveLength(0);
  });
});

describe('fetchLinkedIssues', () => {
  it('falls back to body parse when GhCliError thrown', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockResolvedValue({ stdout: '', stderr: 'unauthorized', exitCode: 1 }),
    };
    const pr = { ...BASE_PR, body: 'closes #5' };
    const result = await fetchLinkedIssues(runner, 'org/repo', pr);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ number: 5, closes: true });
  });

  it('re-throws non-GhCliError from runner', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockRejectedValue(new TypeError('connection reset')),
    };
    await expect(fetchLinkedIssues(runner, 'org/repo', BASE_PR)).rejects.toBeInstanceOf(TypeError);
  });

  it('merges body issues and closingIssuesReferences', async () => {
    const closingRefs = [{ number: 10, title: 'Bug in auth', url: `${REPO_BASE}/issues/10` }];
    const runner: GhRunner = {
      run: vi.fn().mockResolvedValue({
        stdout: JSON.stringify({ closingIssuesReferences: closingRefs }),
        stderr: '',
        exitCode: 0,
      }),
    };
    const pr = { ...BASE_PR, body: 'closes #10\nrefs #20' };
    const result = await fetchLinkedIssues(runner, 'org/repo', pr);
    expect(result).toHaveLength(2);
    const issue10 = result.find((i) => i.number === 10);
    expect(issue10?.title).toBe('Bug in auth');
    expect(issue10?.closes).toBe(true);
    const issue20 = result.find((i) => i.number === 20);
    expect(issue20?.closes).toBe(false);
  });

  it('closing ref title overrides body-parsed entry (no title)', async () => {
    const closingRefs = [{ number: 3, title: 'Real title', url: `${REPO_BASE}/issues/3` }];
    const runner: GhRunner = {
      run: vi.fn().mockResolvedValue({
        stdout: JSON.stringify({ closingIssuesReferences: closingRefs }),
        stderr: '',
        exitCode: 0,
      }),
    };
    const pr = { ...BASE_PR, body: 'closes #3' };
    const result = await fetchLinkedIssues(runner, 'org/repo', pr);
    const issue = result.find((i) => i.number === 3);
    expect(issue?.title).toBe('Real title');
  });

  it('handles empty closingIssuesReferences', async () => {
    const runner: GhRunner = {
      run: vi.fn().mockResolvedValue({
        stdout: JSON.stringify({ closingIssuesReferences: [] }),
        stderr: '',
        exitCode: 0,
      }),
    };
    const pr = { ...BASE_PR, body: 'closes #5' };
    const result = await fetchLinkedIssues(runner, 'org/repo', pr);
    expect(result).toHaveLength(1);
    expect(result[0]?.number).toBe(5);
  });
});
