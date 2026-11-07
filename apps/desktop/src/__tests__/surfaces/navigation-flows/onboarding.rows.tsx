import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getSetting } from '@goodboy/db';
import { storySpies, storySqlite } from '../../../store/storyHarness';
import { type Row, WAIT, click, heading, settle, useAppStore, visible } from './harness';
import { CLONED_FOLDER, LEDGER_CORE_FOLDER } from './onboarding.fixtures';

const WIZARD_KEY = 'onboarding.wizard';

const savedWizard = (): Promise<string | null> => getSetting(storySqlite(), WIZARD_KEY);

const wizardDialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Goodboy setup' });

const stepOf = (): string | null => wizardDialog().getAttribute('data-step');

const onStep = async (step: string): Promise<void> => {
  await waitFor(() => {
    expect(stepOf()).toBe(step);
    expect(screen.queryByTestId('wizard-step-outgoing')).toBeNull();
  }, WAIT);
};

const pressEscape = async (): Promise<void> => {
  await userEvent.setup().keyboard('{Escape}');
  await settle(10);
};

const getStarted = async (): Promise<void> => {
  await heading('Welcome to Goodboy');
  await onStep('agents');
};

const continueFromAgents = async (): Promise<void> => {
  const next = await screen.findByRole('button', { name: /^Continue/ });
  await waitFor(() => expect(next.hasAttribute('disabled')).toBe(false), WAIT);
  await click(next);
  await onStep('workspace');
};

const createHarborline = async (): Promise<void> => {
  await click(await screen.findByRole('button', { name: /^Choose folder/ }));
  const folders = within(await screen.findByRole('list', { name: 'Projects' }, WAIT));
  expect(folders.getByText('ledger-core')).toBeDefined();
  const name = screen.getByRole('textbox', { name: 'Workspace name' });
  expect(name).toHaveProperty('value', 'Harborline');
  await click(screen.getByRole('button', { name: /^Create workspace/ }));
  await onStep('first-session');
};

const reachFirstSession = async (): Promise<void> => {
  await getStarted();
  await continueFromAgents();
  await createHarborline();
};

const closed = async (): Promise<void> => {
  await waitFor(
    () => expect(screen.queryByRole('dialog', { name: 'Goodboy setup' })).toBeNull(),
    WAIT,
  );
  await waitFor(() => expect(document.querySelector('[data-side-column]')).not.toBeNull(), WAIT);
};

export const ONBOARDING_ROWS: ReadonlyArray<Row> = [
  {
    name: 'first launch: an empty database opens the Agents step under the Welcome heading',
    covers: ['onboarding:welcome'],
    seed: 'empty',
    open: async () => undefined,
    lands: async () => {
      await heading('Welcome to Goodboy');
      await visible('button', /^Continue/);
      expect(stepOf()).toBe('agents');
      expect(useAppStore.getState().workspaces).toEqual([]);
      expect(await savedWizard()).toBeNull();
    },
  },
  {
    name: 'first launch: Esc steps back one step and never ends setup',
    covers: ['onboarding:escape'],
    seed: 'empty',
    open: async () => {
      await pressEscape();
      expect(stepOf()).toBe('agents');
      await continueFromAgents();
      await pressEscape();
    },
    lands: async () => {
      await onStep('agents');
      await pressEscape();
      expect(screen.getByRole('dialog', { name: 'Goodboy setup' })).toBeDefined();
      expect(stepOf()).toBe('agents');
      expect(await savedWizard()).toBeNull();
    },
  },
  {
    name: 'first launch: the Workspace step lists likely folders and reads them on Look',
    covers: ['onboarding:likely-folders'],
    seed: 'empty',
    open: async () => {
      await getStarted();
      await continueFromAgents();
      const list = within(await screen.findByRole('list', { name: 'Likely folders' }, WAIT));
      await click(list.getByRole('checkbox', { name: 'Look in ~/Code' }));
      expect(storySpies.tauriInvoke.mock.calls.some(([name]) => name === 'scan_child_repos')).toBe(
        false,
      );
      await click(screen.getByRole('button', { name: 'Look in 1 folder' }));
    },
    lands: async () => {
      const folders = within(await screen.findByRole('list', { name: 'Projects' }, WAIT));
      folders.getByText('notify-relay');
      folders.getByText('payments-api');
      expect(screen.getByRole('textbox', { name: 'Workspace name' })).toHaveProperty(
        'value',
        'Code',
      );
    },
  },
  {
    name: 'first launch: the Workspace step clones a GitHub repository and adds it like a ticked folder',
    covers: ['onboarding:clone'],
    seed: 'empty',
    open: async () => {
      await getStarted();
      await continueFromAgents();
      await click(await screen.findByRole('button', { name: 'Clone it' }, WAIT));
      fireEvent.change(screen.getByLabelText('Repository'), {
        target: { value: 'https://github.com/Northwind/ledger-core' },
      });
      await click(screen.getByRole('button', { name: 'Clone' }));
    },
    lands: async () => {
      const folders = within(await screen.findByRole('list', { name: 'Projects' }, WAIT));
      folders.getByText('ledger-core');
      expect(screen.getByRole('textbox', { name: 'Workspace name' })).toHaveProperty(
        'value',
        'Ledger core',
      );
      const probe = storySpies.tauriInvoke.mock.calls.find(([name]) => name === 'clone_probe');
      expect(probe?.[1]).toEqual({
        url: 'https://github.com/Northwind/ledger-core.git',
        destination: CLONED_FOLDER,
      });
    },
  },
  {
    name: 'first launch: the last step draws the real Start a run field over ledger-core',
    covers: ['onboarding:first-session'],
    seed: 'empty',
    open: reachFirstSession,
    lands: async () => {
      const field = await screen.findByRole('textbox', { name: 'Start a run' });
      expect(field).toHaveProperty('value', expect.stringContaining('Explain how ledger-core'));
      expect(screen.getByRole('region', { name: 'Start a run' })).toBeDefined();
      expect(screen.queryByRole('button', { name: /^How: / })).toBeNull();
      expect(screen.getByRole('group', { name: 'Run settings' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Limit: none' })).toBeNull();
      expect(screen.queryByText('reads only')).toBeNull();
    },
  },
  {
    name: 'first launch: Harborline with ledger-core reaches the board and saves wizardDone',
    covers: ['onboarding:first-run', 'onboarding:wizardDone'],
    seed: 'empty',
    open: async () => {
      await reachFirstSession();
      await click(await screen.findByRole('button', { name: /^Skip/ }));
    },
    lands: async () => {
      await closed();
      const state = useAppStore.getState();
      expect(state.workspaces.map((workspace) => workspace.name)).toEqual(['Harborline']);
      expect(state.projects.map((project) => project.rootPath)).toEqual([LEDGER_CORE_FOLDER]);
      expect(await savedWizard()).toBe('done');
    },
  },
  {
    name: 'setup card: counts the three steps and resumes from the open step while setup is paused',
    covers: ['onboarding:menu-count'],
    seed: 'empty',
    open: async () => {
      await getStarted();
      await continueFromAgents();
      await createHarborline();
      await click(await screen.findByRole('button', { name: 'Set up later' }));
      await closed();
    },
    lands: async () => {
      const setup = within(await screen.findByRole('region', { name: 'Setup' }));
      expect(setup.getByText('Setup · 2 of 3')).toBeDefined();
      expect(setup.getAllByRole('listitem')).toHaveLength(2);
      expect(setup.getByRole('meter').getAttribute('aria-valuenow')).toBe('2');
      expect(setup.getByRole('button', { name: 'Start First session' })).toBeDefined();
      expect(await savedWizard()).toBe('later');
    },
  },
];
