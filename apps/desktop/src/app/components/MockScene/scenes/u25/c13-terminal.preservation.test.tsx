// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: ({ terminalId }: { readonly terminalId: string }) => (
    <div data-testid="terminal-panel" data-terminal={terminalId} />
  ),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_TERMINAL_STUDIO_SCENES } from '../u24/terminal-studio';
import { U25_C13_TERMINAL_SCENES } from './c13-terminal';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const settle = (ms = 150): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, ms)));

const renderTerminal = async (): Promise<void> => {
  const Scene = U25_C13_TERMINAL_SCENES['c13-terminal'];
  render(<Scene />);
  await settle(400);
};

const grid = (): HTMLElement => screen.getByRole('list', { name: 'Terminals' });

describe('Terminal page rows stay reachable from the new list', () => {
  it('keeps Open session for a session group in the tab strip menu, not on the label', async () => {
    await renderTerminal();

    expect(within(grid()).queryByRole('button', { name: /^Open session / })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More on payments-api' }));
    expect(screen.getByRole('menuitem', { name: 'Open session' })).toBeDefined();
  });

  it('drops the group facts (cut C3) and counts the rows of the group beside its label', async () => {
    await renderTerminal();

    expect(within(grid()).queryByText('HBL-412')).toBeNull();
    expect(within(grid()).queryByText(/\+117/)).toBeNull();
    const heading = within(grid()).getByRole('heading', { name: 'Ledger export speed up' });
    expect(heading.closest('li')?.querySelector('[data-list-grid-count]')?.textContent).toBe('2');
  });

  it('moves the header facts to the tab strip menu', async () => {
    await renderTerminal();

    fireEvent.click(screen.getByRole('button', { name: 'More on payments-api' }));
    expect(screen.getByRole('menuitem', { name: 'Copy worktree path' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Open session' })).toBeDefined();
  });

  it('keeps tab rename by double click', async () => {
    await renderTerminal();

    fireEvent.doubleClick(screen.getByRole('tab', { name: 'zsh 2' }));
    expect(screen.getByRole('textbox', { name: 'Rename zsh 2' })).toBeDefined();
  });

  it('keeps the shell surface, where Cmd+F finds in the scrollback', async () => {
    await renderTerminal();

    expect(screen.getByTestId('terminal-panel')).toBeDefined();
  });

  it('keeps Change directory on an idle shell', async () => {
    await renderTerminal();

    fireEvent.click(within(grid()).getByRole('button', { name: 'harborline' }));
    await settle();

    expect(
      screen.getByRole('combobox', { name: 'Change directory in this terminal' }),
    ).toBeDefined();
  });

  it('keeps Restart on a terminal that failed to open', async () => {
    const Scene = U24_TERMINAL_STUDIO_SCENES['terminal-studio'];
    render(<Scene />);
    await settle(400);

    fireEvent.click(
      within(grid()).getByRole('button', { name: 'ledger-core · hl/ledger-rounding' }),
    );
    await settle();

    expect(screen.getByRole('button', { name: 'Restart shell' })).toBeDefined();
  });
});
