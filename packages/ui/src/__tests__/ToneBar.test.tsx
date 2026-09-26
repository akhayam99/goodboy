// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToneBar } from '../components/ToneBar';

afterEach(cleanup);

const barClassName = (): string => screen.getByTestId('tone-bar').className;

describe('ToneBar', () => {
  it('paints the solid tone color, never a soft tint', () => {
    render(<ToneBar tone="danger" density="card" />);

    expect(barClassName()).toContain('bg-danger');
  });

  it('sizes the card density wider and taller than the row density', () => {
    render(<ToneBar tone="info" density="card" />);
    const card = barClassName();
    cleanup();
    render(<ToneBar tone="info" density="row" />);
    const row = barClassName();

    expect(card).toContain('w-0.75');
    expect(row).toContain('w-0.5');
  });

  it('holds still unless told to breathe', () => {
    render(<ToneBar tone="info" density="card" />);

    expect(barClassName()).not.toContain('animate-soft-pulse');
  });

  it('breathes only when the state is running', () => {
    render(<ToneBar tone="info" density="card" isBreathing />);

    expect(barClassName()).toContain('motion-safe:animate-soft-pulse');
  });

  it('never blocks a click meant for the surface underneath', () => {
    render(<ToneBar tone="info" density="card" />);

    expect(barClassName()).toContain('pointer-events-none');
  });

  it('stays out of the accessibility tree, the label carries the state', () => {
    render(<ToneBar tone="info" density="card" />);

    expect(screen.getByTestId('tone-bar').getAttribute('aria-hidden')).toBe('true');
  });
});
