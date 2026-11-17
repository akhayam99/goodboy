// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { MOCK_SCENES } from '../../..';
import { SHELL_RAIL_PLACES_SCENES } from './places';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = () => {
  const Scene = SHELL_RAIL_PLACES_SCENES['shell-rail'];
  return render(<Scene />);
};

type RailParams = {
  readonly name: string;
};

const railOf = ({ name }: RailParams) => screen.getByRole('navigation', { name });

describe('the shell rail scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(SHELL_RAIL_PLACES_SCENES)).toEqual(['shell-rail']);
    expect(MOCK_SCENES['shell-rail']).toBe(SHELL_RAIL_PLACES_SCENES['shell-rail']);
  });

  it('shows the wide rail with words and the narrow rail without them', () => {
    mount();
    const wide = railOf({ name: 'Places, Wide' });
    const narrow = railOf({ name: 'Places, Narrow' });
    expect(within(wide).getByText('Workflows')).toBeDefined();
    expect(within(narrow).queryByText('Workflows')).toBeNull();
    expect(within(narrow).getByRole('button', { name: 'Workflows' })).toBeDefined();
  });

  it('keeps the Board current with its count and the Tasks dot in its name', () => {
    mount();
    const wide = railOf({ name: 'Places, Wide' });
    const board = within(wide).getByRole('button', { name: 'Board, 3 need you' });
    expect(board.getAttribute('aria-current')).toBe('page');
    expect(within(wide).getByRole('button', { name: 'Tasks, new for you' })).toBeDefined();
  });

  it('moves the current place in both forms when a place is clicked', () => {
    mount();
    fireEvent.click(
      within(railOf({ name: 'Places, Narrow' })).getByRole('button', { name: 'Chat' }),
    );
    expect(
      within(railOf({ name: 'Places, Wide' }))
        .getByRole('button', { name: 'Chat' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      within(railOf({ name: 'Places, Wide' }))
        .getByRole('button', { name: 'Board, 3 need you' })
        .getAttribute('aria-current'),
    ).toBeNull();
  });

  it('presses one tool at a time and lets it go on a second click', () => {
    mount();
    const tools = railOf({ name: 'Tools' });
    const terminal = within(tools).getByRole('button', { name: 'Terminal' });
    const browser = within(tools).getByRole('button', { name: 'Browser' });
    expect(terminal.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(browser);
    expect(browser.getAttribute('aria-pressed')).toBe('true');
    expect(terminal.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(browser);
    expect(browser.getAttribute('aria-pressed')).toBe('false');
  });

  it('walks the places with the arrow keys', () => {
    mount();
    const wide = railOf({ name: 'Places, Wide' });
    const newSession = within(wide).getByRole('button', { name: 'New' });
    newSession.focus();
    fireEvent.keyDown(newSession, { key: 'ArrowDown' });
    const board = within(wide).getByRole('button', { name: 'Board, 3 need you' });
    expect(document.activeElement).toBe(board);
    fireEvent.keyDown(board, { key: 'End' });
    expect(document.activeElement).toBe(within(wide).getByRole('button', { name: 'Settings' }));
  });
});
