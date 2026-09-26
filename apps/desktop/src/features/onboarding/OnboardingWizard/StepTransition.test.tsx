// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepTransition } from './StepTransition';
import { OUTGOING_FALLBACK_MS, STEP_TRANSITION_MS, useStepTransition } from './useStepTransition';

const ORDER = ['one', 'two', 'three'] as const;
type Step = (typeof ORDER)[number];

const Harness = ({ step }: { readonly step: Step }) => {
  const transition = useStepTransition({ step, order: ORDER });
  return (
    <>
      <span data-testid="busy">{transition.isTransitioning ? 'busy' : 'idle'}</span>
      <StepTransition
        transition={transition}
        renderStep={(id) => (
          <h2 tabIndex={-1} data-step-title>
            {`page ${id}`}
          </h2>
        )}
      />
    </>
  );
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StepTransition', () => {
  it('renders one page with no animation on first entry', () => {
    render(<Harness step="one" />);
    expect(screen.getByText('page one')).toBeDefined();
    expect(screen.queryByTestId('wizard-step-outgoing')).toBeNull();
    expect(screen.getByTestId('wizard-step-incoming').className).not.toContain('wizard-step-in');
    expect(screen.getByTestId('busy').textContent).toBe('idle');
  });

  it('keeps both pages in the same cell while it crossfades, the outgoing one inert', () => {
    const { rerender } = render(<Harness step="one" />);
    rerender(<Harness step="two" />);

    const outgoing = screen.getByTestId('wizard-step-outgoing');
    expect(outgoing.textContent).toBe('page one');
    expect(outgoing.hasAttribute('inert')).toBe(true);
    expect(outgoing.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('wizard-step-incoming').textContent).toBe('page two');
    expect(screen.getByTestId('wizard-step-incoming').getAttribute('data-direction')).toBe(
      'forward',
    );
  });

  it('reports busy for the whole transition, so the footer can refuse a double click', () => {
    const { rerender } = render(<Harness step="one" />);
    rerender(<Harness step="two" />);
    expect(screen.getByTestId('busy').textContent).toBe('busy');
    act(() => {
      vi.advanceTimersByTime(STEP_TRANSITION_MS);
    });
    expect(screen.getByTestId('busy').textContent).toBe('idle');
  });

  it('removes the outgoing page on its animation end', () => {
    const { rerender } = render(<Harness step="one" />);
    rerender(<Harness step="two" />);
    fireEvent.animationEnd(screen.getByTestId('wizard-step-outgoing'));
    expect(screen.queryByTestId('wizard-step-outgoing')).toBeNull();
  });

  it('removes the outgoing page even without an animation end', () => {
    const { rerender } = render(<Harness step="one" />);
    rerender(<Harness step="two" />);
    act(() => {
      vi.advanceTimersByTime(OUTGOING_FALLBACK_MS);
    });
    expect(screen.queryByTestId('wizard-step-outgoing')).toBeNull();
  });

  it('mirrors the direction going back', () => {
    const { rerender } = render(<Harness step="three" />);
    rerender(<Harness step="two" />);
    expect(screen.getByTestId('wizard-step-incoming').getAttribute('data-direction')).toBe('back');
  });

  it('moves focus to the new title once the transition settles', () => {
    const { rerender } = render(<Harness step="one" />);
    rerender(<Harness step="two" />);
    act(() => {
      vi.advanceTimersByTime(STEP_TRANSITION_MS);
    });
    expect(document.activeElement?.textContent).toBe('page two');
  });
});
