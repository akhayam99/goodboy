import { expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { pressShortcut } from '../../helpers/pressKey';
import { settle, useAppStore, type Ctx, type Row } from './harness';

export const BROWSER_KEY_ROWS: ReadonlyArray<Row> = [
  {
    name: 'key browser.pick picks nothing while the browser shows no live page',
    covers: ['key:browser.pick'],
    open: async ({ sessionId }: Ctx) => {
      useAppStore.getState().openDrawer({ kind: 'browser', sessionId, payload: null });
      await screen.findByRole('combobox', { name: 'Address or search' });
      pressShortcut({ id: 'browser.pick' });
      await settle();
    },
    lands: async () => {
      expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('browser');
      expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).not.toContain(
        'browser_pick',
      );
    },
  },
];
