import { expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  type Row,
  WAIT,
  band,
  both,
  click,
  clickButton,
  heading,
  openPalette,
  settle,
  useAppStore,
  visible,
} from './harness';

let clipboardWrites: Array<string> = [];

const doorIn = (name: string): HTMLElement => {
  const door = document.querySelector<HTMLElement>(
    `[data-side-column] [data-column-door="${name}"]`,
  );
  expect(door).not.toBeNull();
  return door as HTMLElement;
};

export const COLUMN_DOOR_ROWS: ReadonlyArray<Row> = [
  {
    name: 'palette verb: Copy worktree path',
    covers: ['palette:Copy worktree path'],
    open: async () => {
      clipboardWrites = [];
      vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text: string) => {
        clipboardWrites.push(text);
      });
      await openPalette(/^Copy worktree path$/, 'copy worktree path');
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
      await openPalette(new RegExp(`^${label}$`), label);
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
      await openPalette(/^Archive$/, 'archive');
    },
    lands: async () => expect(await screen.findByText('Session archived', {}, WAIT)).toBeDefined(),
  },
  {
    name: 'palette verb: Delete asks first',
    covers: ['palette:Delete…'],
    open: () => openPalette(/^Delete/, 'delete'),
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
    name: 'column: inbox',
    covers: ['openInbox', 'studio:inbox'],
    open: () => click(doorIn('inbox')),
    lands: both(
      () => heading('All items'),
      async () => expect(doorIn('inbox').getAttribute('aria-current')).toBe('page'),
    ),
  },
  {
    name: 'column: workflow library',
    covers: ['openWorkflows', 'studio:workflow'],
    open: () => click(doorIn('workflows')),
    lands: () => visible('button', 'New workflow'),
  },
  {
    name: 'column: chat',
    covers: ['openChat', 'studio:chat'],
    open: () => click(doorIn('chat')),
    lands: both(
      () => band('Chat'),
      () => heading('New chat'),
      () => visible('complementary', 'Chat list'),
    ),
  },
  {
    name: 'column: settings swaps the column',
    covers: ['openSettings', 'studio:settings', 'scope:home'],
    open: () => click(doorIn('settings')),
    lands: both(
      () => visible('navigation', 'Settings scopes'),
      () => visible('button', /^Back to app/),
      () => visible('searchbox', 'Search settings'),
      async () =>
        expect(document.querySelector('[data-column-layer="nav"]')?.hasAttribute('inert')).toBe(
          true,
        ),
    ),
  },
  {
    name: 'column: board from a session',
    covers: ['navigate'],
    open: () => click(doorIn('board')),
    lands: both(
      () => heading('Board'),
      async () => expect(useAppStore.getState().currentSessionId).toBeNull(),
    ),
  },
  {
    name: 'column: new session opens the draft',
    covers: ['column:new'],
    open: () => click(doorIn('new')),
    lands: async () => {
      await waitFor(() => expect(doorIn('new').getAttribute('aria-current')).toBe('page'), WAIT);
    },
  },
  {
    name: 'column: goodboy chip to the changelog',
    covers: ['openChangelog', 'studio:changelog'],
    open: async () => {
      await clickButton(/^Goodboy: setup/);
      await clickButton(/^What's new/);
    },
    lands: () => heading(/^Goodboy \d/),
  },
  {
    name: 'column: report a bug opens the sheet',
    covers: ['column:report'],
    open: () => clickButton('Report a bug'),
    lands: () => visible('dialog', 'Report a bug'),
  },
  {
    name: 'classic footer: impact',
    covers: ['openImpact', 'studio:impact'],
    bars: 'classic',
    open: () => clickButton('Impact'),
    lands: () => band('Impact'),
  },
  {
    name: 'top bar: spend',
    covers: ['openSpend', 'studio:impact'],
    open: () => clickButton(/^Spend today/),
    lands: () => heading('Spend'),
  },
  {
    name: 'classic footer: inbox',
    covers: ['studio:inbox'],
    bars: 'classic',
    open: () => clickButton('Inbox'),
    lands: () => heading('All items'),
  },
  {
    name: 'classic footer: integrations',
    covers: ['openIntegration', 'integrations'],
    bars: 'classic',
    open: () => clickButton(/^Connect your first integration/),
    lands: () => visible('dialog', 'Integrations'),
  },
  {
    name: 'classic top bar: chat',
    covers: ['openStudio', 'studio:chat'],
    bars: 'classic',
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
    lands: () => visible('textbox', 'Workspace name'),
  },
];
