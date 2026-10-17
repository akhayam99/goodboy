// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LaunchBar } from './LaunchBar';

afterEach(cleanup);

type BarParams = {
  readonly estimate?: string;
};

const bar = ({ estimate }: BarParams) => (
  <LaunchBar
    controls={null}
    {...(estimate !== undefined && { estimate: <span data-testid="chip">{estimate}</span> })}
    reason={null}
    isStartDisabled={false}
    isStarting={false}
    label={null}
    canDiscard
    onDiscard={() => undefined}
    onStart={() => undefined}
  />
);

describe('LaunchBar', () => {
  it('puts the estimate between Discard and Start once it arrives', () => {
    const { rerender } = render(bar({}));
    expect(screen.queryByTestId('launch-estimate-slot')).toBeNull();

    rerender(bar({ estimate: '~25-35m' }));

    const slot = screen.getByTestId('launch-estimate-slot');
    const discard = screen.getByRole('button', { name: 'Discard' });
    const start = screen.getByRole('button', { name: 'Start run' });
    expect(slot.contains(screen.getByTestId('chip'))).toBe(true);
    expect(discard.nextElementSibling).toBe(slot);
    expect(slot.nextElementSibling).toBe(start);
  });

  it('collapses the slot when there is no estimate, so Discard touches Start', () => {
    render(bar({}));
    const discard = screen.getByRole('button', { name: 'Discard' });
    expect(discard.nextElementSibling).toBe(screen.getByRole('button', { name: 'Start run' }));
  });
});
