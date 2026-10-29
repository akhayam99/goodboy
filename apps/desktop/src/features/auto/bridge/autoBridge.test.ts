// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import type { AutoUserTurnPort } from '../autoUserTurnPort';
import type { ChecksRerunPort } from '../checksRerunPort';
import type { PublishPort } from '../publishPort';
import { isAutoBridgeRequest } from './isAutoBridgeRequest';
import type { DelegationDecisionPort } from '../delegationDecisionPort';
import type { SendNowPort } from '../sendNowPort';
import type { TreeRetryPort } from '../treeRetryPort';
import type { TreeStopPort } from '../treeStopPort';
import { AUTO_BRIDGE_EVENT, type AutoBridgeBus, type AutoBridgePorts } from './autoBridgeProtocol';
import { createAutoBridgeClient, type AutoBridgeClient } from './createAutoBridgeClient';
import { serveAutoBridge } from './serveAutoBridge';

type Handler = (payload: unknown) => void;

type BusParams = {
  readonly isMainListening?: boolean;
};

const memoryBus = ({ isMainListening = true }: BusParams = {}): AutoBridgeBus => {
  const handlers = new Map<string, Set<Handler>>();
  return {
    emit: async ({ event, payload }) => {
      const copy: unknown = JSON.parse(JSON.stringify(payload));
      for (const handler of handlers.get(event) ?? []) {
        handler(copy);
      }
    },
    listen: async ({ event, onPayload }) => {
      if (!isMainListening && event === AUTO_BRIDGE_EVENT.request) {
        return () => undefined;
      }
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(onPayload);
      handlers.set(event, set);
      return () => {
        set.delete(onPayload);
      };
    },
  };
};

const newIds = () => {
  let next = 0;
  return () => {
    next += 1;
    return `request-${next}`;
  };
};

const TURN = {
  agentId: brandId<AgentId>({ value: 'agent-auto' }),
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  workspaceId: 'workspace-harborline',
  text: 'Also cover the notify-relay retries',
};

const mainPorts = () => {
  const stop = vi.fn<TreeStopPort>(async () => 'stopped');
  const retry = vi.fn<TreeRetryPort>(async () => ({
    kind: 'refused',
    message: 'This conversation reached its time limit.',
  }));
  const userTurn = vi.fn<AutoUserTurnPort>(async () => 'queued');
  const decision = vi.fn<DelegationDecisionPort>(async () => 'confirmed');
  const rerunChecks = vi.fn<ChecksRerunPort>(async () => ({ kind: 'rerun', verdict: 'green' }));
  const publish = vi.fn<PublishPort>(async ({ delegationIds }) => ({
    kind: 'done',
    rows: delegationIds.map((delegationId) => ({
      delegationId,
      state: 'pushed' as const,
      message: null,
    })),
  }));
  const sendNow = vi.fn<SendNowPort>(async () => ({ kind: 'retried' }));
  const ports: AutoBridgePorts = { stop, retry, sendNow, userTurn, decision, rerunChecks, publish };
  return { ports, stop, retry, sendNow, userTurn, decision, rerunChecks, publish };
};

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
  vi.useRealTimers();
});

type WindowsParams = {
  readonly bus: AutoBridgeBus;
  readonly ports: AutoBridgePorts;
  readonly timeoutMs?: number;
};

const windows = async ({ bus, ports, timeoutMs }: WindowsParams): Promise<AutoBridgeClient> => {
  const onError = vi.fn();
  cleanups.push(await serveAutoBridge({ bus, ports, onError }));
  const client = await createAutoBridgeClient({
    bus,
    newId: newIds(),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  cleanups.push(client.close);
  return client;
};

describe('Auto in a window without the runtime', () => {
  it('stops the tree through the main window and gets its answer back', async () => {
    const main = mainPorts();
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    expect(await client.ports.stop({ treeId: 'tree-harborline' })).toBe('stopped');
    expect(main.stop).toHaveBeenCalledWith({ treeId: 'tree-harborline' });
  });

  it('hands a message to the main window, which queues it for Auto', async () => {
    const main = mainPorts();
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    expect(await client.ports.userTurn(TURN)).toBe('queued');
    expect(main.userTurn).toHaveBeenCalledWith(TURN);
  });

  it('carries a refused Retry back with its reason', async () => {
    const main = mainPorts();
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    expect(await client.ports.retry({ treeId: 'tree-harborline' })).toEqual({
      kind: 'refused',
      message: 'This conversation reached its time limit.',
    });
  });

  it('sends a waiting message now in the main window and carries the answer back', async () => {
    const main = mainPorts();
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    expect(await client.ports.sendNow({ treeId: 'tree-harborline', rowId: 'outbox-1' })).toEqual({
      kind: 'retried',
    });
    expect(main.sendNow).toHaveBeenCalledWith({ treeId: 'tree-harborline', rowId: 'outbox-1' });
  });

  it('reruns the checks of one agent in the main window and carries the verdict back', async () => {
    const main = mainPorts();
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    expect(await client.ports.rerunChecks({ delegationId: 'delegation-export' })).toEqual({
      kind: 'rerun',
      verdict: 'green',
    });
    expect(main.rerunChecks).toHaveBeenCalledWith({ delegationId: 'delegation-export' });
  });

  it('carries a refused rerun back with its reason', async () => {
    const main = mainPorts();
    main.rerunChecks.mockResolvedValueOnce({
      kind: 'refused',
      message: 'The branch changed after this agent finished.',
    });
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    expect(await client.ports.rerunChecks({ delegationId: 'delegation-export' })).toEqual({
      kind: 'refused',
      message: 'The branch changed after this agent finished.',
    });
  });

  it('waits for a rerun longer than for a stop', async () => {
    vi.useFakeTimers();
    const main = mainPorts();
    const answered: { rerun: (() => void) | null } = { rerun: null };
    main.rerunChecks.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answered.rerun = () => resolve({ kind: 'rerun', verdict: 'red' });
        }),
    );
    const client = await windows({ bus: memoryBus(), ports: main.ports, timeoutMs: 1_000 });

    const rerun = client.ports.rerunChecks({ delegationId: 'delegation-export' });
    await vi.advanceTimersByTimeAsync(60_000);
    answered.rerun?.();

    expect(await rerun).toEqual({ kind: 'rerun', verdict: 'red' });
  });

  it('forwards one confirm for a batch of branches and carries every row back', async () => {
    const main = mainPorts();
    main.publish.mockResolvedValueOnce({
      kind: 'done',
      rows: [
        { delegationId: 'delegation-a', state: 'pushed', message: null },
        { delegationId: 'delegation-b', state: 'failed', message: 'The online copy changed.' },
      ],
    });
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    const result = await client.ports.publish({
      act: 'confirm',
      delegationIds: ['delegation-a', 'delegation-b'],
    });

    expect(main.publish).toHaveBeenCalledTimes(1);
    expect(main.publish).toHaveBeenCalledWith({
      act: 'confirm',
      delegationIds: ['delegation-a', 'delegation-b'],
    });
    expect(result.rows.map((row) => row.state)).toEqual(['pushed', 'failed']);
  });

  it('forwards a decline, a retry and a put back with their ids', async () => {
    const main = mainPorts();
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    await client.ports.publish({ act: 'decline', delegationIds: ['delegation-a'] });
    await client.ports.publish({ act: 'retry', delegationIds: ['delegation-a'] });
    await client.ports.publish({ act: 'put_back', delegationIds: ['delegation-a'] });

    expect(main.publish.mock.calls.map(([call]) => call.act)).toEqual([
      'decline',
      'retry',
      'put_back',
    ]);
  });

  it('ignores a publish request with no ids or an unknown act', () => {
    const call = { kind: 'publish', act: 'confirm', delegationIds: ['delegation-a'] };
    expect(isAutoBridgeRequest({ id: 'request-1', call })).toBe(true);
    expect(isAutoBridgeRequest({ id: 'request-1', call: { ...call, delegationIds: [] } })).toBe(
      false,
    );
    expect(isAutoBridgeRequest({ id: 'request-1', call: { ...call, act: 'merge' } })).toBe(false);
    expect(isAutoBridgeRequest({ id: 'request-1', call: { ...call, delegationIds: [7] } })).toBe(
      false,
    );
  });

  it('turns a failure in the main window into an error the tail can show', async () => {
    const main = mainPorts();
    main.stop.mockRejectedValueOnce(new Error('Auto is not running in the main window.'));
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    await expect(client.ports.stop({ treeId: 'tree-harborline' })).rejects.toThrow(
      'Auto is not running in the main window.',
    );
  });

  it('gives up when the main window does not answer, and a message counts as lost', async () => {
    vi.useFakeTimers();
    const main = mainPorts();
    const client = await windows({
      bus: memoryBus({ isMainListening: false }),
      ports: main.ports,
      timeoutMs: 1_000,
    });

    const stopped = client.ports.stop({ treeId: 'tree-harborline' });
    const said = client.ports.userTurn(TURN);
    const caught = expect(stopped).rejects.toThrow('The main window did not answer');
    await vi.advanceTimersByTimeAsync(1_000);

    await caught;
    expect(await said).toBe('lost');
    expect(main.stop).not.toHaveBeenCalled();
  });

  it('sends a message main queued after the wait ran out only once', async () => {
    vi.useFakeTimers();
    const main = mainPorts();
    const answered: { queue: (() => void) | null } = { queue: null };
    main.userTurn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answered.queue = () => resolve('queued');
        }),
    );
    const client = await windows({ bus: memoryBus(), ports: main.ports, timeoutMs: 1_000 });

    const first = client.ports.userTurn(TURN);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await first).toBe('lost');
    answered.queue?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(await client.ports.userTurn(TURN)).toBe('queued');
    expect(main.userTurn).toHaveBeenCalledTimes(1);
  });

  it('waits on the same message while main still takes it, without a second send', async () => {
    vi.useFakeTimers();
    const main = mainPorts();
    const answered: { queue: (() => void) | null } = { queue: null };
    main.userTurn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answered.queue = () => resolve('queued');
        }),
    );
    const client = await windows({ bus: memoryBus(), ports: main.ports, timeoutMs: 1_000 });

    const first = client.ports.userTurn(TURN);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await first).toBe('lost');
    const resent = client.ports.userTurn(TURN);
    answered.queue?.();

    expect(await resent).toBe('queued');
    expect(main.userTurn).toHaveBeenCalledTimes(1);
  });

  it('sends a message main lost again on a resend', async () => {
    const main = mainPorts();
    main.userTurn.mockResolvedValueOnce('lost');
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    expect(await client.ports.userTurn(TURN)).toBe('lost');
    expect(await client.ports.userTurn(TURN)).toBe('queued');
    expect(main.userTurn).toHaveBeenCalledTimes(2);
  });

  it('sends the same words again as a new message once the first was queued', async () => {
    const main = mainPorts();
    const client = await windows({ bus: memoryBus(), ports: main.ports });

    expect(await client.ports.userTurn(TURN)).toBe('queued');
    expect(await client.ports.userTurn(TURN)).toBe('queued');
    expect(main.userTurn).toHaveBeenCalledTimes(2);
  });

  it('ignores an answer to a request it never sent', async () => {
    const main = mainPorts();
    const bus = memoryBus();
    const client = await windows({ bus, ports: main.ports });
    await bus.emit({
      event: AUTO_BRIDGE_EVENT.response,
      payload: { id: 'request-99', isOk: true, result: 'stuck' },
    });

    expect(await client.ports.stop({ treeId: 'tree-harborline' })).toBe('stopped');
  });
});
