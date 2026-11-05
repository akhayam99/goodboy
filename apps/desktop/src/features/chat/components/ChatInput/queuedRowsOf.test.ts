import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import { AUTO_BLOCK_TEXT } from '@goodboy/core/auto';
import type { AgentQueuedTurn } from '../../../../store/slices/agentQueue/types';
import { aDelegation, aView } from '../../../auto/testing/autoViewFixtures';
import { queuedRowsOf } from './queuedRowsOf';

const AGENT = brandId<AgentId>({ value: 'agent-auto' });

const SENT_AT = Date.UTC(2026, 9, 20, 12, 10, 0);

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

    const rows = queuedRowsOf({ queue: [turn('t1'), turn('t2')], view });

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

    const [retry] = queuedRowsOf({ queue: [], view: blocked });
    const [none] = queuedRowsOf({ queue: [], view: stopped });

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

    expect(queuedRowsOf({ queue: [], view: budget })[0]?.action).toBe('raiseLimit');
    expect(queuedRowsOf({ queue: [], view: clock })[0]?.action).toBeNull();
  });

  it('says Waits for this turn when the tree takes a turn and no child runs', () => {
    const view = aView({ phase: 'deciding', pendingMessages: [message('a', 0)] });

    expect(queuedRowsOf({ queue: [], view })[0]).toMatchObject({
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

    const during = queuedRowsOf({ queue: [turn('t1', { status: 'sending' }), turn('t2')], view });
    const after = queuedRowsOf({ queue: [turn('t2')], view });

    expect(during.map((row) => row.id)).toEqual(['outbox-1', 't2']);
    expect(after.map((row) => row.id)).toEqual(['outbox-1', 't2']);
  });

  it('keeps a sending tray row until its outbox row is read', () => {
    const view = aView({ phase: 'waiting', delegations: [RUNNING], pendingMessages: [] });

    const rows = queuedRowsOf({ queue: [turn('t1', { status: 'sending' })], view });

    expect(rows.map((row) => row.id)).toEqual(['t1']);
  });

  it('keeps an identical older Auto message and a sending tray message as two rows', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [RUNNING],
      pendingMessages: [message('old', -60_000, 'tray t1')],
    });

    const rows = queuedRowsOf({ queue: [turn('t1', { status: 'sending' })], view });

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

    const rows = queuedRowsOf({ queue: [turn('t1', { attachments: [stored] })], view });

    expect(rows[0]?.images.map((item) => [item.id, item.workingDir])).toEqual([
      ['image-1', '/scratch/session-harborline'],
      ['image-2', '/scratch/session-harborline'],
    ]);
    expect(rows[1]?.images[0]).toMatchObject({ id: 'stored-1', previewSrc: stored.dataUrl });
  });

  it('draws only the tray when the agent is not the root of an Auto tree', () => {
    const rows = queuedRowsOf({ queue: [turn('t1')], view: null });

    expect(rows.map((row) => row.source)).toEqual(['agent']);
  });
});
