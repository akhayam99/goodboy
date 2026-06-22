// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PullRequestChip, pullRequestMeta } from './index';

afterEach(cleanup);

describe('PullRequestChip', () => {
  it('renders an icon variant with aria-label including state', () => {
    render(<PullRequestChip state="open" />);
    expect(screen.getByLabelText(/in review/i)).toBeDefined();
  });

  it('shows the number with badge variant', () => {
    render(<PullRequestChip state="merged" variant="badge" number={42} />);
    expect(screen.getByText('Merged')).toBeDefined();
    expect(screen.getByText('#42')).toBeDefined();
  });

  it('renders the queued state as a badge with label', () => {
    render(<PullRequestChip state="queued" variant="badge" />);
    expect(screen.getByText('Queued')).toBeDefined();
  });

  it('renders compact variant with number, no label word', () => {
    render(<PullRequestChip state="draft" variant="compact" number={7} />);
    expect(screen.getByText('#7')).toBeDefined();
    expect(screen.queryByText('Draft')).toBeNull();
  });
});

describe('pullRequestMeta', () => {
  it('exposes a label for every state', () => {
    expect(pullRequestMeta('open').label).toBe('In review');
    expect(pullRequestMeta('queued').label).toBe('Queued');
    expect(pullRequestMeta('closed').label).toBe('Closed');
  });
});
