import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GithubIssue } from '@goodboy/types';
import { GithubIssueDetail } from './index';

const ISSUE: GithubIssue = {
  number: 42,
  title: 'Add issue dashboard',
  body: 'Show assigned issues in GitHub Studio.',
  url: 'https://github.com/goodboy/goodboy/issues/42',
  state: 'OPEN',
  labels: ['feature'],
  updatedAt: '2026-07-22T10:00:00Z',
};

afterEach(cleanup);

describe('GithubIssueDetail', () => {
  it('renders the issue title, description and properties', () => {
    render(<GithubIssueDetail issue={ISSUE} />);

    expect(screen.getByText('Add issue dashboard')).toBeDefined();
    expect(screen.getByText('Show assigned issues in GitHub Studio.')).toBeDefined();
    expect(screen.getByText('feature')).toBeDefined();
    expect(screen.getByText('#42')).toBeDefined();
  });

  it('falls back to a placeholder when the body is empty', () => {
    render(<GithubIssueDetail issue={{ ...ISSUE, body: '' }} />);

    expect(screen.getByText('No description.')).toBeDefined();
  });
});
