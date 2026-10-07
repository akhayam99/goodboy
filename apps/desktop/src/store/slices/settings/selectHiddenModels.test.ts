// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { getCapabilities, orchestratorModelPool, visibleCatalog } from '@goodboy/core';
import type { ProviderId, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import { SETTING_HIDDEN_MODELS } from '../../../features/settings/settings';
import { useAppStore } from '../../store';
import { selectKindRouting } from '../agents/selectKindRouting';
import { autoLimitContext } from '../providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../providerLimits/resolveLimitedTaskModel';
import { selectHiddenModels } from './selectHiddenModels';

const SESSION_ID = 'ses-ledger' as SessionId;
const WORKSPACE_ID = 'ws-northwind' as WorkspaceId;

type ProviderParams = {
  readonly id: ProviderId;
};

const connectedProvider = ({ id }: ProviderParams): ProviderDisplayInfo => ({
  id,
  binary: id,
  capabilities: getCapabilities({ id }),
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

type SeedParams = {
  readonly hidden: Readonly<Record<string, ReadonlyArray<string>>>;
};

const seed = ({ hidden }: SeedParams) =>
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    providers: [connectedProvider({ id: 'anthropic' }), connectedProvider({ id: 'codex' })],
    providerLimits: {},
    workspaceOverrides: {},
    settings: { [SETTING_HIDDEN_MODELS]: JSON.stringify(hidden) },
  });

const AVAILABILITY = {
  connectedProviders: ['anthropic', 'codex'],
  coolingDownProviders: [],
  budgetBlockedProviders: [],
  isSessionBudgetBlocked: false,
  isRunBudgetBlocked: false,
  nowMs: 0,
} satisfies Parameters<typeof orchestratorModelPool>[0]['availability'];

beforeEach(() => {
  useAppStore.setState({ settings: {}, sessions: [], providers: [] });
});

describe('a model hidden from the pickers', () => {
  it('leaves the menu, Auto and the orchestrator together', () => {
    seed({ hidden: { anthropic: ['opus-5.5'] } });
    const state = useAppStore.getState();
    const hidden = selectHiddenModels({ state });

    const menu = visibleCatalog({ provider: 'anthropic', hidden }).map((model) => model.key);
    const planner = selectKindRouting({ state, sessionId: SESSION_ID, kind: 'planner' });
    const pool = orchestratorModelPool({ availability: AVAILABILITY, hidden }).map(
      (option) => `${option.provider}/${option.model}`,
    );

    expect(menu).not.toContain('opus-5.5');
    expect(planner.model).toBe('opus-5');
    expect(pool).not.toContain('anthropic/opus-5.5');
    expect(pool).toContain('anthropic/opus-5');
  });

  it('keeps a pinned hidden model in the menu where it is the current pick', () => {
    seed({ hidden: { anthropic: ['opus-5.5'] } });
    const hidden = selectHiddenModels({ state: useAppStore.getState() });
    expect(
      visibleCatalog({ provider: 'anthropic', hidden, currentKey: 'opus-5.5' }).map(
        (model) => model.key,
      ),
    ).toContain('opus-5.5');
  });

  it('never puts the summarizer on a hidden Haiku when the task is on Auto', () => {
    seed({ hidden: { anthropic: ['haiku-4.5'] } });
    const summarizer = resolveLimitedTaskModel({
      limitContext: autoLimitContext({ state: useAppStore.getState() }),
      task: 'summarizer',
      preferences: null,
      connectedProviders: ['anthropic', 'codex'],
      workspaceDefaultProviderId: 'anthropic',
      sessionDefaultProviderId: 'anthropic',
    });

    expect(summarizer.model).not.toBe('haiku-4.5');
  });

  it('keeps a hidden Haiku when Settings name it for the summarizer', () => {
    seed({ hidden: { anthropic: ['haiku-4.5'] } });
    const summarizer = resolveLimitedTaskModel({
      limitContext: autoLimitContext({ state: useAppStore.getState() }),
      task: 'summarizer',
      preferences: { summarizer: { providerId: 'anthropic', model: 'haiku-4.5' } },
      connectedProviders: ['anthropic', 'codex'],
      workspaceDefaultProviderId: 'anthropic',
      sessionDefaultProviderId: 'anthropic',
    });

    expect(summarizer).toEqual({ providerId: 'anthropic', model: 'haiku-4.5' });
  });
});
