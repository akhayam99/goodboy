// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, OpenQuestion, SessionEvent, SessionEventId } from '@goodboy/types';
import { DONE_ROW_STATE, type RowState } from '../../workTreeModel/rowState';
import type { TimelineTopLevelEntry } from './buildTimelineGroups';
import type { TimelineStreamItem } from './buildTimelineStream';
import { needsYouOwners } from './needsYou';

const ASKING: RowState = {
  phase: 'waiting',
  reason: null,
  ask: { kind: 'answer', question: null },
};

const question = ({
  id,
  status = 'open',
  createdAt = '2026-10-03T10:00:00.000Z',
}: {
  readonly id: string;
  readonly status?: string;
  readonly createdAt?: string;
}) => ({ id, status, text: `Which retry cap for ${id}?`, createdAt }) as unknown as OpenQuestion;

const agentEntry = ({
  id,
  questions = [],
}: {
  readonly id: string;
  readonly questions?: ReadonlyArray<OpenQuestion>;
}) => ({
  kind: 'agent' as const,
  id: `agent:${id}`,
  agent: { id, name: `Step ${id}` },
  agentKind: 'implementer' as const,
  openQuestions: questions,
  children: [],
});

type RowParams = {
  readonly id: string;
  readonly familyId: string | null;
  readonly rowState: RowState;
  readonly entry: unknown;
  readonly at?: string | null;
  readonly hasSubagentAttention?: true;
};

const row = ({ id, familyId, rowState, entry, at = null, hasSubagentAttention }: RowParams) =>
  ({
    kind: 'row',
    id,
    familyId,
    rowState,
    entry,
    at,
    ...(hasSubagentAttention === undefined ? {} : { hasSubagentAttention }),
  }) as unknown as TimelineStreamItem;

const NOW = { kind: 'now', id: 'now' } as unknown as TimelineStreamItem;

const event = ({
  id,
  kind,
  at,
  payload,
}: {
  readonly id: string;
  readonly kind: SessionEvent['kind'];
  readonly at: string;
  readonly payload: SessionEvent['payload'];
}): SessionEvent => ({
  id: id as SessionEventId,
  sessionId: 'session-1' as SessionEvent['sessionId'],
  kind,
  payload,
  createdAt: at as IsoDateTime,
});

describe('needsYouOwners', () => {
  it('gives a run one row, however many of its steps ask', () => {
    const asked = question({ id: 'cap' });
    const second = question({ id: 'timeout', createdAt: '2026-10-03T11:00:00.000Z' });
    const stepOne = agentEntry({ id: 'one', questions: [asked] });
    const stepTwo = agentEntry({ id: 'two', questions: [second] });
    const runEntry = {
      kind: 'run',
      id: 'run:1',
      run: { title: 'Retry policy for payments-api' },
      workflow: { name: 'Plan and build' },
      children: [stepOne, stepTwo],
    };
    const owners = needsYouOwners({
      items: [
        NOW,
        row({ id: 'run:1', familyId: 'run:1', rowState: DONE_ROW_STATE, entry: runEntry }),
        row({ id: 'agent:two', familyId: 'run:1', rowState: ASKING, entry: stepTwo }),
        row({ id: 'agent:one', familyId: 'run:1', rowState: ASKING, entry: stepOne }),
      ],
      entries: [],
      events: [],
    });

    expect(owners.map((owner) => [owner.id, owner.kind, owner.text])).toEqual([
      ['run:1', 'run', 'Retry policy for payments-api · 2 questions'],
    ]);
    expect(owners[0]?.question?.id).toBe('cap');
  });

  it('names a solo agent that asks and leaves quiet rows out', () => {
    const solo = agentEntry({ id: 'solo', questions: [question({ id: 'cap' })] });
    const quiet = agentEntry({ id: 'quiet' });
    const owners = needsYouOwners({
      items: [
        NOW,
        row({ id: 'agent:quiet', familyId: 'agent:quiet', rowState: DONE_ROW_STATE, entry: quiet }),
        row({ id: 'agent:solo', familyId: 'agent:solo', rowState: ASKING, entry: solo }),
      ],
      entries: [],
      events: [],
    });

    expect(owners.map((owner) => [owner.id, owner.text])).toEqual([
      ['agent:solo', 'Step solo · 1 question'],
    ]);
  });

  it('counts a subagent that asks or has failed once, on its step', () => {
    const step = agentEntry({ id: 'build' });
    const owners = needsYouOwners({
      items: [
        row({
          id: 'agent:build',
          familyId: 'agent:build',
          rowState: DONE_ROW_STATE,
          entry: step,
          hasSubagentAttention: true,
        }),
      ],
      entries: [],
      events: [],
    });

    expect(owners.map((owner) => owner.id)).toEqual(['agent:build']);
  });

  it('gives a question without a launch its own row while it is open only', () => {
    const open: TimelineTopLevelEntry = {
      kind: 'question',
      id: 'question:cap',
      at: '2026-10-03T10:00:00.000Z',
      questions: [question({ id: 'cap' })],
      lane: null,
    };
    const answered: TimelineTopLevelEntry = {
      ...open,
      id: 'question:done',
      questions: [question({ id: 'done', status: 'answered' })],
    };
    const owners = needsYouOwners({ items: [], entries: [open, answered], events: [] });

    expect(owners.map((owner) => [owner.id, owner.kind, owner.text])).toEqual([
      ['question:cap', 'question', 'Question · Which retry cap for cap?'],
    ]);
  });

  it('keeps a stopped rebase with its repeats and drops it once a later outcome settled it', () => {
    const stopped = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-10-03T17:57:00.000Z',
      payload: { origin: 'rebase', reason: 'conflict', branch: 'feat/export' },
    });
    const rewritten = event({
      id: 'ev-2',
      kind: 'history_rewritten',
      at: '2026-10-03T18:30:00.000Z',
      payload: { origin: 'rebase', backupRef: 'refs/goodboy/backup/feat/1' },
    });
    const stopRow = row({
      id: 'event:ev-1',
      familyId: null,
      rowState: DONE_ROW_STATE,
      entry: { kind: 'event', id: 'event:ev-1', event: stopped, repeatCount: 2 },
      at: stopped.createdAt,
    });

    const open = needsYouOwners({ items: [stopRow], entries: [], events: [stopped] });
    const settled = needsYouOwners({ items: [stopRow], entries: [], events: [stopped, rewritten] });

    expect(open.map((owner) => [owner.kind, owner.text])).toEqual([
      ['rebase', 'Rebase of feat/export stopped ×2'],
    ]);
    expect(settled).toEqual([]);
  });

  it('orders owners newest first', () => {
    const early = agentEntry({ id: 'early', questions: [question({ id: 'a' })] });
    const late = agentEntry({ id: 'late', questions: [question({ id: 'b' })] });
    const owners = needsYouOwners({
      items: [
        row({
          id: 'agent:early',
          familyId: 'agent:early',
          rowState: ASKING,
          entry: early,
          at: '2026-10-03T09:00:00.000Z',
        }),
        row({
          id: 'agent:late',
          familyId: 'agent:late',
          rowState: ASKING,
          entry: late,
          at: '2026-10-03T12:00:00.000Z',
        }),
      ],
      entries: [],
      events: [],
    });

    expect(owners.map((owner) => owner.id)).toEqual(['agent:late', 'agent:early']);
  });

  it('merges resolve batches of one pull request into one row with summed counts', () => {
    const part = (state: string, count: number) => ({ state, count });
    const batch = ({
      id,
      prNumber,
      parts,
      at,
    }: {
      readonly id: string;
      readonly prNumber: number;
      readonly parts: ReadonlyArray<{ readonly state: string; readonly count: number }>;
      readonly at: string;
    }) =>
      row({
        id,
        familyId: id,
        rowState: ASKING,
        at,
        entry: {
          kind: 'resolveBatch',
          id,
          prNumber,
          summary: { total: 0, parts, attentionCount: 1, failedCount: 0 },
        },
      });
    const owners = needsYouOwners({
      items: [
        batch({
          id: 'batch:2',
          prNumber: 318,
          parts: [part('couldnt_fix', 1)],
          at: '2026-10-03T12:00:00.000Z',
        }),
        batch({
          id: 'batch:1',
          prNumber: 318,
          parts: [part('ready', 4), part('couldnt_fix', 1)],
          at: '2026-10-03T09:00:00.000Z',
        }),
        batch({
          id: 'batch:3',
          prNumber: 402,
          parts: [part('couldnt_fix', 2)],
          at: '2026-10-03T08:00:00.000Z',
        }),
      ],
      entries: [],
      events: [],
    });

    expect(owners.map((owner) => owner.text)).toEqual([
      "Resolve #318 · 4 ready · 2 couldn't fix",
      "Resolve #402 · 2 couldn't fix",
    ]);
    expect(owners[0]?.id).toBe('batch:2');
  });
});
