import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { branchPlace } from '../../../store';
import {
  type Row,
  WAIT,
  both,
  branchTab,
  click,
  clickButton,
  lens,
  openPalette,
  settle,
  useAppStore,
} from './harness';

const PAGES = ['Overview', 'Branch', 'Runs', 'Agents', 'Artifacts'];

const TOOLS = ['Explore', 'Scripts', 'Terminal'];

const menuLabels = async (): Promise<ReadonlyArray<string>> => {
  const rows = await screen.findAllByRole('menuitemradio', undefined, WAIT);
  return rows.map((row) => row.textContent ?? '');
};

const startsWithInOrder = (texts: ReadonlyArray<string>, labels: ReadonlyArray<string>): void => {
  const found = labels.map((label) => texts.findIndex((text) => text.startsWith(label)));
  expect(
    found.every((index) => index >= 0),
    `${labels.join(', ')} in ${texts.join(' | ')}`,
  ).toBe(true);
  expect([...found].sort((a, b) => a - b)).toEqual(found);
};

export const REGISTRY_ROWS: ReadonlyArray<Row> = [
  {
    name: 'pages menu: the first rows are the five pages of the column, then the tools',
    covers: ['trail:pages-menu'],
    open: () => clickButton(/^Session/),
    lands: async () => {
      const texts = await menuLabels();
      startsWithInOrder(texts, [...PAGES, ...TOOLS]);
      for (const retired of ['Review', 'Diff', 'Pull request', 'Session']) {
        expect(
          texts.some((text) => text.startsWith(retired)),
          retired,
        ).toBe(false);
      }
    },
  },
  {
    name: 'pages menu: choosing Branch lands on the Pull request tab',
    covers: ['navigate', 'lens:branch'],
    open: async () => {
      await clickButton(/^Session/);
      await click(await screen.findByRole('menuitemradio', { name: /^Branch/ }));
    },
    lands: both(lens('branch'), branchTab('pr')),
  },
  {
    name: 'palette: Open Comments finds the Comments tab',
    covers: ['navigate', 'palette:Open Comments'],
    open: () => openPalette(/^Open Comments/, 'Open Comments'),
    lands: branchTab('comments'),
  },
  {
    name: 'palette: Open Files finds the Files tab',
    covers: ['navigate', 'palette:Open Files'],
    open: () => openPalette(/^Open Files/, 'Open Files'),
    lands: branchTab('files'),
  },
  {
    name: 'palette: the former names still find the tabs',
    covers: ['navigate', 'palette:Open Comments'],
    open: () => openPalette(/^Open Comments/, 'Review'),
    lands: branchTab('comments'),
  },
  {
    name: 'a pull request address lands on the Pull request tab, first of the five',
    covers: ['navigate', 'tab:pr'],
    open: async (ctx) => {
      useAppStore.getState().navigate({ to: branchPlace({ sessionId: ctx.sessionId, tab: 'pr' }) });
      await settle();
    },
    lands: async (ctx) => {
      await branchTab('pr')(ctx);
      await waitFor(
        () =>
          expect(screen.getAllByRole('tab').map((tab) => tab.textContent ?? '')[0]).toMatch(
            /^Pull request/,
          ),
        WAIT,
      );
    },
  },
];
