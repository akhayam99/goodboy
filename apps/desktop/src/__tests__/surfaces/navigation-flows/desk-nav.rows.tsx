import { expect } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { deskToolsOf } from '../../../features/session/components/SessionDesk/deskToolsOf';
import { pressShortcut } from '../../helpers/pressKey';
import { type Row, WAIT, pressBoardKey, settle, useAppStore } from './harness';

const ANCHOR = /^Search or run \(/;

const toolsOnDesk = (): number => deskToolsOf({ state: useAppStore.getState() }).length;

const faceOf = (sessionId: SessionId): string =>
  useAppStore.getState().sessionFace[sessionId] ?? 'overview';

const openTerminal = async (): Promise<void> => {
  fireEvent.click(await screen.findByTestId('pane-toggle-terminal'));
  await settle();
};

const deskIsOpen = async (): Promise<void> => {
  await screen.findByRole('complementary', { name: 'Desk' });
  await waitFor(() => expect(toolsOnDesk()).toBeGreaterThan(0), WAIT);
};

const closeEveryTool = async (): Promise<void> => {
  await act(async () => {
    deskToolsOf({ state: useAppStore.getState() }).forEach((entry) =>
      useAppStore.getState().closeDrawerEntry({ entry }),
    );
  });
  await settle();
};

const pressNav = async (id: 'nav.back' | 'nav.forward'): Promise<void> => {
  const anchor = await screen.findByRole('button', { name: ANCHOR });
  anchor.focus();
  pressShortcut({ id });
  await settle();
};

export const DESK_NAV_ROWS: ReadonlyArray<Row> = [
  {
    name: 'desk: a tool opened from the right rail splits the page, with no switch in the head',
    covers: ['rail:terminal'],
    open: openTerminal,
    lands: async (ctx) => {
      await deskIsOpen();
      expect(faceOf(ctx.sessionId)).toBe('desk');
      expect(screen.queryByRole('tablist', { name: 'Overview or Desk' })).toBeNull();
    },
  },
  {
    name: 'desk: closing the last tool returns to the whole overview with Desk closed and Reopen',
    covers: ['rail:terminal'],
    open: async () => {
      await openTerminal();
      await deskIsOpen();
      await closeEveryTool();
    },
    lands: async (ctx) => {
      expect(faceOf(ctx.sessionId)).toBe('overview');
      expect(screen.queryByRole('complementary', { name: 'Desk' })).toBeNull();
      await screen.findByText('Desk closed');
      await waitFor(() => {
        expect(document.activeElement?.textContent).toBe('Reopen');
      }, WAIT);
      fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
      await settle();
      await deskIsOpen();
      expect(screen.queryByText('Desk closed')).toBeNull();
    },
  },
  {
    name: 'desk: Back and Forward walk places, never faces, and open no tool by themselves',
    covers: ['key:nav.back', 'key:nav.forward'],
    open: async () => {
      await openTerminal();
      await deskIsOpen();
      await pressBoardKey();
    },
    lands: async (ctx) => {
      expect(screen.queryByRole('complementary', { name: 'Desk' })).toBeNull();
      expect(faceOf(ctx.sessionId)).toBe('desk');
      await pressNav('nav.back');
      await deskIsOpen();
      expect(faceOf(ctx.sessionId)).toBe('desk');
      await pressNav('nav.forward');
      expect(screen.queryByRole('complementary', { name: 'Desk' })).toBeNull();
      expect(faceOf(ctx.sessionId)).toBe('desk');
    },
  },
  {
    name: 'desk: Esc on the last tool never leaves an empty Desk, it closes it with Reopen',
    covers: ['rail:terminal'],
    open: async () => {
      await openTerminal();
      await deskIsOpen();
      pressShortcut({ id: 'overlay.close' });
      await settle();
    },
    lands: async (ctx) => {
      expect(faceOf(ctx.sessionId)).toBe('overview');
      expect(screen.queryByRole('complementary', { name: 'Desk' })).toBeNull();
      await screen.findByText('Desk closed');
      screen.getByRole('button', { name: 'Reopen' });
    },
  },
];
