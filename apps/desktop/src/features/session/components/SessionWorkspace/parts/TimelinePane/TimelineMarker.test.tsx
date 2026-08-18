// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TimelineMarkerState } from '../../../../timeline/markerState';
import { TIMELINE_RHYTHM, type TimelineRowGrade } from '../../../../timeline/timelineRhythm';
import { TimelineMarker } from './TimelineMarker';
import { TIMELINE_SURFACE_FILL } from './timelineLayout';

afterEach(cleanup);

const STATES = [
  'done',
  'failed',
  'running',
  'pending',
  'skipped',
  'needsUser',
  'question',
] satisfies ReadonlyArray<TimelineMarkerState>;

const CIRCLE_STATES = [
  'done',
  'failed',
  'running',
  'pending',
  'skipped',
] satisfies ReadonlyArray<TimelineMarkerState>;

const LABELS: Record<TimelineMarkerState, string> = {
  done: 'Done',
  failed: 'Failed',
  running: 'Running',
  pending: 'Not started',
  skipped: 'Skipped',
  needsUser: 'Needs you',
  question: 'Waiting on your answer',
};

const rootOf = ({ state }: { readonly state: TimelineMarkerState }) => {
  const { container } = render(<TimelineMarker state={state} grade="step" />);
  const root = container.firstElementChild;
  if (root === null) {
    throw new Error('marker did not render');
  }
  return root;
};

const classOf = ({ node }: { readonly node: Element }) => node.getAttribute('class') ?? '';

const animatedInside = ({ root }: { readonly root: Element }) =>
  Array.from(root.querySelectorAll('*')).filter((node) => classOf({ node }).includes('animate-'));

const dotOf = ({ root }: { readonly root: Element }) => {
  const dot = root.querySelector('[class*="bg-info"]');
  if (dot === null) {
    throw new Error('running marker rendered no centre dot');
  }
  return dot;
};

const layersOf = ({ state }: { readonly state: TimelineMarkerState }) => {
  const root = rootOf({ state });
  return [root, ...Array.from(root.querySelectorAll('span'))].map((node) => node.className);
};

const fillsOf = ({ className }: { readonly className: string }): ReadonlyArray<string> =>
  className.split(' ').filter((token) => token.startsWith('bg-'));

const bottomFillOf = ({ state }: { readonly state: TimelineMarkerState }): string | null => {
  for (const className of layersOf({ state })) {
    const fill = fillsOf({ className })[0];
    if (fill !== undefined) {
      return fill;
    }
  }
  return null;
};

describe('TimelineMarker', () => {
  it('names every state for a screen reader', () => {
    for (const state of STATES) {
      render(<TimelineMarker state={state} grade="step" />);
      expect(screen.getByLabelText(LABELS[state])).toBeDefined();
      cleanup();
    }
  });

  it('gives the two blocking states a shape that is not the circle', () => {
    for (const state of CIRCLE_STATES) {
      expect(rootOf({ state }).className).toContain('rounded-full');
      cleanup();
    }
    for (const state of ['needsUser', 'question'] satisfies ReadonlyArray<TimelineMarkerState>) {
      expect(rootOf({ state }).className).not.toContain('rounded-full');
      cleanup();
    }
  });

  it('cuts the lane it sits on, so a translucent tone never paints onto the rail', () => {
    for (const state of STATES) {
      const fill = bottomFillOf({ state });

      expect(fill).not.toBeNull();
      expect(fill).not.toContain('/');
      cleanup();
    }
  });

  it('takes the occluding fill from the surface the feed is drawn on', () => {
    expect(TIMELINE_SURFACE_FILL).toBe('bg-background');
  });

  it('leaves pending an outline while a settled state carries its tone', () => {
    expect(rootOf({ state: 'pending' }).className).toContain(TIMELINE_SURFACE_FILL);
    expect(rootOf({ state: 'pending' }).querySelector('span.absolute')).toBeNull();
    cleanup();
    expect(rootOf({ state: 'running' }).className).toContain(TIMELINE_SURFACE_FILL);
    cleanup();
    expect(rootOf({ state: 'done' }).querySelector('span.absolute')?.className).toContain(
      'bg-success',
    );
    cleanup();
    expect(rootOf({ state: 'skipped' }).querySelector('span.absolute')?.className).toContain(
      'bg-muted',
    );
    cleanup();
    expect(rootOf({ state: 'failed' }).className).toContain('bg-danger');
  });

  it('animates running and nothing else', () => {
    expect(rootOf({ state: 'running' }).className).toContain('spin-border');
    cleanup();
    for (const state of [
      'done',
      'failed',
      'pending',
      'skipped',
    ] satisfies ReadonlyArray<TimelineMarkerState>) {
      expect(rootOf({ state }).className).not.toContain('spin-border');
      cleanup();
    }
  });

  it('draws running as the ring plus a pulsing dot at its centre', () => {
    const root = rootOf({ state: 'running' });

    expect(root.className).toContain('spin-border');
    expect(classOf({ node: dotOf({ root }) })).toContain('motion-safe:animate-soft-pulse');
  });

  it('pulses the running dot and leaves every other marker still', () => {
    expect(animatedInside({ root: rootOf({ state: 'running' }) })).toHaveLength(1);
    cleanup();
    for (const state of [
      'done',
      'failed',
      'pending',
      'skipped',
      'needsUser',
      'question',
    ] satisfies ReadonlyArray<TimelineMarkerState>) {
      const root = rootOf({ state });
      expect(root.className).not.toContain('animate-');
      expect(animatedInside({ root })).toHaveLength(0);
      cleanup();
    }
  });

  it('keeps the dot under reduced motion and stops only its animation', () => {
    const dot = dotOf({ root: rootOf({ state: 'running' }) });
    const animations = classOf({ node: dot })
      .split(' ')
      .filter((token) => token.includes('animate-'));

    expect(animations).toHaveLength(1);
    expect(animations.every((token) => token.startsWith('motion-safe:'))).toBe(true);
    expect(dot.getAttribute('style')).toContain(`${TIMELINE_RHYTHM.grade.step.dotSize}px`);
  });

  it('keeps the dot inside the ring so running never reads as the filled done marker', () => {
    const root = rootOf({ state: 'running' });

    expect(root.className).toContain('bg-background');
    expect(root.getAttribute('style')).toContain(`${TIMELINE_RHYTHM.grade.step.markerSize}px`);
    for (const grade of ['entry', 'step', 'pending'] satisfies ReadonlyArray<TimelineRowGrade>) {
      const { markerSize, dotSize } = TIMELINE_RHYTHM.grade[grade];
      expect(dotSize).toBeLessThanOrEqual(markerSize / 2);
      expect(dotSize % 2).toBe(0);
    }
  });

  it('carries unread as a dot beside the state instead of replacing it', () => {
    render(<TimelineMarker state="failed" grade="step" hasUnread />);
    expect(screen.getByLabelText('Failed')).toBeDefined();
    expect(screen.getByLabelText('Unseen')).toBeDefined();
  });

  it('keeps unread on a blocking state, which does not render a circle', () => {
    render(<TimelineMarker state="question" grade="entry" hasUnread />);
    expect(screen.getByLabelText('Waiting on your answer')).toBeDefined();
    expect(screen.getByLabelText('Unseen')).toBeDefined();
  });

  it('sizes the marker off the grade so a step never outweighs its entry', () => {
    const step = rootOf({ state: 'done' });
    expect(step.getAttribute('style')).toContain(`${TIMELINE_RHYTHM.grade.step.markerSize}px`);
    cleanup();
    const { container } = render(<TimelineMarker state="done" grade="entry" />);
    expect(container.firstElementChild?.getAttribute('style')).toContain(
      `${TIMELINE_RHYTHM.grade.entry.markerSize}px`,
    );
  });
});
