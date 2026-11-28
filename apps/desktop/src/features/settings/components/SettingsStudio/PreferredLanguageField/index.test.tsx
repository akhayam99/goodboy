// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { loadPreferredLanguage } from '../../../../../store/slices/settings/loadPreferredLanguage';
import { PreferredLanguageField } from './index';

const HARBORLINE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'ws-northwind' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type RowParams = {
  readonly workspaceId: WorkspaceId;
  readonly value: string | null;
};

const rows = new Map<WorkspaceId, string>();

const seed = ({ workspaceId, value }: RowParams) => {
  if (value !== null) {
    rows.set(workspaceId, value);
  }
};

type TargetParams = {
  readonly params: unknown;
};

const targetOf = ({ params }: TargetParams): RowParams => {
  if (
    typeof params !== 'object' ||
    params === null ||
    !('workspaceId' in params) ||
    typeof params.workspaceId !== 'string'
  ) {
    throw new Error('the call names no workspace');
  }
  const value = 'value' in params && typeof params.value === 'string' ? params.value : null;
  return { workspaceId: brandId<WorkspaceId>({ value: params.workspaceId }), value };
};

beforeEach(async () => {
  await resetStoryStore();
  rows.clear();
  storySpies.getWorkspaceValue.mockImplementation(
    async (params) => rows.get(targetOf({ params }).workspaceId) ?? null,
  );
  storySpies.setWorkspaceValue.mockImplementation(async (params) => {
    const { workspaceId, value } = targetOf({ params });
    if (value === null) {
      rows.delete(workspaceId);
      return;
    }
    rows.set(workspaceId, value);
  });
});

afterEach(cleanup);

const mount = ({ workspaceId }: { readonly workspaceId: WorkspaceId }) =>
  render(
    <ToastProvider>
      <PreferredLanguageField workspaceId={workspaceId} />
    </ToastProvider>,
  );

const picker = () => screen.getByRole('combobox', { name: 'Preferred language' });

const choose = (name: string) => {
  fireEvent.click(picker());
  fireEvent.click(screen.getByRole('option', { name }));
};

describe('PreferredLanguageField', () => {
  it('shows Auto when nothing is stored', async () => {
    mount({ workspaceId: HARBORLINE });

    await waitFor(() => expect(picker().textContent).toContain('Auto'));
    expect(
      await loadPreferredLanguage({ get: store.getState, workspaceId: HARBORLINE }),
    ).toBeNull();
  });

  it('labels the languages by their native names and saves the code', async () => {
    mount({ workspaceId: HARBORLINE });

    choose('Italiano');

    await waitFor(() =>
      expect(storySpies.setWorkspaceValue).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: HARBORLINE,
          key: 'session.language',
          value: 'it',
        }),
      ),
    );
    await waitFor(() => expect(picker().textContent).toContain('Italiano'));
    expect(await loadPreferredLanguage({ get: store.getState, workspaceId: HARBORLINE })).toBe(
      'it',
    );
  });

  it('clears the stored value when the choice goes back to Auto', async () => {
    seed({ workspaceId: HARBORLINE, value: 'it' });
    mount({ workspaceId: HARBORLINE });
    await waitFor(() => expect(picker().textContent).toContain('Italiano'));

    choose('Auto');

    await waitFor(() =>
      expect(storySpies.setWorkspaceValue).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'session.language', value: null }),
      ),
    );
    expect(
      await loadPreferredLanguage({ get: store.getState, workspaceId: HARBORLINE }),
    ).toBeNull();
  });

  it('keeps each workspace on its own setting', async () => {
    seed({ workspaceId: HARBORLINE, value: 'it' });
    seed({ workspaceId: NORTHWIND, value: 'de' });
    const first = mount({ workspaceId: HARBORLINE });
    await waitFor(() => expect(picker().textContent).toContain('Italiano'));
    first.unmount();
    mount({ workspaceId: NORTHWIND });
    await waitFor(() => expect(picker().textContent).toContain('Deutsch'));

    expect(await loadPreferredLanguage({ get: store.getState, workspaceId: HARBORLINE })).toBe(
      'it',
    );
    expect(await loadPreferredLanguage({ get: store.getState, workspaceId: NORTHWIND })).toBe('de');
  });

  it('keeps the old value and shows the error when the save fails', async () => {
    seed({ workspaceId: HARBORLINE, value: 'it' });
    storySpies.setWorkspaceValue.mockRejectedValue(new Error('disk is full'));
    mount({ workspaceId: HARBORLINE });
    await waitFor(() => expect(picker().textContent).toContain('Italiano'));

    choose('Español');

    await screen.findByText(/Couldn't save. Still Italiano/);
    expect(picker().textContent).toContain('Italiano');
    expect(await loadPreferredLanguage({ get: store.getState, workspaceId: HARBORLINE })).toBe(
      'it',
    );
  });
});
