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
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type IsoDateTime,
  type OverrideSettings,
  type WorkflowRun,
  type WorkflowRules,
  type Workspace,
} from '@goodboy/types';
import type { AutoLevel } from '@goodboy/core/auto';
import { aSession, aWorkflowRun, aWorkspace, EMPTY_OVERRIDES } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { buildProviderList, type ProviderStatus } from '../../../providers/providers';
import { WorkspaceDefaultsGrid } from '../../../settings/components/SettingsStudio/WorkspaceDefaultsGrid';
import { StartAsksSetting } from '../../../session/components/SessionKickoff/StartAsksSetting';
import { EveryRun } from './index';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });

const ROUTING_WORDS = /Balanced|In order|most room|Send new steps to/;

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
      cursor: null,
      codex: installed('codex'),
      gemini: null,
      copilot: null,
      opencode: null,
      openrouter: null,
      moonshot: null,
    },
    { anthropic: signedIn, codex: signedIn },
  ),
});

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

type SeedParams = {
  readonly rules?: Partial<WorkflowRules>;
  readonly overrides?: Partial<OverrideSettings>;
};

const seed = ({ rules = {}, overrides = {} }: SeedParams) =>
  useAppStore.setState({
    workspaceOverrides: {
      [HARBORLINE.id]: {
        ...EMPTY_OVERRIDES,
        ...overrides,
        workflowRules: { ...DEFAULT_WORKFLOW_RULES, ...rules },
      },
    },
  });

type RunsParams = {
  readonly runs: ReadonlyArray<WorkflowRun>;
};

const withRuns = ({ runs }: RunsParams) =>
  useAppStore.setState({
    sessions: [aSession({ workspaceId: HARBORLINE.id, workflowRuns: runs })],
  });

const writeCount = (): number =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'patch_workspace_overrides').length;

const savedOverrides = () => useAppStore.getState().workspaceOverrides[HARBORLINE.id];

const renderBoth = () =>
  render(
    <>
      <section aria-label="Every run tab">
        <EveryRun workspaceId={HARBORLINE.id} />
      </section>
      <section aria-label="Settings Runs page">
        <WorkspaceDefaultsGrid workspaceId={HARBORLINE.id} />
      </section>
    </>,
  );

type PageParams = {
  readonly name: 'Every run tab' | 'Settings Runs page';
};

const page = ({ name }: PageParams) => within(screen.getByRole('region', { name }));

const selectedStops = ({ name }: PageParams) =>
  within(page({ name }).getByRole('tablist', { name: 'Stops for your OK' }))
    .getAllByRole('tab')
    .filter((tab) => tab.getAttribute('aria-selected') === 'true')
    .map((tab) => tab.textContent);

const stopsTab = ({ name, tab }: PageParams & { readonly tab: RegExp }) =>
  within(page({ name }).getByRole('tablist', { name: 'Stops for your OK' })).getByRole('tab', {
    name: tab,
  });

const limitInput = ({ name }: PageParams) =>
  page({ name }).getByLabelText<HTMLInputElement>('Limit in dollars');

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
  });
  seed({});
});

afterEach(cleanup);

describe('Every run', () => {
  it('holds the run rules, reply length, the Lead, the roles, Guidance and Advanced in order', () => {
    render(<EveryRun workspaceId={HARBORLINE.id} />);

    expect(screen.getAllByRole('region').map((band) => band.getAttribute('aria-label'))).toEqual([
      'When a run stops for you',
      'Spending',
      'Agents',
      'Runs',
      'Roles',
      'Guidance',
    ]);
    screen.getByTestId('runs-advanced');
    within(screen.getByRole('region', { name: 'Runs' })).getByText('Lead');
    const roles = within(screen.getByRole('region', { name: 'Roles' }));
    roles.getByText('Implementer');
    roles.getByText('Reviewer');
    screen.getByText('Reply length');
  });

  it('saves Stops for your OK once and Settings, Runs shows the same level', async () => {
    seed({ rules: { autonomy: 'step' } });
    storeLeadLevel({ level: 'step' });
    renderBoth();

    fireEvent.click(stopsTab({ name: 'Every run tab', tab: /After the plan/ }));

    await waitFor(() =>
      expect(selectedStops({ name: 'Settings Runs page' })).toEqual(['After the plan']),
    );
    expect(selectedStops({ name: 'Every run tab' })).toEqual(['After the plan']);
    expect(writeCount()).toBe(1);
    expect(savedOverrides()?.workflowRules?.autonomy).toBe('plan');
  });

  it('shows a level picked on Settings, Runs on Every run', async () => {
    seed({ rules: { autonomy: 'step' } });
    storeLeadLevel({ level: 'step' });
    renderBoth();

    fireEvent.click(stopsTab({ name: 'Settings Runs page', tab: /^Never/ }));

    await waitFor(() => expect(selectedStops({ name: 'Every run tab' })).toEqual(['Never']));
  });

  it('saves the limit from Every run and Settings, Runs reads the same amount', async () => {
    renderBoth();

    const input = limitInput({ name: 'Every run tab' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.submit(
      page({ name: 'Every run tab' }).getByRole('form', { name: 'Limit for new runs' }),
    );

    await waitFor(() => expect(limitInput({ name: 'Settings Runs page' }).value).toBe('20'));
    expect(savedOverrides()?.workflowRules?.spendLimitUsd).toBe(20);
  });

  it('gives the launcher the level saved on Every run as the workspace default', async () => {
    seed({ rules: { autonomy: 'step' } });
    storeLeadLevel({ level: 'step' });
    render(<EveryRun workspaceId={HARBORLINE.id} />);

    fireEvent.click(screen.getByRole('tab', { name: /After the plan/ }));
    await waitFor(() => expect(savedOverrides()?.workflowRules?.autonomy).toBe('plan'));
    cleanup();

    const { container } = render(
      <StartAsksSetting
        workspaceId={HARBORLINE.id}
        autonomy="plan"
        isDisabled={false}
        onPick={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('After the plan');
    expect(container.textContent).not.toContain('this run');
  });

  it('removes a role model on Every run and writes the same key Settings reads', async () => {
    seed({
      overrides: {
        roleModels: {
          implementer: { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
        },
      },
    });
    render(<EveryRun workspaceId={HARBORLINE.id} />);
    const roles = within(screen.getByRole('region', { name: 'Roles' }));
    roles.getByText('Pinned');

    fireEvent.click(roles.getByRole('button', { name: /^Implementer/ }));
    fireEvent.click(await roles.findByRole('button', { name: /^Remove / }));

    await waitFor(() => expect(writeCount()).toBe(1));
    expect(savedOverrides()?.roleModels).toBeNull();
    expect(roles.queryByText('Pinned')).toBeNull();
  });

  it('shows Older plan runs only while a plan run that is not discarded exists', () => {
    withRuns({ runs: [aWorkflowRun({ executionMode: 'dynamic' })] });
    render(<EveryRun workspaceId={HARBORLINE.id} />);

    const older = within(screen.getByRole('region', { name: 'Older plan runs' }));
    older.getByText('Orchestrator');
    older.getByText('Models in older plan runs');
    expect(
      within(screen.getByRole('region', { name: 'Runs' })).queryByText('Orchestrator'),
    ).toBeNull();
  });

  it('hides Older plan runs with only step runs or a discarded plan run', () => {
    withRuns({
      runs: [
        aWorkflowRun({ executionMode: 'static' }),
        aWorkflowRun({
          executionMode: 'dynamic',
          discardedAt: brandId<IsoDateTime>({ value: '2026-11-20T10:00:00.000Z' }),
        }),
      ],
    });
    render(<EveryRun workspaceId={HARBORLINE.id} />);

    expect(screen.queryByRole('region', { name: 'Older plan runs' })).toBeNull();
    expect(screen.queryByText('Models in older plan runs')).toBeNull();
  });

  it('names no provider rule of its own', () => {
    withRuns({ runs: [aWorkflowRun({ executionMode: 'dynamic' })] });
    const { container } = render(<EveryRun workspaceId={HARBORLINE.id} />);

    expect(container.textContent).not.toMatch(ROUTING_WORDS);
    expect(screen.queryByText('Provider priority')).toBeNull();
  });
});
