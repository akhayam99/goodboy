// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StageTrack, type StageTrackStage } from '../components/StageTrack';

afterEach(cleanup);

const STAGES: ReadonlyArray<StageTrackStage> = [
  { id: 'commits', label: 'Commit', state: 'done' },
  { id: 'pushed', label: 'Push', state: 'done' },
  { id: 'pr', label: 'Pull request', state: 'done' },
  { id: 'checks', label: 'Checks', state: 'skipped' },
  { id: 'review', label: 'Review', state: 'current' },
  { id: 'merged', label: 'Merge', state: 'todo' },
];

type StateParams = { readonly id: string };

const stateOf = ({ id }: StateParams): string | null =>
  document.querySelector(`[data-stage="${id}"]`)?.getAttribute('data-stage-state') ?? null;

describe('StageTrack', () => {
  it('names every stage and its state', () => {
    render(<StageTrack stages={STAGES} tone="info" />);
    screen.getByRole('img', {
      name: 'Commit done, Push done, Pull request done, Checks skipped, Review current, Merge to do',
    });
  });

  it('draws the four dot states, the state tone only on the current dot', () => {
    render(<StageTrack stages={STAGES} tone="success" />);
    expect(stateOf({ id: 'commits' })).toBe('done');
    expect(stateOf({ id: 'checks' })).toBe('skipped');
    expect(stateOf({ id: 'review' })).toBe('current');
    expect(stateOf({ id: 'merged' })).toBe('todo');
    const toned = [...document.querySelectorAll('[data-stage]')].filter((dot) =>
      dot.className.includes('bg-success'),
    );
    expect(toned.map((dot) => dot.getAttribute('data-stage'))).toEqual(['review']);
  });

  it('joins the stages with one line, filled up to the current stage', () => {
    render(<StageTrack stages={STAGES} tone="info" />);
    const lines = [...document.querySelectorAll('[data-stage-line]')].map((line) =>
      line.getAttribute('data-stage-line'),
    );
    expect(lines).toEqual(['filled', 'filled', 'filled', 'filled', 'empty']);
  });

  it('leaves every line empty before the first stage is reached', () => {
    render(
      <StageTrack
        stages={STAGES.map((stage) => ({ ...stage, state: 'todo' as const }))}
        tone="neutral"
      />,
    );
    const lines = [...document.querySelectorAll('[data-stage-line]')];
    expect(lines.every((line) => line.getAttribute('data-stage-line') === 'empty')).toBe(true);
  });
});
