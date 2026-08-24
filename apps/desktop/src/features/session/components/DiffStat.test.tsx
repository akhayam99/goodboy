// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { DiffStat } from './DiffStat';

afterEach(cleanup);

describe('DiffStat', () => {
  it('renders nothing when neither side moved', () => {
    const { container } = render(<DiffStat additions={0} deletions={0} />);

    expect(container.firstChild).toBeNull();
  });

  it('drops the half that is zero instead of printing it', () => {
    render(<DiffStat additions={7} deletions={0} />);

    expect(screen.getByTestId('diff-stat').textContent).toBe('+7');
  });

  it('carries a type scale per surface and lets a chip keep its own', () => {
    render(<DiffStat additions={1} deletions={2} size="md" />);
    const sized = screen.getByTestId('diff-stat');

    expect(sized.textContent).toBe('+1-2');
    expect(sized.className).toContain('text-xs');
    cleanup();

    render(<DiffStat additions={1} deletions={2} size="inherit" />);

    expect(screen.getByTestId('diff-stat').className).not.toContain('text-');
  });
});
