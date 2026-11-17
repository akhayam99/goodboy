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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  leadPermissionsOf,
  type AutoLevel,
  type LeadPermissions,
  type StoredLeadPermissionRows,
} from '@goodboy/core/auto';
import { brandId, type AutoTreeId, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { LeadPermissionChange } from '../../../../store/runtime/auto/level/writeLeadPermission';
import { LeadPermissionsChip } from '../LeadPermissionsChip';
import { LeadDetailsDrawer } from '.';

let useAppStore: StoryStore;

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const TREE = brandId<AutoTreeId>({ value: 'tree-harborline' });

type FactsParams = {
  readonly leadRows: StoredLeadPermissionRows;
  readonly level: AutoLevel;
};

const permissionsFor = ({ leadRows, level }: FactsParams) =>
  leadPermissionsOf({
    leadRows,
    defaultRows: {},
    sessionLevel: level,
    workspaceLevel: null,
    isPlanApprovalOff: false,
    isWorkFlowOn: true,
    spendLimitUsd: 10,
  });

type BackendParams = {
  readonly leadRows: StoredLeadPermissionRows;
};

type ChangeParams = {
  readonly change: LeadPermissionChange;
};

type LevelParams = {
  readonly level: AutoLevel;
};

const withBackend = ({ leadRows }: BackendParams) => {
  let rows = leadRows;
  let level: AutoLevel = 'plan';
  const read = vi.fn(async () => permissionsFor({ leadRows: rows, level }));
  const change = vi.fn(async ({ change: next }: ChangeParams): Promise<void> => {
    const kept = Object.entries(rows).filter(([key]) => key !== next.key);
    rows = Object.fromEntries(next.value === null ? kept : [...kept, [next.key, next.value]]);
  });
  const changeAutoLevel = vi.fn(async ({ level: picked }: LevelParams): Promise<void> => {
    level = picked;
  });
  useAppStore.setState({
    readLeadPermissions: read,
    changeLeadPermission: change,
    changeAutoLevel,
  });
  return { read, change };
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderBoth = () =>
  render(
    <>
      <LeadPermissionsChip target={{ workspaceId: WORKSPACE, sessionId: SESSION, treeId: TREE }} />
      <LeadDetailsDrawer
        sessionId={SESSION}
        workspaceId={WORKSPACE}
        treeId={TREE}
        onClose={() => undefined}
      />
    </>,
  );

type MenuParams = {
  readonly word: string;
};

const chipMenu = async ({ word }: MenuParams) => {
  fireEvent.click(await screen.findByRole('button', { name: `Stops for your OK: ${word}` }));
  return within(screen.getByRole('menu', { name: 'Stops for your OK' }));
};

type TabParams = {
  readonly name: string;
};

const pushTab = async ({ name }: TabParams) =>
  within(await screen.findByRole('tablist', { name: 'Push a branch' })).getByRole('tab', {
    name,
  });

describe('Lead details drawer and the status line chip', () => {
  it('a write in the drawer turns the chip to Custom with Reset', async () => {
    withBackend({ leadRows: {} });
    renderBoth();
    await screen.findByRole('button', { name: 'Stops for your OK: After the plan' });

    fireEvent.click(await pushTab({ name: 'Ask first' }));

    const menu = await chipMenu({ word: 'Custom, 1 detail' });
    menu.getByRole('menuitem', { name: 'Reset to After the plan' });
  });

  it('Reset in the chip menu puts the drawer rows back to the level', async () => {
    withBackend({ leadRows: { push: 'ask' } });
    renderBoth();
    expect((await pushTab({ name: 'Ask first' })).getAttribute('aria-selected')).toBe('true');

    const menu = await chipMenu({ word: 'Custom, 1 detail' });
    fireEvent.click(menu.getByRole('menuitem', { name: 'Reset to After the plan' }));

    await screen.findByRole('button', { name: 'Stops for your OK: After the plan' });
    await waitFor(async () =>
      expect((await pushTab({ name: 'When checks pass' })).getAttribute('aria-selected')).toBe(
        'true',
      ),
    );
  });

  it('a failed write leaves the chip and the drawer as they were', async () => {
    const { read } = withBackend({ leadRows: {} });
    useAppStore.setState({
      changeLeadPermission: vi.fn().mockRejectedValue(new Error('disk full')),
    });
    renderBoth();
    await screen.findByRole('button', { name: 'Stops for your OK: After the plan' });
    const readsBefore = read.mock.calls.length;

    fireEvent.click(await pushTab({ name: 'Ask first' }));

    expect((await screen.findByRole('alert')).textContent).toContain('disk full');
    expect(useAppStore.getState().leadPermissionsRevisionByWorkspace).toEqual({});
    expect(read.mock.calls.length).toBe(readsBefore + 1);
    screen.getByRole('button', { name: 'Stops for your OK: After the plan' });
    expect((await pushTab({ name: 'When checks pass' })).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('drops a late answer for an older read after two changes elsewhere', async () => {
    const answers: Array<(value: LeadPermissions) => void> = [];
    useAppStore.setState({
      readLeadPermissions: vi
        .fn()
        .mockResolvedValueOnce(permissionsFor({ leadRows: {}, level: 'plan' }))
        .mockImplementation(
          () =>
            new Promise<LeadPermissions>((resolve) => {
              answers.push(resolve);
            }),
        ),
    });
    render(
      <LeadPermissionsChip target={{ workspaceId: WORKSPACE, sessionId: SESSION, treeId: TREE }} />,
    );
    await screen.findByRole('button', { name: 'Stops for your OK: After the plan' });

    act(() => {
      useAppStore.getState().markLeadPermissionsChanged({ workspaceId: WORKSPACE });
    });
    act(() => {
      useAppStore.getState().markLeadPermissionsChanged({ workspaceId: WORKSPACE });
    });
    expect(answers).toHaveLength(2);

    await act(async () => {
      answers[1]?.(
        permissionsFor({ leadRows: { push: 'ask', dependencies: 'ask' }, level: 'plan' }),
      );
    });
    await act(async () => {
      answers[0]?.(permissionsFor({ leadRows: { push: 'ask' }, level: 'plan' }));
    });

    screen.getByRole('button', { name: 'Stops for your OK: Custom, 2 details' });
  });
});
