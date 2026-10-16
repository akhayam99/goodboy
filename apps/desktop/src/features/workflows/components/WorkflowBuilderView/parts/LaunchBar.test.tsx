// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LaunchBar } from './LaunchBar';

afterEach(cleanup);

const bar = ({ estimate }: { readonly estimate?: string }) => (
  <LaunchBar
    controls={null}
    hasEstimateSlot
    {...(estimate !== undefined && { estimate: <span data-testid="chip">{estimate}</span> })}
    reason={null}
    isStartDisabled={false}
    isStarting={false}
    label={null}
    onStart={() => undefined}
  />
);

describe('LaunchBar', () => {
  it('reserves the estimate slot before the estimate arrives, so Start never moves', () => {
    const { rerender } = render(bar({}));
    const slot = screen.getByTestId('launch-estimate-slot');
    const start = screen.getByRole('button', { name: 'Start run' });
    expect(screen.queryByTestId('chip')).toBeNull();

    rerender(bar({ estimate: 'About $1.20' }));

    expect(screen.getByTestId('launch-estimate-slot')).toBe(slot);
    expect(screen.getByRole('button', { name: 'Start run' })).toBe(start);
    expect(slot.contains(screen.getByTestId('chip'))).toBe(true);
    expect(screen.getByTestId('chip').textContent).toBe('About $1.20');
  });

  it('draws no slot when the lane never shows an estimate', () => {
    render(
      <LaunchBar
        controls={null}
        reason={null}
        isStartDisabled={false}
        isStarting={false}
        label={null}
        onStart={() => undefined}
      />,
    );
    expect(screen.queryByTestId('launch-estimate-slot')).toBeNull();
  });
});
