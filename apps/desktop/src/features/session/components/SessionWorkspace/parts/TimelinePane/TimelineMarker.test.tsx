// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TimelineMarkerState } from '../../../../timeline/markerState';
import { TIMELINE_RHYTHM, type TimelineRowGrade } from '../../../../timeline/timelineRhythm';
import { TimelineMarker } from './TimelineMarker';

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

describe('TimelineMarker', () => {
  it('names every state for a screen reader', () => {
    for (const state of STATES) {
      render(<TimelineMarker state={state} grade="step" />);
      expect(screen.getByLabelText(LABELS[state])).toBeDefined();
      cleanup();
    }
  });

  it('gives the two blocking states a shape that is not the circle', () => {
    const circles = [
      'done',
      'failed',
      'running',
      'pending',
      'skipped',
    ] satisfies ReadonlyArray<TimelineMarkerState>;
    for (const state of circles) {
      expect(rootOf({ state }).className).toContain('rounded-full');
      cleanup();
    }
    for (const state of ['needsUser', 'question'] satisfies ReadonlyArray<TimelineMarkerState>) {
      expect(rootOf({ state }).className).not.toContain('rounded-full');
      cleanup();
    }
  });

  it('leaves pending and running hollow so fill reads as has happened', () => {
    expect(rootOf({ state: 'pending' }).className).toContain('bg-background');
    cleanup();
    expect(rootOf({ state: 'running' }).className).toContain('bg-background');
    cleanup();
    expect(rootOf({ state: 'done' }).className).toContain('bg-success');
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
