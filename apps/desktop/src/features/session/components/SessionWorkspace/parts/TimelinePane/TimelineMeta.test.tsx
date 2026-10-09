// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { visibleTextAt } from '../../../../../../test/containerView';
import { tooltipTextOf } from '../../../../../../__tests__/helpers/tooltip';
import { DONE_ROW_STATE } from '../../../../../workTreeModel/rowState';
import type { WorkTime } from '../../../../../workTreeModel/workTime';
import { TimelineModelCell } from './TimelineModelCell';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { TimelineRowMeta } from './TimelineRowMeta';
import { TimelineRowStateLine } from './TimelineRowStateLine';

afterEach(cleanup);

const timeOf = ({ label }: { readonly label: string }): WorkTime => ({
  label,
  detail: `Active ${label}`,
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
  it('stacks the duration over the cost in one column', () => {
    const { container } = render(
      <TimelineRowMeta time={timeOf({ label: '6m 40s' })} cost="$0.62" />,
    );
    const stack = container.querySelector('[data-meta-column="stack"]');

    expect(stack?.children).toHaveLength(2);
    expect(stack?.children[0]?.getAttribute('data-meta-column')).toBe('time');
    expect(stack?.children[0]?.textContent).toBe('6m 40s');
    expect(stack?.children[1]?.getAttribute('data-meta-column')).toBe('cost');
    expect(stack?.children[1]?.textContent).toBe('$0.62');
    expect(container.querySelectorAll('[data-meta-column="cost"]')).toHaveLength(1);
  });

  it('keeps the cost in the tooltip of the duration for the widths where it leaves the row', () => {
    const { container } = render(
      <TimelineRowMeta time={timeOf({ label: '6m 40s' })} cost="$0.62" />,
    );

    expect(tooltipTextOf({ element: within(container).getByTestId('work-time') })).toBe(
      'Active 6m 40s. Cost $0.62',
    );
  });

  it('draws the duration without a cost, and the cost without a duration', () => {
    const { container } = render(<TimelineRowMeta time={timeOf({ label: '6m 40s' })} />);
    const bare = render(<TimelineRowMeta cost="$0.62" />);

    expect(container.querySelector('[data-meta-column="cost"]')).toBeNull();
    expect(container.querySelector('[data-meta-column="time"]')?.textContent).toBe('6m 40s');
    expect(bare.container.querySelector('[data-meta-column="time"]')).toBeNull();
    expect(bare.container.querySelector('[data-meta-column="cost"]')?.textContent).toBe('$0.62');
  });

  it('puts the model cell before the stacked column, on the same slots for every row', () => {
    const { container } = render(
      <TimelineRowMeta
        model={<TimelineModelCell summary={{ text: 'Sonnet 5.5', providers: ['anthropic'] }} />}
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

  it('hides the cost under 620px and the whole column under 500px', () => {
    const { container } = render(
      <TimelineRowMeta time={timeOf({ label: '6m 40s' })} cost="$0.62" />,
    );
    const root = container.firstElementChild;
    if (root === null) {
      throw new Error('no meta rendered');
    }

    expect(visibleTextAt({ root, width: 700 })).toBe('6m 40s$0.62');
    expect(visibleTextAt({ root, width: 560 })).toBe('6m 40s');
    expect(visibleTextAt({ root, width: 460 })).toBe('');
  });
});

describe('TimelineModelCell', () => {
  it('shows the glyph of the provider and the model that ran', () => {
    const { container } = render(
      <TimelineModelCell summary={{ text: 'Sonnet 5.5', providers: ['anthropic'] }} />,
    );

    expect(container.querySelector('[data-provider="anthropic"]')).not.toBeNull();
    expect(screen.getByText('Sonnet 5.5')).toBeDefined();
  });

  it('keeps one glyph per provider when a fallback crossed providers', () => {
    const { container } = render(
      <TimelineModelCell
        summary={{
          text: 'Kimi K3 → Sonnet 5.5',
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

  it('keeps only the glyphs under 640px and hands the name to assistive tech', () => {
    const { container } = render(
      <TimelineModelCell summary={{ text: 'Sonnet 5.5', providers: ['anthropic'] }} />,
    );
    const cell = container.firstElementChild;
    if (cell === null) {
      throw new Error('no cell rendered');
    }

    expect(visibleTextAt({ root: cell, width: 700 })).toBe('Sonnet 5.5');
    expect(visibleTextAt({ root: cell, width: 600 })).toBe('');
    expect(screen.getByText('Sonnet 5.5')).toBeDefined();
  });

  it('shows the effort after the model name and hides it with the name under 640px', () => {
    const { container } = render(
      <TimelineModelCell
        summary={{ text: 'Opus 5.5', effort: 'High', providers: ['anthropic'] }}
      />,
    );
    const cell = container.firstElementChild;
    if (cell === null) {
      throw new Error('no cell rendered');
    }

    expect(visibleTextAt({ root: cell, width: 700 })).toBe('Opus 5.5·High');
    expect(visibleTextAt({ root: cell, width: 600 })).toBe('');
    expect(cell.querySelector('[data-routing-part="detail"]')?.textContent).toBe('High');
  });

  it('prints no effort for a fallback chain', () => {
    const { container } = render(
      <TimelineModelCell
        summary={{ text: 'Opus 5.5 → Kimi K3', providers: ['anthropic', 'moonshot'] }}
      />,
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
    expect(tooltipTextOf({ element: time })).toBe('Longer than usual. Active 11m. Cost $2.31');
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
