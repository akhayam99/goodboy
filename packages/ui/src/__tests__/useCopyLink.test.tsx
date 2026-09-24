// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useCopyLink } from '../useCopyLink';

afterEach(cleanup);

const Rows = () => {
  const { copiedKey, copy } = useCopyLink();
  return (
    <ul>
      {['/worktrees/api', '/worktrees/web'].map((path) => (
        <li key={path}>
          <button type="button" onClick={() => void copy({ text: path })}>
            {copiedKey === path ? `Copied ${path}` : `Copy ${path}`}
          </button>
        </li>
      ))}
    </ul>
  );
};

describe('useCopyLink', () => {
  it('flips only the row whose key was copied', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    render(<Rows />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy /worktrees/api' }));
    });

    expect(screen.getByRole('button', { name: 'Copied /worktrees/api' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copy /worktrees/web' })).toBeDefined();
  });
});
