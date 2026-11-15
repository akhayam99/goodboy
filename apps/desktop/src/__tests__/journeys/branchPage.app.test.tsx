// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { escapeLadder } from '../../features/session/escapeLadder';
import { BOARD_PLACE } from '../../store/slices/navigation/place';
import { captureLocation } from '../../store/slices/navigation/captureLocation';
import {
  WAIT,
  boot,
  clickBackArrow,
  click,
  clickButton,
  findSection,
  installNavigationHooks,
  installStoryBridge,
  openBranchFiles,
  sectionLabels,
  settle,
  useAppStore,
} from '../surfaces/navigation-flows/harness';

installNavigationHooks();
installStoryBridge();

const viewOf = () => {
  const { place } = captureLocation({ state: useAppStore.getState() });
  if (place.at !== 'session') {
    throw new Error('the place is not a session');
  }
  return place.view;
};

const branchTabNow = (): string | null => {
  const { target } = viewOf();
  return target?.kind === 'branch' ? target.tab : null;
};

const crumbNames = (): ReadonlyArray<string> =>
  within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');

const sessionTabNames = (): ReadonlyArray<string> =>
  within(screen.getByRole('tablist', { name: 'Session pages' }))
    .getAllByRole('tab')
    .map((tab) => (tab.textContent ?? '').replace(/\d+$/, ''));

const hasFilesRail = (): boolean => screen.queryByRole('button', { name: /^All files/ }) !== null;

const pressEsc = async (): Promise<void> => {
  act(() => escapeLadder({}));
  await settle();
};

describe('journey: the branch page, its tabs and its files rail', () => {
  it('lists the branch tabs in order and draws the files rail on Changes only', async () => {
    await boot({ seed: 'pr' });

    await openBranchFiles();

    expect(sectionLabels()).toEqual([
      'Conversation',
      'Changes',
      'Commits',
      'Checks',
      'Work',
      'Comments',
    ]);
    await click(await findSection(/^Changes/));
    expect(branchTabNow()).toBe('files');
    expect(hasFilesRail()).toBe(true);

    await click(await findSection(/^Commits/));
    expect(branchTabNow()).toBe('commits');
    expect(hasFilesRail()).toBe(false);

    await click(await findSection(/^Work/));
    expect(branchTabNow()).toBe('work');
    expect(hasFilesRail()).toBe(false);

    await click(await findSection(/^Changes/));
    expect(branchTabNow()).toBe('files');
    expect(hasFilesRail()).toBe(true);
  });

  it('opens the page under Overview as its first crumb and goes back to it from the crumb', async () => {
    await boot({ seed: 'pr' });
    await openBranchFiles();

    const crumbs = crumbNames();
    expect(crumbs[0]).toBe('Overview');
    expect(crumbs).toHaveLength(2);
    expect(screen.queryByRole('tablist', { name: 'Session pages' })).toBeNull();

    await click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', {
        name: 'Overview',
      }),
    );

    expect(viewOf().target).toBeNull();
    expect(viewOf().lens).toBeNull();
    expect(sessionTabNames()).toEqual(['Overview', 'Runs', 'Artifacts', 'Questions', 'Context']);
    expect(hasFilesRail()).toBe(false);
  });

  it('goes up to the Overview on Esc, the tab edits in place so one Esc is enough', async () => {
    await boot({ seed: 'pr' });
    await openBranchFiles();
    await click(await findSection(/^Commits/));
    await click(await findSection(/^Work/));
    await click(await findSection(/^Changes/));

    await pressEsc();

    expect(viewOf().target).toBeNull();
    expect(viewOf().lens).toBeNull();
  });

  it('goes back with the head back button to the page the branch was opened from', async () => {
    await boot({ seed: 'pr' });
    await openBranchFiles();
    expect(viewOf().lens).toBe('branch');

    await clickButton(/^Back to Overview/);

    expect(viewOf().lens).toBeNull();
    await waitFor(() => screen.getByRole('tablist', { name: 'Session pages' }), WAIT);
    await clickBackArrow();
    expect(viewOf()).toBeDefined();
  });

  it('crosses the session tabs one by one and keeps exactly one tab selected', async () => {
    await boot({ seed: 'pr' });
    const tabs = within(screen.getByRole('tablist', { name: 'Session pages' }));

    for (const label of [/^Runs/, /^Artifacts/, /^Questions/, /^Context/, /^Overview/]) {
      await click(tabs.getByRole('tab', { name: label }));
      const selected = tabs
        .getAllByRole('tab')
        .filter((tab) => tab.getAttribute('aria-selected') === 'true');
      expect(selected).toHaveLength(1);
      expect(selected[0]?.textContent).toMatch(label);
    }
    expect(viewOf().lens).toBeNull();
  });
});

describe('journey: the board opens a session', () => {
  it('goes from the board to a session row, onto its Overview tab, and Back returns to the board', async () => {
    await boot({ seed: 'pr' });
    const sessionId = useAppStore.getState().currentSessionId;
    act(() => useAppStore.getState().navigate({ to: BOARD_PLACE }));
    await settle();
    expect(captureLocation({ state: useAppStore.getState() }).place.at).toBe('board');

    const row = screen.getAllByRole('button', { name: /^Fix the rounding drift/ }).at(-1);
    if (row === undefined) {
      throw new Error('the board draws no row for the rounding session');
    }
    await click(row);

    const { place } = captureLocation({ state: useAppStore.getState() });
    expect(place.at).toBe('session');
    expect(place.at === 'session' && place.sessionId !== sessionId).toBe(true);
    expect(sessionTabNames()).toEqual([
      'Overview',
      'Runs',
      'Artifacts',
      'Questions',
      'Context',
      'Changes',
    ]);

    await clickBackArrow();
    expect(captureLocation({ state: useAppStore.getState() }).place.at).toBe('board');
  });
});
