// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Meter } from '../components/Meter';
import { METER_TRACK } from '../meterTrack';

const fillOf = ({ container }: { readonly container: HTMLElement }): HTMLElement => {
  const fill = container.querySelector<HTMLElement>('[data-meter-fill]');
  if (fill === null) {
    throw new Error('no fill');
  }
  return fill;
};

describe('Meter', () => {
  afterEach(cleanup);

  it('names the value it draws through the meter role', () => {
    render(<Meter label="Saved versions of Harborline" value={30} max={120} />);

    const meter = screen.getByRole('meter', { name: 'Saved versions of Harborline' });
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('120');
    expect(meter.getAttribute('aria-valuenow')).toBe('30');
  });

  it('draws the share of the max as the fill width', () => {
    const { container } = render(<Meter label="Spent" value={30} max={120} />);

    expect(fillOf({ container }).style.width).toBe('25%');
  });

  it('stops at the track ends when the value is out of range', () => {
    const over = render(<Meter label="Over" value={500} max={100} />);
    expect(fillOf({ container: over.container }).style.width).toBe('100%');
    expect(screen.getByRole('meter', { name: 'Over' }).getAttribute('aria-valuenow')).toBe('100');
    cleanup();

    const under = render(<Meter label="Under" value={-4} max={100} />);
    expect(fillOf({ container: under.container }).style.width).toBe('0%');
  });

  it('draws an empty bar for a zero max', () => {
    const { container } = render(<Meter label="Empty" value={3} max={0} />);

    expect(fillOf({ container }).style.width).toBe('0%');
  });

  it('shares one track and picks the height from the size', () => {
    render(
      <>
        <Meter label="Small" value={10} size="xs" />
        <Meter label="Default" value={10} />
      </>,
    );

    const small = screen.getByRole('meter', { name: 'Small' });
    const regular = screen.getByRole('meter', { name: 'Default' });
    METER_TRACK.split(' ').forEach((token) => {
      expect(small.className).toContain(token);
      expect(regular.className).toContain(token);
    });
    expect(small.className).toContain('h-1');
    expect(small.className).not.toContain('h-1.5');
    expect(regular.className).toContain('h-1.5');
  });

  it('fills with the tone it is given and primary by default', () => {
    const plain = render(<Meter label="Plain" value={10} />);
    expect(fillOf({ container: plain.container }).className).toContain('bg-primary');
    cleanup();

    const warned = render(<Meter label="Warned" value={10} tone="warning" />);
    expect(fillOf({ container: warned.container }).className).toContain('bg-warning');
  });
});
