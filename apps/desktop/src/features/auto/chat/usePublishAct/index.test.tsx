// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { makeGate } from '../../../../store/runtime/auto/testing/makeGate';
import { aDelegation, aView, FIXTURE_SESSION } from '../../testing/autoViewFixtures';
import { registerPublishPort, type PublishAct, type PublishPort } from '../../publishPort';
import { usePublishAct } from './index';

const SESSION = FIXTURE_SESSION;

let useAppStore: StoryStore;

const reportError = vi.fn(async () => undefined);
const loadAutoTrees = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  reportError.mockClear();
  loadAutoTrees.mockClear();
  useAppStore.setState({ reportError, loadAutoTrees });
});

afterEach(() => {
  cleanup();
  registerPublishPort({ port: null });
});

type SavedParams = {
  readonly key: string;
  readonly state: string;
  readonly isRetryable?: boolean;
};

const savedPush = ({ key, state, isRetryable = false }: SavedParams) =>
  aDelegation({
    key,
    role: 'implementer',
    state: 'settled',
    outcome: 'completed',
    settledAt: 1_000,
    result: {
      verified: {
        publish: {
          mode: 'force',
          state,
          branch: `harborline/${key}`,
          sha: 'abc1234',
          leaseSha: 'remote111',
          backupRef: 'refs/goodboy/backup/keep-1',
          message: null,
          isRetryable,
          isConfirmed: state !== 'awaiting_confirm',
          tries: 1,
          reviewerReportId: null,
          isContentChanging: false,
        },
      },
    },
  });

const actOnce = async (port: PublishPort | null, name: PublishAct = 'confirm') => {
  registerPublishPort({ port });
  const { result } = renderHook(() => usePublishAct());
  await act(async () => {
    await result.current.act({
      act: name,
      delegationIds: ['delegation-a', 'delegation-b'],
      sessionId: SESSION,
    });
  });
  return result;
};

describe('answering a push from the card', () => {
  it('sends the whole batch in one call, then reloads the cards', async () => {
    const port = vi.fn<PublishPort>(async ({ delegationIds }) => ({
      kind: 'done',
      rows: delegationIds.map((delegationId) => ({
        delegationId,
        state: 'pushed' as const,
        message: null,
      })),
    }));

    const result = await actOnce(port);

    expect(port).toHaveBeenCalledWith({
      act: 'confirm',
      delegationIds: ['delegation-a', 'delegation-b'],
    });
    expect(loadAutoTrees).toHaveBeenCalledWith({ sessionId: SESSION });
    expect(reportError).not.toHaveBeenCalled();
    expect(result.current.busyIds).toEqual([]);
  });

  it('marks every branch of the batch busy until the port answers', async () => {
    const gate = makeGate();
    const port = vi.fn<PublishPort>(async () => {
      await gate.promise;
      return { kind: 'done', rows: [] };
    });
    registerPublishPort({ port });
    const { result } = renderHook(() => usePublishAct());

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.act({
        act: 'confirm',
        delegationIds: ['delegation-a', 'delegation-b'],
        sessionId: SESSION,
      });
    });
    expect(result.current.busyIds).toEqual(['delegation-a', 'delegation-b']);
    await act(async () => {
      gate.open();
      await pending;
    });

    expect(result.current.busyIds).toEqual([]);
  });

  it('leaves a failed push to the card and raises no toast', async () => {
    useAppStore.setState({
      autoTreeViews: {
        [SESSION]: [aView({ delegations: [savedPush({ key: 'a', state: 'failed' })] })],
      },
    });
    const port = vi.fn<PublishPort>(async () => ({
      kind: 'done',
      rows: [
        {
          delegationId: 'delegation-a',
          state: 'failed',
          message: 'Origin changed. Check again before force pushing.',
        },
      ],
    }));

    await actOnce(port);

    expect(reportError).not.toHaveBeenCalled();
    expect(loadAutoTrees).toHaveBeenCalledOnce();
  });

  it('stays quiet when a refused answer is for a push that already moved on', async () => {
    useAppStore.setState({
      autoTreeViews: {
        [SESSION]: [aView({ delegations: [savedPush({ key: 'a', state: 'pushed' })] })],
      },
    });
    const port = vi.fn<PublishPort>(async () => ({
      kind: 'done',
      rows: [
        {
          delegationId: 'delegation-a',
          state: 'refused',
          message: 'This push is not waiting for an answer.',
        },
      ],
    }));

    await actOnce(port);

    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports a refusal while the push still waits for the same answer', async () => {
    useAppStore.setState({
      autoTreeViews: {
        [SESSION]: [aView({ delegations: [savedPush({ key: 'a', state: 'awaiting_confirm' })] })],
      },
    });
    const port = vi.fn<PublishPort>(async () => ({
      kind: 'done',
      rows: [
        {
          delegationId: 'delegation-a',
          state: 'refused',
          message: 'The push was not saved on the card because the result moved on.',
        },
      ],
    }));

    await actOnce(port);

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't finish the push" }),
    );
  });

  it('reports a port that throws, frees the buttons and lets the next try go through', async () => {
    const port = vi
      .fn<PublishPort>()
      .mockRejectedValueOnce(new Error('The main window did not answer.'))
      .mockResolvedValueOnce({ kind: 'done', rows: [] });
    registerPublishPort({ port });
    const { result } = renderHook(() => usePublishAct());

    await act(async () => {
      await result.current.act({
        act: 'retry',
        delegationIds: ['delegation-a'],
        sessionId: SESSION,
      });
    });
    expect(reportError).toHaveBeenCalledOnce();
    expect(result.current.busyIds).toEqual([]);
    await act(async () => {
      await result.current.act({
        act: 'retry',
        delegationIds: ['delegation-a'],
        sessionId: SESSION,
      });
    });

    expect(port).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledOnce();
  });

  it('says so when no window can take the answer yet', async () => {
    await actOnce(null);

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't finish the push" }),
    );
    expect(loadAutoTrees).not.toHaveBeenCalled();
  });
});

type RefusalParams = {
  readonly name: PublishAct;
  readonly open: SavedParams;
  readonly moved: SavedParams;
  readonly message: string;
};

type PortParams = {
  readonly message: string;
};

const refusalPort = ({ message }: PortParams) =>
  vi.fn<PublishPort>(async () => ({
    kind: 'done',
    rows: [{ delegationId: 'delegation-a', state: 'refused' as const, message }],
  }));

const REFUSALS: ReadonlyArray<RefusalParams> = [
  {
    name: 'put_back',
    open: { key: 'a', state: 'pushed' },
    moved: { key: 'a', state: 'declined' },
    message: 'Nothing changed. The branch moved on after the push.',
  },
  {
    name: 'retry',
    open: { key: 'a', state: 'failed', isRetryable: true },
    moved: { key: 'a', state: 'pushed' },
    message: 'Nothing changed. The push is not waiting to be retried.',
  },
];

describe.each(REFUSALS)('a refused $name', ({ name, open, moved, message }) => {
  it('is reported while the saved push still offers that act', async () => {
    useAppStore.setState({
      autoTreeViews: { [SESSION]: [aView({ delegations: [savedPush(open)] })] },
    });

    await actOnce(refusalPort({ message }), name);

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't finish the push" }),
    );
  });

  it('stays quiet when the saved push already moved on', async () => {
    useAppStore.setState({
      autoTreeViews: { [SESSION]: [aView({ delegations: [savedPush(moved)] })] },
    });

    await actOnce(refusalPort({ message }), name);

    expect(reportError).not.toHaveBeenCalled();
  });
});
