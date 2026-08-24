// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResolverCommitChip } from './ResolverCommitChip';

const LINK_AFFORDANCE = [
  'cursor-pointer',
  'underline-offset-2',
  'hover:underline',
  'hover:text-foreground',
];

afterEach(cleanup);

describe('ResolverCommitChip', () => {
  it('reads as an in-app link when it can open the commit', () => {
    const onOpen = vi.fn();
    render(<ResolverCommitChip sha="abcdef1234567890" onOpen={onOpen} />);
    const button = screen.getByRole('button', { name: 'Open commit abcdef1' });
    LINK_AFFORDANCE.forEach((token) => expect(button.className).toContain(token));
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('stays a plain chip without a handler', () => {
    render(<ResolverCommitChip sha="abcdef1234567890" onOpen={null} />);
    expect(screen.queryByRole('button')).toBeNull();
    const chip = screen.getByText('abcdef1');
    LINK_AFFORDANCE.forEach((token) => expect(chip.className).not.toContain(token));
  });
});
