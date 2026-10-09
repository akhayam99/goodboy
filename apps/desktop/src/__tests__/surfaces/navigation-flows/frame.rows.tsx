import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { frameGeometryOf, type FramePage } from '@goodboy/ui';
import {
  CRUMB_ROWS,
  type Row,
  WAIT,
  band,
  branchTab,
  click,
  clickButton,
  heading,
  lens,
  openCrumb,
  openPalette,
  settle,
} from './harness';

const QUESTIONS_ROW = CRUMB_ROWS.find((row) => row.label === 'Questions');

const titleRowOf = (title: HTMLElement): HTMLElement | null =>
  title.closest<HTMLElement>('[data-slot="pane-title-row"]');

const columnOf = (title: HTMLElement): string | null =>
  title.closest<HTMLElement>('[data-page-column]')?.getAttribute('data-width') ?? null;

const onlyH1 = ({ scope }: { readonly scope: ParentNode }): HTMLElement => {
  const titles = [...scope.querySelectorAll<HTMLElement>('h1')].filter(
    (title) => title.closest('.invisible, [inert], [hidden]') === null,
  );
  expect(titles).toHaveLength(1);
  return titles[0] as HTMLElement;
};

type GridParams = {
  readonly page: FramePage;
  readonly isStudio: boolean;
};

const expectOnGrid = ({ page, isStudio }: GridParams): void => {
  const geometry = frameGeometryOf({ page });
  expect(geometry.titleCentreY).toBe(56);
  expect(geometry.bandHeight + geometry.titleRowHeight / 2).toBe(56);
  const title = onlyH1({
    scope: isStudio ? (document.querySelector('[data-studio-frame]') ?? document) : document,
  });
  const row = titleRowOf(title);
  expect(row).not.toBeNull();
  expect(row?.firstElementChild).toBe(title);
  if (geometry.titleLeft === 'column') {
    expect(columnOf(title)).toBe('column');
  }
  const header = title.closest<HTMLElement>('[data-slot="pane-header"]');
  if (header !== null) {
    expect(header.hasAttribute('data-under-trail')).toBe(true);
  }
  if (isStudio) {
    const frame = title.closest('[data-studio-frame]');
    expect(frame).not.toBeNull();
    expect(frame?.querySelector('[data-studio-band] [data-page-column]')).not.toBeNull();
    return;
  }
  expect(document.querySelector('[data-slot="trail-bar"]')).not.toBeNull();
};

const landsOnSessionPage =
  ({ page, title }: { readonly page: FramePage; readonly title: RegExp | string | null }) =>
  async (): Promise<void> => {
    if (title !== null) {
      await heading(title);
    }
    await waitFor(() => expectOnGrid({ page, isStudio: false }), WAIT);
  };

export const FRAME_ROWS: ReadonlyArray<Row> = [
  {
    name: 'frame: the Board title sits under an empty band on the same 32px row',
    covers: ['navigate'],
    open: async () => {
      await clickButton(/^Board/);
    },
    lands: async () => {
      await heading('Board');
      const title = onlyH1({ scope: document });
      const row = titleRowOf(title);
      expect(row).not.toBeNull();
      expect(row?.previousElementSibling?.getAttribute('data-slot')).toBe('board-band');
      expect(frameGeometryOf({ page: 'board' }).titleCentreY).toBe(56);
    },
  },
  {
    name: 'frame: the Overview title is the one h1 on the trail grid',
    covers: [],
    open: async () => {
      await settle();
    },
    lands: async (ctx) => {
      await lens(null)(ctx);
      expect(await screen.findByTestId('context-chip')).toBeDefined();
      await waitFor(() => expectOnGrid({ page: 'overview', isStudio: false }), WAIT);
    },
  },
  {
    name: 'frame: the Branch title sits on the grid at every tab',
    covers: ['navigate'],
    open: async () => {
      await openCrumb(/^Branch/);
    },
    lands: async (ctx) => {
      await branchTab('comments')(ctx);
      await waitFor(() => expectOnGrid({ page: 'branch', isStudio: false }), WAIT);
      for (const name of [/^Files/, /^Commits/, /^Checks/]) {
        await click(screen.getByRole('tab', { name }));
        await waitFor(() => expectOnGrid({ page: 'branch', isStudio: false }), WAIT);
      }
    },
  },
  {
    name: 'frame: the Runs title sits on the grid',
    covers: ['navigate'],
    open: async () => {
      await openCrumb(/^Runs/);
    },
    lands: landsOnSessionPage({ page: 'runs', title: 'Runs' }),
  },
  {
    name: 'frame: the Agents title sits on the grid',
    covers: ['navigate'],
    open: async () => {
      await openCrumb(/^Agents/);
    },
    lands: landsOnSessionPage({ page: 'agents', title: 'Agents' }),
  },
  {
    name: 'frame: the Questions title sits on the grid',
    covers: ['navigate'],
    open: async (ctx) => {
      QUESTIONS_ROW?.beforeOpen?.(ctx);
      await settle();
      await openCrumb(/^Questions/);
    },
    lands: landsOnSessionPage({ page: 'questions', title: 'Questions' }),
  },
  {
    name: 'frame: the Inbox studio draws its band and its title on the column',
    covers: ['openInbox', 'studio:inbox'],
    open: async () => {
      await clickButton('Inbox');
    },
    lands: async () => {
      await band('Inbox');
      await settle();
      expectOnGrid({ page: 'inbox', isStudio: true });
    },
  },
  {
    name: 'frame: the Workflows studio draws its band and its title on the column',
    covers: ['openStudio', 'studio:workflow', 'palette:Workflows'],
    open: () => openPalette(/^Workflows$/),
    lands: async () => {
      await band('Workflows');
      await heading('Workflows');
      await waitFor(() => expectOnGrid({ page: 'workflows', isStudio: true }), WAIT);
    },
  },
];
