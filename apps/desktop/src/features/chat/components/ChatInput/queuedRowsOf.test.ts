import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import { AUTO_BLOCK_TEXT } from '@goodboy/core/auto';
import type { AgentQueuedTurn } from '../../../../store/slices/agentQueue/types';
import { aDelegation, aView } from '../../../auto/testing/autoViewFixtures';
import { queuedRowsOf } from './queuedRowsOf';

const AGENT = brandId<AgentId>({ value: 'agent-auto' });

const SENT_AT = Date.UTC(2026, 9, 20, 12, 10, 0);

const AT_REST = { isAgentStopped: false, nowMs: SENT_AT + 60_000 };

const turn = (id: string, overrides: Partial<AgentQueuedTurn> = {}): AgentQueuedTurn => ({
  id,
  agentId: AGENT,
  content: `tray ${id}`,
  attachments: [],
  override: undefined,
  status: 'queued',
  createdAt: brandId<IsoDateTime>({ value: new Date(SENT_AT).toISOString() }),
  ...overrides,
});

const message = (rowId: string, offsetMs: number, text = `auto ${rowId}`) => ({
  rowId,
  createdAt: SENT_AT + offsetMs,
  text,
  images: [],
});

const RUNNING = aDelegation({ key: 'export', role: 'scout', state: 'running' });

type BlockedParams = {
  readonly reason: string;
  readonly pendingMessages: ReadonlyArray<ReturnType<typeof message>>;
};

const blockedView = ({ reason, pendingMessages }: BlockedParams) => {
  const view = aView({ phase: 'blocked', pendingMessages });
  return { ...view, tree: { ...view.tree, blockedReason: reason } };
};

describe('queuedRowsOf', () => {
  it('puts the Auto rows first and the tray rows after them, in send order', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [RUNNING],
      pendingMessages: [message('b', 2_000), message('a', 1_000)],
    });

    const rows = queuedRowsOf({ queue: [turn('t1'), turn('t2')], view, ...AT_REST });

    expect(rows.map((row) => `${row.source}:${row.id}`)).toEqual([
      'auto:a',
      'auto:b',
      'agent:t1',
      'agent:t2',
    ]);
  });

  it('says one status word per row, the reason only as a tooltip', () => {
    const blocked = blockedView({
      reason: 'Claude is not signed in',
      pendingMessages: [message('a', 0)],
    });
    const stopped = aView({ phase: 'stopped', pendingMessages: [message('a', 0)] });

    const [retry] = queuedRowsOf({ queue: [], view: blocked, ...AT_REST });
    const [none] = queuedRowsOf({ queue: [], view: stopped, ...AT_REST });

    expect(retry).toMatchObject({
      statusText: 'Not delivered',
      reason: 'Claude is not signed in',
      action: 'retry',
      status: 'notDelivered',
    });
    expect(none).toMatchObject({
      statusText: 'Not delivered',
      reason: 'Auto was stopped.',
      action: null,
    });
  });

  it('offers Change limit for the budget and nothing for the time limit', () => {
    const budget = blockedView({
      reason: AUTO_BLOCK_TEXT.budget,
      pendingMessages: [message('a', 0)],
    });
    const clock = blockedView({
      reason: AUTO_BLOCK_TEXT.limit_wall_clock,
      pendingMessages: [message('a', 0)],
    });

    expect(queuedRowsOf({ queue: [], view: budget, ...AT_REST })[0]?.action).toBe('raiseLimit');
    expect(queuedRowsOf({ queue: [], view: clock, ...AT_REST })[0]?.action).toBeNull();
  });

  it('says Waits for this turn when the tree takes a turn and no child runs', () => {
    const view = aView({ phase: 'deciding', pendingMessages: [message('a', 0)] });

    expect(queuedRowsOf({ queue: [], view, ...AT_REST })[0]).toMatchObject({
      statusText: 'Waits for this turn',
      action: null,
    });
  });

  it('keeps a message that moves from the tray to the outbox in one place, once', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [RUNNING],
      pendingMessages: [message('outbox-1', 400, 'tray t1')],
    });

    const during = queuedRowsOf({
      queue: [turn('t1', { status: 'sending' }), turn('t2')],
      view,
      ...AT_REST,
    });
    const after = queuedRowsOf({ queue: [turn('t2')], view, ...AT_REST });

    expect(during.map((row) => row.id)).toEqual(['outbox-1', 't2']);
    expect(after.map((row) => row.id)).toEqual(['outbox-1', 't2']);
  });

  it('keeps a sending tray row until its outbox row is read', () => {
    const view = aView({ phase: 'waiting', delegations: [RUNNING], pendingMessages: [] });

    const rows = queuedRowsOf({ queue: [turn('t1', { status: 'sending' })], view, ...AT_REST });

    expect(rows.map((row) => row.id)).toEqual(['t1']);
  });

  it('keeps an identical older Auto message and a sending tray message as two rows', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [RUNNING],
      pendingMessages: [message('old', -60_000, 'tray t1')],
    });

    const rows = queuedRowsOf({ queue: [turn('t1', { status: 'sending' })], view, ...AT_REST });

    expect(rows.map((row) => row.id)).toEqual(['old', 't1']);
  });

  it('carries the images of both sources as thumbs', () => {
    const image = {
      id: 'image-1',
      kind: 'image' as const,
      fileName: 'timeline.png',
      mimeType: 'image/png',
      relPath: '.goodboy/attachments/image-1/timeline.png',
      dir: '/scratch/session-harborline',
    };
    const view = aView({
      phase: 'waiting',
      delegations: [RUNNING],
      pendingMessages: [{ ...message('a', 0), images: [image, { ...image, id: 'image-2' }] }],
    });
    const stored = {
      id: 'stored-1',
      fileName: 'log.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AAAA',
      relPath: null,
    };

    const rows = queuedRowsOf({ queue: [turn('t1', { attachments: [stored] })], view, ...AT_REST });

    expect(rows[0]?.images.map((item) => [item.id, item.workingDir])).toEqual([
      ['image-1', '/scratch/session-harborline'],
      ['image-2', '/scratch/session-harborline'],
    ]);
    expect(rows[1]?.images[0]).toMatchObject({ id: 'stored-1', previewSrc: stored.dataUrl });
  });

  it('hides a message sent to an idle agent for its first half second', () => {
    const direct = turn('d1', { status: 'sending', isDirect: true });

    const early = queuedRowsOf({ queue: [direct], view: null, ...AT_REST, nowMs: SENT_AT + 200 });
    const late = queuedRowsOf({ queue: [direct], view: null, ...AT_REST, nowMs: SENT_AT + 600 });

    expect(early).toEqual([]);
    expect(late.map((row) => [row.id, row.statusText, row.action])).toEqual([
      ['d1', 'Sending now', null],
    ]);
  });

  it('shows a held message at once as Not delivered with its reason and Retry', () => {
    const held = turn('h1', {
      isDirect: true,
      hold: { reason: 'Every provider is over its limit.' },
    });

    const [row] = queuedRowsOf({ queue: [held], view: null, ...AT_REST, nowMs: SENT_AT });

    expect(row).toMatchObject({
      status: 'notDelivered',
      statusText: 'Not delivered',
      reason: 'Every provider is over its limit.',
      action: 'retry',
    });
  });

  it('says a message for a stopped agent sends when you Continue', () => {
    const [row] = queuedRowsOf({
      queue: [turn('s1')],
      view: null,
      ...AT_REST,
      isAgentStopped: true,
    });

    expect(row).toMatchObject({ statusText: 'Sends when you Continue', action: 'sendNow' });
  });

  it('draws only the tray when the agent is not the root of an Auto tree', () => {
    const rows = queuedRowsOf({ queue: [turn('t1')], view: null, ...AT_REST });

    expect(rows.map((row) => row.source)).toEqual(['agent']);
  });
});
