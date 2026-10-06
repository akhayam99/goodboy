import { expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  type Ctx,
  branchTab,
  LENS_ROWS,
  type Row,
  WAIT,
  both,
  click,
  clickButton,
  heading,
  lens,
  openCrumb,
  openPalette,
  settle,
  useAppStore,
} from './harness';

const openObjectMenu = async (element: Element): Promise<void> => {
  fireEvent.contextMenu(element);
  await settle();
};

const runMenuItem = async (label: RegExp): Promise<void> => {
  await click(await screen.findByRole('menuitem', { name: label }));
};

const sessionRow = async (ctx: Ctx): Promise<Element> => {
  await waitFor(
    () => expect(document.querySelector(`[data-select-id="${ctx.sessionId}"]`)).not.toBeNull(),
    WAIT,
  );
  return document.querySelector(`[data-select-id="${ctx.sessionId}"]`) as Element;
};

const RIGHT_CLICK_SESSION_ROWS: ReadonlyArray<{
  readonly label: string;
  readonly lens: string | null;
  readonly lands: (ctx: Ctx) => Promise<void>;
}> = [
  { label: 'Review', lens: 'branch', lands: branchTab('comments') },
  { label: 'Diff', lens: 'branch', lands: branchTab('files') },
  { label: 'Terminal', lens: 'terminal', lands: () => heading('Terminal') },
];

export const LENS_ENTRY_ROWS: ReadonlyArray<Row> = [
  ...RIGHT_CLICK_SESSION_ROWS.map((row): Row => ({
    name: `right click sidebar session: ${row.label}`,
    covers: ['navigate', `rightclick:session:${row.label}`],
    open: async (ctx) => {
      await openObjectMenu(await sessionRow(ctx));
      await runMenuItem(new RegExp(`^${row.label}`));
    },
    lands: both(lens(row.lens), row.lands),
  })),
  {
    name: 'right click board card: Open',
    covers: ['navigate', 'rightclick:session:Open'],
    open: async (ctx) => {
      await clickButton(/^Board/);
      await openObjectMenu(await sessionRow(ctx));
      await runMenuItem(/^Open$/);
    },
    lands: lens(null),
  },
  {
    name: 'right click agent row: Open agent',
    covers: ['navigate', 'rightclick:agent:Open agent'],
    open: async (ctx) => {
      await openCrumb(/^Agents/);
      const agent = (useAppStore.getState().sessionPhaseRuns[ctx.sessionId] ?? []).find(
        (candidate) => candidate.workflowRunId == null && candidate.deletedAt == null,
      );
      if (agent === undefined) {
        throw new Error('the seeded session has no standalone agent');
      }
      const [name] = await screen.findAllByText(agent.name, undefined, WAIT);
      const card = name?.closest('[data-agent-card]');
      if (card === null || card === undefined) {
        throw new Error('the agents lens shows no agent card');
      }
      await openObjectMenu(card);
      await runMenuItem(/^Open agent/);
    },
    lands: async (ctx) => {
      await waitFor(
        () => expect(useAppStore.getState().selectedAgentId[ctx.sessionId] ?? null).not.toBeNull(),
        WAIT,
      );
    },
  },
  ...LENS_ROWS.map((row): Row => ({
    name: `crumb menu: ${row.label}${row.note === undefined ? '' : `, ${row.note}`}`,
    covers: ['navigate', `crumb:${row.label}`, `lens:${row.lens ?? 'overview'}`],
    ...(row.seed !== undefined && { seed: row.seed }),
    open: () => openCrumb(new RegExp(`^${row.label}`)),
    lands: both(lens(row.lens), row.lands),
  })),
  ...LENS_ROWS.map((row): Row => ({
    name: `palette: Open ${row.label}${row.note === undefined ? '' : `, ${row.note}`}`,
    covers: ['navigate', `palette:Open ${row.label}`],
    ...(row.seed !== undefined && { seed: row.seed }),
    open: () => openPalette(new RegExp(`^Open ${row.label}`), `Open ${row.label}`),
    lands: both(lens(row.lens), row.lands),
  })),
];
