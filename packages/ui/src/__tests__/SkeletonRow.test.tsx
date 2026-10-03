// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SkeletonRow } from '../components/SkeletonRow';
import { SkeletonChip } from '../components/SkeletonChip';
import { EmptyLine } from '../components/EmptyLine';

afterEach(cleanup);

describe('loading and empty primitives', () => {
  it('names what a skeleton row is loading for assistive tech', () => {
    render(<SkeletonRow label="Loading your inbox" />);

    screen.getByRole('status', { name: 'Loading your inbox' });
  });

  it('keeps a skeleton chip out of the accessibility tree', () => {
    const { container } = render(<SkeletonChip />);

    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says an empty line in one sentence with its action beside it', () => {
    render(<EmptyLine action={<button type="button">Add</button>}>No open worktrees.</EmptyLine>);

    screen.getByText('No open worktrees.');
    screen.getByRole('button', { name: 'Add' });
  });
});
