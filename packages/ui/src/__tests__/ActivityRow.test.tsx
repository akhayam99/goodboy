// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ActivityMessage } from '../components/ActivityRow/ActivityMessage';
import { ActivityMeta } from '../components/ActivityRow/ActivityMeta';
import { ActivityRow } from '../components/ActivityRow/ActivityRow';
import type { ActivityRowTone } from '../components/ActivityRow/activityRowSpec';

afterEach(cleanup);

const TASK = 'Post one credit per retry in postCredit and applyCredit';

const textOf = (): HTMLElement => screen.getByTestId('activity-row-text');

const cellsOf = (): ReadonlyArray<string | null> =>
  Array.from(screen.getByTestId('activity-meta').children).map((cell) =>
    cell.getAttribute('data-meta-column'),
  );

describe('ActivityRow', () => {
  it('wraps the task to two lines in a rail and keeps the slots on the first line', () => {
    render(
      <ActivityRow density="rail" tone="quiet" ordinal="4" glyph={<span>I</span>} text={TASK} />,
    );

    expect(textOf().className).toContain('line-clamp-2');
    expect(textOf().className).not.toContain('truncate');
    expect(screen.getByTestId('activity-row').className).toContain('items-start');
    expect(screen.getByText('4').className).toContain('h-5');
  });

  it('keeps the task on one line in a feed, centred on the row the surface sizes', () => {
    render(<ActivityRow density="feed" tone="quiet" text={TASK} />);

    expect(textOf().className).toContain('truncate');
    expect(textOf().className).not.toContain('line-clamp-2');
    expect(screen.getByTestId('activity-row').className).toContain('items-center');
  });

  it('carries a tone bar only when the row needs you or broke, never a fill', () => {
    const tones: ReadonlyArray<ActivityRowTone> = [
      'quiet',
      'live',
      'attention',
      'failed',
      'pending',
    ];
    render(
      <>
        {tones.map((tone) => (
          <ActivityRow key={tone} density="feed" tone={tone} text={tone} />
        ))}
      </>,
    );

    const bars = screen.getAllByTestId('tone-bar').map((bar) => bar.getAttribute('data-tone'));
    expect(bars).toEqual(['warning', 'danger']);
    for (const row of screen.getAllByTestId('activity-row')) {
      expect(row.className).not.toMatch(/bg-(warning|danger)/);
    }
  });

  it('mutes the task of work that waits or was stopped, and keeps every other task in the foreground', () => {
    render(
      <>
        <ActivityRow density="rail" tone="pending" text="Queued work" />
        <ActivityRow density="rail" tone="quiet" text="Done work" />
      </>,
    );

    expect(screen.getByText('Queued work').className).toContain('text-muted-foreground');
    expect(screen.getByText('Done work').className).toContain('text-foreground');
  });

  it('gives a wide ordinal slot to a step label and a narrow one to a number', () => {
    render(
      <>
        <ActivityRow density="feed" tone="quiet" ordinal="Step 4" ordinalSlot="wide" text="a" />
        <ActivityRow density="feed" tone="quiet" ordinal="4.2" text="b" />
      </>,
    );

    expect(screen.getByText('Step 4').className).toContain('w-12');
    expect(screen.getByText('4.2').className).toContain('w-6');
  });
});

describe('ActivityMeta', () => {
  it('hides the cost of a run that cost nothing', () => {
    render(<ActivityMeta density="feed" columns={['time', 'cost']} time="3m" costUsd={0} />);

    expect(screen.queryByText('$0')).toBeNull();
    expect(cellsOf()).toEqual(['time', 'cost']);
  });

  it('shows a cost above zero in dollars', () => {
    render(<ActivityMeta density="rail" columns={['cost']} costUsd={0.31} />);

    expect(screen.getByText('$0.31').getAttribute('data-meta-column')).toBe('cost');
  });

  it('keeps every declared column in a feed, empty or not, in one order, so rows line up', () => {
    render(
      <ActivityMeta
        density="feed"
        columns={['time', 'state', 'model']}
        state={null}
        model="Sonnet 5.5"
        time={null}
      />,
    );

    expect(cellsOf()).toEqual(['state', 'model', 'time']);
  });

  it('drops an empty cell in a rail, where the column hugs its content', () => {
    render(<ActivityMeta density="rail" columns={['state', 'time', 'cost']} state="Needs you" />);

    expect(cellsOf()).toEqual(['state']);
  });
});

describe('ActivityMessage', () => {
  it('reads as your words in a bubble with a byline under it in a rail', () => {
    render(
      <ActivityMessage
        density="rail"
        text="Also cover the batch endpoint"
        byline="You · read at turn 6"
        isPending={false}
      />,
    );

    const bubble = screen.getByTestId('activity-message-bubble');
    expect(bubble.textContent).toBe('Also cover the batch endpoint');
    expect(bubble.className).toContain('bg-fill');
    expect(bubble.className).toContain('line-clamp-2');
    screen.getByText('You · read at turn 6');
  });

  it('draws a note not read yet as an outline with its actions', () => {
    render(
      <ActivityMessage
        density="feed"
        text="Keep ledger-core read only"
        byline="You · not read yet"
        isPending
        actions={<button type="button">Remove</button>}
      />,
    );

    const bubble = screen.getByTestId('activity-message-bubble');
    expect(bubble.className).toContain('ring-border');
    expect(bubble.className).not.toContain('bg-fill');
    expect(bubble.className).toContain('truncate');
    expect(screen.getByTestId('activity-message').getAttribute('data-message-pending')).toBe(
      'true',
    );
    screen.getByRole('button', { name: 'Remove' });
  });
});
