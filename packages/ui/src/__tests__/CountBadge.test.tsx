// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CountBadge } from '../components/CountBadge';
import { COUNT_BADGE_CORNER } from '../countBadgeCorner';
import { countTextOf } from '../countTextOf';

afterEach(cleanup);

describe('CountBadge', () => {
  it('draws nothing at zero or below', () => {
    const { container, rerender } = render(<CountBadge count={0} />);
    expect(container.firstChild).toBeNull();
    rerender(<CountBadge count={-2} />);
    expect(container.firstChild).toBeNull();
  });

  it('caps the number at 9+', () => {
    const { rerender } = render(<CountBadge count={9} />);
    expect(screen.getByRole('img').textContent).toBe('9');
    rerender(<CountBadge count={10} />);
    expect(screen.getByRole('img').textContent).toBe('9+');
    rerender(<CountBadge count={1024} />);
    expect(screen.getByRole('img').textContent).toBe('9+');
    expect(countTextOf({ count: 12 })).toBe('9+');
  });

  it('names itself "n open" with the real number, or the label it is given', () => {
    const { rerender } = render(<CountBadge count={12} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('12 open');
    rerender(<CountBadge count={3} label="3 need you" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('3 need you');
  });

  it('hides itself from the reader when the control around it already says the number', () => {
    const { container } = render(<CountBadge count={2} isAnnounced={false} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('is neutral by default and takes a tone only when it means something', () => {
    const { container, rerender } = render(<CountBadge count={2} />);
    const badge = () => container.firstElementChild;
    expect(badge()?.getAttribute('data-count-badge')).toBe('neutral');
    expect(badge()?.className).toContain('text-muted-foreground');
    rerender(<CountBadge count={2} tone="warning" />);
    expect(badge()?.getAttribute('data-count-badge')).toBe('warning');
    expect(badge()?.className).toContain('bg-warning-solid');
  });

  it('is a small tabular pill, anchored on the top end corner when placed there', () => {
    const { container, rerender } = render(<CountBadge count={4} />);
    const classes = () => container.firstElementChild?.className.split(' ') ?? [];
    expect(classes()).toEqual(
      expect.arrayContaining(['h-3.5', 'min-w-3.5', 'rounded-full', 'tabular-nums', 'text-chip']),
    );
    expect(classes()).not.toContain('absolute');
    rerender(<CountBadge count={4} placement="corner" />);
    expect(classes()).toEqual(expect.arrayContaining(COUNT_BADGE_CORNER.end.split(' ')));
    expect(container.firstElementChild?.getAttribute('data-placement')).toBe('corner');
  });
});
