// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  DEFAULT_WORKFLOW_RULES,
  type IsoDateTime,
  type OverrideSettings,
  type ProviderLimits,
  type WorkflowRules,
  type Workspace,
} from '@goodboy/types';
import { aWorkspace, EMPTY_OVERRIDES } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { buildProviderList, type ProviderStatus } from '../../../providers/providers';
import { RUN_AUTONOMY_OPTIONS } from '../../runAutonomy';
import { WorkflowRulesPanel } from './index';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });

const savedRules = (): ReadonlyArray<WorkflowRules | null | undefined> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'set_workspace_overrides')
    .map(([, args]) => (args as { readonly overrides: OverrideSettings }).overrides.workflowRules);

const installed = (id: string): ProviderStatus => ({
  id,
  binary: id,
  available: true,
  version: '1.0.0',
  error: null,
});

const signedIn = { state: 'connected', identity: 'mara@harborline.test' } as const;

const connectedProviders = () => ({
  providers: buildProviderList(
    {
      anthropic: installed('claude'),
      cursor: installed('cursor-agent'),
      codex: installed('codex'),
      gemini: null,
      opencode: null,
      openrouter: null,
      moonshot: null,
    },
    { anthropic: signedIn, cursor: signedIn, codex: signedIn },
  ),
});

const claudeAt = ({ used }: { readonly used: number }): ProviderLimits => ({
  providerId: 'anthropic',
  plan: 'max',
  status: 'ok',
  windows: [
    {
      kind: 'fiveHour',
      model: null,
      status: 'ok',
      usedFraction: used,
      resetsAt: new Date(Date.now() + 3_600_000).toISOString() as IsoDateTime,
    },
  ],
  observedAt: new Date().toISOString() as IsoDateTime,
});

const panel = () => render(<WorkflowRulesPanel workspaceId={HARBORLINE.id} />);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ set_workspace_overrides: null });
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    ...connectedProviders(),
    workspaceOverrides: {
      [HARBORLINE.id]: {
        ...EMPTY_OVERRIDES,
        providerPool: [
          { id: 'anthropic', state: 'on' },
          { id: 'codex', state: 'on' },
          { id: 'cursor', state: 'backup' },
        ],
      },
    },
  });
});

afterEach(cleanup);

const withPool = (providerPool: NonNullable<OverrideSettings['providerPool']>) =>
  useAppStore.setState((state) => ({
    workspaceOverrides: {
      [HARBORLINE.id]: {
        ...(state.workspaceOverrides[HARBORLINE.id] ?? EMPTY_OVERRIDES),
        providerPool,
      },
    },
  }));

const withRules = (rules: Partial<WorkflowRules>) =>
  useAppStore.setState((state) => ({
    workspaceOverrides: {
      [HARBORLINE.id]: {
        ...EMPTY_OVERRIDES,
        providerPool: state.workspaceOverrides[HARBORLINE.id]?.providerPool ?? null,
        workflowRules: { ...DEFAULT_WORKFLOW_RULES, ...rules },
      },
    },
  }));

describe('WorkflowRulesPanel', () => {
  it('starts on the defaults with three controls and a text field', () => {
    panel();

    expect(screen.getByRole('heading', { level: 2, name: 'Run defaults' })).toBeDefined();
    expect(screen.getByText('Each run keeps its own copy.')).toBeDefined();
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-checked'))).toEqual(
      ['true', 'false', 'false'],
    );
    expect(screen.getByRole('switch', { name: 'Spend cap' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(screen.getByRole('textbox', { name: 'Guidance' })).toBeDefined();
  });

  it('orders the bands when to ask, spend cap, providers, guidance', () => {
    panel();

    expect(
      screen.getAllByRole('region').map((region) => region.getAttribute('aria-label')),
    ).toEqual(['When to ask', 'Spend cap', 'Providers', 'Guidance']);
  });

  it('shows the same autonomy hints the builder shows', () => {
    panel();

    for (const option of RUN_AUTONOMY_OPTIONS) {
      expect(screen.getByText(option.hint)).toBeDefined();
    }
  });

  it('saves the autonomy for new runs as soon as you pick it', async () => {
    panel();

    fireEvent.click(screen.getByRole('radio', { name: /Ask after the plan/ }));

    await waitFor(() => expect(savedRules().map((rules) => rules?.autonomy)).toEqual(['plan']));
    expect(useAppStore.getState().workspaceOverrides[HARBORLINE.id]?.workflowRules?.autonomy).toBe(
      'plan',
    );
    expect(
      screen.getByRole('radio', { name: /Ask after the plan/ }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('turns the spend cap on, keeps a typed amount and the behaviour at the limit', async () => {
    panel();

    fireEvent.click(screen.getByRole('switch', { name: 'Spend cap' }));
    const amount = await screen.findByRole('textbox', { name: 'Amount per run' });
    fireEvent.change(amount, { target: { value: '40' } });
    fireEvent.blur(amount);
    fireEvent.click(screen.getByRole('tab', { name: 'Warn only' }));

    await waitFor(() =>
      expect(savedRules().at(-1)).toMatchObject({ spendLimitUsd: 40, spendLimitMode: 'notify' }),
    );
    expect(savedRules()[0]).toMatchObject({ spendLimitUsd: 25, spendLimitMode: 'pause' });
  });

  it('opens Providers & models from the providers band', () => {
    const received: Array<unknown> = [];
    const listener = (event: Event) => received.push((event as CustomEvent).detail);
    window.addEventListener('goodboy:open-settings', listener);
    panel();

    fireEvent.click(screen.getByRole('button', { name: 'Open Providers & models' }));
    window.removeEventListener('goodboy:open-settings', listener);

    expect(received).toEqual([{ scope: 'providers', section: undefined }]);
  });

  it('shows the policy in one line and a link, with no switch and no provider list', () => {
    panel();
    const band = screen.getByRole('region', { name: 'Providers' });

    expect(within(band).queryAllByRole('switch')).toHaveLength(0);
    expect(within(band).getByText('When a provider is out')).toBeDefined();
    expect(screen.getByTestId('rules-policy-summary').textContent).toBe(
      'Claude, Codex · Cursor as backup',
    );
    expect(band.textContent).not.toMatch(/most room|room left/);
  });

  it('saves guidance, polishes it into one rule per line and undoes the polish', async () => {
    const polished = '- Group the commits by concern at the end.\n- Open the PR as a draft.';
    stubStoryInvoke({
      set_workspace_overrides: null,
      summarize_session: {
        stdout: JSON.stringify({ result: `<<guidance>>\n${polished}\n<</guidance>>` }),
        stderr: '',
        exitCode: 0,
      },
    });
    panel();
    const field = screen.getByRole('textbox', { name: 'Guidance' });

    fireEvent.change(field, { target: { value: 'cluster commits at the end. open PR as draft' } });
    fireEvent.blur(field);
    await waitFor(() =>
      expect(savedRules().at(-1)?.standingGuidance).toBe(
        'cluster commits at the end. open PR as draft',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Polish guidance' }));

    await waitFor(() => expect(savedRules().at(-1)?.standingGuidance).toBe(polished));
    expect(screen.getByText('Implementer, Docs').parentElement?.textContent).toBe(
      'Goes to the planning agent and to Implementer, Docs',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo guidance change' }));
    await waitFor(() =>
      expect(savedRules().at(-1)?.standingGuidance).toBe(
        'cluster commits at the end. open PR as draft',
      ),
    );
  });

  it('shows no routing line while guidance is empty', () => {
    panel();

    expect(screen.queryByText(/Goes to the planning agent/)).toBeNull();
    expect(screen.queryByText(/Nothing to send yet/)).toBeNull();
  });

  it('adds the tester to the roles only when you pick it', async () => {
    withRules({ standingGuidance: '- Open the PR as a draft.' });
    panel();

    const guidance = screen.getByRole('region', { name: 'Guidance' });
    expect(within(guidance).queryByRole('button', { name: 'About you' })).toBeNull();
    fireEvent.click(within(guidance).getByRole('button', { name: 'Edit', expanded: false }));
    expect(within(guidance).getByRole('button', { name: 'About you' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Tester' }));

    await waitFor(() =>
      expect(savedRules().at(-1)?.guidanceRoles).toEqual(['implementer', 'docs', 'tester']),
    );
  });
});
