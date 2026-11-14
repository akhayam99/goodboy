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
import { LeadPermissionsData } from '.';

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

const renderLead = () =>
  render(
    <LeadPermissionsData workspaceId={WORKSPACE} sessionId={null} treeId={TREE} scope="lead" />,
  );

describe('LeadPermissionsData', () => {
  it('shows This Lead with Reset for an override, and Reset writes the row away', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(permissionsFor({ leadRows: { push: 'ask' } }))
      .mockResolvedValue(permissionsFor({ leadRows: {} }));
    const change = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ readLeadPermissions: read, changeLeadPermission: change });
    renderLead();

    await screen.findByText('This Lead');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() =>
      expect(change).toHaveBeenCalledWith({
        target: { treeId: TREE },
        change: { key: 'push', value: null },
      }),
    );
    await waitFor(() => expect(screen.queryByText('This Lead')).toBeNull());
  });

  it('reads Custom as soon as a row is tightened', async () => {
    useAppStore.setState({
      readLeadPermissions: vi.fn().mockResolvedValue(permissionsFor({ leadRows: { push: 'ask' } })),
      changeLeadPermission: vi.fn(),
    });
    renderLead();

    const custom = await screen.findByRole('tab', { name: 'Custom' });
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
    renderLead();

    await screen.findByText('No plan is approved at this setting, so this reads as Ask.');
  });

  it('keeps the old value and shows the error under the row when a write fails', async () => {
    useAppStore.setState({
      readLeadPermissions: vi.fn().mockResolvedValue(permissionsFor({ leadRows: {} })),
      changeLeadPermission: vi.fn().mockRejectedValue(new Error('disk full')),
    });
    renderLead();

    const group = await screen.findByRole('tablist', { name: 'Push a branch' });
    fireEvent.click(within(group).getByRole('tab', { name: 'Ask' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('disk full');
    const checks = screen.getByRole('tab', { name: 'When checks pass' });
    expect(checks.getAttribute('aria-selected')).toBe('true');
  });
});
