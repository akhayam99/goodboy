// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SkeletonRow } from '../components/SkeletonRow';
import { EmptyLine } from '../components/EmptyLine';

afterEach(cleanup);

describe('loading and empty primitives', () => {
  it('names what a skeleton row is loading for assistive tech', () => {
    render(<SkeletonRow label="Loading your inbox" />);

    screen.getByRole('status', { name: 'Loading your inbox' });
  });

  it('says an empty line in one sentence with its action beside it', () => {
    render(<EmptyLine action={<button type="button">Add</button>}>No open worktrees.</EmptyLine>);

    screen.getByText('No open worktrees.');
    screen.getByRole('button', { name: 'Add' });
  });
});
