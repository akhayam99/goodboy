// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import type { AutoUserTurnPort } from '../autoUserTurnPort';
import type { DelegationDecisionPort } from '../delegationDecisionPort';
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
  const ports: AutoBridgePorts = { stop, retry, userTurn, decision };
  return { ports, stop, retry, userTurn, decision };
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
