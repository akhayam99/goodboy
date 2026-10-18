// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_R1_INACTIVE_SCENES } from './r1-inactive';

type SceneName = keyof typeof U25_R1_INACTIVE_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const INACTIVE = [
  { title: 'Write the notify-relay digest', age: '4d ago' },
  { title: 'Paginate the payments list', age: '6d ago' },
  { title: 'Move the ledger export to a queue', age: '12d ago' },
];

const INACTIVE_ROWS = INACTIVE.map((row) => ({ title: row.title, trailing: null }));

const STAYING = [
  'Reconcile the ledger export',
  'Stop notify-relay posting a webhook twice',
  'Stop notify-relay retries on a 409',
  'Add idempotency keys to payments-api',
  'Tune the payments rate limiter',
  'Backfill the settlement dates',
];

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_R1_INACTIVE_SCENES[name];
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await waitFor(() => expect(document.querySelector('[data-column-sessions]')).not.toBeNull());
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const sessionList = (): HTMLElement => {
  const list = document.querySelector('[data-column-sessions]');
  if (!(list instanceof HTMLElement)) {
    throw new Error('the scene has no sessions list');
  }
  return list;
};

type RootParams = {
  readonly root: ParentNode;
};

const sidebarRows = ({ root }: RootParams) =>
  Array.from(root.querySelectorAll<HTMLElement>('button[data-select-id]')).map((button) => {
    const trailing = button.querySelector('[data-row-trailing]');
    return {
      title: (trailing?.previousElementSibling ?? button.firstElementChild)?.textContent ?? '',
      trailing: trailing?.textContent ?? null,
    };
  });

const sidebarInactive = () => {
  const header = within(sessionList()).getByText('Inactive');
  const group = header.closest('div.flex.flex-col');
  if (group === null) {
    throw new Error('the Inactive header has no group');
  }
  return group;
};

describe('the r1 inactive sessions scenes', () => {
  it('are registered under their keys', () => {
    for (const name of Object.keys(U25_R1_INACTIVE_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('r1-inactive-sidebar closes the list with Inactive 3, newest first, and keeps every busy session above it', async () => {
    await mount('r1-inactive-sidebar');

    await waitFor(() => expect(within(sessionList()).getByText('Inactive')).toBeDefined());
    expect(sidebarInactive().textContent).toContain('Inactive3');
    expect(sidebarRows({ root: sidebarInactive() })).toEqual(INACTIVE_ROWS);
    const rows = sidebarRows({ root: sessionList() });
    expect(rows.slice(-3)).toEqual(INACTIVE_ROWS);
    expect(
      rows
        .slice(0, -3)
        .map((row) => row.title)
        .sort(),
    ).toEqual([...STAYING].sort());
    expect(rows.slice(0, -3).every((row) => row.trailing === null)).toBe(true);
  });

  it('r1-inactive-sidebar-grouped ends the project groups with a foldable Inactive group', async () => {
    await mount('r1-inactive-sidebar-grouped');

    const header = await within(sessionList()).findByRole('button', { name: /^Inactive/ });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    const headers = Array.from(sessionList().querySelectorAll('button[aria-expanded]'))
      .map((button) => button.textContent ?? '')
      .filter((text) => text !== '');
    expect(headers.at(-1)).toBe('Inactive3');
    expect(sidebarRows({ root: sidebarInactive() })).toEqual(INACTIVE_ROWS);
  });

  it('r1-inactive-list keeps an inactive session in its stage group, its last column says how long', async () => {
    await mount('r1-inactive-list');

    const list = await screen.findByRole('list', { name: 'Sessions' });
    expect(screen.queryByRole('heading', { level: 2, name: 'Inactive' })).toBeNull();
    for (const inactive of INACTIVE) {
      const row = within(list).getByRole('button', { name: inactive.title });
      expect(row.textContent).toContain(inactive.age);
      expect(row.closest('li')?.parentElement?.closest('li')).not.toBeNull();
    }
  });

  it('r1-inactive-list-grouped groups by the board stages in lane order and adds no Inactive group', async () => {
    await mount('r1-inactive-list-grouped');

    await screen.findByRole('list', { name: 'Sessions' });
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent ?? '');
    const LANE_ORDER = ['Building', 'Running', 'Needs you', 'In review', 'Done', 'Archived'];
    expect(headings.length).toBeGreaterThan(1);
    expect(headings.every((heading) => LANE_ORDER.includes(heading))).toBe(true);
    expect([...headings].sort((a, b) => LANE_ORDER.indexOf(a) - LANE_ORDER.indexOf(b))).toEqual(
      headings,
    );
  });
});
