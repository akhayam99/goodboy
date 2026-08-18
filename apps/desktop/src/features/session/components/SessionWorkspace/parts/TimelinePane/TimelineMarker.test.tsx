// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TimelineMarkerState } from '../../../../timeline/markerState';
import { TIMELINE_RHYTHM } from '../../../../timeline/timelineRhythm';
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
