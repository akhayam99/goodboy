import { expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { APP_SECTIONS } from '../../../features/settings/components/SettingsStudio/appSections';
import {
  type Row,
  both,
  click,
  clickButton,
  clickFirstButton,
  heading,
  lens,
  openCrumb,
  visible,
} from './harness';

const openSettingsHome = async (): Promise<HTMLElement> => {
  await clickButton('Settings');
  return screen.findByRole('list', { name: 'App pages' });
};

const openSettingsRail = async (label: RegExp): Promise<void> => {
  const appPages = await openSettingsHome();
  await click(within(appPages).getByRole('button', { name: /^General/ }));
  const rail = await screen.findByRole('navigation', { name: 'Settings scopes' });
  await click(within(rail).getAllByRole('button', { name: label })[0] ?? rail);
};

export const SETTINGS_AND_MOUNT_ROWS: ReadonlyArray<Row> = [
  {
    name: 'settings home',
    covers: ['openSettings', 'scope:home'],
    open: async () => {
      await openSettingsHome();
    },
    lands: both(
      () => heading('Settings'),
      () => visible('list', 'Integrations pages'),
    ),
  },
  {
    name: 'settings home card: storage',
    covers: ['openSettings', 'scope:home', 'settings:storage'],
    open: async () => {
      const appPages = await openSettingsHome();
      await click(within(appPages).getByRole('button', { name: /^Storage/ }));
    },
    lands: () => visible('region', 'Worktrees'),
  },
  {
    name: 'settings crumb back to the home',
    covers: ['openSettings', 'scope:home'],
    open: async () => {
      await openSettingsRail(/^Shortcuts/);
      const trails = await screen.findAllByRole('navigation', { name: 'Breadcrumb' });
      const settings = trails.flatMap((trail) =>
        within(trail).queryAllByRole('button', { name: 'Settings' }),
      );
      await click(settings[0] ?? trails[0]!);
    },
    lands: () => visible('list', 'App pages'),
  },
  ...APP_SECTIONS.map((section): Row => ({
    name: `settings rail: ${section.label}`,
    covers: ['openSettings', 'scope:app', `settings:${section.id}`],
    open: () => openSettingsRail(new RegExp(`^${section.label}`)),
    lands: () => heading(section.id === 'general' ? 'Appearance' : section.label),
  })),
  {
    name: 'settings rail: backup export',
    covers: ['openSettings', 'settings:backup'],
    open: () => openSettingsRail(/^Backup/),
    lands: both(
      () => heading('Export'),
      () => heading('Import'),
    ),
  },
  {
    name: 'settings rail: storage worktrees',
    covers: ['openSettings', 'settings:storage'],
    open: () => openSettingsRail(/^Storage/),
    lands: () => visible('region', 'Worktrees'),
  },
  {
    name: 'settings rail: workspace',
    covers: ['openSettings', 'scope:workspace'],
    open: () => openSettingsRail(/^Workspace/),
    lands: () => visible('textbox', 'Workspace name'),
  },
  {
    name: 'settings rail: providers and models',
    covers: ['openSettings', 'openProviders', 'scope:providers'],
    open: () => openSettingsRail(/^Providers & models/),
    lands: () => visible('region', 'Providers'),
  },
  {
    name: 'settings rail: one provider page',
    covers: ['openSettings', 'scope:providers', 'settings:provider'],
    open: async () => {
      await openSettingsRail(/^Providers & models/);
      const rail = await screen.findByRole('list', { name: 'Providers & models settings' });
      await click(within(rail).getByRole('button', { name: /Claude/ }));
    },
    lands: () => heading('Claude'),
  },
  {
    name: 'settings rail: integrations',
    covers: ['openSettings', 'scope:tools'],
    open: () => openSettingsRail(/^Integrations/),
    lands: () => visible('list', 'Integrations settings'),
  },
  {
    name: 'mount row menu: scripts',
    covers: ['navigate', 'lens:scripts'],
    open: async () => {
      await clickFirstButton(/ on .+ actions$/);
      await click(await screen.findByRole('menuitem', { name: /^Open scripts/ }));
    },
    lands: both(lens('scripts'), () => heading('Scripts')),
  },
  {
    name: 'mount row menu: terminal',
    covers: ['openMountTerminal', 'lens:terminal'],
    open: async () => {
      await clickFirstButton(/ on .+ actions$/);
      await click(await screen.findByRole('menuitem', { name: /^Open terminal/ }));
    },
    lands: lens('terminal'),
  },
  {
    name: 'linked issue chip',
    covers: ['openExternalTaskLens'],
    seed: 'issue',
    open: () => clickButton(/^Open HBL-377/),
    lands: async () => expect((await screen.findAllByText(/HBL-377/)).length).toBeGreaterThan(0),
  },
  {
    name: 'back arrow returns to the overview',
    covers: ['back'],
    open: async () => {
      await openCrumb(/^Diff/);
      await clickButton(/^Back/);
    },
    lands: lens(null),
  },
  {
    name: 'forward arrow returns to the diff',
    covers: ['back', 'forward'],
    open: async () => {
      await openCrumb(/^Diff/);
      await clickButton(/^Back/);
      await clickButton(/^Forward/);
    },
    lands: both(lens('files'), () => heading('Diff')),
  },
];
