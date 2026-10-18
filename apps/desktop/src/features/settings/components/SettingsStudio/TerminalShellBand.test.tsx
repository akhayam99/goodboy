// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SETTING_TERMINAL_SHELL } from '../../settings';
import { TerminalShellBand } from './TerminalShellBand';

const PWSH = {
  id: 'pwsh',
  kind: 'powerShell',
  label: 'PowerShell 7',
  program: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
  distro: null,
  isDefault: true,
};
const CMD = {
  id: 'cmd',
  kind: 'cmd',
  label: 'Command Prompt',
  program: 'C:\\Windows\\System32\\cmd.exe',
  distro: null,
  isDefault: false,
};
const GIT_BASH = {
  id: 'gitbash',
  kind: 'gitBash',
  label: 'Git Bash',
  program: 'C:\\Program Files\\Git\\bin\\bash.exe',
  distro: null,
  isDefault: false,
};

type ShellsParams = {
  readonly isRescan: boolean;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    terminal_shells_list: ({ isRescan }: ShellsParams) =>
      isRescan ? [PWSH, CMD, GIT_BASH] : [PWSH, CMD],
  });
});

afterEach(cleanup);

describe('TerminalShellBand', () => {
  it('names the automatic shell and saves the one picked', async () => {
    render(<TerminalShellBand />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Shell' }).textContent).toContain(
        'Automatic (PowerShell 7)',
      ),
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Shell' }));
    await userEvent.click(screen.getByRole('option', { name: /Command Prompt/ }));

    await waitFor(() =>
      expect(storySpies.setSetting).toHaveBeenCalledWith(
        expect.anything(),
        SETTING_TERMINAL_SHELL,
        'cmd',
      ),
    );
    expect(screen.getByRole('combobox', { name: 'Shell' }).textContent).toContain('Command Prompt');
  });

  it('finds a shell installed after the app started when asked to look again', async () => {
    render(<TerminalShellBand />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Shell' }).textContent).toContain('Automatic'),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Look for shells again' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Shell' }));

    expect(await screen.findByRole('option', { name: /Git Bash/ })).toBeTruthy();
  });

  it('keeps the old choice and reports the error when saving fails', async () => {
    storySpies.setSetting.mockRejectedValueOnce(new Error('disk full'));
    render(<TerminalShellBand />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Shell' }).textContent).toContain(
        'Automatic (PowerShell 7)',
      ),
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Shell' }));
    await userEvent.click(screen.getByRole('option', { name: /Command Prompt/ }));

    await waitFor(() =>
      expect(useAppStore.getState().notifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: "Couldn't save the terminal shell" }),
        ]),
      ),
    );
    expect(screen.getByRole('combobox', { name: 'Shell' }).textContent).toContain('Automatic');
  });

  it('warns when the saved shell is gone and falls back to the automatic one', async () => {
    storySpies.getSetting.mockImplementation(async (_db: unknown, key: string) =>
      key === SETTING_TERMINAL_SHELL ? 'wsl:Ubuntu' : null,
    );
    render(<TerminalShellBand />);

    expect(
      await screen.findByText(
        'wsl:Ubuntu is not on this computer any more. New terminals use Automatic (PowerShell 7) until you pick another.',
      ),
    ).toBeTruthy();
  });
});
