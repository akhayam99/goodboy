// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TurnState,
} from '@goodboy/types';
import {
  registerAutoChildTurnPort,
  type AutoChildTurnPort,
} from '../../../../features/auto/autoChildTurnPort';
import type { SendTurnInput } from '../../../slices/turn/types';
import { routeAutoChildTurn } from './routeAutoChildTurn';

type ChildState = ReturnType<Parameters<typeof routeAutoChildTurn>[0]['get']>;

type AgentRow = ChildState['sessionPhaseRuns'][SessionId][number];

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const AUTO_AGENT = brandId<AgentId>({ value: 'agent-auto' });
const CHILD_AGENT = brandId<AgentId>({ value: 'agent-scout' });
const PLAIN_PARENT = brandId<AgentId>({ value: 'agent-planner' });
const PLAIN_CHILD = brandId<AgentId>({ value: 'agent-reviewer' });

const ROWS: ReadonlyArray<AgentRow> = [
  { id: AUTO_AGENT, kind: 'auto', name: 'Auto', parentAgentId: undefined },
  { id: CHILD_AGENT, kind: 'scout', name: 'Scout', parentAgentId: AUTO_AGENT },
  { id: PLAIN_PARENT, kind: 'planner', name: 'Planner', parentAgentId: undefined },
  { id: PLAIN_CHILD, kind: 'reviewer', name: 'Reviewer', parentAgentId: PLAIN_PARENT },
];

const RUNNING: TurnState = {
  kind: 'running',
  runId: brandId<ProviderRunId>({ value: 'run-scout' }),
  startedAt: brandId<IsoDateTime>({ value: '2026-11-08T10:00:00.000Z' }),
};

type HarnessParams = {
  readonly isChildRunning?: boolean;
};

const harness = ({ isChildRunning = false }: HarnessParams = {}) => {
  const reportError = vi.fn(async () => undefined);
  const appendTurnEvent = vi.fn();
  const state: ChildState = {
    sessionPhaseRuns: { [SESSION]: ROWS },
    agentTurnState: isChildRunning ? { [CHILD_AGENT]: RUNNING } : {},
    reportError,
    appendTurnEvent,
  };
  return { reportError, appendTurnEvent, get: () => state };
};

type InputParams = {
  readonly agentId: AgentId;
  readonly origin?: SendTurnInput['origin'];
  readonly deliveryId?: string;
  readonly onStarted?: () => void;
  readonly attachments?: SendTurnInput['attachments'];
};

const SCREENSHOT = {
  id: 'attachment-ledger',
  fileName: 'ledger-core.png',
  mimeType: 'image/png',
  dataBase64: 'iVBORw0KGgo=',
};

const inputOf = ({
  agentId,
  origin,
  deliveryId,
  onStarted,
  attachments,
}: InputParams): SendTurnInput => ({
  sessionId: SESSION,
  agentId,
  content: 'Also read the notify-relay callers',
  ...(origin !== undefined && { origin }),
  ...(deliveryId !== undefined && { deliveryId }),
  ...(onStarted !== undefined && { onStarted }),
  ...(attachments !== undefined && { attachments }),
});

afterEach(() => {
  registerAutoChildTurnPort({ port: null });
});

describe('a message typed to a child Auto started', () => {
  it('becomes a continue of its delegation and keeps the words in the chat', async () => {
    const port = vi.fn<AutoChildTurnPort>(async () => ({ kind: 'continued' }));
    registerAutoChildTurnPort({ port });
    const { get, appendTurnEvent } = harness();
    const onStarted = vi.fn();

    const result = await routeAutoChildTurn({
      get,
      input: inputOf({ agentId: CHILD_AGENT, onStarted }),
    });

    expect(result).toEqual({ blockedOverBudget: false });
    expect(port).toHaveBeenCalledWith({
      agentId: CHILD_AGENT,
      sessionId: SESSION,
      text: 'Also read the notify-relay callers',
      from: 'user',
      hasFiles: false,
    });
    expect(onStarted).toHaveBeenCalledOnce();
    expect(appendTurnEvent).toHaveBeenCalledWith(
      CHILD_AGENT,
      SESSION,
      expect.objectContaining({
        kind: 'operator_text',
        text: 'Also read the notify-relay callers',
      }),
    );
  });

  it("reads a queued Auto message as Auto's, and shows no echo of the person", async () => {
    const port = vi.fn<AutoChildTurnPort>(async () => ({ kind: 'continued' }));
    registerAutoChildTurnPort({ port });
    const { get, appendTurnEvent } = harness();

    await routeAutoChildTurn({
      get,
      input: inputOf({
        agentId: CHILD_AGENT,
        origin: 'operator',
        deliveryId: 'queue:auto-message:delegation-scout:id-1',
      }),
    });

    expect(port).toHaveBeenCalledWith(expect.objectContaining({ from: 'auto-message' }));
    expect(appendTurnEvent).not.toHaveBeenCalled();
  });

  it('drops a late Auto message once its tree is gone, never running it as the person', async () => {
    const port = vi.fn<AutoChildTurnPort>(async () => ({ kind: 'plain' }));
    registerAutoChildTurnPort({ port });
    const { get, appendTurnEvent } = harness();
    const onStarted = vi.fn();

    const result = await routeAutoChildTurn({
      get,
      input: inputOf({
        agentId: CHILD_AGENT,
        origin: 'operator',
        deliveryId: 'queue:auto-message:delegation-scout:id-1',
        onStarted,
      }),
    });

    expect(result).toEqual({ blockedOverBudget: false, isAlreadySent: true });
    expect(port).toHaveBeenCalledWith(expect.objectContaining({ from: 'auto-message' }));
    expect(onStarted).not.toHaveBeenCalled();
    expect(appendTurnEvent).not.toHaveBeenCalled();
  });

  it('keeps the plain turn for a child outside a live tree', async () => {
    registerAutoChildTurnPort({ port: async () => ({ kind: 'plain' }) });
    const { get } = harness();

    expect(await routeAutoChildTurn({ get, input: inputOf({ agentId: CHILD_AGENT }) })).toBeNull();
  });

  it('lets files through as a plain turn when the tree has finished', async () => {
    const port = vi.fn<AutoChildTurnPort>(async () => ({ kind: 'plain' }));
    registerAutoChildTurnPort({ port });
    const { get, reportError } = harness();

    expect(
      await routeAutoChildTurn({
        get,
        input: inputOf({ agentId: CHILD_AGENT, attachments: [SCREENSHOT] }),
      }),
    ).toBeNull();
    expect(port).toHaveBeenCalledWith(expect.objectContaining({ hasFiles: true }));
    expect(reportError).not.toHaveBeenCalled();
  });

  it('shows the files refusal Auto gives for a child of a live tree', async () => {
    registerAutoChildTurnPort({
      port: async () => ({ kind: 'refused', message: 'not files yet' }),
    });
    const { get } = harness();

    await expect(
      routeAutoChildTurn({
        get,
        input: inputOf({ agentId: CHILD_AGENT, attachments: [SCREENSHOT] }),
      }),
    ).rejects.toThrow('not files yet');
  });

  it('never injects a message into a running child turn', async () => {
    const port = vi.fn<AutoChildTurnPort>(async () => ({ kind: 'continued' }));
    registerAutoChildTurnPort({ port });
    const { get, reportError } = harness({ isChildRunning: true });

    await expect(
      routeAutoChildTurn({ get, input: inputOf({ agentId: CHILD_AGENT }) }),
    ).rejects.toThrow('still working for Auto');

    expect(port).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Your message did not reach Scout' }),
    );
  });

  it('shows the refusal Auto gives and sends nothing', async () => {
    registerAutoChildTurnPort({
      port: async () => ({ kind: 'refused', message: 'that agent came back too many times' }),
    });
    const { get } = harness();

    await expect(
      routeAutoChildTurn({ get, input: inputOf({ agentId: CHILD_AGENT }) }),
    ).rejects.toThrow('that agent came back too many times');
  });

  it('leaves Auto itself, a child of a plain agent and a delegation turn alone', async () => {
    const port = vi.fn<AutoChildTurnPort>(async () => ({ kind: 'continued' }));
    registerAutoChildTurnPort({ port });
    const { get } = harness();

    expect(await routeAutoChildTurn({ get, input: inputOf({ agentId: AUTO_AGENT }) })).toBeNull();
    expect(await routeAutoChildTurn({ get, input: inputOf({ agentId: PLAIN_CHILD }) })).toBeNull();
    expect(
      await routeAutoChildTurn({
        get,
        input: inputOf({ agentId: CHILD_AGENT, origin: 'delegation' }),
      }),
    ).toBeNull();
    expect(port).not.toHaveBeenCalled();
  });
});
