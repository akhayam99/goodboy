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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { LensKind } from '../../../store';
import { sessionOf } from '../../../features/workspace/testing/sessionColumn';
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

const selectedTab = (): string | null =>
  screen.queryAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')
    ?.textContent ?? null;

describe('the session page tabs', () => {
  it('reads Overview, Changes, Runs, Artifacts, Questions and Context on every session', () => {
    render(<SessionPageTabs session={session} />);

    screen.getByRole('tablist', { name: 'Session pages' });
    const names = screen.getAllByRole('tab').map((tab) => tab.textContent?.replace(/\d+$/, ''));
    expect(names).toEqual(['Overview', 'Changes', 'Runs', 'Artifacts', 'Questions', 'Context']);
  });

  it('reads Changes with a branch and without one', () => {
    act(() => {
      store.setState({ sessionBranches: { [session.id]: 'fix-duplicate-credit' } });
    });
    render(<SessionPageTabs session={session} />);

    screen.getByRole('tab', { name: /Changes/ });
  });

  it.each([
    [null, 'Overview'],
    ['files', 'Changes'],
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

    fireEvent.click(screen.getByRole('tab', { name: /Context/ }));

    expect(store.getState().activeLens[session.id]).toBe('context');
  });

  it('selects no tab on a page the tabs do not own', () => {
    openLens({ lens: 'linear' });
    render(<SessionPageTabs session={session} />);

    expect(selectedTab()).toBeNull();
  });
});
