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
import { brandId, type AutoTreeId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SETTING_WORK_ENABLED } from '../../../../shared/lib/workSetting';
import { LeadPermissionsChip } from '.';

let useAppStore: StoryStore;

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const TREE = brandId<AutoTreeId>({ value: 'tree-harborline' });

type FactsParams = {
  readonly leadRows: StoredLeadPermissionRows;
  readonly isPlanApprovalOff?: boolean;
};

const permissionsFor = ({ leadRows, isPlanApprovalOff = false }: FactsParams) =>
  leadPermissionsOf({
    leadRows,
    defaultRows: {},
    sessionLevel: 'plan',
    workspaceLevel: null,
    isPlanApprovalOff,
    isWorkFlowOn: true,
    spendLimitUsd: 10,
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ settings: { [SETTING_WORK_ENABLED]: 'true' } });
});

afterEach(cleanup);

const openLead = async () => {
  render(
    <LeadPermissionsChip target={{ workspaceId: WORKSPACE, sessionId: null, treeId: TREE }} />,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Asks you: (?!Loading)/ }));
  return within(screen.getByRole('dialog', { name: 'Asks you' }));
};

describe('LeadPermissionsChip', () => {
  it('shows This Lead with Reset for an override, and Reset writes the row away', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(permissionsFor({ leadRows: { push: 'ask' } }))
      .mockResolvedValue(permissionsFor({ leadRows: {} }));
    const change = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ readLeadPermissions: read, changeLeadPermission: change });
    const popover = await openLead();

    fireEvent.click(await popover.findByRole('button', { name: 'Use default' }));

    await waitFor(() =>
      expect(change).toHaveBeenCalledWith({
        target: { treeId: TREE },
        change: { key: 'push', value: null },
      }),
    );
    await waitFor(() => expect(popover.queryByRole('button', { name: 'Use default' })).toBeNull());
  });

  it('reads Custom as soon as a row is tightened', async () => {
    useAppStore.setState({
      readLeadPermissions: vi.fn().mockResolvedValue(permissionsFor({ leadRows: { push: 'ask' } })),
      changeLeadPermission: vi.fn(),
    });
    const popover = await openLead();

    const custom = await popover.findByRole('tab', { name: 'Custom' });
    expect(custom.getAttribute('aria-selected')).toBe('true');
  });

  it('shows the one line for a plan skip with writers set after the plan', async () => {
    useAppStore.setState({
      readLeadPermissions: vi
        .fn()
        .mockResolvedValue(
          permissionsFor({ leadRows: { approvePlan: 'skip', startWriters: 'afterPlan' } }),
        ),
      changeLeadPermission: vi.fn(),
    });
    const popover = await openLead();

    await popover.findByText('No plan is approved at this setting, so this reads as Ask.');
  });

  it('keeps the old value and shows the error under the row when a write fails', async () => {
    useAppStore.setState({
      readLeadPermissions: vi.fn().mockResolvedValue(permissionsFor({ leadRows: {} })),
      changeLeadPermission: vi.fn().mockRejectedValue(new Error('disk full')),
    });
    const popover = await openLead();

    const group = await popover.findByRole('tablist', { name: 'Push a branch' });
    fireEvent.click(within(group).getByRole('tab', { name: 'Ask' }));

    const alert = await popover.findByRole('alert');
    expect(alert.textContent).toContain('disk full');
    const checks = popover.getByRole('tab', { name: 'When checks pass' });
    expect(checks.getAttribute('aria-selected')).toBe('true');
  });
});
