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
import {
  leadPermissionsOf,
  type AutoLevel,
  type StoredLeadPermissionRows,
} from '@goodboy/core/auto';
import { aSession, aWorkflowRun, aWorkspace, EMPTY_OVERRIDES } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { parseAutoLevelSetting } from '../../../../store/runtime/auto/level/parseAutoLevelSetting';
import { buildProviderList, type ProviderStatus } from '../../../providers/providers';
import { RUN_AUTONOMY_OPTIONS } from '../../runAutonomy';
import { WorkflowRulesPanel } from './index';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });

const savedRules = (): ReadonlyArray<WorkflowRules | null | undefined> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'patch_workspace_overrides')
    .map(([, args]) => (args as { readonly patch: Partial<OverrideSettings> }).patch.workflowRules);

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
      copilot: null,
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

const newRuns = () => within(screen.getByRole('region', { name: 'New runs' }));

const asksTab = ({ name }: { readonly name: RegExp }) =>
  within(newRuns().getByRole('tablist', { name: 'Stops for your OK' })).getByRole('tab', {
    name,
  });

const selectedLevels = () =>
  within(newRuns().getByRole('tablist', { name: 'Stops for your OK' }))
    .getAllByRole('tab')
    .filter((tab) => tab.getAttribute('aria-selected') === 'true')
    .map((tab) => tab.textContent);

const leadLevel = (): AutoLevel | null =>
  parseAutoLevelSetting({
    raw: useAppStore.getState().workspaceValues[HARBORLINE.id]?.['auto.level'] ?? null,
  }).defaultLevel;

type LevelParams = {
  readonly level: AutoLevel;
};

const storeLeadLevel = ({ level }: LevelParams) =>
  useAppStore.setState((state) => ({
    workspaceValues: {
      ...state.workspaceValues,
      [HARBORLINE.id]: { 'auto.level': JSON.stringify({ defaultLevel: level, sessions: {} }) },
    },
  }));

const leadWrites = vi.fn(async ({ level }: LevelParams) => {
  storeLeadLevel({ level });
});

const failSaves = () =>
  useAppStore.setState({
    patchWorkspaceOverrides: vi.fn(async (): Promise<void> => {
      throw new Error('disk full');
    }),
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  leadWrites.mockClear();
  stubStoryInvoke({ patch_workspace_overrides: null, db_select: () => [] });
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    loadSetting: vi.fn(async (): Promise<string | null> => null),
    loadWorkspaceValue: vi.fn(async (): Promise<string | null> => null),
    changeAutoLevel: leadWrites,
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

type DetailsParams = {
  readonly defaultRows: StoredLeadPermissionRows;
};

const withDetails = ({ defaultRows }: DetailsParams) => {
  withRules({ autonomy: 'plan' });
  storeLeadLevel({ level: 'plan' });
  let rows = defaultRows;
  const change = vi.fn(
    async ({ change: next }: { readonly change: { readonly key: string } }): Promise<void> => {
      rows = Object.fromEntries(Object.entries(rows).filter(([key]) => key !== next.key));
    },
  );
  useAppStore.setState({
    readLeadPermissions: vi.fn(async () =>
      leadPermissionsOf({
        leadRows: {},
        defaultRows: rows,
        sessionLevel: null,
        workspaceLevel: leadLevel(),
        isPlanApprovalOff: false,
        isWorkFlowOn: true,
        spendLimitUsd: null,
      }),
    ),
    changeLeadPermission: change,
  });
  return change;
};

describe('WorkflowRulesPanel', () => {
  it('starts on the defaults with one row per setting and the guidance field', () => {
    panel();

    expect(screen.getByRole('heading', { level: 2, name: 'New runs' })).toBeDefined();
    expect(selectedLevels()).toEqual([]);
    expect(newRuns().getByLabelText<HTMLInputElement>('Limit in dollars').value).toBe('');
    expect(newRuns().getByTestId('rules-policy-summary').textContent).toBe(
      'Claude, Codex · Cursor as backup',
    );
    expect(newRuns().queryAllByRole('button', { name: /^(Asks you|Limit|Models):/ })).toEqual([]);
    expect(screen.getByRole('textbox', { name: 'Guidance' })).toBeDefined();
  });

  it('shows the hints the builder shows, with no Save', () => {
    panel();

    expect(
      within(newRuns().getByRole('tablist', { name: 'Stops for your OK' }))
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(RUN_AUTONOMY_OPTIONS.map((option) => option.label));
    expect(newRuns().queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('puts the rows it gets after Stops for your OK and the bands it gets before Guidance', () => {
    render(
      <WorkflowRulesPanel workspaceId={HARBORLINE.id} runRows={<p>Start as row</p>}>
        <section aria-label="Agents" />
      </WorkflowRulesPanel>,
    );

    expect(
      newRuns()
        .getAllByText(/^(Stops for your OK|Start as row|Limit|Models)$/)
        .map((node) => node.textContent),
    ).toEqual(['Stops for your OK', 'Start as row', 'Limit', 'Models']);
    expect(screen.getAllByRole('region').map((band) => band.getAttribute('aria-label'))).toEqual([
      'New runs',
      'Agents',
      'Guidance',
    ]);
  });

  it('says when workflows and the Lead stop at different points, until you pick', () => {
    withRules({ autonomy: 'step' });
    storeLeadLevel({ level: 'plan' });
    panel();

    expect(selectedLevels()).toEqual([]);
    expect(
      newRuns().getByText(/^Workflows: Every step · Lead: After the plan\. Pick one\.$/),
    ).toBeDefined();
    expect(savedRules()).toEqual([]);
    expect(leadWrites).not.toHaveBeenCalled();
  });

  it('shows one level when both stop at the same point', () => {
    withRules({ autonomy: 'run' });
    storeLeadLevel({ level: 'run' });
    panel();

    expect(selectedLevels()).toEqual(['Never']);
    expect(newRuns().getByText(/Workflows and the Lead follow it\./)).toBeDefined();
  });

  it('writes workflows and the Lead together, for this workspace, from one pick', async () => {
    withRules({ autonomy: 'step' });
    storeLeadLevel({ level: 'plan' });
    panel();

    fireEvent.click(asksTab({ name: /After the plan/ }));

    await waitFor(() => expect(selectedLevels()).toEqual(['After the plan']));
    expect(savedRules().map((rules) => rules?.autonomy)).toEqual(['plan']);
    expect(leadWrites).toHaveBeenCalledWith({
      workspaceId: HARBORLINE.id,
      sessionId: null,
      level: 'plan',
    });
    expect(leadLevel()).toBe('plan');
  });

  it('keeps both old values and says why under the row when the first save fails', async () => {
    withRules({ autonomy: 'step' });
    storeLeadLevel({ level: 'step' });
    failSaves();
    panel();

    fireEvent.click(asksTab({ name: /After the plan/ }));

    expect((await newRuns().findByRole('alert')).textContent).toContain('disk full');
    expect(selectedLevels()).toEqual(['Every step']);
    expect(leadWrites).not.toHaveBeenCalled();
    expect(leadLevel()).toBe('step');
  });

  it('puts the workflow level back when the Lead level fails to save', async () => {
    withRules({ autonomy: 'step' });
    storeLeadLevel({ level: 'step' });
    leadWrites.mockRejectedValueOnce(new Error('database is locked'));
    panel();

    fireEvent.click(asksTab({ name: /^Never/ }));

    expect((await newRuns().findByRole('alert')).textContent).toContain('database is locked');
    expect(savedRules().map((rules) => rules?.autonomy)).toEqual(['run', 'step']);
    expect(useAppStore.getState().workspaceOverrides[HARBORLINE.id]?.workflowRules?.autonomy).toBe(
      'step',
    );
    expect(leadLevel()).toBe('step');
    expect(selectedLevels()).toEqual(['Every step']);
  });

  it('keeps the old level shown while saving and ignores a second pick until it lands', async () => {
    withRules({ autonomy: 'step' });
    storeLeadLevel({ level: 'step' });
    let land: () => void = () => undefined;
    leadWrites.mockImplementationOnce(
      ({ level }) =>
        new Promise<void>((resolve) => {
          land = () => {
            storeLeadLevel({ level });
            resolve();
          };
        }),
    );
    panel();

    fireEvent.click(asksTab({ name: /After the plan/ }));
    await waitFor(() => expect(leadWrites).toHaveBeenCalledTimes(1));
    expect(selectedLevels()).toEqual(['Every step']);
    fireEvent.click(asksTab({ name: /^Never/ }));
    land();

    await waitFor(() => expect(selectedLevels()).toEqual(['After the plan']));
    expect(leadWrites).toHaveBeenCalledTimes(1);
    expect(savedRules().map((rules) => rules?.autonomy)).toEqual(['plan']);
  });

  it('says Custom with the count when the Lead details differ, and Reset clears them', async () => {
    const change = withDetails({ defaultRows: { push: 'ask' } });
    panel();

    await newRuns().findByText(/^Custom: 1 detail differs from After the plan\.$/);
    expect(selectedLevels()).toEqual([]);
    fireEvent.click(newRuns().getByRole('button', { name: 'Reset Stops for your OK to default' }));

    await waitFor(() =>
      expect(change).toHaveBeenCalledWith({
        target: { workspaceId: HARBORLINE.id },
        change: { key: 'push', value: null },
      }),
    );
  });

  it('opens the Lead details in the page and writes a change to this workspace', async () => {
    const change = withDetails({ defaultRows: {} });
    panel();

    fireEvent.click(
      await newRuns().findByRole('button', { name: 'Fine-tune what the Lead does alone' }),
    );
    const row = await newRuns().findByRole('tablist', { name: 'Open or update a pull request' });
    fireEvent.click(within(row).getByRole('tab', { name: 'Ask first' }));

    await waitFor(() =>
      expect(change).toHaveBeenCalledWith({
        target: { workspaceId: HARBORLINE.id },
        change: { key: 'pullRequest', value: 'ask' },
      }),
    );
    expect(newRuns().queryByRole('tablist', { name: 'Applies to' })).toBeNull();
    expect(newRuns().queryByRole('tablist', { name: 'Start from' })).toBeNull();
  });

  it('a level pick on Custom saves the level and then clears the details', async () => {
    const change = withDetails({ defaultRows: { push: 'ask' } });
    panel();

    await newRuns().findByText(/^Custom: 1 detail/);
    fireEvent.click(asksTab({ name: /^Never/ }));

    await waitFor(() =>
      expect(change).toHaveBeenCalledWith({
        target: { workspaceId: HARBORLINE.id },
        change: { key: 'push', value: null },
      }),
    );
    expect(leadWrites).toHaveBeenCalledWith({
      workspaceId: HARBORLINE.id,
      sessionId: null,
      level: 'run',
    });
  });

  it('reaches new runs only: a run already going keeps its own copy', async () => {
    const run = aWorkflowRun({
      rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'step', spendLimitUsd: 5 },
    });
    useAppStore.setState({
      sessions: [aSession({ workspaceId: HARBORLINE.id, workflowRuns: [run] })],
    });
    panel();

    fireEvent.click(asksTab({ name: /^Never/ }));

    await waitFor(() => expect(savedRules().map((rules) => rules?.autonomy)).toEqual(['run']));
    expect(useAppStore.getState().sessions[0]?.workflowRuns[0]?.rulesSnapshot).toMatchObject({
      autonomy: 'step',
      spendLimitUsd: 5,
    });
  });

  it('applies the spend limit on Enter and the behaviour at the limit on click', async () => {
    panel();

    const amount = newRuns().getByLabelText('Limit in dollars');
    fireEvent.focus(amount);
    fireEvent.change(amount, { target: { value: '40' } });
    fireEvent.submit(newRuns().getByRole('form', { name: 'Limit for new runs' }));
    await waitFor(() => expect(savedRules().at(-1)).toMatchObject({ spendLimitUsd: 40 }));
    fireEvent.click(
      within(newRuns().getByRole('tablist', { name: 'At the limit' })).getByRole('tab', {
        name: 'Warn only',
      }),
    );

    await waitFor(() =>
      expect(savedRules().at(-1)).toMatchObject({ spendLimitUsd: 40, spendLimitMode: 'notify' }),
    );
  });

  it('keeps the old spend limit and says why under the row when the save fails', async () => {
    withRules({ spendLimitUsd: 20 });
    failSaves();
    panel();

    const amount = newRuns().getByLabelText<HTMLInputElement>('Limit in dollars');
    expect(amount.value).toBe('20');
    fireEvent.focus(amount);
    fireEvent.change(amount, { target: { value: '40' } });
    fireEvent.submit(newRuns().getByRole('form', { name: 'Limit for new runs' }));

    expect((await newRuns().findByRole('alert')).textContent).toContain('disk full');
    expect(
      useAppStore.getState().workspaceOverrides[HARBORLINE.id]?.workflowRules?.spendLimitUsd,
    ).toBe(20);
  });

  it('opens the workspace Models page from the Models row', () => {
    const received: Array<unknown> = [];
    const listener = (event: Event) => received.push((event as CustomEvent).detail);
    window.addEventListener('goodboy:open-settings', listener);
    panel();

    fireEvent.click(newRuns().getByRole('button', { name: 'Open Models' }));
    window.removeEventListener('goodboy:open-settings', listener);

    expect(received).toEqual([{ scope: 'workspace', section: 'models' }]);
  });

  it('shows the policy in one line, with no switch and no provider list', () => {
    panel();

    expect(newRuns().queryAllByRole('switch')).toHaveLength(0);
    expect(screen.getByTestId('rules-policy-summary').textContent).toBe(
      'Claude, Codex · Cursor as backup',
    );
    expect(screen.getByRole('region', { name: 'New runs' }).textContent).not.toMatch(
      /most room|room left/,
    );
  });

  it('saves guidance, polishes it into one rule per line and undoes the polish', async () => {
    const polished = '- Group the commits by concern at the end.\n- Open the PR as a draft.';
    stubStoryInvoke({
      patch_workspace_overrides: null,
      db_select: () => [],
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
