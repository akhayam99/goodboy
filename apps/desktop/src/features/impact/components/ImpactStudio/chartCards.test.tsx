// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StackedBar } from './StackedBar';
import { TurnHistogram } from './TurnHistogram';

let clock = 1_800_000_000_000;

beforeEach(() => {
  clock += 60_000;
  vi.useFakeTimers();
  vi.setSystemTime(clock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type RestParams = {
  readonly element: Element | null | undefined;
};

const restOn = ({ element }: RestParams): void => {
  if (element === null || element === undefined) {
    throw new Error('no element to hover');
  }
  fireEvent.pointerEnter(element, { pointerType: 'mouse' });
  act(() => {
    vi.advanceTimersByTime(500);
  });
};

describe('StackedBar', () => {
  it('opens one card for the whole bar with a row per segment', () => {
    const { container } = render(
      <StackedBar
        heading="Review throughput"
        segments={[
          { key: 'fast', tone: 'success', share: 50, label: 'Under one hour', value: '2' },
          { key: 'day', tone: 'warning', share: 50, label: 'Within one day', value: '2' },
          { key: 'slow', tone: 'danger', share: 0, label: 'Over one day', value: '0' },
        ]}
      />,
    );

    restOn({ element: container.firstElementChild });

    const card = within(screen.getByTestId('fact-card'));
    expect(card.getByText('Review throughput')).toBeDefined();
    expect(card.getByText('Over one day')).toBeDefined();
    expect(card.getAllByText('50%')).toHaveLength(2);
  });
});

describe('TurnHistogram', () => {
  it('names the turn count, the agents and their share, and marks the median', () => {
    const { container } = render(
      <TurnHistogram
        buckets={[
          { turnCount: 1, agentCount: 1 },
          { turnCount: 2, agentCount: 3 },
        ]}
        median={2}
        maxAgents={3}
      />,
    );

    restOn({ element: container.querySelectorAll('div > div')[2] });

    const card = within(screen.getByTestId('fact-card'));
    expect(card.getByText('2 turns')).toBeDefined();
    expect(card.getByText('3')).toBeDefined();
    expect(card.getByText('75%')).toBeDefined();
    expect(card.getByText('Median turn count')).toBeDefined();
  });
});
