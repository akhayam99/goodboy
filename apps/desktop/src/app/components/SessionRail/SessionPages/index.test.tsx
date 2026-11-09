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
import type { SessionPageVariant } from '../SessionPageRow';

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

const renderPages = ({ variant }: { readonly variant: SessionPageVariant }) =>
  render(
    <SessionPages
      session={sessionOf({ goal: 'Reconcile the ledger export' })}
      pages={pagesOf({ isBranchless: false, hasOpenQuestions: true })}
      facts={FACTS}
      sign="overview"
      variant={variant}
    />,
  );

const hover = async ({ target }: { readonly target: Element }) => {
  fireEvent.mouseEnter(target);
  return (await screen.findByRole('tooltip')).textContent ?? '';
};

describe('the session pages rows', () => {
  it('shows one Runs entry for every kind of run', () => {
    renderPages({ variant: 'row' });

    const labels = screen.getAllByRole('button').map((row) => row.textContent ?? '');
    expect(labels.filter((label) => /Orchestrated|Agents|Auto/.test(label))).toEqual([]);
    expect(labels.filter((label) => label.startsWith('Runs'))).toHaveLength(1);
  });

  it('draws the same pages in the same order open and folded', () => {
    const open = renderPages({ variant: 'row' });
    const openNames = open
      .getAllByRole('button')
      .map((row) => row.querySelector('span')?.textContent);
    cleanup();
    const folded = renderPages({ variant: 'icon' });
    const foldedNames = folded
      .getAllByRole('button')
      .map((row) => row.getAttribute('aria-label')?.split(',')[0]);

    expect(openNames).toEqual(['Overview', 'Runs', 'Artifacts', 'Questions']);
    expect(foldedNames).toEqual(openNames);
  });

  it('puts the label, the fact and the shortcut in one tooltip on an open row', async () => {
    renderPages({ variant: 'row' });

    const text = await hover({ target: screen.getByRole('button', { name: /^Runs/ }) });

    expect(text).toContain('Runs, 1 running');
    expect(text).toContain(shortcutGlyphs('lens.workflows'));
  });

  it('puts the same tooltip on a folded row', async () => {
    renderPages({ variant: 'icon' });

    const text = await hover({ target: screen.getByRole('button', { name: 'Runs, 1 running' }) });

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

  it('marks a waiting question with a dot on the open and the folded row', () => {
    const open = renderPages({ variant: 'row' });
    const openTone = open.container
      .querySelector('[data-page-value="questions"]')
      ?.getAttribute('data-tone');
    cleanup();
    const folded = renderPages({ variant: 'icon' });
    const foldedDot = folded.container.querySelector(
      '[data-rail-page="page-questions"] span[aria-hidden]',
    );

    expect(openTone).not.toBe('count');
    expect(foldedDot?.childElementCount).toBe(1);
  });

  it('uses no native title on any row', () => {
    const { container } = renderPages({ variant: 'row' });

    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});
