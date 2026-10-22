import { expect } from 'vitest';
import { waitFor, within } from '@testing-library/react';
import { branchPlace } from '../../../store';
import {
  type Row,
  WAIT,
  both,
  branchTab,
  lens,
  openCrumb,
  openPalette,
  settle,
  useAppStore,
  sectionLabels,
} from './harness';

const PAGES = ['Overview', 'Runs', 'Artifacts'];

const pageLabels = async (): Promise<ReadonlyArray<string>> => {
  const list = await waitFor(() => {
    const found = document.querySelector<HTMLElement>(
      '[data-level-layer="session"]:not([inert]) [data-testid="session-pages"]',
    );
    if (found === null) {
      throw new Error('the sidebar is not on a session level');
    }
    return found;
  }, WAIT);
  return within(list)
    .getAllByRole('button')
    .map((row) => row.textContent ?? '');
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
    name: 'session level: the pages read Overview, Runs, Artifacts, with no branch entry',
    covers: ['sidebar:session-pages'],
    open: () => settle(),
    lands: async () => {
      const texts = await pageLabels();
      startsWithInOrder(texts, PAGES);
      for (const retired of ['Branch', 'Review', 'Diff', 'Pull request', 'Explore', 'Scripts']) {
        expect(
          texts.some((text) => text.startsWith(retired)),
          retired,
        ).toBe(false);
      }
    },
  },
  {
    name: 'session level: a worktree row lands on the Pull request tab',
    covers: ['navigate', 'lens:branch'],
    open: () => openCrumb(/^Branch/),
    lands: both(lens('branch'), branchTab('pr')),
  },
  {
    name: 'palette: Open comments finds the Comments tab',
    covers: ['navigate', 'palette:Open comments'],
    open: () => openPalette(/^Open comments/, 'Open comments'),
    lands: branchTab('comments'),
  },
  {
    name: 'palette: Open files finds the Files tab',
    covers: ['navigate', 'palette:Open files'],
    open: () => openPalette(/^Open files/, 'Open files'),
    lands: branchTab('files'),
  },
  {
    name: 'palette: the former names still find the tabs',
    covers: ['navigate', 'palette:Open comments'],
    open: () => openPalette(/^Open comments/, 'Review'),
    lands: branchTab('comments'),
  },
  {
    name: 'a pull request address lands on the Overview, first of the five sections',
    covers: ['navigate', 'tab:pr'],
    open: async (ctx) => {
      useAppStore.getState().navigate({ to: branchPlace({ sessionId: ctx.sessionId, tab: 'pr' }) });
      await settle();
    },
    lands: async (ctx) => {
      await branchTab('pr')(ctx);
      await waitFor(() => expect(sectionLabels()[0]).toBe('Pull request'), WAIT);
    },
  },
];
