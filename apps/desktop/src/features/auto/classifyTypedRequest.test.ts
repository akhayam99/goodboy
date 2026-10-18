// @vitest-environment node

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCapabilities } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';
import type { ProviderDisplayInfo } from '../providers/providers';
import { SETTING_CLASSIFY_REQUESTS } from '../settings/settings';
import { classifyTypedRequest } from './classifyTypedRequest';

const WORKSPACE = aWorkspace({ name: 'Northwind' });

const GOAL = 'Where does notify-relay retry a failed delivery?';

const providerInfo = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
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

let useAppStore: StoryStore;

type AnswerParams = {
  readonly result: string;
};

const stubAnswer = ({ result }: AnswerParams) =>
  stubStoryInvoke({
    summarize_session: () => ({ stdout: JSON.stringify({ result }), stderr: '', exitCode: 0 }),
  });

type SettingParams = {
  readonly value: 'true' | 'false' | null;
};

const setSetting = ({ value }: SettingParams) =>
  useAppStore.setState({
    settings: value === null ? {} : { [SETTING_CLASSIFY_REQUESTS]: value },
  });

const classify = ({ isRoutingPinned = false }: { readonly isRoutingPinned?: boolean } = {}) =>
  classifyTypedRequest({
    state: useAppStore.getState(),
    workspaceId: WORKSPACE.id,
    goal: GOAL,
    isRoutingPinned,
  });

const classifierCalls = () =>
  storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'summarize_session');

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    providers: [providerInfo({ id: 'anthropic' })],
    providerCooldowns: {},
    workspaceOverrides: {},
  });
});

describe('classifyTypedRequest', () => {
  it('asks no model while the setting is off, and off is the default', async () => {
    stubAnswer({ result: '{"role":"scout","difficulty":"light"}' });

    setSetting({ value: null });
    expect(await classify()).toBeNull();
    setSetting({ value: 'false' });
    expect(await classify()).toBeNull();

    expect(classifierCalls()).toHaveLength(0);
  });

  it('starts the role the classifier names, on the rung its difficulty sizes', async () => {
    stubAnswer({ result: '{"role":"scout","difficulty":"light"}' });
    setSetting({ value: 'true' });

    const start = await classify();

    expect(classifierCalls()).toHaveLength(1);
    expect(start).toEqual({
      agentKind: 'scout',
      routing: { provider: 'anthropic', model: 'haiku-5.5', effort: 'medium' },
    });
  });

  it('maps the investigator to the Debugger kind', async () => {
    stubAnswer({ result: '{"role":"investigator","difficulty":"heavy"}' });
    setSetting({ value: 'true' });

    const start = await classify();

    expect(start?.agentKind).toBe('debugger');
    expect(start?.routing).toMatchObject({ provider: 'anthropic', model: 'opus-5.5' });
  });

  it('leaves Auto to start when the classifier is not sure', async () => {
    stubAnswer({ result: '{"role":"none","difficulty":"standard"}' });
    setSetting({ value: 'true' });

    expect(await classify()).toBeNull();
    expect(classifierCalls()).toHaveLength(1);
  });

  it('leaves Auto to start when the model fails or answers prose', async () => {
    setSetting({ value: 'true' });

    stubStoryInvoke({
      summarize_session: () => ({ stdout: '', stderr: 'boom', exitCode: 1 }),
    });
    expect(await classify()).toBeNull();

    stubAnswer({ result: 'I would say a scout.' });
    expect(await classify()).toBeNull();
  });

  it('never overrules a model the user pinned for Auto', async () => {
    stubAnswer({ result: '{"role":"scout","difficulty":"light"}' });
    setSetting({ value: 'true' });

    expect(await classify({ isRoutingPinned: true })).toBeNull();
    expect(classifierCalls()).toHaveLength(0);
  });

  it('asks nothing when no provider can run the task', async () => {
    stubAnswer({ result: '{"role":"scout","difficulty":"light"}' });
    setSetting({ value: 'true' });
    useAppStore.setState({ providers: [] });

    expect(await classify()).toBeNull();
    expect(classifierCalls()).toHaveLength(0);
  });
});
