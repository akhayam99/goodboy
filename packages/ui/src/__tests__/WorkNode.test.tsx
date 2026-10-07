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
      'approval',
      'alert',
      'failed',
      'approved',
      'done',
      'finished',
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

  it('spins the ring of any state when the caller says the work goes on', () => {
    render(
      <>
        <WorkNode state="question" mark={{ kind: 'dot' }} label="Asking" isSpinning />
        <WorkNode
          state="approval"
          mark={{ kind: 'dot' }}
          label="Approving"
          isSpinning
          spinClassName="spin-border-primary"
        />
        <WorkNode state="alert" mark={{ kind: 'dot' }} label="Quiet" />
      </>,
    );

    expect(nodeOf('Asking').className).toContain('spin-border spin-border-info');
    expect(nodeOf('Asking').textContent).toBe('?');
    expect(nodeOf('Approving').className).toContain('spin-border-primary');
    expect(nodeOf('Quiet').className).not.toContain('spin-border');
  });

  it('draws an approved node as a solid success disc with a white check', () => {
    render(<WorkNode state="approved" mark={{ kind: 'dot' }} label="Approved" />);

    const node = nodeOf('Approved');
    const disc = node.querySelector('circle');
    expect(disc?.getAttribute('class')).toContain('fill-success');
    expect(disc?.getAttribute('class')).toContain('stroke-success');
    expect(disc?.getAttribute('class')).not.toContain('fill-none');
    const check = screen.getByTestId('work-node-glyph').querySelector('svg.lucide-check');
    expect(check).not.toBeNull();
    expect(check?.getAttribute('class')).toContain('text-on-tone');
    expect(check?.getAttribute('width')).toBe('12');
  });

  it('keeps an approved disc apart from a done node, which is an outline with a tinted fill', () => {
    render(
      <>
        <WorkNode state="approved" mark={{ kind: 'dot' }} label="Approved" />
        <WorkNode state="done" mark={{ kind: 'dot' }} label="Done" />
      </>,
    );

    const fillOf = (label: string) => nodeOf(label).querySelector('circle')?.getAttribute('class');
    expect(fillOf('Done')).toContain('fill-success/18');
    expect(fillOf('Approved')).not.toContain('fill-success/18');
    expect(fillOf('Approved')).not.toBe(fillOf('Done'));
  });

  it('draws the approved check at 12px in the small node, inside the same 14px ring', () => {
    render(<WorkNode state="approved" mark={{ kind: 'dot' }} label="Approved" size="sm" />);

    const node = nodeOf('Approved');
    expect(node.style.width).toBe('14px');
    expect(node.querySelector('svg.lucide-check')?.getAttribute('width')).toBe('12');
  });

  it('draws a finished node as a solid violet disc with a white check, apart from approved', () => {
    render(
      <>
        <WorkNode state="finished" mark={{ kind: 'dot' }} label="Finished" size="sm" />
        <WorkNode state="approved" mark={{ kind: 'dot' }} label="Approved" size="sm" />
      </>,
    );

    const finished = nodeOf('Finished');
    const disc = finished.querySelector('circle')?.getAttribute('class') ?? '';
    expect(finished.style.width).toBe('14px');
    expect(disc).toContain('fill-merged');
    expect(disc).toContain('stroke-merged');
    expect(disc).not.toContain('fill-none');
    expect(disc).not.toContain('success');
    const check = finished.querySelector('svg.lucide-check');
    expect(check?.getAttribute('class')).toContain('text-on-tone');
    expect(check?.getAttribute('width')).toBe('12');
    const approved = nodeOf('Approved').querySelector('circle');
    expect(approved?.getAttribute('r')).toBe(finished.querySelector('circle')?.getAttribute('r'));
    expect(approved?.getAttribute('stroke-width')).toBe(
      finished.querySelector('circle')?.getAttribute('stroke-width'),
    );
  });

  it('draws no glyph under 12px in the small node, in any state', () => {
    const states: ReadonlyArray<WorkNodeState> = [
      'queued',
      'question',
      'budget',
      'approval',
      'alert',
      'failed',
      'approved',
      'done',
      'finished',
      'closed',
      'stopped',
      'skipped',
      'marker',
    ];
    render(
      <>
        {states.map((state) => (
          <WorkNode key={state} state={state} mark={{ kind: 'dot' }} label={state} size="sm" />
        ))}
      </>,
    );

    for (const state of states) {
      for (const glyph of nodeOf(state).querySelectorAll('svg.lucide')) {
        expect(Number(glyph.getAttribute('width'))).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it('draws an alert node as an amber ring around an amber exclamation mark', () => {
    render(<WorkNode state="alert" mark={{ kind: 'dot' }} label="Alert" />);

    const node = nodeOf('Alert');
    expect(node.textContent).toBe('!');
    expect(node.querySelector('circle')?.getAttribute('class')).toContain('stroke-warning');
    expect(node.innerHTML).toContain('text-warning');
    expect(node.innerHTML).not.toContain('text-danger');
  });

  it('pulses the running dot behind motion-safe', () => {
    render(<WorkNode state="running" mark={{ kind: 'dot' }} label="Running" />);

    expect(nodeOf('Running').innerHTML).toContain('motion-safe:animate-soft-pulse');
  });

  it('fills an arc with measured progress instead of spinning', () => {
    render(
      <>
        <WorkNode
          state="running"
          mark={{ kind: 'index', value: '2' }}
          label="Running"
          progress={0.5}
        />
        <WorkNode
          state="question"
          mark={{ kind: 'index', value: '2' }}
          label="Waiting"
          progress={0.5}
        />
        <WorkNode
          state="failed"
          mark={{ kind: 'index', value: '2' }}
          label="Failed"
          progress={0.5}
        />
      </>,
    );

    const running = nodeOf('Running');
    expect(running.className).not.toContain('spin-border');
    expect(running.querySelector('[data-node-arc="running"]')).not.toBeNull();
    expect(running.innerHTML).toContain('motion-safe:animate-soft-pulse');
    expect(running.textContent).toBe('2');

    const waiting = nodeOf('Waiting');
    expect(waiting.querySelector('[data-node-arc="paused"]')).not.toBeNull();
    expect(waiting.innerHTML).not.toContain('animate-soft-pulse');
    expect(waiting.textContent).toBe('?');

    expect(nodeOf('Failed').querySelector('[data-node-arc]')).toBeNull();
  });

  it('keeps the arc full once the work runs past its estimate', () => {
    render(<WorkNode state="running" mark={{ kind: 'dot' }} label="Running" progress={1.6} />);

    const arc = nodeOf('Running').querySelectorAll('[data-node-arc] circle')[1];
    const [filled, circumference] = (arc?.getAttribute('stroke-dasharray') ?? '').split(' ');
    expect(Number(filled)).toBeCloseTo(Number(circumference));
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

  it('centres the glyph on both axes in a full box, off the text baseline', () => {
    render(<WorkNode state="done" mark={{ kind: 'dot' }} label="Done" />);

    const node = nodeOf('Done');
    const glyph = screen.getByTestId('work-node-glyph');
    expect(node.className).toContain('items-center');
    expect(node.className).toContain('justify-center');
    expect(glyph.className.split(' ')).toEqual(
      expect.arrayContaining([
        'flex',
        'size-full',
        'items-center',
        'justify-center',
        'leading-none',
        '[&_svg]:block',
      ]),
    );
    expect(glyph.className).not.toContain('inline-flex');
  });
  it('splits the mixed ring into arcs proportional to the counts, one tone each', () => {
    const { container } = render(
      <WorkNode
        state="mixed"
        label="10 resolves"
        mark={{ kind: 'index', value: '10' }}
        parts={[
          { tone: 'warning', count: 3 },
          { tone: 'info', count: 4 },
          { tone: 'success', count: 2 },
          { tone: 'danger', count: 1 },
        ]}
      />,
    );

    const arcs = Array.from(container.querySelectorAll<SVGCircleElement>('[data-arc-tone]'));
    expect(arcs.map((arc) => arc.getAttribute('data-arc-tone'))).toEqual([
      'warning',
      'info',
      'success',
      'danger',
    ]);
    const lengths = arcs.map((arc) => Number(arc.getAttribute('stroke-dasharray')?.split(' ')[0]));
    const unit = (lengths[3] ?? 0) / 1;
    expect(lengths[0]).toBeCloseTo(unit * 3, 1);
    expect(lengths[1]).toBeCloseTo(unit * 4, 1);
    expect(lengths[2]).toBeCloseTo(unit * 2, 1);
    expect(nodeOf('10 resolves').textContent).toBe('10');
    expect(nodeOf('10 resolves').getAttribute('data-node-state')).toBe('mixed');
  });

  it('draws a single part as one unbroken ring', () => {
    const { container } = render(
      <WorkNode
        state="mixed"
        label="4 done"
        mark={{ kind: 'index', value: '4' }}
        parts={[{ tone: 'success', count: 4 }]}
      />,
    );

    const arcs = container.querySelectorAll('[data-arc-tone]');
    expect(arcs).toHaveLength(1);
    const dash = arcs[0]?.getAttribute('stroke-dasharray')?.split(' ') ?? [];
    expect(Number(dash[1])).toBeCloseTo(0, 1);
  });
});
