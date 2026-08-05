import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';

const listChannelsSpy = vi.fn();
const listUsersSpy = vi.fn();
const listThreadHeadsSpy = vi.fn();
const getThreadSpy = vi.fn();

vi.mock('../../../features/integrations/slack/client', () => ({
  slackListChannels: (...args: ReadonlyArray<unknown>) => listChannelsSpy(...args),
  slackListUsers: (...args: ReadonlyArray<unknown>) => listUsersSpy(...args),
  slackListThreadHeads: (...args: ReadonlyArray<unknown>) => listThreadHeadsSpy(...args),
  slackGetThread: (...args: ReadonlyArray<unknown>) => getThreadSpy(...args),
}));

const { createSlackThreadsSlice, initialSlackThreadsState, slackChannelKey, slackThreadKey } =
  await import('./index');

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const CHANNEL_ID = 'C024BE7LR';
const THREAD_TS = '1723456789.123456';

type TestState = Record<string, unknown>;

const buildStore = () => {
  let state: TestState = { ...initialSlackThreadsState };
  const set = (partial: unknown) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...(next as TestState) };
  };
  const get = () => state as unknown as AppStore;
  const slice = createSlackThreadsSlice(
    set as Parameters<typeof createSlackThreadsSlice>[0],
    get as Parameters<typeof createSlackThreadsSlice>[1],
  );
  Object.assign(state, slice);
  return { getState: () => state, slice };
};

describe('slack-threads slice', () => {
  beforeEach(() => {
    listChannelsSpy.mockReset();
    listUsersSpy.mockReset();
    listThreadHeadsSpy.mockReset();
    getThreadSpy.mockReset();
  });

  it('caches channels per workspace', async () => {
    listChannelsSpy.mockResolvedValue([{ id: CHANNEL_ID, name: 'eng-alerts' }]);
    const store = buildStore();

    await store.slice.refreshSlackChannels({ workspaceId: WORKSPACE_ID });

    expect(listChannelsSpy).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID });
    const entry = (store.getState().slackChannels as Record<string, { channels: unknown[] }>)[
      WORKSPACE_ID
    ];
    expect(entry?.channels).toHaveLength(1);
  });

  it('caches thread heads under a workspace and channel key', async () => {
    listThreadHeadsSpy.mockResolvedValue([{ ts: THREAD_TS }]);
    const store = buildStore();

    await store.slice.refreshSlackThreadHeads({
      workspaceId: WORKSPACE_ID,
      channelId: CHANNEL_ID,
    });

    const key = slackChannelKey({ workspaceId: WORKSPACE_ID, channelId: CHANNEL_ID });
    expect(
      (store.getState().slackThreadHeads as Record<string, { heads: unknown[] }>)[key]?.heads,
    ).toHaveLength(1);
  });

  it('caches one thread so every surface reads the same messages', async () => {
    getThreadSpy.mockResolvedValue([{ ts: THREAD_TS }, { ts: '1723456999.000100' }]);
    const store = buildStore();

    await store.slice.refreshSlackThread({
      workspaceId: WORKSPACE_ID,
      channelId: CHANNEL_ID,
      threadTs: THREAD_TS,
    });

    const key = slackThreadKey({
      workspaceId: WORKSPACE_ID,
      channelId: CHANNEL_ID,
      threadTs: THREAD_TS,
    });
    const entry = (
      store.getState().slackThreads as Record<
        string,
        { messages: unknown[]; loading: boolean; error: string | null }
      >
    )[key];
    expect(entry?.messages).toHaveLength(2);
    expect(entry?.loading).toBe(false);
    expect(entry?.error).toBeNull();
  });

  it('records the failure instead of clearing the thread already on screen', async () => {
    getThreadSpy.mockResolvedValueOnce([{ ts: THREAD_TS }]);
    const store = buildStore();
    const target = { workspaceId: WORKSPACE_ID, channelId: CHANNEL_ID, threadTs: THREAD_TS };
    await store.slice.refreshSlackThread(target);

    getThreadSpy.mockRejectedValueOnce(new Error('missing_scope: channels:history'));
    await store.slice.refreshSlackThread(target, { force: true });

    const key = slackThreadKey(target);
    const entry = (
      store.getState().slackThreads as Record<
        string,
        { messages: unknown[]; error: string | null; loading: boolean }
      >
    )[key];
    expect(entry?.error).toContain('missing_scope: channels:history');
    expect(entry?.messages).toHaveLength(1);
    expect(entry?.loading).toBe(false);
  });

  it('keeps the known user list when the directory call fails', async () => {
    listUsersSpy.mockResolvedValueOnce([{ id: 'U1', name: 'ada' }]);
    const store = buildStore();
    await store.slice.refreshSlackUsers({ workspaceId: WORKSPACE_ID });

    listUsersSpy.mockRejectedValueOnce(new Error('ratelimited'));
    await store.slice.refreshSlackUsers({ workspaceId: WORKSPACE_ID });

    expect(
      (store.getState().slackUsers as Record<string, ReadonlyArray<unknown>>)[WORKSPACE_ID],
    ).toHaveLength(1);
  });
});
