// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type {
  ProviderConnectionState,
  ProviderId,
  ProviderPolicy,
  RoleModelPreference,
} from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import type { ProviderDisplayInfo } from '../../../../providers';
import { RoleRow } from './index';

const WORKSPACE = aWorkspace({ name: 'Harborline' });

const OPUS_PIN: RoleModelPreference = {
  providerId: 'anthropic',
  model: 'claude-opus-5-5',
  effort: 'high',
};

const CODEX_ONLY: ProviderPolicy = [
  { id: 'codex', state: 'on' },
  { id: 'anthropic', state: 'off' },
];

const CLAUDE_ON: ProviderPolicy = [
  { id: 'anthropic', state: 'on' },
  { id: 'codex', state: 'on' },
];

const providerInfo = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected' satisfies ProviderConnectionState,
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type RowParams = {
  readonly preference: RoleModelPreference | null;
  readonly policy: ProviderPolicy;
};

const row = ({ preference, policy }: RowParams) => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    providers: [providerInfo({ id: 'anthropic' }), providerInfo({ id: 'codex' })],
    workspaceOverrides: {
      [WORKSPACE.id]: {
        ...WORKSPACE.overrides,
        providerPool: policy,
        ...(preference !== null && { roleModels: { planner: preference } }),
      },
    },
  });
  render(
    <RoleRow
      workspaceId={WORKSPACE.id}
      role="planner"
      label="Planner"
      help="Writes the plan."
      preference={preference}
      isParallelOn={false}
      connectedProviderIds={['anthropic', 'codex']}
      disabled={false}
      onChange={vi.fn()}
    />,
  );
  return screen.getByRole('button', { name: (name) => name.startsWith('Planner') });
};

describe('RoleRow', () => {
  it('shows the model that runs, the Pinned chip and why the pin is skipped when its provider is Off', () => {
    const trigger = row({ preference: OPUS_PIN, policy: CODEX_ONLY });

    const summary = trigger.querySelector<HTMLElement>('[data-role-summary]');
    expect(summary?.textContent).toContain('Astra');
    expect(summary?.textContent).not.toContain('Opus');
    expect(trigger.textContent).toContain('Pinned');
    expect(
      screen.getByText('Pinned Opus 5.5 is skipped: Claude is Off. Using Astra.'),
    ).toBeDefined();
  });

  it('shows the pinned model and no line while its provider is On', () => {
    const trigger = row({ preference: OPUS_PIN, policy: CLAUDE_ON });

    const summary = trigger.querySelector<HTMLElement>('[data-role-summary]');
    expect(summary?.textContent).toBe('Opus 5.5·High');
    expect(trigger.textContent).toContain('Pinned');
    expect(screen.queryByText(/is skipped/)).toBeNull();
    expect(screen.getByText('Writes the plan.')).toBeDefined();
  });

  it('calls a row with no pin Auto', () => {
    const trigger = row({ preference: null, policy: CODEX_ONLY });

    expect(trigger.textContent).toContain('Auto');
    expect(trigger.textContent).not.toContain('Pinned');
    expect(screen.queryByText(/is skipped/)).toBeNull();
  });
});
