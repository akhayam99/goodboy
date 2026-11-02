import { screen, within } from '@testing-library/react';

type TabParams = {
  readonly name: RegExp;
};

const stripOf = (): HTMLElement => screen.getByRole('tablist', { name: 'Branch pages' });

export const stripTab = ({ name }: TabParams): HTMLElement =>
  within(stripOf()).getByRole('tab', { name });

export const stripNames = (): ReadonlyArray<string> =>
  within(stripOf())
    .getAllByRole('tab')
    .map((tab) => {
      const text = tab.textContent ?? '';
      const count = tab.querySelector('[data-tab-count]')?.textContent ?? '';
      return text.slice(0, text.length - count.length);
    });
