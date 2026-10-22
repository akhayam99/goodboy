// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import type { PageCountFacts } from '../../../session/pageCountWord';
import { columnPagesOf } from '../../../session/pageRegistry';
import { sessionOf } from '../../testing/sessionColumn';
import { SessionPages } from './SessionPages';

const FACTS: PageCountFacts = {
  changedFiles: 0,
  runs: 2,
  runningRuns: 1,
  waitingRuns: 0,
  artifacts: 0,
  openQuestions: 0,
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderPages = () =>
  render(
    <SessionPages
      session={sessionOf({ goal: 'Reconcile the ledger export' })}
      pages={columnPagesOf({ isBranchless: false })}
      facts={FACTS}
      sign="overview"
    />,
  );

describe('the session rail page row tooltips', () => {
  it('shows one Runs entry for every kind of run', () => {
    renderPages();

    const labels = screen.getAllByRole('button').map((row) => row.textContent ?? '');
    expect(labels.filter((label) => /Orchestrated|Agents|Auto/.test(label))).toEqual([]);
    expect(labels.filter((label) => label.startsWith('Runs'))).toHaveLength(1);
  });

  it('keeps the count on its own short tooltip', async () => {
    const { container } = renderPages();
    const count = container.querySelector('[data-page-value="runs"]');
    if (count === null) {
      throw new Error('the Runs count is missing');
    }
    fireEvent.mouseEnter(count);

    expect((await screen.findByRole('tooltip')).textContent).toBe('1 running');
  });

  it('uses no native title on any row', () => {
    const { container } = renderPages();

    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});
