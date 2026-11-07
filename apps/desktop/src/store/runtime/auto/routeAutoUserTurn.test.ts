// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type MessageAttachment,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
  type TurnState,
  type WorkspaceId,
} from '@goodboy/types';
import {
  registerAutoUserTurnPort,
  type AutoUserTurnPort,
} from '../../../features/auto/autoUserTurnPort';
import type { SendTurnInput } from '../../slices/turn/types';
import { routeAutoUserTurn, type RouteAutoUserTurnParams } from './routeAutoUserTurn';

type AutoTurnState = ReturnType<RouteAutoUserTurnParams['get']>;

const AUTO_ATTACHMENTS_MESSAGE = 'Auto takes images in a message, not other files yet.';
const AUTO_IMAGES_LOST_MESSAGE = 'Auto could not keep the images. Attach them again.';

const BANNER_INPUT = {
  id: 'attachment-banner',
  fileName: 'banner-wide.png',
  mimeType: 'image/png',
  dataBase64: 'iVBORw0KGgo=',
};

const BANNER_STORED: MessageAttachment = {
  id: 'attachment-banner',
  kind: 'image',
  fileName: 'banner-wide.png',
  mimeType: 'image/png',
  relPath: '.goodboy/attachments/attachment-banner/banner-wide.png',
  dir: '/scratch/session-harborline',
};
const AUTO_MESSAGE_LOST_MESSAGE = 'Auto could not take your message. Send it again in a moment.';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const AUTO_AGENT = brandId<AgentId>({ value: 'agent-auto' });
const CHILD_AGENT = brandId<AgentId>({ value: 'agent-implementer' });
const NESTED_AGENT = brandId<AgentId>({ value: 'agent-nested' });

type AgentRow = AutoTurnState['sessionPhaseRuns'][SessionId][number];

const autoRow: AgentRow = { id: AUTO_AGENT, kind: 'auto', parentAgentId: undefined };

type HarnessParams = {
  readonly agents: ReadonlyArray<AgentRow>;
  readonly transcripts?: AutoTurnState['transcripts'];
  readonly agentTurnState?: AutoTurnState['agentTurnState'];
};

const ASKED_AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const ASK_RUN = brandId<ProviderRunId>({ value: 'run-auto-ask' });
const AUTO_ASK: TurnEvent = {
  kind: 'permission_request',
  runId: ASK_RUN,
  toolUseId: 'read-outside',
  toolName: 'Read',
  input: { file_path: '/notify-relay/README.md' },
  at: ASKED_AT,
};
const HELD: TurnState = { kind: 'blocked', runId: ASK_RUN, blockedAt: ASKED_AT };

const harness = ({ agents, transcripts = {}, agentTurnState = {} }: HarnessParams) => {
  const reportError = vi.fn(async () => undefined);
  const appendTurnEvent = vi.fn<AutoTurnState['appendTurnEvent']>();
  const loadAutoTrees = vi.fn<AutoTurnState['loadAutoTrees']>(async () => undefined);
  const state: AutoTurnState = {
    sessions: [{ id: SESSION, workspaceId: WORKSPACE }],
    sessionPhaseRuns: { [SESSION]: agents },
    selectedAgentId: { [SESSION]: AUTO_AGENT },
    transcripts,
    agentTurnState,
    reportError,
    appendTurnEvent,
    loadAutoTrees,
  };
  return { reportError, appendTurnEvent, loadAutoTrees, get: () => state };
};

const isDecision = (event: unknown): boolean =>
  typeof event === 'object' &&
  event !== null &&
  Reflect.get(event, 'kind') === 'permission_decision';

const inputOf = (overrides: Partial<SendTurnInput> = {}): SendTurnInput => ({
  sessionId: SESSION,
  agentId: AUTO_AGENT,
  content: 'Also cover the notify-relay retries',
  ...overrides,
});

afterEach(() => {
  registerAutoUserTurnPort({ port: null });
});

describe('a message typed over the ask of an Auto agent', () => {
  const askingAuto = () =>
    harness({
      agents: [autoRow],
      transcripts: { [AUTO_AGENT]: [AUTO_ASK] },
      agentTurnState: { [AUTO_AGENT]: HELD },
    });

  const decisionsOf = (calls: ReadonlyArray<ReadonlyArray<unknown>>) =>
    calls.map((call) => call[2]).filter((event) => isDecision(event));

  it('denies the ask with the text as the reason, and Auto reads the denial', async () => {
    const texts: Array<string> = [];
    const port = vi.fn<AutoUserTurnPort>(async ({ text }) => {
      texts.push(text);
      return 'queued';
    });
    registerAutoUserTurnPort({ port });
    const { get, appendTurnEvent } = askingAuto();

    await routeAutoUserTurn({ get, input: inputOf({ origin: 'operator' }) });

    expect(texts).toEqual(['Denied Read. Also cover the notify-relay retries']);
    expect(decisionsOf(appendTurnEvent.mock.calls)).toEqual([
      expect.objectContaining({
        decision: 'deny',
        decidedBy: 'user',
        toolUseId: 'read-outside',
        runId: ASK_RUN,
        reason: 'Also cover the notify-relay retries',
      }),
    ]);
    expect(appendTurnEvent.mock.calls.at(-1)?.[2]).toMatchObject({
      kind: 'operator_text',
      text: 'Also cover the notify-relay retries',
    });
  });

  it('leaves the ask open when Auto lost the message', async () => {
    registerAutoUserTurnPort({ port: vi.fn<AutoUserTurnPort>(async () => 'lost') });
    const { get, appendTurnEvent } = askingAuto();

    await expect(
      routeAutoUserTurn({ get, input: inputOf({ origin: 'operator' }) }),
    ).rejects.toThrow(AUTO_MESSAGE_LOST_MESSAGE);

    expect(decisionsOf(appendTurnEvent.mock.calls)).toEqual([]);
  });

  it('leaves the ask alone for the turn a permission answer starts', async () => {
    const texts: Array<string> = [];
    const port = vi.fn<AutoUserTurnPort>(async ({ text }) => {
      texts.push(text);
      return 'queued';
    });
    registerAutoUserTurnPort({ port });
    const { get, appendTurnEvent } = askingAuto();

    await routeAutoUserTurn({ get, input: inputOf() });

    expect(texts).toEqual(['Also cover the notify-relay retries']);
    expect(decisionsOf(appendTurnEvent.mock.calls)).toEqual([]);
  });

  it('carries a scoped read grant to the port, and nothing else', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = askingAuto();

    await routeAutoUserTurn({
      get,
      input: inputOf({
        content: 'Go on.',
        permissionOnceAllows: ['Read(//notify-relay/README.md)', 'Bash(pnpm db:migrate)', 'Read'],
      }),
    });

    expect(port.mock.calls[0]?.[0]?.permissionOnceAllows).toEqual([
      'Read(//notify-relay/README.md)',
    ]);
  });

  it('reads an unsent allow from the transcript and sends the grant with it', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness({
      agents: [autoRow],
      transcripts: {
        [AUTO_AGENT]: [
          AUTO_ASK,
          {
            kind: 'permission_decision',
            runId: ASK_RUN,
            toolUseId: 'read-outside',
            decision: 'allow',
            scope: 'once',
            ruleId: null,
            decidedBy: 'user',
            at: ASKED_AT,
          },
        ],
      },
    });

    await routeAutoUserTurn({ get, input: inputOf({ origin: 'operator', content: 'Go on.' }) });

    const turn = port.mock.calls[0]?.[0];
    expect(turn?.text).toContain('Permission for Read is granted for this one call.');
    expect(turn?.permissionOnceAllows).toEqual(['Read(//notify-relay/README.md)']);
  });

  it('omits the reason of an images only message', async () => {
    registerAutoUserTurnPort({ port: vi.fn<AutoUserTurnPort>(async () => 'queued') });
    const { get, appendTurnEvent } = askingAuto();

    await routeAutoUserTurn({
      get,
      input: inputOf({ origin: 'operator', content: '' }),
      storeImages: async () => [BANNER_STORED],
    });

    const [decision] = decisionsOf(appendTurnEvent.mock.calls);
    expect(decision).toMatchObject({ decision: 'deny' });
    expect(decision).not.toHaveProperty('reason');
  });
});

describe('a message typed to an Auto agent', () => {
  it('goes through the Auto door with the workspace of its session', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness({ agents: [autoRow] });
    const onStarted = vi.fn();

    const result = await routeAutoUserTurn({ get, input: inputOf({ onStarted }) });

    expect(result).toEqual({ blockedOverBudget: false });
    expect(port).toHaveBeenCalledWith({
      agentId: AUTO_AGENT,
      sessionId: SESSION,
      workspaceId: WORKSPACE,
      text: 'Also cover the notify-relay retries',
      onQueued: expect.any(Function),
    });
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it('writes its echo with the id of the outbox row Auto queued', async () => {
    registerAutoUserTurnPort({
      port: vi.fn<AutoUserTurnPort>(async ({ onQueued }) => {
        onQueued?.({ rowId: 'outbox-row-7' });
        return 'queued';
      }),
    });
    const { get, appendTurnEvent } = harness({ agents: [autoRow] });

    await routeAutoUserTurn({ get, input: inputOf() });

    expect(appendTurnEvent).toHaveBeenCalledWith(
      AUTO_AGENT,
      SESSION,
      expect.objectContaining({ kind: 'operator_text', outboxId: 'outbox-row-7' }),
    );
  });

  it('hands the queue delivery id to Auto and writes no second echo for a repeat', async () => {
    const port = vi.fn<AutoUserTurnPort>(async ({ onQueued }) => {
      onQueued?.({ rowId: 'outbox-row-7', isRepeat: true });
      return 'queued';
    });
    registerAutoUserTurnPort({ port });
    const { get, appendTurnEvent } = harness({ agents: [autoRow] });
    const onStarted = vi.fn();

    await routeAutoUserTurn({
      get,
      input: inputOf({ deliveryId: 'queue:send-auto-1', onStarted }),
    });

    expect(port).toHaveBeenCalledWith(expect.objectContaining({ deliveryId: 'queue:send-auto-1' }));
    expect(appendTurnEvent).not.toHaveBeenCalled();
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it('reads the trees again before the composer tray lets go of the message', async () => {
    registerAutoUserTurnPort({ port: vi.fn<AutoUserTurnPort>(async () => 'queued') });
    const { get, loadAutoTrees } = harness({ agents: [autoRow] });
    const onStarted = vi.fn(() => {
      expect(loadAutoTrees).toHaveBeenCalledWith({ sessionId: SESSION });
    });

    await routeAutoUserTurn({ get, input: inputOf({ onStarted }) });

    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it('follows the selected agent when the send names none', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness({ agents: [autoRow] });

    await routeAutoUserTurn({
      get,
      input: { sessionId: SESSION, content: 'Also cover the notify-relay retries' },
    });

    expect(port).toHaveBeenCalledWith(expect.objectContaining({ agentId: AUTO_AGENT }));
  });

  it('is written once as the user own words after Auto took it', async () => {
    registerAutoUserTurnPort({ port: vi.fn<AutoUserTurnPort>(async () => 'queued') });
    const { get, appendTurnEvent } = harness({ agents: [autoRow] });

    await routeAutoUserTurn({ get, input: inputOf() });

    expect(appendTurnEvent).toHaveBeenCalledTimes(1);
    expect(appendTurnEvent).toHaveBeenCalledWith(
      AUTO_AGENT,
      SESSION,
      expect.objectContaining({
        kind: 'operator_text',
        text: 'Also cover the notify-relay retries',
      }),
    );
  });

  it('is refused out loud when Auto lost it, and no turn is started', async () => {
    registerAutoUserTurnPort({ port: vi.fn<AutoUserTurnPort>(async () => 'lost') });
    const { get, reportError, appendTurnEvent } = harness({ agents: [autoRow] });

    await expect(routeAutoUserTurn({ get, input: inputOf() })).rejects.toThrow(
      AUTO_MESSAGE_LOST_MESSAGE,
    );
    expect(appendTurnEvent).not.toHaveBeenCalled();

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Auto didn't get your message", sessionId: SESSION }),
    );
  });

  it('is refused out loud when it carries files, and the door is not asked', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get, reportError } = harness({ agents: [autoRow] });
    const attachments = [
      {
        id: 'attachment-1',
        fileName: 'notes.md',
        mimeType: 'text/markdown',
        dataBase64: 'bm90ZXM=',
      },
    ];

    await expect(
      routeAutoUserTurn({
        get,
        input: inputOf({ attachments }),
      }),
    ).rejects.toThrow(AUTO_ATTACHMENTS_MESSAGE);

    expect(port).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('keeps the images, hands them to Auto and shows them on the bubble', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get, appendTurnEvent } = harness({ agents: [autoRow] });
    const storeImages = vi.fn(async () => [BANNER_STORED]);

    await routeAutoUserTurn({
      get,
      input: inputOf({ attachments: [BANNER_INPUT] }),
      storeImages,
    });

    expect(storeImages).toHaveBeenCalledWith({ sessionId: SESSION, images: [BANNER_INPUT] });
    expect(port).toHaveBeenCalledWith(expect.objectContaining({ images: [BANNER_STORED] }));
    expect(appendTurnEvent).toHaveBeenCalledWith(
      AUTO_AGENT,
      SESSION,
      expect.objectContaining({ kind: 'operator_text', attachments: [BANNER_STORED] }),
    );
  });

  it('refuses the message when the images cannot be kept, and Auto hears nothing', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get, reportError } = harness({ agents: [autoRow] });

    await expect(
      routeAutoUserTurn({
        get,
        input: inputOf({ attachments: [BANNER_INPUT] }),
        storeImages: async () => {
          throw new Error('disk full');
        },
      }),
    ).rejects.toThrow(AUTO_IMAGES_LOST_MESSAGE);

    expect(port).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('refuses the message when there is no Auto door, never sending it as a plain turn', async () => {
    const { get, reportError, appendTurnEvent } = harness({ agents: [autoRow] });

    await expect(routeAutoUserTurn({ get, input: inputOf() })).rejects.toThrow(
      'Auto is still starting. Retry in a moment.',
    );
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(appendTurnEvent).not.toHaveBeenCalled();
  });

  it('leaves a plain agent to the plain turn when there is no Auto door', async () => {
    const { get } = harness({
      agents: [{ id: CHILD_AGENT, kind: 'implementer', parentAgentId: undefined }],
    });

    expect(await routeAutoUserTurn({ get, input: inputOf({ agentId: CHILD_AGENT }) })).toBeNull();
  });

  it('leaves a delivery, a workflow turn and a continuation to the plain turn', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness({ agents: [autoRow] });

    for (const origin of ['delegation', 'workflow', 'mount-continuation'] as const) {
      expect(await routeAutoUserTurn({ get, input: inputOf({ origin }) })).toBeNull();
    }
    expect(port).not.toHaveBeenCalled();
  });

  it('leaves agents that are not the root of an Auto tree to the plain turn', async () => {
    const port = vi.fn<AutoUserTurnPort>(async () => 'queued');
    registerAutoUserTurnPort({ port });
    const { get } = harness({
      agents: [
        autoRow,
        { id: CHILD_AGENT, kind: 'implementer', parentAgentId: AUTO_AGENT },
        { id: NESTED_AGENT, kind: 'auto', parentAgentId: AUTO_AGENT },
      ],
    });

    expect(await routeAutoUserTurn({ get, input: inputOf({ agentId: CHILD_AGENT }) })).toBeNull();
    expect(
      await routeAutoUserTurn({
        get,
        input: inputOf({ agentId: NESTED_AGENT }),
      }),
    ).toBeNull();
    expect(port).not.toHaveBeenCalled();
  });
});
