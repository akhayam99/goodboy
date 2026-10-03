import { expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  type Row,
  WAIT,
  band,
  both,
  clickButton,
  heading,
  openPalette,
  settle,
  useAppStore,
  visible,
} from './harness';

let clipboardWrites: Array<string> = [];

export const FOOTER_AND_VERB_ROWS: ReadonlyArray<Row> = [
  {
    name: 'palette verb: Copy worktree path',
    covers: ['palette:Copy worktree path'],
    open: async () => {
      clipboardWrites = [];
      vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text: string) => {
        clipboardWrites.push(text);
      });
      await openPalette(/^Copy worktree path$/);
      const all = screen.queryByRole('option', { name: 'Copy all paths' });
      if (all !== null) {
        fireEvent.mouseDown(all);
        await settle();
      }
    },
    lands: async () => {
      await waitFor(() => expect(clipboardWrites).toHaveLength(1), WAIT);
      expect(clipboardWrites[0]?.trim()).not.toBe('');
    },
  },
  ...(['Copy title', 'Copy branch name', 'Copy PR link'] as const).map((label): Row => ({
    name: `palette verb: ${label}`,
    covers: [`palette:${label}`],
    open: async () => {
      clipboardWrites = [];
      vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text: string) => {
        clipboardWrites.push(text);
      });
      await openPalette(new RegExp(`^${label}$`));
    },
    lands: async () => {
      await waitFor(() => expect(clipboardWrites).toHaveLength(1), WAIT);
      expect(clipboardWrites[0]?.trim()).not.toBe('');
    },
  })),
  {
    name: 'palette verb: Archive',
    covers: ['palette:Archive'],
    open: async () => {
      useAppStore.setState({ archiveTask: async () => undefined } as never);
      await openPalette(/^Archive$/);
    },
    lands: async () => expect(await screen.findByText('Session archived', {}, WAIT)).toBeDefined(),
  },
  {
    name: 'palette verb: Delete asks first',
    covers: ['palette:Delete…'],
    open: () => openPalette(/^Delete/),
    lands: async () => expect(await screen.findByText('Delete session?', {}, WAIT)).toBeDefined(),
  },
  {
    name: 'palette: Open a folder',
    covers: ['openStudio', 'studio:addWorkspace', 'openAddWorkspace', 'palette:Open a folder'],
    open: () => openPalette(/^Open a folder/, 'Open a folder'),
    lands: () => band('Add workspace'),
  },
  {
    name: 'palette: Start a new project',
    covers: ['palette:Start a new project'],
    open: () => openPalette(/^Start a new project/, 'Start a new project'),
    lands: () => band('Start a new project'),
  },
  {
    name: 'footer: inbox',
    covers: ['openInbox', 'studio:inbox'],
    open: () => clickButton(/^Open the inbox/),
    lands: () => heading('All items'),
  },
  {
    name: 'footer: workflow library',
    covers: ['openWorkflows', 'studio:workflow'],
    open: () => clickButton(/^Open the workflow library/),
    lands: () => visible('button', 'New workflow'),
  },
  {
    name: 'footer: impact',
    covers: ['openImpact', 'studio:impact'],
    open: () => clickButton(/^Open Impact/),
    lands: () => band('Impact'),
  },
  {
    name: 'footer: settings',
    covers: ['openSettings', 'studio:settings', 'settings:general'],
    open: () => clickButton(/^Open settings/),
    lands: () => heading('Appearance'),
  },
  {
    name: 'footer: integrations',
    covers: ['openIntegration', 'integrations'],
    open: () => clickButton(/^Link your first integration/),
    lands: () => visible('dialog', 'Integrations'),
  },
  {
    name: 'footer: goodboy chip to the changelog',
    covers: ['openChangelog', 'studio:changelog'],
    open: async () => {
      await clickButton(/^Goodboy: setup/);
      await clickButton(/^What's new/);
    },
    lands: () => heading(/^Goodboy \d/),
  },
  {
    name: 'top bar: spend',
    covers: ['openSpend', 'studio:impact'],
    open: () => clickButton(/^Spent today/),
    lands: () => heading('Spend'),
  },
  {
    name: 'top bar: chat',
    covers: ['openStudio', 'studio:chat'],
    open: () => clickButton(/^Chat$/),
    lands: both(
      () => band('Chat'),
      () => heading('New chat'),
    ),
  },
  {
    name: 'top bar: all notifications',
    covers: ['studio:notifications'],
    open: async () => {
      await clickButton(/^Notifications$/);
      await clickButton(/^Open all notifications/);
    },
    lands: () => heading('All notifications'),
  },
  {
    name: 'workspace switcher: workspace settings',
    covers: ['studio:settings', 'scope:workspace'],
    open: async () => {
      await clickButton(/^Switch workspace/);
      await clickButton(/^Workspace settings/);
    },
    lands: () => heading('About you'),
  },
];
