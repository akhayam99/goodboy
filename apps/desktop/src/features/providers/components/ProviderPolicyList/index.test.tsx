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
import type {
  OverrideSettings,
  ProviderConnectionState,
  ProviderId,
  ProviderPolicy,
  WorkspaceId,
} from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../../providers';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ProvidersMenu } from '../../../../app/components/AppFooter/ProvidersMenu';
import { ProvidersInOrder } from '../ProviderStudio/DefaultsPanel/ProvidersInOrder';
import { ProviderPolicyList } from './index';

const WORKSPACE = aWorkspace({ id: 'workspace-harborline' as WorkspaceId, name: 'Harborline' });

type ProviderParams = {
  readonly id: ProviderId;
  readonly connection?: ProviderConnectionState;
};

const providerInfo = ({ id, connection = 'connected' }: ProviderParams): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection,
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const POLICY: ProviderPolicy = [
  { id: 'anthropic', state: 'on' },
  { id: 'codex', state: 'on' },
  { id: 'cursor', state: 'backup' },
];

type PayloadShape = {
  readonly overrides: OverrideSettings;
};

const isPayload = (value: unknown): value is PayloadShape =>
  typeof value === 'object' && value !== null && 'overrides' in value;

const writtenRows = (): ReadonlyArray<OverrideSettings> =>
  storySpies.tauriInvoke.mock.calls.flatMap(([command, args]) =>
    command === 'set_workspace_overrides' && isPayload(args) ? [args.overrides] : [],
  );

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = {
  readonly policy: ProviderPolicy | null;
  readonly providers?: ReadonlyArray<ProviderId>;
};

const seed = ({ policy, providers = ['anthropic', 'codex', 'cursor'] }: SeedParams) => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    providers: providers.map((id) => providerInfo({ id })),
    workspaceOverrides: { [WORKSPACE.id]: { ...WORKSPACE.overrides, providerPool: policy } },
  });
};

const renderList = () =>
  render(<ProviderPolicyList workspaceId={WORKSPACE.id} workspaceName="Harborline" hasReset />);

const rowNames = () =>
  within(screen.getByRole('list', { name: 'Providers, in order, for Harborline' }))
    .getAllByRole('listitem')
    .flatMap((item) => {
      const id = item.getAttribute('data-policy-row');
      return id === null ? [] : [id];
    });

beforeEach(async () => {
  await resetStoryStore();
  seed({ policy: POLICY });
});

afterEach(cleanup);

describe('ProviderPolicyList', () => {
  it('lists the providers in the saved order and says what each one does', () => {
    renderList();

    expect(rowNames()).toEqual(['anthropic', 'codex', 'cursor']);
    screen.getByText('Default for new work');
    screen.getByText('Used in this order');
    screen.getByText('Used when no On provider can work');
  });

  it('keeps each subtitle in its own column, beside the policy control and never under it', () => {
    renderList();

    const rows: ReadonlyArray<readonly [string, string]> = [
      ['Codex', 'Used in this order'],
      ['Cursor', 'Used when no On provider can work'],
    ];
    for (const [name, subtitle] of rows) {
      const text = screen.getByText(subtitle);
      const column = text.closest('button[aria-expanded]');
      const control = screen.getByRole('radiogroup', { name: `${name} policy` });
      expect(column?.contains(control)).toBe(false);
      expect(control.contains(text)).toBe(false);
      expect(column?.parentElement).toBe(control.parentElement);
    }
  });

  it('moves a provider up with Alt and the arrow and makes it the default', async () => {
    renderList();
    const codex = screen.getByRole('listitem', { name: /^Codex, position 2 of 3/ });

    fireEvent.keyDown(codex, { key: 'ArrowUp', altKey: true });

    await waitFor(() => expect(rowNames()).toEqual(['codex', 'anthropic', 'cursor']));
    const last = writtenRows().at(-1);
    expect(last?.providerPool?.map((entry) => entry.id)).toEqual(['codex', 'anthropic', 'cursor']);
    expect(last?.defaultProviderId).toBe('codex');
    screen.getByText('Codex is now the default for new work');
  });

  it('reorders by dragging the handle onto another row', async () => {
    renderList();
    const anthropicRow = screen.getByRole('listitem', { name: /^Claude, position 1/ });
    const grip = screen.getByRole('button', { name: 'Drag to reorder Cursor' });

    fireEvent.pointerDown(grip, { clientX: 10, clientY: 90 });
    const spy = vi.spyOn(document, 'elementFromPoint').mockReturnValue(anthropicRow);
    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(window);
    spy.mockRestore();

    await waitFor(() => expect(rowNames()).toEqual(['cursor', 'anthropic', 'codex']));
    expect(writtenRows().at(-1)?.defaultProviderId).toBe('anthropic');
  });

  it('sets Backup only and Off through the row segment', async () => {
    renderList();

    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Codex policy' })).getByRole('radio', {
        name: 'Off',
      }),
    );

    await waitFor(() =>
      expect(writtenRows().at(-1)?.providerPool).toEqual([
        { id: 'anthropic', state: 'on' },
        { id: 'codex', state: 'off' },
        { id: 'cursor', state: 'backup' },
      ]),
    );
    screen.getByText('Never used');
  });

  it('shows a provider connected after the policy at the end, new, until it is turned on', async () => {
    seed({ policy: POLICY, providers: ['anthropic', 'codex', 'cursor', 'gemini'] });
    renderList();

    expect(rowNames()).toEqual(['anthropic', 'codex', 'cursor', 'gemini']);
    screen.getByText('Connected just now. Not used until you turn it on.');
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));

    await waitFor(() =>
      expect(writtenRows().at(-1)?.providerPool?.at(-1)).toEqual({ id: 'gemini', state: 'on' }),
    );
  });

  it('keeps the two marks on the provider and suggests Backup only for pay-as-you-go', async () => {
    renderList();

    fireEvent.click(screen.getByRole('button', { name: /^Codex/, expanded: false }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pay-as-you-go' }));

    await waitFor(() =>
      expect(writtenRows().at(-1)?.providerPool?.[1]).toEqual({
        id: 'codex',
        state: 'on',
        payAsYouGo: true,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set Backup only' }));
    await waitFor(() => expect(writtenRows().at(-1)?.providerPool?.[1]?.state).toBe('backup'));
  });

  it('resets to every connected provider On with null', async () => {
    renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() => expect(writtenRows().at(-1)?.providerPool).toBeNull());
    expect(screen.getAllByRole('radio', { name: 'On', checked: true })).toHaveLength(3);
  });

  it('writes the same row whether the click comes from Defaults or from the footer', async () => {
    const defaults = render(<ProvidersInOrder workspaceId={WORKSPACE.id} />);
    fireEvent.click(screen.getByRole('button', { name: /Claude, Codex · Cursor as backup/ }));
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Cursor policy' })).getByRole('radio', {
        name: 'Off',
      }),
    );
    await waitFor(() => expect(writtenRows()).toHaveLength(1));
    const fromDefaults = writtenRows()[0];
    defaults.unmount();

    await resetStoryStore();
    seed({ policy: POLICY });
    render(<ProvidersMenu workspaceId={WORKSPACE.id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Providers' }));
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Cursor policy' })).getByRole('radio', {
        name: 'Off',
      }),
    );
    await waitFor(() => expect(writtenRows()).toHaveLength(1));

    expect(writtenRows()[0]).toEqual(fromDefaults);
  });
});
