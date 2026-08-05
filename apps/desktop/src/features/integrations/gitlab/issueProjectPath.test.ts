import { describe, expect, it } from 'vitest';
import type { GitlabIssue } from './client';
import { projectPathFromIssue } from './issueProjectPath';

type Params = {
  readonly full: string;
};

const issue = ({ full }: Params): GitlabIssue => ({
  id: 1,
  iid: 1,
  projectId: 1,
  title: 't',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/issues/1',
  references: { full },
  updatedAt: '2026-01-01T00:00:00Z',
  milestone: null,
  labels: [],
});

describe('projectPathFromIssue', () => {
  it('strips the issue suffix from the full reference', () => {
    expect(projectPathFromIssue({ issue: issue({ full: 'acme/web#7' }) })).toBe('acme/web');
  });

  it('returns null when the reference has no project prefix', () => {
    expect(projectPathFromIssue({ issue: issue({ full: '#7' }) })).toBeNull();
  });

  it('returns null when the reference is empty', () => {
    expect(projectPathFromIssue({ issue: issue({ full: '' }) })).toBeNull();
  });
});
