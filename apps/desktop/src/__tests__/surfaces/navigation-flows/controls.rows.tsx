import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FOCUS_RING } from '@goodboy/ui';
import { type Row, WAIT, clickButton, settingsColumn, settle } from './harness';

const MOST_TABS = 60;
const FOCUS_RING_TOKENS = FOCUS_RING.split(' ');

const wearsFocusRing = (element: Element): boolean => {
  const own = (element.getAttribute('class') ?? '').split(' ');
  return FOCUS_RING_TOKENS.every((token) => own.includes(token));
};

const topBar = (): HTMLElement => {
  const bar = document.querySelector<HTMLElement>('[data-top-bar]');
  expect(bar).not.toBeNull();
  return bar as HTMLElement;
};

const tabAcross = async (bar: HTMLElement): Promise<ReadonlyArray<Element>> => {
  const first = bar.querySelector<HTMLElement>('button');
  expect(first).not.toBeNull();
  first?.focus();
  const user = userEvent.setup();
  const stops: Element[] = [document.activeElement as Element];
  for (let step = 0; step < MOST_TABS; step += 1) {
    await user.tab();
    const active = document.activeElement;
    if (active === null || !bar.contains(active)) {
      break;
    }
    stops.push(active);
  }
  return stops;
};

export const CONTROLS_ROWS: ReadonlyArray<Row> = [
  {
    name: 'top bar: Tab walks the bar from the history arrows to the bell and every control wears the shared focus ring',
    covers: [],
    open: async () => {
      await screen.findByRole('button', { name: /^Search \(/ });
      await settle();
    },
    lands: async () => {
      const stops = await tabAcross(topBar());
      const named = (predicate: (stop: Element) => boolean): Element => {
        const found = stops.find(predicate);
        expect(found).toBeDefined();
        return found as Element;
      };
      const arrows = stops.filter((stop) => stop.hasAttribute('data-nav-arrow'));
      const search = named((stop) =>
        (stop.getAttribute('aria-label') ?? '').startsWith('Search ('),
      );
      const bell = named((stop) =>
        (stop.getAttribute('aria-label') ?? '').startsWith('Notifications'),
      );

      expect(stops.length).toBeGreaterThanOrEqual(5);
      expect(arrows.map((arrow) => arrow.getAttribute('data-nav-arrow'))).toEqual([
        'back',
        'forward',
      ]);
      expect(stops.indexOf(arrows[0] as Element)).toBeLessThan(stops.indexOf(search));
      expect(stops.indexOf(search)).toBeLessThan(stops.indexOf(bell));
      for (const control of [...arrows, bell]) {
        expect(wearsFocusRing(control)).toBe(true);
      }
    },
  },
  {
    name: 'a settings row: Tab reaches the switch, which carries the shared focus ring and names its setting',
    covers: [],
    open: async () => {
      await clickButton('Settings');
      await settingsColumn();
    },
    lands: async () => {
      const user = userEvent.setup();
      const target = await waitFor(
        () => screen.getByRole('switch', { name: 'Legacy layout' }),
        WAIT,
      );
      const tabbable = [
        ...document.querySelectorAll<HTMLElement>('button, input, [tabindex]'),
      ].filter((element) => !element.hasAttribute('disabled') && element.tabIndex >= 0);
      const before = tabbable[tabbable.indexOf(target) - 1];
      expect(before).toBeDefined();
      before?.focus();
      await user.tab();
      expect(document.activeElement).toBe(target);
      expect(wearsFocusRing(target)).toBe(true);
      expect(target.getAttribute('aria-checked')).not.toBeNull();
    },
  },
];
