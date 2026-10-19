import { screen, waitFor, within } from '@testing-library/react';

export const railOf = (): HTMLElement => {
  const list = document.querySelector<HTMLElement>('[data-worktree-entries]');
  if (list === null) {
    return screen.getByRole('list', { name: /pages$/ });
  }
  return list;
};

export const sectionRow = (name: RegExp): HTMLElement =>
  within(railOf()).getByRole('button', { name });

export const findSectionRow = (name: RegExp): Promise<HTMLElement> =>
  waitFor(() => sectionRow(name), { timeout: 4_000 });

export const sectionNames = (): ReadonlyArray<string> =>
  [...railOf().querySelectorAll<HTMLElement>('[data-entry-label]')].map(
    (label) => label.textContent ?? '',
  );
