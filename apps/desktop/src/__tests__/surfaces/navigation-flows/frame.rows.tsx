import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { FRAME_BAND_PX, frameGeometryOf, type FramePage } from '@goodboy/ui';
import {
  CRUMB_ROWS,
  type Row,
  WAIT,
  studio,
  branchTab,
  click,
  clickButton,
  getSection,
  heading,
  lens,
  openCrumb,
  openPalette,
  settle,
} from './harness';

const QUESTIONS_ROW = CRUMB_ROWS.find((row) => row.label === 'Questions');

const titleRowOf = (title: HTMLElement): HTMLElement | null =>
  title.closest<HTMLElement>('[data-slot="pane-title-row"]');

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
  expect(geometry.titleCentreY).toBe(geometry.bandHeight + geometry.titleRowHeight / 2);
  expect(geometry.titleCentreY).toBe(geometry.bandHeight === FRAME_BAND_PX ? 56 : 28);
  const title = onlyH1({
    scope: isStudio ? (document.querySelector('[data-studio-frame]') ?? document) : document,
  });
  const row = titleRowOf(title);
  expect(row).not.toBeNull();
  expect(row?.firstElementChild).toBe(title);
  if (!isStudio) {
    expect(document.querySelector('[data-slot="trail-bar"]')).toBeNull();
    expect(
      title.closest('[data-slot="pane-header"]')?.hasAttribute('data-under-trail') ?? false,
    ).toBe(false);
    return;
  }
  const frame = title.closest('[data-studio-frame]');
  expect(frame).not.toBeNull();
  const header = title.closest<HTMLElement>('[data-slot="pane-header"]');
  if (geometry.bandHeight !== FRAME_BAND_PX) {
    expect(frame?.querySelector('[data-studio-band]')).toBeNull();
    expect(header?.hasAttribute('data-under-trail') ?? false).toBe(false);
    return;
  }
  if (geometry.titleLeft === 'detail') {
    const detail = title.closest('[data-studio-detail]');
    expect(detail).not.toBeNull();
    const first = detail?.firstElementChild;
    expect(
      first?.matches('[data-studio-band]') === true ||
        first?.querySelector('[data-slot="trail-bar"]') !== null,
    ).toBe(true);
  }
  if (header !== null) {
    expect(header.hasAttribute('data-under-trail')).toBe(true);
  }
  expect(frame?.querySelector('[data-studio-band] [data-page-column]')).not.toBeNull();
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
    name: 'frame: the Board title sits on one header row, no band above it',
    covers: ['navigate'],
    open: async () => {
      await clickButton(/^Sessions/);
    },
    lands: async () => {
      await heading('Sessions');
      const title = onlyH1({ scope: document });
      const row = titleRowOf(title);
      expect(row).not.toBeNull();
      expect(row?.previousElementSibling).toBeNull();
      expect(document.querySelector('[data-slot="board-band"]')).toBeNull();
      expect(frameGeometryOf({ page: 'board' }).titleCentreY).toBe(56);
    },
  },
  {
    name: 'frame: the Overview title is the one h1 on the page header row',
    covers: [],
    open: async () => {
      await settle();
    },
    lands: async (ctx) => {
      await lens(null)(ctx);
      expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeDefined();
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
      await branchTab('pr')(ctx);
      await waitFor(() => expectOnGrid({ page: 'branch', isStudio: false }), WAIT);
      for (const name of [/^Comments/, /^Files/, /^Commits/, /^Checks/]) {
        await click(getSection(name));
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
    name: 'frame: the Tasks page draws no band, its title alone on the column',
    covers: ['openInbox', 'studio:inbox'],
    door: 'visible',
    open: async () => {
      await clickButton('Tasks');
    },
    lands: async () => {
      await studio('Tasks');
      await settle();
      expectOnGrid({ page: 'inbox', isStudio: true });
    },
  },
  {
    name: 'frame: the Workflows page draws no band, its title alone on the column',
    covers: ['openStudio', 'studio:workflow', 'palette:Workflows'],
    door: 'palette',
    open: () => openPalette(/^Workflows$/),
    lands: async () => {
      await studio('Workflows');
      await heading('Workflows');
      await waitFor(() => expectOnGrid({ page: 'workflows', isStudio: true }), WAIT);
    },
  },
];
