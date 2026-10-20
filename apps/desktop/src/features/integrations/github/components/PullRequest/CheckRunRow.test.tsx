// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrCheckRun } from '@goodboy/types';
import { checkCardOf, checkFootnoteOf } from './checkCardOf';
import { CheckRunRow } from './CheckRunRow';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const CHECK: PrCheckRun = {
  name: 'unit tests',
  conclusion: 'failure',
  detailsUrl: 'https://ci.invalid/runs/3?token=abc',
  durationMs: 90_000,
};

describe('checkCardOf', () => {
  it('names the result and the time taken, never the address', () => {
    const card = checkCardOf({ check: CHECK, footnote: checkFootnoteOf({ detailsUrl: 'x' }) });

    expect(card.title).toBe('unit tests');
    expect(card.state).toEqual({ tone: 'danger', words: 'Failed' });
    expect(card.facts).toEqual([{ label: 'Took', value: '1m 30s' }]);
    expect(JSON.stringify(card)).not.toContain('ci.invalid');
  });

  it('drops the time row when the run has no duration', () => {
    const card = checkCardOf({
      check: { ...CHECK, conclusion: 'pending', durationMs: null },
      footnote: 'n',
    });

    expect(card.facts).toEqual([]);
    expect(card.state).toEqual({ tone: 'info', words: 'Running', isRunning: true });
  });

  it('says where a click leads', () => {
    expect(checkFootnoteOf({ detailsUrl: 'https://ci.invalid/runs/3' })).toBe(
      'Click to open the log',
    );
    expect(checkFootnoteOf({ detailsUrl: null })).toBe('Click to open the checks page');
  });
});

describe('CheckRunRow', () => {
  it('opens a card with the result and no URL after a rest on the row', () => {
    render(
      <ul>
        <CheckRunRow check={CHECK} footnote="Click to open the log" onOpen={vi.fn()} />
      </ul>,
    );

    fireEvent.pointerEnter(screen.getByRole('button', { name: /unit tests/ }), {
      pointerType: 'mouse',
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const card = within(screen.getByTestId('fact-card'));
    expect(card.getByText('Failed')).toBeDefined();
    expect(card.getByText('Took')).toBeDefined();
    expect(card.getByText('Click to open the log')).toBeDefined();
    expect(screen.getByTestId('fact-card').textContent).not.toContain('https://');
  });
});
