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
import { LeadDetailsDrawer } from '.';

let useAppStore: StoryStore;

const WORKSPACE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const TREE = brandId<AutoTreeId>({ value: 'tree-harborline' });

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

const renderDrawer = () =>
  render(
    <LeadDetailsDrawer
      sessionId={SESSION}
      workspaceId={WORKSPACE}
      treeId={TREE}
      onClose={() => undefined}
    />,
  );

describe('LeadDetailsDrawer', () => {
  it('writes a changed detail to this Lead only, and reads Custom after', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(permissionsFor({ leadRows: {} }))
      .mockResolvedValue(permissionsFor({ leadRows: { push: 'ask' } }));
    const change = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ readLeadPermissions: read, changeLeadPermission: change });
    renderDrawer();

    const row = await screen.findByRole('tablist', { name: 'Push a branch' });
    fireEvent.click(within(row).getByRole('tab', { name: 'Ask first' }));

    await waitFor(() =>
      expect(change).toHaveBeenCalledWith({
        target: { treeId: TREE },
        change: { key: 'push', value: 'ask' },
      }),
    );
    await screen.findByText('Custom: 1 detail differs from After the plan.');
    screen.getByRole('button', { name: 'Reset to After the plan' });
  });

  it('keeps the old value and shows the error under the row when a write fails', async () => {
    useAppStore.setState({
      readLeadPermissions: vi.fn().mockResolvedValue(permissionsFor({ leadRows: {} })),
      changeLeadPermission: vi.fn().mockRejectedValue(new Error('disk full')),
    });
    renderDrawer();

    const row = await screen.findByRole('tablist', { name: 'Push a branch' });
    fireEvent.click(within(row).getByRole('tab', { name: 'Ask first' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('disk full');
    const checks = within(row).getByRole('tab', { name: 'When checks pass' });
    expect(checks.getAttribute('aria-selected')).toBe('true');
  });

  it('says in one line what never changes, with no limit row and no sentence', async () => {
    useAppStore.setState({
      readLeadPermissions: vi.fn().mockResolvedValue(permissionsFor({ leadRows: {} })),
    });
    renderDrawer();

    await screen.findByText(
      'Always: force push asks, you merge, agents never push, the Lead never writes code.',
    );
    expect(screen.queryByText(/asks you before/)).toBeNull();
    expect(document.querySelector('[data-permission-row="spendLimit"]')).toBeNull();
  });
});
