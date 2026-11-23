// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EffortMeter } from './EffortMeter';
import { FactCardFacts } from './FactCardFacts';
import { FactCardFootnote } from './FactCardFootnote';
import { FactCardHeader } from './FactCardHeader';
import { FactCardModels } from './FactCardModels';
import { FactCardState } from './FactCardState';
import { FactCardTask } from './FactCardTask';
import { cappedModels } from './cappedModels';
import type { Fact, FactModel } from './types';

afterEach(cleanup);

describe('the fact card parts', () => {
  it('cuts a plain title and leaves a title node to the caller', () => {
    const { rerender } = render(<FactCardHeader title="Fix duplicate credits" />);

    expect(screen.getByText('Fix duplicate credits').className).toContain('truncate');

    rerender(<FactCardHeader title={<span data-testid="own">Harborline</span>} />);

    expect(screen.getByTestId('own').className).not.toContain('truncate');
  });

  it('puts the caller glyph before the words of a state', () => {
    render(
      <FactCardState
        glyph={<i data-testid="glyph" />}
        words={<b data-testid="words">Running</b>}
      />,
    );

    expect(screen.getByTestId('glyph').parentElement?.className).toContain('size-4');
    expect(screen.getByTestId('words').textContent).toBe('Running');
  });

  it('caps the label column so a long label cuts and the value stays visible', () => {
    render(
      <FactCardFacts
        facts={[{ label: 'Reconcile duplicate credits in the Harborline ledger', value: '3m' }]}
      />,
    );

    const label = screen.getByText('Reconcile duplicate credits in the Harborline ledger');
    expect(label.className).toContain('truncate');
    expect(label.closest('dl')?.className).toContain('grid-cols-[fit-content(40%)_minmax(0,1fr)]');
    expect(screen.getByText('3m').className).toContain('min-w-0');
  });

  it('draws a footnote in the faint tone', () => {
    render(<FactCardFootnote text="2 agents" />);

    expect(screen.getByText('2 agents').className).toContain('text-faint-foreground');
  });
});

const TASK =
  'Post one credit per retry in postCredit and applyCredit, keyed on the event id so a replayed webhook is a no-op';

const SONNET: FactModel = {
  key: 'anthropic:Sonnet 5.5',
  name: 'Sonnet 5.5',
  mark: <i data-provider="anthropic" />,
  effort: { word: 'High', step: 3, steps: 5 },
};

const SOL: FactModel = {
  key: 'codex:GPT-6.1 Sol',
  name: 'GPT-6.1 Sol',
  mark: <i data-provider="codex" />,
  effort: { word: 'Very high', step: 4, steps: 5 },
};

const HAIKU: FactModel = { key: 'anthropic:Haiku 4.5', name: 'Haiku 4.5' };

const OPUS: FactModel = {
  key: 'anthropic:Opus 5.5',
  name: 'Opus 5.5',
  effort: { word: 'Max', step: 5, steps: 5 },
};

const NO_FACTS: ReadonlyArray<Fact> = [];

const renderModels = ({ models }: { readonly models: ReadonlyArray<FactModel> }) =>
  render(
    <FactCardFacts
      facts={NO_FACTS}
      lead={
        <FactCardModels models={cappedModels({ card: { title: 'Reviewer', models, facts: [] } })} />
      }
    />,
  );

const segmentsOf = ({ meter }: { readonly meter: HTMLElement }) =>
  Array.from(meter.querySelectorAll<HTMLElement>('[data-segment]'));

describe('the role card parts', () => {
  it('shows the task in full up to four lines, then clamps it', () => {
    render(
      <FactCardTask
        task={TASK}
        state={{ tone: 'info', words: 'Working', note: '12m' }}
        stateGlyph={<i data-testid="node" />}
      />,
    );

    const task = screen.getByText(TASK);
    expect(task.className).toContain('line-clamp-4');
    expect(task.className).not.toContain('truncate');
    expect(screen.getByTestId('node')).toBeDefined();
    expect(screen.getByText('Working').className).toContain('text-info');
    expect(screen.getByText('12m').className).toContain('text-faint-foreground');
  });

  it('keeps the word of a quiet state muted', () => {
    render(
      <FactCardTask
        task={TASK}
        state={{ tone: 'neutral', words: 'Done', note: 'in 6m 12s' }}
        stateGlyph={null}
      />,
    );

    expect(screen.getByText('Done').className).toContain('text-muted-foreground');
  });

  it('draws one model line per model with its own provider mark, in the order it ran', () => {
    const { container } = renderModels({ models: [SONNET, SOL] });

    const lines = Array.from(container.querySelectorAll<HTMLElement>('[data-fact-model]'));
    expect(lines.map((line) => line.dataset.factModel)).toEqual([SONNET.key, SOL.key]);
    expect(lines[0]?.querySelector('[data-provider="anthropic"]')).not.toBeNull();
    expect(lines[1]?.querySelector('[data-provider="codex"]')).not.toBeNull();
    expect(screen.getByText('Models')).toBeDefined();
  });

  it('gives the meter one segment per level the model offers, filled to the level used', () => {
    render(<EffortMeter effort={{ word: 'High', step: 3, steps: 5 }} isPlanned={false} />);

    const meter = screen.getByRole('img', { name: 'Effort High, 3 of 5' });
    const segments = segmentsOf({ meter });
    expect(segments).toHaveLength(5);
    expect(segments.filter((segment) => segment.dataset.segment === 'on')).toHaveLength(3);
  });

  it('follows the axis of the model, three segments for a model with three levels', () => {
    render(<EffortMeter effort={{ word: 'High', step: 3, steps: 3 }} isPlanned={false} />);

    expect(
      segmentsOf({ meter: screen.getByRole('img', { name: 'Effort High, 3 of 3' }) }),
    ).toHaveLength(3);
  });

  it('draws no meter for a model without an effort axis', () => {
    const { container } = renderModels({ models: [HAIKU] });

    expect(container.querySelector('[data-effort-meter]')).toBeNull();
    expect(screen.getByText('Model')).toBeDefined();
    expect(screen.getByText('Haiku 4.5')).toBeDefined();
  });

  it('draws the planned meter in faint ink and the used one in muted ink', () => {
    const { rerender } = render(
      <EffortMeter effort={{ word: 'Low', step: 1, steps: 5 }} isPlanned />,
    );
    const planned = segmentsOf({ meter: screen.getByRole('img') });
    expect(planned[0]?.className).toContain('bg-faint-foreground');

    rerender(<EffortMeter effort={{ word: 'Low', step: 1, steps: 5 }} isPlanned={false} />);
    const used = segmentsOf({ meter: screen.getByRole('img') });
    expect(used[0]?.className).toContain('bg-muted-foreground');
  });

  it('never paints the meter in a tone colour', () => {
    render(<EffortMeter effort={{ word: 'Max', step: 5, steps: 5 }} isPlanned={false} />);

    const classes = segmentsOf({ meter: screen.getByRole('img') })
      .map((segment) => segment.className)
      .join(' ');
    expect(classes).not.toMatch(/(info|warning|danger|success|primary)/);
  });

  it('shows the first and the last of three models and counts the one between', () => {
    const { container } = renderModels({ models: [SONNET, OPUS, SOL] });

    const lines = Array.from(container.querySelectorAll<HTMLElement>('[data-fact-model]'));
    expect(lines.map((line) => line.dataset.factModel)).toEqual([SONNET.key, SOL.key]);
    expect(screen.getByText('+ 1 model')).toBeDefined();
  });
});
