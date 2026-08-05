import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { LinearIssueComment } from '../client';
import { LinearIssueComments } from './index';

const COMMENT: LinearIssueComment = {
  id: '1',
  body: 'Shipped in v2.',
  createdAt: '2026-08-01T10:00:00Z',
  user: { name: 'Ada Lovelace' },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-04T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('LinearIssueComments', () => {
  it('renders no avatar for any comment', () => {
    render(<LinearIssueComments comments={[COMMENT]} isLoading={false} error={null} />);

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders the author name and a relative timestamp for each comment', () => {
    render(<LinearIssueComments comments={[COMMENT]} isLoading={false} error={null} />);

    expect(screen.getByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('3d ago')).toBeDefined();
    expect(screen.getByText('Shipped in v2.')).toBeDefined();
  });
});
