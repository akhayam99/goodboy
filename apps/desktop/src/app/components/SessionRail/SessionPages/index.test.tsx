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
import type { PageCountFacts } from '../../../../features/session/pageCountWord';
import { pagesOf } from '../../../../features/session/pageRegistry';
import { sessionOf } from '../../../../features/workspace/testing/sessionColumn';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { RailFlyoutSession } from '../../SideColumn/RailFlyoutSession';
import { SessionPages } from '.';

const FACTS: PageCountFacts = {
  changedFiles: 0,
  runs: 2,
  runningRuns: 1,
  waitingRuns: 0,
  artifacts: 0,
  openQuestions: 1,
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type HoverParams = { readonly target: Element };

const renderPages = () =>
  render(
    <SessionPages
      session={sessionOf({ goal: 'Reconcile the ledger export' })}
      pages={pagesOf({ hasOpenQuestions: true })}
      facts={FACTS}
      sign="overview"
    />,
  );

const hover = async ({ target }: HoverParams) => {
  fireEvent.mouseEnter(target);
  return (await screen.findByRole('tooltip')).textContent ?? '';
};

describe('the session pages rows', () => {
  it('shows one Runs entry for every kind of run', () => {
    renderPages();

    const labels = screen.getAllByRole('button').map((row) => row.textContent ?? '');
    expect(labels.filter((label) => /Orchestrated|Agents|Auto/.test(label))).toEqual([]);
    expect(labels.filter((label) => label.startsWith('Runs'))).toHaveLength(1);
  });

  it('draws the six pages of a session in the tab order', () => {
    const open = renderPages();
    const names = open.getAllByRole('button').map((row) => row.querySelector('span')?.textContent);

    expect(names).toEqual(['Overview', 'Changes', 'Runs', 'Artifacts', 'Questions', 'Context']);
  });

  it('puts the label, the fact and the shortcut in one tooltip on an open row', async () => {
    renderPages();

    const text = await hover({ target: screen.getByRole('button', { name: /^Runs/ }) });

    expect(text).toContain('Runs, 1 running');
    expect(text).toContain(shortcutGlyphs('lens.workflows'));
  });

  it('puts the same tooltip on a row of the sidebar flyout', async () => {
    render(
      <RailFlyoutSession
        session={sessionOf({ goal: 'Reconcile the ledger export' })}
        hasStudioOver={false}
      />,
    );

    const text = await hover({ target: screen.getByRole('button', { name: /^Runs/ }) });

    expect(text).toContain('Runs');
    expect(text).toContain(shortcutGlyphs('lens.workflows'));
  });

  it('marks a waiting question with a dot on its row', () => {
    const open = renderPages();
    const openTone = open.container
      .querySelector('[data-page-value="questions"]')
      ?.getAttribute('data-tone');

    expect(openTone).not.toBe('count');
  });

  it('uses no native title on any row', () => {
    const { container } = renderPages();

    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});
