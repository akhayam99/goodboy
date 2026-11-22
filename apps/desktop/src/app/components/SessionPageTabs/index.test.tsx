// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { LensKind } from '../../../store';
import {
  ledgerCore,
  mountOf,
  paymentsApi,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { SessionPageTabs } from '.';

const session = sessionOf({ goal: 'Reconcile the ledger export' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const openLens = ({ lens }: { readonly lens: LensKind | null }) => {
  act(() => {
    store.setState({ activeLens: { [session.id]: lens } });
  });
};

const pageTabs = () => within(screen.getByRole('tablist', { name: 'Session pages' }));

const selectedTab = (): string | null =>
  pageTabs()
    .queryAllByRole('tab')
    .find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent ?? null;

describe('the session page tabs', () => {
  it('reads Overview, Runs, Artifacts, Questions and Context on every session', () => {
    render(<SessionPageTabs session={session} />);

    const names = pageTabs()
      .getAllByRole('tab')
      .map((tab) => tab.textContent?.replace(/\d+$/, ''));
    expect(names).toEqual(['Overview', 'Runs', 'Artifacts', 'Questions', 'Context']);
  });

  it('adds the Changes shortcut last only while the session has exactly one branch', () => {
    const ledger = mountOf({ session, project: ledgerCore });
    const payments = mountOf({ session, project: paymentsApi });
    act(() => {
      store.setState({ sessionProjectMounts: { [session.id]: [ledger] } });
    });
    const view = render(<SessionPageTabs session={session} />);
    expect(pageTabs().getAllByRole('tab').at(-1)?.textContent).toBe('Changes');
    view.unmount();

    act(() => {
      store.setState({ sessionProjectMounts: { [session.id]: [ledger, payments] } });
    });
    render(<SessionPageTabs session={session} />);
    expect(pageTabs().queryByRole('tab', { name: /Changes/ })).toBeNull();
  });

  it.each([
    [null, 'Overview'],
    ['workflows', 'Runs'],
    ['orchestrated', 'Runs'],
    ['plans', 'Artifacts'],
    ['questions', 'Questions'],
    ['context', 'Context'],
  ] as const)('selects the tab of the stored %s page', (lens, name) => {
    openLens({ lens });
    render(<SessionPageTabs session={session} />);

    expect(selectedTab()).toContain(name);
  });

  it('opens the page of a tab that is pressed', () => {
    render(<SessionPageTabs session={session} />);

    fireEvent.click(pageTabs().getByRole('tab', { name: /Context/ }));

    expect(store.getState().activeLens[session.id]).toBe('context');
  });

  it('draws a tab count like a door count: one toned number, no dot beside it', () => {
    const source = readFileSync(join(__dirname, 'index.tsx'), 'utf8');

    expect(source).toContain('tintClasses(slot.tone).text');
    expect(source).toContain("'text-faint-foreground'");
    expect(source).not.toContain('StatusDot');
  });

  it('selects no tab on a page the tabs do not own', () => {
    openLens({ lens: 'linear' });
    render(<SessionPageTabs session={session} />);

    expect(selectedTab()).toBeNull();
  });
});
