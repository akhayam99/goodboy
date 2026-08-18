// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TimelineStatusMarker, type TimelineMarkerState } from './TimelineStatusMarker';

afterEach(cleanup);

type MarkerParams = {
  readonly state: TimelineMarkerState;
};

const markerOf = ({ state }: MarkerParams) => {
  const { container } = render(<TimelineStatusMarker state={state} />);
  const circle = container.querySelector('span');
  if (circle === null) {
    throw new Error('marker did not render');
  }
  return circle;
};

describe('TimelineStatusMarker', () => {
  it('wraps every state in a filled circle that occludes the spine', () => {
    for (const state of [
      'running',
      'completed',
      'failed',
      'pending',
      'skipped',
      'waiting',
    ] satisfies ReadonlyArray<TimelineMarkerState>) {
      const circle = markerOf({ state });
      expect(circle.className).toContain('rounded-full');
      expect(circle.className).toMatch(/bg-background|bg-/);
      cleanup();
    }
  });

  it('names each state for a screen reader', () => {
    render(<TimelineStatusMarker state="waiting" />);
    expect(screen.getByLabelText('Waiting for you')).toBeDefined();
    cleanup();

    render(<TimelineStatusMarker state="running" />);
    expect(screen.getByLabelText('Running')).toBeDefined();
    cleanup();

    render(<TimelineStatusMarker state="failed" />);
    expect(screen.getByLabelText('Failed')).toBeDefined();
    cleanup();

    render(<TimelineStatusMarker state="completed" />);
    expect(screen.getByLabelText('Completed')).toBeDefined();
  });

  it('separates running from waiting by shape, not only by colour', () => {
    const running = markerOf({ state: 'running' });
    const runningShape = running.innerHTML;
    cleanup();
    const waiting = markerOf({ state: 'waiting' });

    expect(runningShape).not.toBe(waiting.innerHTML);
  });

  it('raises the emphasis of the two states that want the user', () => {
    const waiting = markerOf({ state: 'waiting' });
    expect(waiting.className).toContain('bg-warning');
    cleanup();

    const failed = markerOf({ state: 'failed' });
    expect(failed.className).toContain('bg-danger');
    cleanup();

    const completed = markerOf({ state: 'completed' });
    expect(completed.className).toContain('bg-background');
  });
});
