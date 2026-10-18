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
import { SESSION_PAGE_MARKER_WHY } from '../../../session/sessionPageIntro';
import { sessionOf } from '../../testing/sessionColumn';
import { SessionPages } from './SessionPages';

const FACTS: PageCountFacts = {
  runs: 0,
  runningRuns: 0,
  waitingRuns: 0,
  orchestratedRuns: 0,
  runningOrchestratedRuns: 0,
  waitingOrchestratedRuns: 0,
  agents: 1,
  runningAgents: 0,
  autoAgents: 0,
  workingAutoAgents: 0,
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
      pages={columnPagesOf({ isBranchless: false, hasAutoAgents: true })}
      facts={FACTS}
      sign="overview"
    />,
  );

describe('the session rail page row tooltips', () => {
  it('opens the Deprecated tooltip on the marker alone, with no count in it', async () => {
    renderPages();
    fireEvent.mouseEnter(screen.getByTestId('page-marker-agents'));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe(SESSION_PAGE_MARKER_WHY.agents);
    expect(tooltip.textContent).not.toMatch(/\d/);
  });

  it('opens the Experimental tooltip on the Auto agents marker', async () => {
    renderPages();
    fireEvent.mouseEnter(screen.getByTestId('page-marker-auto'));

    expect((await screen.findByRole('tooltip')).textContent).toBe(SESSION_PAGE_MARKER_WHY.auto);
  });

  it('keeps the count on its own short tooltip', async () => {
    const { container } = renderPages();
    const count = container.querySelector('[data-page-value="agents"]');
    if (count === null) {
      throw new Error('the Agents count is missing');
    }
    fireEvent.mouseEnter(count);

    expect((await screen.findByRole('tooltip')).textContent).toBe('1 agent');
  });

  it('uses no native title on any row', () => {
    const { container } = renderPages();

    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});
