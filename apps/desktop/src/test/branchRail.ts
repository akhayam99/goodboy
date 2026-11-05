import { screen, waitFor, within } from '@testing-library/react';

export const railOf = (): HTMLElement => screen.getByRole('tablist', { name: 'Branch pages' });

export const sectionRow = (name: RegExp): HTMLElement =>
  within(railOf()).getByRole('tab', { name });

export const findSectionRow = (name: RegExp): Promise<HTMLElement> =>
  waitFor(() => sectionRow(name), { timeout: 4_000 });

export const sectionNames = (): ReadonlyArray<string> =>
  [...railOf().querySelectorAll<HTMLElement>('[data-tab-label]')].map(
    (label) => label.textContent ?? '',
  );
