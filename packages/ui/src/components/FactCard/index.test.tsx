// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { registerEscapeLayer } from '../../escape';
import { FactCard } from '.';
import { factCardSentence } from './factCardSentence';
import type { FactCardSpec } from './types';

const LIMITS: FactCardSpec = {
  title: 'Northwind limits',
  state: { tone: 'warning', words: 'Near the 5 hour limit' },
  facts: [
    { label: '5 hours', value: '82% used', note: 'resets 16:40', tone: 'warning' },
    { label: 'Week', value: '31% used', note: 'resets Fri' },
  ],
  footnote: 'Updated 14:02',
};

const OTHER: FactCardSpec = {
  title: 'payments-api',
  sub: 'checks',
  facts: [{ label: 'Took', value: '1m 32s' }],
};

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

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const hover = ({ element }: { readonly element: HTMLElement }): void => {
  fireEvent.pointerEnter(element, { pointerType: 'mouse' });
};

const unhover = ({ element }: { readonly element: HTMLElement }): void => {
  fireEvent.pointerLeave(element, { pointerType: 'mouse' });
};

const focusByKeyboard = ({ element }: { readonly element: HTMLElement }): void => {
  act(() => {
    element.focus();
  });
};

const cardNode = (): HTMLElement | null => screen.queryByTestId('fact-card');

type RenderParams = {
  readonly card?: FactCardSpec;
  readonly isTapOpen?: boolean;
  readonly isFocusRested?: boolean;
};

const renderCard = ({
  card = LIMITS,
  isTapOpen = false,
  isFocusRested = false,
}: RenderParams = {}) => {
  render(
    <FactCard card={card} isTapOpen={isTapOpen} isFocusRested={isFocusRested}>
      <button type="button">Limits</button>
    </FactCard>,
  );
  return screen.getByRole('button', { name: 'Limits' });
};

describe('FactCard', () => {
  it('opens after 500 ms of rest and not before', () => {
    const trigger = renderCard();

    hover({ element: trigger });
    advance(499);
    expect(cardNode()).toBeNull();
    advance(1);

    expect(cardNode()?.textContent).toContain('Northwind limits');
  });

  it('keeps the card for 180 ms of grace after the pointer leaves', () => {
    const trigger = renderCard();
    hover({ element: trigger });
    advance(500);

    unhover({ element: trigger });
    advance(179);
    expect(cardNode()).not.toBeNull();
    advance(1);

    expect(cardNode()).toBeNull();
  });

  it('keeps the card when the pointer comes back inside the grace', () => {
    const trigger = renderCard();
    hover({ element: trigger });
    advance(500);

    unhover({ element: trigger });
    advance(100);
    hover({ element: trigger });
    advance(500);

    expect(cardNode()).not.toBeNull();
  });

  it('opens the next card at once within 300 ms of another closing', () => {
    render(
      <>
        <FactCard card={LIMITS}>
          <button type="button">First</button>
        </FactCard>
        <FactCard card={OTHER}>
          <button type="button">Second</button>
        </FactCard>
      </>,
    );
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });
    hover({ element: first });
    advance(500);
    unhover({ element: first });
    advance(180);
    expect(cardNode()).toBeNull();

    advance(100);
    hover({ element: second });

    expect(cardNode()?.textContent).toContain('payments-api');
  });

  it('waits for the rest again once the warm window is over', () => {
    render(
      <>
        <FactCard card={LIMITS}>
          <button type="button">First</button>
        </FactCard>
        <FactCard card={OTHER}>
          <button type="button">Second</button>
        </FactCard>
      </>,
    );
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });
    hover({ element: first });
    advance(500);
    unhover({ element: first });
    advance(180 + 300);

    hover({ element: second });

    expect(cardNode()).toBeNull();
  });

  it('opens at once on keyboard focus and closes on blur', () => {
    const trigger = renderCard();

    focusByKeyboard({ element: trigger });
    expect(cardNode()).not.toBeNull();
    act(() => {
      trigger.blur();
    });

    expect(cardNode()).toBeNull();
  });

  it('opens a keyboard focus after the rest in a list with arrow keys', () => {
    const trigger = renderCard({ isFocusRested: true });

    focusByKeyboard({ element: trigger });
    expect(cardNode()).toBeNull();
    advance(500);

    expect(cardNode()).not.toBeNull();
  });

  it('does not open from the focus a click gives', () => {
    const trigger = renderCard();

    fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
    focusByKeyboard({ element: trigger });
    advance(1000);

    expect(cardNode()).toBeNull();
  });

  it('closes when the pointer goes down on the trigger', () => {
    const trigger = renderCard();
    hover({ element: trigger });
    advance(500);

    fireEvent.pointerDown(trigger, { pointerType: 'mouse' });

    expect(cardNode()).toBeNull();
  });

  it('closes on Escape without swallowing it from the layer beneath', () => {
    const onEscape = vi.fn();
    const unregister = registerEscapeLayer(onEscape);
    const trigger = renderCard();
    focusByKeyboard({ element: trigger });

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(cardNode()).toBeNull();
    expect(onEscape).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('closes when the page scrolls', () => {
    const trigger = renderCard();
    hover({ element: trigger });
    advance(500);

    fireEvent.scroll(window);

    expect(cardNode()).toBeNull();
  });

  it('never opens for a touch, and the tap reaches the trigger', () => {
    const onClick = vi.fn();
    render(
      <FactCard card={LIMITS}>
        <button type="button" onClick={onClick}>
          Limits
        </button>
      </FactCard>,
    );
    const trigger = screen.getByRole('button', { name: 'Limits' });

    fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    fireEvent.click(trigger);
    advance(1000);

    expect(cardNode()).toBeNull();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('opens on a tap for a trigger whose only job is the card, and closes outside', () => {
    const trigger = renderCard({ isTapOpen: true });

    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    fireEvent.click(trigger);
    expect(cardNode()).not.toBeNull();
    fireEvent.pointerDown(document.body, { pointerType: 'touch' });

    expect(cardNode()).toBeNull();
  });

  it('closes a tap-opened card on the next tap of its trigger', () => {
    const trigger = renderCard({ isTapOpen: true });
    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    fireEvent.click(trigger);

    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    fireEvent.click(trigger);

    expect(cardNode()).toBeNull();
  });

  it('does not open while suppressed and closes when it becomes suppressed', () => {
    const { rerender } = render(
      <FactCard card={LIMITS} isSuppressed>
        <button type="button">Limits</button>
      </FactCard>,
    );
    const trigger = screen.getByRole('button', { name: 'Limits' });
    hover({ element: trigger });
    advance(500);
    expect(cardNode()).toBeNull();

    rerender(
      <FactCard card={LIMITS}>
        <button type="button">Limits</button>
      </FactCard>,
    );
    hover({ element: trigger });
    advance(500);
    expect(cardNode()).not.toBeNull();
    rerender(
      <FactCard card={LIMITS} isSuppressed>
        <button type="button">Limits</button>
      </FactCard>,
    );

    expect(cardNode()).toBeNull();
  });

  it('reads one sentence from its data through a node that is always there', () => {
    const trigger = renderCard();

    const sentence = document.getElementById(trigger.getAttribute('aria-describedby') ?? '');
    expect(sentence?.textContent).toBe(
      'Northwind limits. Near the 5 hour limit. 5 hours, 82% used, resets 16:40. Week, 31% used, resets Fri. Updated 14:02.',
    );
    hover({ element: trigger });
    advance(500);
    expect(cardNode()?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keeps the trigger own description next to the sentence', () => {
    render(
      <FactCard card={LIMITS}>
        <button type="button" aria-describedby="own-hint">
          Limits
        </button>
      </FactCard>,
    );

    const ids = screen.getByRole('button').getAttribute('aria-describedby')?.split(' ');
    expect(ids?.[0]).toBe('own-hint');
    expect(ids).toHaveLength(2);
  });

  it('keeps the trigger own handlers', () => {
    const onFocus = vi.fn();
    const onClick = vi.fn();
    render(
      <FactCard card={LIMITS}>
        <button type="button" onFocus={onFocus} onClick={onClick}>
          Limits
        </button>
      </FactCard>,
    );
    const trigger = screen.getByRole('button');

    focusByKeyboard({ element: trigger });
    fireEvent.click(trigger);

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows a forced open card without any hover', () => {
    render(
      <FactCard card={LIMITS} isOpen>
        <button type="button">Limits</button>
      </FactCard>,
    );

    expect(cardNode()?.textContent).toContain('82% used');
  });

  it('refuses more than six facts and names the card', () => {
    const seven: FactCardSpec = {
      title: 'ledger-core',
      facts: Array.from({ length: 7 }, (_, index) => ({ label: `Row ${index}`, value: 'x' })),
    };
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderCard({ card: seven })).toThrow(/FactCard "ledger-core" sent 7 facts/);
    quiet.mockRestore();
  });

  it('shows the first six facts in a production build', () => {
    vi.stubEnv('PROD', true);
    const seven: FactCardSpec = {
      title: 'ledger-core',
      facts: Array.from({ length: 7 }, (_, index) => ({ label: `Row ${index}`, value: 'x' })),
    };

    const trigger = renderCard({ card: seven });
    hover({ element: trigger });
    advance(500);

    expect(cardNode()?.querySelectorAll('dt')).toHaveLength(6);
    vi.unstubAllEnvs();
  });
});

describe('factCardSentence', () => {
  it('puts the sub next to the title and skips what is missing', () => {
    expect(factCardSentence({ card: OTHER })).toBe('payments-api checks. Took, 1m 32s.');
  });

  it('draws no empty facts grid for a card with only a state', () => {
    render(
      <FactCard
        isOpen
        card={{
          title: 'Repositories',
          state: { tone: 'neutral', words: '1 repo, all current' },
          facts: [],
        }}
      >
        <button type="button">trigger</button>
      </FactCard>,
    );

    expect(cardNode()?.querySelector('dl')).toBeNull();
    expect(cardNode()?.textContent).toContain('1 repo, all current');
  });

  it('does not double a full stop that is already there', () => {
    expect(
      factCardSentence({
        card: { title: 'Run', facts: [{ label: 'Result', value: 'Passed.' }] },
      }),
    ).toBe('Run. Result, Passed.');
  });
});
