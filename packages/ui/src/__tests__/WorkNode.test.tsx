// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WorkNode } from '../components/WorkTree/WorkNode';
import type { WorkNodeState } from '../components/WorkTree/workNodeSpec';

afterEach(cleanup);

const nodeOf = (label: string): HTMLElement => screen.getByRole('img', { name: label });

describe('WorkNode', () => {
  it('draws every state at the same 20px size', () => {
    const states: ReadonlyArray<WorkNodeState> = [
      'queued',
      'ready',
      'running',
      'question',
      'budget',
      'failed',
      'done',
      'closed',
      'stopped',
      'skipped',
      'marker',
    ];
    render(
      <>
        {states.map((state) => (
          <WorkNode key={state} state={state} mark={{ kind: 'dot' }} label={state} />
        ))}
      </>,
    );

    for (const state of states) {
      const node = nodeOf(state);
      expect(node.style.width).toBe('20px');
      expect(node.style.height).toBe('20px');
      expect(node.getAttribute('data-node-state')).toBe(state);
    }
  });

  it('shows the local index while a step waits its turn or runs', () => {
    render(
      <>
        <WorkNode state="queued" mark={{ kind: 'index', value: '2' }} label="Not started" />
        <WorkNode state="running" mark={{ kind: 'index', value: '3' }} label="Running" />
      </>,
    );

    expect(nodeOf('Not started').textContent).toBe('2');
    expect(nodeOf('Running').textContent).toBe('3');
  });

  it('dashes the ring only for work that has not started', () => {
    render(
      <>
        <WorkNode state="queued" mark={{ kind: 'index', value: '1' }} label="Queued" />
        <WorkNode state="ready" mark={{ kind: 'index', value: '1' }} label="Ready" />
        <WorkNode state="failed" mark={{ kind: 'index', value: '1' }} label="Failed" />
      </>,
    );

    const dashOf = (label: string) =>
      nodeOf(label).querySelector('circle')?.getAttribute('stroke-dasharray') ?? null;
    expect(dashOf('Queued')).not.toBeNull();
    expect(dashOf('Ready')).not.toBeNull();
    expect(dashOf('Failed')).toBeNull();
  });

  it('replaces the number with a glyph when the state asks something or broke', () => {
    render(
      <>
        <WorkNode state="question" mark={{ kind: 'index', value: '4' }} label="Question" />
        <WorkNode state="budget" mark={{ kind: 'index', value: '4' }} label="Budget" />
        <WorkNode state="failed" mark={{ kind: 'index', value: '4' }} label="Failed" />
      </>,
    );

    expect(nodeOf('Question').textContent).toBe('?');
    expect(nodeOf('Budget').textContent).toBe('$');
    expect(nodeOf('Failed').textContent).toBe('!');
  });

  it('spins only while running, in the colour the caller names', () => {
    render(
      <>
        <WorkNode
          state="running"
          mark={{ kind: 'dot' }}
          label="Deciding"
          spinClassName="spin-border-identity-2"
        />
        <WorkNode state="question" mark={{ kind: 'dot' }} label="Waiting" />
      </>,
    );

    expect(nodeOf('Deciding').className).toContain('spin-border-identity-2');
    expect(nodeOf('Waiting').className).not.toContain('spin-border');
  });

  it('pulses the running dot behind motion-safe', () => {
    render(<WorkNode state="running" mark={{ kind: 'dot' }} label="Running" />);

    expect(nodeOf('Running').innerHTML).toContain('motion-safe:animate-soft-pulse');
  });

  it('folds the unseen dot into the accessible name', () => {
    render(<WorkNode state="done" mark={{ kind: 'dot' }} label="Done" hasUnread />);

    expect(nodeOf('Done, unseen')).toBeDefined();
  });

  it('rings a concept marker in its tone around the caller glyph', () => {
    render(
      <WorkNode
        state="marker"
        tone="warning"
        mark={{ kind: 'glyph', glyph: <span>P</span> }}
        label="Plan"
      />,
    );

    const node = nodeOf('Plan');
    expect(node.className).toContain('ring-warning/20');
    expect(node.textContent).toBe('P');
  });
});
