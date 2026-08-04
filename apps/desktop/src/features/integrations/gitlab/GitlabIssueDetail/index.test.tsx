import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GitlabIssue } from '../client';
import { GitlabIssueDetail } from './index';

const ISSUE: GitlabIssue = {
  id: 101,
  iid: 7,
  projectId: 3,
  title: 'Fix the thing',
  description: 'Investigate the flaky request.',
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/issues/7',
  references: { full: 'acme/web#7' },
  updatedAt: '2026-05-21T10:00:00Z',
  milestone: { title: 'v1' },
  labels: ['bug'],
};

afterEach(cleanup);

describe('GitlabIssueDetail', () => {
  it('renders the issue title, description and properties', () => {
    render(<GitlabIssueDetail issue={ISSUE} />);

    expect(screen.getByText('Fix the thing')).toBeDefined();
    expect(screen.getByText('Investigate the flaky request.')).toBeDefined();
    expect(screen.getByText('bug')).toBeDefined();
    expect(screen.getByText('v1')).toBeDefined();
    expect(screen.getByText('acme/web#7')).toBeDefined();
  });

  it('falls back to a placeholder when there is no description', () => {
    render(<GitlabIssueDetail issue={{ ...ISSUE, description: null }} />);

    expect(screen.getByText('No description.')).toBeDefined();
  });
});
