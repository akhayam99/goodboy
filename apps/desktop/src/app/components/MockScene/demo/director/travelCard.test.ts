// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { travelCard } from './travelCard';

const SELECTOR = 'article[data-select-id="mock-session-ledger"]';

type Travel = {
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
};

type RectParams = {
  readonly left: number;
  readonly width: number;
};

type BoardParams = {
  readonly width: number;
};

const rectAt = ({ left, width }: RectParams): DOMRect =>
  DOMRect.fromRect({ x: left, y: 40, width, height: 96 });

const setupBoard = ({ width }: BoardParams) => {
  const running = document.createElement('div');
  const needsYou = document.createElement('div');
  const card = document.createElement('article');
  card.dataset.selectId = 'mock-session-ledger';
  card.textContent = 'Reconcile the Monday ledger';
  card.getBoundingClientRect = () =>
    rectAt({ left: card.parentElement === running ? 0 : 320, width });
  running.append(card);
  document.body.append(running, needsYou);
  const travels: Travel[] = [];
  const animate = vi.fn(() => {
    const travel: Travel = { onfinish: null, oncancel: null };
    travels.push(travel);
    return travel;
  });
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
  return { card, needsYou, travels, animate };
};

const ghosts = () => document.querySelectorAll('article[aria-hidden="true"]');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('travelCard', () => {
  it('flies a copy from the old column to the new one, then removes it', () => {
    const { card, needsYou, travels, animate } = setupBoard({ width: 280 });
    const apply = vi.fn(() => needsYou.append(card));

    travelCard({ selector: SELECTOR, apply });

    expect(apply).toHaveBeenCalledTimes(1);
    expect(ghosts()).toHaveLength(0);

    vi.advanceTimersToNextFrame();

    expect(ghosts()).toHaveLength(1);
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'translate(0, 0)' }, { transform: 'translate(320px, 0px)' }],
      expect.objectContaining({ duration: expect.any(Number) }),
    );

    travels[0]?.onfinish?.();

    expect(ghosts()).toHaveLength(0);
  });

  it('changes the board in place when nothing is laid out', () => {
    const { card, needsYou, animate } = setupBoard({ width: 0 });
    const apply = vi.fn(() => needsYou.append(card));

    travelCard({ selector: SELECTOR, apply });
    vi.advanceTimersToNextFrame();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
    expect(ghosts()).toHaveLength(0);
  });

  it('changes the board in place under reduced motion', () => {
    const { card, needsYou, animate } = setupBoard({ width: 280 });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const apply = vi.fn(() => needsYou.append(card));

    travelCard({ selector: SELECTOR, apply });
    vi.advanceTimersToNextFrame();

    expect(apply).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
  });

  it('applies the change when the card is not on screen', () => {
    const apply = vi.fn();

    travelCard({ selector: SELECTOR, apply });

    expect(apply).toHaveBeenCalledTimes(1);
  });
});
