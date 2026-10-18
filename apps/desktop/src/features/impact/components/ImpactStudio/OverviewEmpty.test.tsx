// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OverviewEmpty } from './OverviewEmpty';

afterEach(cleanup);

describe('OverviewEmpty', () => {
  it('says what fills Impact in one line and never names a spend', () => {
    render(<OverviewEmpty onStartSession={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Nothing finished yet' })).toBeDefined();
    expect(
      screen.getByText(
        'Finished sessions appear here: what shipped, how long it took, what it cost.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/spent today/)).toBeNull();
  });

  it('offers a new session', () => {
    const onStartSession = vi.fn();
    render(<OverviewEmpty onStartSession={onStartSession} />);

    fireEvent.click(screen.getByRole('button', { name: 'New session' }));

    expect(onStartSession).toHaveBeenCalledOnce();
  });
});
