// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { aSession, aWorkspace, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { registerTreeStopPort } from '../../auto/treeStopPort';
import { runRoutesKey } from '../../session/startRun/runRoutesSetting';
import { aView } from '../../auto/testing/autoViewFixtures';
import type { SendToLeadItem } from '../../../store/slices/send-to-lead/types';
import { sentToLeadStatusOf } from './sentToLeadStatusOf';
import { startNewLead } from './startNewLead';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'HBL-405' });
const AGENT = brandId<AgentId>({ value: 'agent-lead-405' });
const THREAD = 'PRRT_harborline_ledger_batch';

type StoryState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

const ITEM: SendToLeadItem = {
  key: 'move:rebase-301',
  sessionId: SESSION.id,
  text: 'A review comment for you to work on.',
  note: '',
  threadId: THREAD,
  mountId: null,
  branch: 'hl/ledger-batch',
};

const entry = () => useAppStore.getState().sentToLead[ITEM.key];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    workspaceOverrides: {},
    loadAutoTrees: vi.fn(async () => undefined),
  });
});

describe('Start new Lead', () => {
  it('starts a Lead run with the item as its ask and the comment attached, no form', async () => {
    const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => AGENT);
    useAppStore.setState({ spawnAgent });

    await startNewLead({ item: ITEM });

    const options = spawnAgent.mock.calls[0]?.[1];
    expect(options).toMatchObject({
      kindOverride: 'auto',
      initialPrompt: ITEM.text,
      sourceThreadIds: [THREAD],
    });
    const started = entry();
    expect(started).toMatchObject({ isNew: true, phase: 'sent' });
    expect(started?.target.rootAgentId).toBe(AGENT);
    if (started === undefined) {
      return;
    }
    expect(sentToLeadStatusOf({ entry: started, queue: [], views: [] }).kind).toBe('starting');
  });

  it('keeps the item with the reason when the start fails', async () => {
    useAppStore.setState({
      spawnAgent: vi.fn<StoryState['spawnAgent']>(async () => {
        throw new Error('No provider can run the Lead.');
      }),
    });

    await startNewLead({ item: ITEM });

    expect(entry()).toMatchObject({ phase: 'failed', failure: 'No provider can run the Lead.' });
  });

  it('Undo while the Lead starts stops its tree and drops the row', async () => {
    useAppStore.setState({ spawnAgent: vi.fn<StoryState['spawnAgent']>(async () => AGENT) });
    await startNewLead({ item: ITEM });
    const base = aView();
    useAppStore.setState({
      autoTreeViews: { [SESSION.id]: [{ ...base, tree: { ...base.tree, rootAgentId: AGENT } }] },
    });
    const stop = vi.fn(async () => 'stopped' as const);
    registerTreeStopPort({ port: stop });

    await useAppStore.getState().undoSendToLead({ key: ITEM.key });

    expect(stop).toHaveBeenCalledWith({ treeId: base.tree.id });
    expect(entry()).toBeUndefined();
  });

  it('starts one Lead when Start new Lead is clicked twice', async () => {
    const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => AGENT);
    useAppStore.setState({ spawnAgent });

    await Promise.all([startNewLead({ item: ITEM }), startNewLead({ item: ITEM })]);

    expect(spawnAgent).toHaveBeenCalledTimes(1);
  });

  it('keeps the started Lead with Undo when only the bookkeeping after the launch fails', async () => {
    useAppStore.setState({
      spawnAgent: vi.fn<StoryState['spawnAgent']>(async () => {
        useAppStore.setState({
          sessionPhaseRuns: {
            [SESSION.id]: [anAgent({ id: AGENT, sessionId: SESSION.id, kind: 'auto' })],
          },
        });
        return AGENT;
      }),
      loadSetting: vi.fn<StoryState['loadSetting']>(async (key) => {
        if (key === runRoutesKey({ sessionId: SESSION.id })) {
          throw new Error('The settings could not be read.');
        }
        return null;
      }),
    });

    await startNewLead({ item: ITEM });

    expect(entry()).toMatchObject({ phase: 'sent', failure: null });
    expect(entry()?.target.rootAgentId).toBe(AGENT);
  });

  it('Undo pressed while the Lead is still starting stops it once it exists', async () => {
    const launch: { resolve: ((id: AgentId) => void) | null } = { resolve: null };
    useAppStore.setState({
      spawnAgent: vi.fn<StoryState['spawnAgent']>(
        () =>
          new Promise<AgentId>((resolve) => {
            launch.resolve = resolve;
          }),
      ),
    });
    const base = aView();
    useAppStore.setState({
      autoTreeViews: { [SESSION.id]: [{ ...base, tree: { ...base.tree, rootAgentId: AGENT } }] },
    });
    const stop = vi.fn(async () => 'stopped' as const);
    registerTreeStopPort({ port: stop });

    const starting = startNewLead({ item: ITEM });
    await vi.waitFor(() => expect(entry()?.phase).toBe('sending'));
    await useAppStore.getState().undoSendToLead({ key: ITEM.key });
    expect(entry()?.isCancelled).toBe(true);
    await vi.waitFor(() => expect(launch.resolve).not.toBeNull());
    launch.resolve?.(AGENT);
    await starting;

    expect(stop).toHaveBeenCalledWith({ treeId: base.tree.id });
    expect(entry()).toBeUndefined();
  });
});
