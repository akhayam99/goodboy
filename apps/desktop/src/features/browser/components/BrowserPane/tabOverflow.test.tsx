// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStorySession,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { BrowserTabFacts } from '../../types';
import { BrowserPane } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const TITLES = [
  'Checkout',
  'Tax rates',
  'notify-relay webhooks',
  'Ledger entries',
  'payments-api health',
  'Acme invoices',
  'Northwind orders',
  'Cascadia status',
];

type IndexParams = {
  readonly index: number;
};

let store: StoryStore;

const rowOf = ({ index }: IndexParams): BrowserTab => ({
  id: `row-${index}`,
  sessionId: SESSION_ID,
  projectId: null,
  url: `http://localhost:5173/page-${index}`,
  title: TITLES[index] ?? `Harborline ${index}`,
  position: index,
  createdAt: 1,
  updatedAt: 1,
});

const factsOf = ({ index }: IndexParams): BrowserTabFacts => ({
  id: `live-${index}`,
  sessionId: SESSION_ID,
  url: `http://localhost:5173/page-${index}`,
  title: TITLES[index] ?? `Harborline ${index}`,
  state: 'live',
  isShown: index === 0,
  hiddenSinceMs: null,
  openerId: null,
  isPasskeyBlocked: false,
});

const ROWS = TITLES.map((_, index) => rowOf({ index }));
const LIVE = TITLES.map((_, index) => factsOf({ index }));

const renderPane = () =>
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );

const rowOfPane = (): HTMLElement => {
  const row = document.querySelector<HTMLElement>('[data-browser-row]');
  if (row === null) {
    throw new Error('The pane draws no browser row.');
  }
  return row;
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    browserSessionTabs: { [SESSION_ID]: ROWS },
    browserActiveTab: { [SESSION_ID]: 'row-0' },
    browserShownPin: { [SESSION_ID]: null },
    browserLiveTabs: {
      [SESSION_ID]: Object.fromEntries(ROWS.map((row, index) => [row.id, `live-${index}`])),
    },
  });
  stubStoryInvoke({
    browser_tab_rows_list: () => ROWS,
    browser_workspace_tab_rows_list: () => ROWS,
    browser_tab_list: () => LIVE,
    browser_visits_list: [],
    browser_history_state: null,
    browser_console_read: { doc: null, entries: [], watermark: 0, isHeard: false },
    browser_favicon: null,
    browser_tab_place: null,
    browser_tab_show: () => LIVE[0],
    browser_tab_hide: () => LIVE[0],
  });
});

afterEach(cleanup);

describe('the browser tabs in one row', () => {
  it('puts the tabs in the address row, with no second strip under it', async () => {
    renderPane();

    const tabs = await screen.findByRole('navigation', { name: 'Browser tabs' });

    expect(rowOfPane().contains(tabs)).toBe(true);
    expect(document.querySelector('[data-tool-tab-strip]')).toBeNull();
  });

  it('lets the inactive tabs shrink to their icon and keeps the shown one wide', async () => {
    renderPane();

    const tabs = await screen.findByRole('navigation', { name: 'Browser tabs' });
    const inactive = Array.from(tabs.querySelectorAll<HTMLElement>('[data-browser-tab="tab"]'));
    const shown = tabs.querySelectorAll<HTMLElement>('[data-browser-tab="active"]');

    expect(inactive).toHaveLength(TITLES.length - 1);
    expect(shown).toHaveLength(1);
    for (const chip of inactive) {
      expect(chip.className.split(/\s+/)).toEqual(expect.arrayContaining(['shrink', 'min-w-8']));
      expect(chip.className.split(/\s+/)).not.toContain('shrink-0');
    }
    expect(tabs.closest('.overflow-x-auto')).not.toBeNull();
  });

  it('shows the title and the address on the shown tab', async () => {
    renderPane();

    const tabs = await screen.findByRole('navigation', { name: 'Browser tabs' });
    const shown = within(tabs).getByRole('button', { name: /^Edit address, Checkout/ });

    expect(shown.getAttribute('aria-current')).toBe('page');
    within(shown).getByText('Checkout');
    within(shown).getByText('localhost:5173');
  });

  it('opens the address field in place of the shown tab on a click', async () => {
    renderPane();

    const tabs = await screen.findByRole('navigation', { name: 'Browser tabs' });
    fireEvent.click(within(tabs).getByRole('button', { name: /^Edit address, Checkout/ }));

    const field = within(tabs).getByRole('combobox', { name: 'Address or search' });
    expect(field).toHaveProperty('value', 'http://localhost:5173/page-0');
    within(tabs).getByRole('button', { name: 'Tax rates' });
  });

  it('shows the page flush under the row, with no card, border or inset around it', async () => {
    renderPane();

    await screen.findByRole('navigation', { name: 'Browser tabs' });
    const stage = document.querySelector<HTMLElement>('[data-browser-stage]');
    const frame = document.querySelector<HTMLElement>('[data-browser-frame]');
    const classes = `${stage?.className ?? ''} ${frame?.className ?? ''}`.split(/\s+/);

    expect(stage).not.toBeNull();
    expect(frame).not.toBeNull();
    expect(classes.filter((name) => /^(p|px|pb|pt|m|mx|my)-/.test(name))).toEqual([]);
    expect(classes).not.toContain('rounded-lg');
    expect(classes).not.toContain('border');
    expect(rowOfPane().parentElement?.className.split(/\s+/)).not.toContain('gap-3');
  });
});
