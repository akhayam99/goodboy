import { screen, waitFor, within } from '@testing-library/react';

export const railOf = (): HTMLElement => screen.getByRole('navigation', { name: 'Sections' });

export const sectionRow = (name: RegExp): HTMLElement =>
  within(railOf()).getByRole('button', { name });

export const findSectionRow = (name: RegExp): Promise<HTMLElement> =>
  waitFor(() => sectionRow(name), { timeout: 4_000 });

export const sectionNames = (): ReadonlyArray<string> =>
  within(railOf())
    .getAllByRole('button')
    .filter((button) => button.closest('[data-slot="branch-rail-files"]') === null)
    .map((button) => (button.textContent ?? '').replace(/[\d/-]+$/, '').trim());
