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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { leadPermissionsOf, type StoredLeadPermissionRows } from '@goodboy/core/auto';
import { brandId, type AutoTreeId, type SessionId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { LeadPermissionsChip, type LeadPermissionsTarget } from '.';

let useAppStore: StoryStore;

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const TREE = brandId<AutoTreeId>({ value: 'tree-harborline' });
const LEAD: LeadPermissionsTarget = { workspaceId: WORKSPACE, sessionId: SESSION, treeId: TREE };

type FactsParams = {
  readonly leadRows: StoredLeadPermissionRows;
};

const permissionsFor = ({ leadRows }: FactsParams) =>
  leadPermissionsOf({
    leadRows,
    defaultRows: {},
    sessionLevel: 'plan',
    workspaceLevel: null,
    isPlanApprovalOff: false,
    isWorkFlowOn: true,
    spendLimitUsd: 10,
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type OpenParams = {
  readonly target: LeadPermissionsTarget;
  readonly word: RegExp;
};

const openMenu = async ({ target, word }: OpenParams) => {
  render(<LeadPermissionsChip target={target} />);
  fireEvent.click(await screen.findByRole('button', { name: word }));
  return within(screen.getByRole('menu', { name: 'Stops for your OK' }));
};

describe('LeadPermissionsChip', () => {
  it('opens a menu of three levels with the current one checked and Fine-tune last', async () => {
    useAppStore.setState({
      readLeadPermissions: vi.fn().mockResolvedValue(permissionsFor({ leadRows: {} })),
    });
    const menu = await openMenu({ target: LEAD, word: /^Stops for your OK: After the plan$/ });

    const levels = menu.getAllByRole('menuitemradio');
    expect(levels).toHaveLength(3);
    expect(levels.map((level) => level.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(menu.queryByRole('menuitem', { name: /^Reset/ })).toBeNull();
    menu.getByRole('menuitem', { name: /^Fine-tune this run/ });
  });

  it('reads Custom with the count, checks no level, and offers Reset', async () => {
    useAppStore.setState({
      readLeadPermissions: vi
        .fn()
        .mockResolvedValue(permissionsFor({ leadRows: { push: 'ask', dependencies: 'ask' } })),
    });
    const menu = await openMenu({
      target: LEAD,
      word: /^Stops for your OK: Custom, 2 details$/,
    });

    const checked = menu
      .getAllByRole('menuitemradio')
      .filter((level) => level.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(0);
    menu.getByRole('menuitem', { name: 'Reset to After the plan' });
  });

  it('Reset writes the level back on this Lead and the chip reads the level again', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(permissionsFor({ leadRows: { push: 'ask' } }))
      .mockResolvedValue(permissionsFor({ leadRows: {} }));
    const changeAutoLevel = vi.fn().mockResolvedValue(undefined);
    const change = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({
      readLeadPermissions: read,
      changeAutoLevel,
      changeLeadPermission: change,
    });
    const menu = await openMenu({ target: LEAD, word: /^Stops for your OK: Custom, 1 detail$/ });

    fireEvent.click(menu.getByRole('menuitem', { name: 'Reset to After the plan' }));

    await waitFor(() =>
      expect(changeAutoLevel).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        sessionId: SESSION,
        level: 'plan',
      }),
    );
    expect(change).toHaveBeenCalledWith({
      target: { treeId: TREE },
      change: { key: 'push', value: null },
    });
    await screen.findByRole('button', { name: 'Stops for your OK: After the plan' });
  });

  it('keeps the level and says why when the write fails', async () => {
    useAppStore.setState({
      readLeadPermissions: vi.fn().mockResolvedValue(permissionsFor({ leadRows: {} })),
      changeAutoLevel: vi.fn().mockRejectedValue(new Error('disk full')),
      changeLeadPermission: vi.fn(),
    });
    const menu = await openMenu({ target: LEAD, word: /^Stops for your OK: After the plan$/ });

    fireEvent.click(menu.getByRole('menuitemradio', { name: /^Never/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('disk full');
    screen.getByRole('button', { name: 'Stops for your OK: After the plan' });
  });

  it('Fine-tune this run opens the Lead details beside the chat', async () => {
    useAppStore.setState({
      readLeadPermissions: vi.fn().mockResolvedValue(permissionsFor({ leadRows: {} })),
    });
    const menu = await openMenu({ target: LEAD, word: /^Stops for your OK: After the plan$/ });

    fireEvent.click(menu.getByRole('menuitem', { name: /^Fine-tune this run/ }));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'lead-details',
      sessionId: SESSION,
      payload: { workspaceId: WORKSPACE, treeId: TREE },
    });
  });

  it('before a Lead exists, the last row points to Settings and nothing else edits details', async () => {
    useAppStore.setState({
      readLeadPermissions: vi.fn().mockResolvedValue(permissionsFor({ leadRows: {} })),
    });
    const menu = await openMenu({
      target: { workspaceId: WORKSPACE, sessionId: SESSION, treeId: null },
      word: /^Stops for your OK: After the plan$/,
    });

    menu.getByRole('menuitem', { name: /^Fine-tune in Settings/ });
    expect(menu.queryByRole('menuitem', { name: /^Fine-tune this run/ })).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});
