import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  type Ctx,
  type Row,
  WAIT,
  both,
  branchTab,
  click,
  openCrumb,
  useAppStore,
} from './harness';
import { setGhChecksMode } from './checks.runner';

const activateFirstMount = ({ sessionId }: Ctx): void => {
  const mountId = useAppStore.getState().sessionProjectMounts[sessionId]?.[0]?.mountId;
  if (mountId === undefined) {
    throw new Error('the pr seed has no mount to select');
  }
  useAppStore.setState((state) => ({
    sessionActiveMount: { ...state.sessionActiveMount, [sessionId]: mountId },
  }));
};

const openChecks = async (ctx: Ctx): Promise<void> => {
  activateFirstMount(ctx);
  await openCrumb(/^Diff/);
  await click(await screen.findByRole('tab', { name: /^Checks/ }));
};

const deniedNotice = async (): Promise<void> => {
  expect(await screen.findByText(/^Goodboy can't read checks for /, undefined, WAIT)).toBeDefined();
  expect(screen.getByText("The GitHub access Goodboy uses can't read checks.")).toBeDefined();
  expect(screen.queryByText(/No checks have reported/)).toBeNull();
};

const rowsAppear = async (): Promise<void> => {
  await waitFor(
    () =>
      expect(screen.getByTestId('checks-rollup').textContent).toBe(
        '1 failing · 1 running · 1 passed',
      ),
    WAIT,
  );
  expect(screen.getByRole('list', { name: 'Failing checks' })).toBeDefined();
  expect(screen.queryByText(/^Goodboy can't read checks for /)).toBeNull();
};

const reviewersStayListed = async (): Promise<void> => {
  await click(await screen.findByRole('tab', { name: /^Comments/ }));
  await click(await screen.findByRole('button', { name: 'Description' }));
  expect(await screen.findByText('Reviewers', undefined, WAIT)).toBeDefined();
  expect(screen.getByText('mara-l')).toBeDefined();
  expect(screen.getByText('kenji-w')).toBeDefined();
};

export const CHECKS_ROWS: ReadonlyArray<Row> = [
  {
    name: 'checks tab: a denied read names the repository and keeps the reviewers listed',
    covers: ['navigate', 'checks:denied'],
    open: async (ctx) => {
      setGhChecksMode({ next: 'denied' });
      await openChecks(ctx);
      await deniedNotice();
    },
    lands: both(branchTab('checks'), deniedNotice, reviewersStayListed),
  },
  {
    name: 'checks tab: Check again after the runner answers shows the rows',
    covers: ['navigate', 'checks:recheck'],
    open: async (ctx) => {
      setGhChecksMode({ next: 'denied' });
      await openChecks(ctx);
      await deniedNotice();
      setGhChecksMode({ next: 'runs' });
      await click(await screen.findByRole('button', { name: 'Check again' }));
    },
    lands: both(branchTab('checks'), rowsAppear, reviewersStayListed),
  },
];
