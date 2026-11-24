// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { visibleTextAt } from '../../../../../../test/containerView';
import { factCardOf } from '../../../../../../__tests__/helpers/factCard';
import { DONE_ROW_STATE, type RowState } from '../../../../../workTreeModel/rowState';
import type { WorkTime } from '../../../../../workTreeModel/workTime';
import { TimelineFeedState } from './TimelineFeedState';
import { TimelineModelCell } from './TimelineModelCell';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { TimelineRowMeta } from './TimelineRowMeta';
import { TimelineRowStateLine } from './TimelineRowStateLine';

afterEach(cleanup);

const timeOf = ({ label }: { readonly label: string }): WorkTime => ({
  label,
  detail: `Active ${label}`,
  facts: [{ label: 'Active', value: label }],
  footnote: null,
  progress: null,
  headline: label,
  note: null,
  isMuchLonger: false,
});

describe('TimelineProviderGlyph', () => {
  it('shows the glyph of a known provider', () => {
    const { container } = render(<TimelineProviderGlyph provider="anthropic" />);

    expect(container.querySelector('[data-provider="anthropic"]')).not.toBeNull();
  });

  it('draws nothing for a provider it does not know', () => {
    const { container } = render(<TimelineProviderGlyph provider="acme-cloud" />);

    expect(container.children).toHaveLength(0);
  });
});

describe('TimelineRowMeta', () => {
  it('draws the duration alone in its column, never the cost on the row', () => {
    const { container } = render(
      <TimelineRowMeta time={timeOf({ label: '6m 40s' })} cost="$0.62" />,
    );
    const stack = container.querySelector('[data-meta-column="stack"]');

    expect(stack?.children).toHaveLength(1);
    expect(stack?.children[0]?.getAttribute('data-meta-column')).toBe('time');
    expect(stack?.children[0]?.querySelector('[data-testid="work-time"]')?.textContent).toBe(
      '6m 40s',
    );
    expect(container.querySelector('[data-meta-column="cost"]')).toBeNull();
  });

  it('keeps the cost in the card of the duration', () => {
    const { container } = render(
      <TimelineRowMeta time={timeOf({ label: '6m 40s' })} cost="$0.62" />,
    );

    expect(factCardOf({ element: within(container).getByTestId('work-time') }).rows).toEqual([
      ['Active', '6m 40s'],
      ['Cost', '$0.62'],
    ]);
  });

  it('draws the duration without a cost, and nothing for a cost without a duration', () => {
    const { container } = render(<TimelineRowMeta time={timeOf({ label: '6m 40s' })} />);
    const bare = render(<TimelineRowMeta cost="$0.62" />);

    expect(container.querySelector('[data-testid="work-time"]')?.textContent).toBe('6m 40s');
    expect(bare.container.querySelector('[data-meta-column="time"]')).toBeNull();
    expect(bare.container.textContent).toBe('');
  });

  it('puts the model cell before the stacked column, on the same slots for every row', () => {
    const { container } = render(
      <TimelineRowMeta
        model={
          <TimelineModelCell
            summary={{ name: 'Sonnet 5.5', detail: null, providers: ['anthropic'] }}
          />
        }
        time={timeOf({ label: '6m 40s' })}
        cost="$0.62"
      />,
    );
    const slots = Array.from(
      container.querySelectorAll('[data-meta-column="model"], [data-meta-column="stack"]'),
    ).map((slot) => slot.getAttribute('data-meta-column'));
    const bare = render(<TimelineRowMeta />);

    expect(slots).toEqual(['model', 'stack']);
    expect(
      Array.from(bare.container.querySelectorAll('[data-meta-column]')).map((slot) =>
        slot.getAttribute('data-meta-column'),
      ),
    ).toEqual(['model', 'stack']);
  });

  it('keeps the duration over 500px and hides the whole column under it', () => {
    const { container } = render(
      <TimelineRowMeta time={timeOf({ label: '6m 40s' })} cost="$0.62" />,
    );
    const root = container.firstElementChild;
    if (root === null) {
      throw new Error('no meta rendered');
    }

    expect(visibleTextAt({ root, width: 700 })).toBe('6m 40s');
    expect(visibleTextAt({ root, width: 560 })).toBe('6m 40s');
    expect(visibleTextAt({ root, width: 460 })).toBe('');
  });
});

describe('TimelineModelCell', () => {
  it('shows the glyph of the provider and the model that ran', () => {
    const { container } = render(
      <TimelineModelCell
        summary={{ name: 'Sonnet 5.5', detail: null, providers: ['anthropic'] }}
      />,
    );

    expect(container.querySelector('[data-provider="anthropic"]')).not.toBeNull();
    expect(screen.getByText('Sonnet 5.5')).toBeDefined();
  });

  it('keeps one glyph per provider when a fallback crossed providers', () => {
    const { container } = render(
      <TimelineModelCell
        summary={{
          name: 'Sonnet 5.5',
          detail: 'from Kimi K3',
          providers: ['moonshot', 'anthropic'],
        }}
      />,
    );

    expect(
      Array.from(container.querySelectorAll('[data-provider]')).map((glyph) =>
        glyph.getAttribute('data-provider'),
      ),
    ).toEqual(['moonshot', 'anthropic']);
  });

  it('keeps the model name on a 720 column and leaves the cell under 500px', () => {
    const { container } = render(
      <TimelineModelCell
        summary={{ name: 'Sonnet 5.5', detail: null, providers: ['anthropic'] }}
      />,
    );
    const cell = container.firstElementChild;
    if (cell === null) {
      throw new Error('no cell rendered');
    }

    expect(visibleTextAt({ root: cell, width: 600 })).toBe('Sonnet 5.5');
    expect(visibleTextAt({ root: cell, width: 460 })).toBe('');
    expect(screen.getByText('Sonnet 5.5')).toBeDefined();
  });

  it('puts the effort on the model line and hides both under 500px', () => {
    const { container } = render(
      <TimelineModelCell
        summary={{ name: 'Opus 5.5', detail: 'High', providers: ['anthropic'] }}
      />,
    );
    const cell = container.firstElementChild;
    if (cell === null) {
      throw new Error('no cell rendered');
    }
    const lines = Array.from(cell.querySelectorAll('[data-routing-part]')).map(
      (line) => line.textContent,
    );

    expect(lines).toEqual(['Opus 5.5', 'High']);
    expect(visibleTextAt({ root: cell, width: 600 })).toBe('Opus 5.5·High');
    expect(visibleTextAt({ root: cell, width: 460 })).toBe('');
  });

  it('names where a fallback chain started on the second line', () => {
    const { container } = render(
      <TimelineModelCell
        summary={{
          name: 'Opus 5.5',
          detail: 'from Kimi K3',
          providers: ['anthropic', 'moonshot'],
        }}
      />,
    );

    expect(container.querySelector('[data-routing-part="detail"]')?.textContent).toBe(
      'from Kimi K3',
    );
  });

  it('leaves the second line out when there is nothing to say', () => {
    const { container } = render(
      <TimelineModelCell summary={{ name: 'Opus 5.5', detail: null, providers: ['anthropic'] }} />,
    );

    expect(container.querySelector('[data-routing-part="detail"]')).toBeNull();
  });

  it('holds its slot empty when nothing ran and nothing is planned', () => {
    const { container } = render(<TimelineModelCell summary={null} />);

    expect(container.querySelector('[data-meta-column="model"]')?.textContent).toBe('');
    expect(container.querySelector('[data-meta-column="model"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

describe('TimelineRowMeta note', () => {
  it('keeps the time on its column and turns it warm with the note on a slow step', () => {
    const { container } = render(
      <TimelineRowMeta time={timeOf({ label: '11m' })} cost="$2.31" note="Longer than usual" />,
    );
    const time = within(container).getByTestId('work-time');

    expect(time.textContent).toBe('11m');
    expect(time.getAttribute('data-note')).toBe('true');
    expect(screen.getByText('Longer than usual')).toBeDefined();
    const card = factCardOf({ element: time });

    expect(card.text).toContain('Longer than usual');
    expect(card.rows).toEqual([
      ['Active', '11m'],
      ['Cost', '$2.31'],
    ]);
  });

  it('leaves the time quiet when the step is within its range', () => {
    const { container } = render(<TimelineRowMeta time={timeOf({ label: '4m' })} cost="$0.31" />);

    expect(within(container).getByTestId('work-time').getAttribute('data-note')).toBeNull();
    expect(screen.queryByText('Longer than usual')).toBeNull();
  });
});

describe('TimelineRowStateLine', () => {
  it('takes no space on a row without a state word', () => {
    const { container } = render(<TimelineRowStateLine state={DONE_ROW_STATE} />);

    expect(container.querySelector('[data-testid="timeline-row-state"]')).toBeNull();
    expect(container.children).toHaveLength(0);
  });
});

const columnsOf = ({ container }: { readonly container: HTMLElement }) =>
  Array.from(container.querySelectorAll('[data-testid="activity-meta"] > [data-meta-column]')).map(
    (cell) => cell.getAttribute('data-meta-column'),
  );

const QUESTION_STATE: RowState = {
  phase: 'waiting',
  reason: { kind: 'question', stepLabel: null },
  ask: { kind: 'answer', question: null },
};

const FAILED_STATE: RowState = { phase: 'failed', reason: { kind: 'failed' }, ask: null };

describe('TimelineRowMeta in the feed', () => {
  it('declares the state, the model and the time once, in that order, with the cost in the card', () => {
    const { container } = render(
      <TimelineRowMeta
        layout="feed"
        state={<TimelineFeedState state={FAILED_STATE} />}
        time={timeOf({ label: '6m 40s' })}
        cost="$0.62"
      />,
    );

    expect(columnsOf({ container })).toEqual(['state', 'model', 'time']);
    expect(container.querySelector('[data-meta-column="cost"]')).toBeNull();
    expect(screen.getByTestId('work-time').textContent).toBe('6m 40s');
  });

  it('keeps an empty state cell at its width so every row lines up', () => {
    const { container } = render(
      <TimelineRowMeta layout="feed" state={null} time={timeOf({ label: '4m' })} />,
    );
    const state = container.querySelector<HTMLElement>('[data-meta-column="state"]');

    expect(state?.textContent).toBe('');
    expect(columnsOf({ container })).toEqual(['state', 'model', 'time']);
  });

  const toneOfTime = ({ container }: { readonly container: HTMLElement }) =>
    container.querySelector('[data-time-tone]')?.getAttribute('data-time-tone') ?? null;

  it('draws a running clock in the info tone and a finished one quiet', () => {
    const live = render(<TimelineRowMeta layout="feed" time={timeOf({ label: '12m' })} isLive />);
    expect(toneOfTime({ container: live.container })).toBe('live');
    cleanup();

    const done = render(<TimelineRowMeta layout="feed" time={timeOf({ label: '3m 10s' })} />);
    expect(toneOfTime({ container: done.container })).toBe('quiet');
  });

  it('keeps the stacked column on the run page, where no layout is asked for', () => {
    const { container } = render(<TimelineRowMeta time={timeOf({ label: '4m' })} />);

    expect(container.querySelector('[data-meta-column="stack"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="activity-meta"]')).toBeNull();
  });
});

describe('TimelineFeedState', () => {
  it('offers Answer on a row that waits on your answer, and names the state to a reader', () => {
    const { container } = render(<TimelineFeedState state={QUESTION_STATE} />);
    const action = within(container).getByTestId('timeline-row-action');

    expect(action.textContent).toContain('Answer');
    expect(within(action).queryByRole('button')).toBeNull();
    expect(action.querySelector('.sr-only')).not.toBeNull();
  });

  it('writes a failed state in the danger tone', () => {
    render(<TimelineFeedState state={FAILED_STATE} />);
    const state = screen.getByTestId('timeline-row-state');

    expect(state.getAttribute('data-state-tone')).toBe('failed');
  });

  it('says nothing on a done row', () => {
    const { container } = render(<TimelineFeedState state={DONE_ROW_STATE} />);

    expect(container.children).toHaveLength(0);
  });
});
