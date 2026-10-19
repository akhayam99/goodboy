import { expect, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { screen, waitFor, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { openQuestionFor } from '../../../features/workspace/testing/sessionColumn';
import { type Row, WAIT, clickButton, lens, openPalette, settle, useAppStore } from './harness';

export const OVERVIEW_ROWS: ReadonlyArray<Row> = [
  {
    name: 'overview: a waiting question is answered from the Needs you card only',
    covers: ['overview:needs-you-only'],
    open: async (ctx) => {
      useAppStore.setState({
        sessionOpenQuestions: {
          [ctx.sessionId]: [openQuestionFor({ sessionId: ctx.sessionId as SessionId })],
        },
      });
      await settle();
    },
    lands: async (ctx) => {
      const card = await screen.findByRole('region', { name: 'Needs you' }, WAIT);
      const activity = screen.getByRole('region', { name: 'Activity' });
      expect(within(activity).queryAllByRole('button', { name: 'Answer' })).toHaveLength(0);
      expect(within(card).getAllByRole('button', { name: /^Open/ })).toHaveLength(1);

      await clickButton(/^Open: /);

      await lens('questions')(ctx);
    },
  },
];

const hasReadLayout = (): boolean =>
  vi
    .mocked(invoke)
    .mock.calls.some(
      ([command, args]) =>
        command === 'db_select' &&
        JSON.stringify(args ?? null).includes('"params":["overview.layout"]'),
    );

type EntryParams = {
  readonly label: RegExp;
  readonly query: string;
};

const openLayoutEntry = async ({ label, query }: EntryParams): Promise<void> => {
  vi.mocked(invoke).mockClear();
  await openPalette(label, query);
};

export const OVERVIEW_LAYOUT_ROWS: ReadonlyArray<Row> = [
  {
    name: 'palette: Use the new session overview starts the save of the setting',
    covers: ['palette:Use the new session overview'],
    open: () =>
      openLayoutEntry({ label: /^Use the new session overview/, query: 'session overview' }),
    lands: async () => {
      await waitFor(() => expect(hasReadLayout()).toBe(true));
    },
  },
  {
    name: 'palette: Use the classic session overview starts the save of the setting',
    covers: ['palette:Use the classic session overview'],
    open: () =>
      openLayoutEntry({ label: /^Use the classic session overview/, query: 'session overview' }),
    lands: async () => {
      await waitFor(() => expect(hasReadLayout()).toBe(true));
    },
  },
];
