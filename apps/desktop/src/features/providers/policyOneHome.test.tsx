// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  DEFAULT_WORKFLOW_RULES,
  type OverrideSettings,
  type ProviderConnectionState,
  type ProviderId,
  type ProviderPolicy,
  type WorkflowRules,
  type WorkspaceId,
} from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import { WorkflowRulesPanel } from '../workflows/components/WorkflowRulesPanel';
import { ProvidersInOrder } from './components/ProviderStudio/DefaultsPanel/ProvidersInOrder';
import type { ProviderDisplayInfo } from './providers';

const WORKSPACE = aWorkspace({ id: 'workspace-harborline' as WorkspaceId, name: 'Harborline' });

const SPREAD_LABEL = 'Send new steps to the provider with the most room';

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

const POLICY: ProviderPolicy = [
  { id: 'anthropic', state: 'on' },
  { id: 'codex', state: 'on' },
  { id: 'cursor', state: 'backup' },
];

const CURSOR_ONLY: ProviderPolicy = [{ id: 'cursor', state: 'on' }];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type SeedParams = {
  readonly policy: ProviderPolicy;
  readonly rules?: Partial<WorkflowRules>;
};

const seed = ({ policy, rules }: SeedParams) => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    providers: (['anthropic', 'codex', 'cursor'] as const).map((id) => providerInfo({ id })),
    workspaceOverrides: {
      [WORKSPACE.id]: {
        ...WORKSPACE.overrides,
        providerPool: policy,
        ...(rules !== undefined && { workflowRules: { ...DEFAULT_WORKFLOW_RULES, ...rules } }),
      },
    },
  });
};

const writtenRules = (): ReadonlyArray<WorkflowRules | null | undefined> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'set_workspace_overrides')
    .map(([, args]) => (args as { readonly overrides: OverrideSettings }).overrides.workflowRules);

const openPopover = () => {
  render(<ProvidersInOrder workspaceId={WORKSPACE.id} />);
  fireEvent.click(screen.getByRole('button', { expanded: false, name: /Claude|Cursor/ }));
  return within(screen.getByRole('dialog', { name: 'When a provider is out' }));
};

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ set_workspace_overrides: null });
});

afterEach(cleanup);

describe('the provider policy has one home', () => {
  it('writes spreadByHeadroom on the workflow rules from the Providers popover', async () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: false } });
    const popover = openPopover();

    const toggle = popover.getByRole('switch', { name: SPREAD_LABEL });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);

    await waitFor(() => expect(writtenRules().at(-1)?.spreadByHeadroom).toBe(true));
    expect(useAppStore.getState().workspaceOverrides[WORKSPACE.id]?.workflowRules).toMatchObject({
      spreadByHeadroom: true,
      autonomy: DEFAULT_WORKFLOW_RULES.autonomy,
    });
    expect(popover.getByRole('switch', { name: SPREAD_LABEL }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('turns the rule off again through the same switch', async () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: true } });
    const popover = openPopover();

    fireEvent.click(popover.getByRole('switch', { name: SPREAD_LABEL }));

    await waitFor(() => expect(writtenRules().at(-1)?.spreadByHeadroom).toBe(false));
  });

  it('disables the option and says why when no On provider reports limits', () => {
    seed({ policy: CURSOR_ONLY, rules: { spreadByHeadroom: true } });
    const popover = openPopover();

    const toggle = popover.getByRole('switch', { name: SPREAD_LABEL });
    expect(toggle.hasAttribute('disabled')).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(popover.getByText('Needs a provider that reports limits')).toBeDefined();
  });

  it('shows Run defaults a summary and a link, never a second switch for the policy', () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: true } });
    render(<WorkflowRulesPanel workspaceId={WORKSPACE.id} />);

    const band = screen.getByRole('region', { name: 'Providers' });
    expect(within(band).queryAllByRole('switch')).toEqual([]);
    expect(within(band).getByRole('button', { name: 'Open Providers & models' })).toBeDefined();
    expect(within(band).getByTestId('rules-policy-summary').textContent).toBe(
      'Claude, Codex · Cursor as backup',
    );
  });

  it('keeps the two screens in step after the policy changes in Providers', async () => {
    seed({ policy: POLICY, rules: { spreadByHeadroom: false } });
    const popover = openPopover();
    fireEvent.click(popover.getByRole('switch', { name: SPREAD_LABEL }));
    await waitFor(() =>
      expect(useAppStore.getState().workspaceOverrides[WORKSPACE.id]?.workflowRules).toMatchObject({
        spreadByHeadroom: true,
      }),
    );
    cleanup();

    render(<WorkflowRulesPanel workspaceId={WORKSPACE.id} />);

    expect(screen.queryAllByRole('switch', { name: SPREAD_LABEL })).toEqual([]);
    expect(screen.getByTestId('rules-policy-summary')).toBeDefined();
    cleanup();
    const reopened = openPopover();
    expect(reopened.getByRole('switch', { name: SPREAD_LABEL }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });
});
