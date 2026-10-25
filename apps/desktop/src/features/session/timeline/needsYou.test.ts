// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, OpenQuestion, SessionEvent, SessionEventId } from '@goodboy/types';
import { DONE_ROW_STATE, type RowState } from '../../workTreeModel/rowState';
import type { TimelineTopLevelEntry } from './buildTimelineGroups';
import type { TimelineStreamItem } from './buildTimelineStream';
import { needsYouOwners } from './needsYou';
import type { ResolveActivityFacts } from './resolveActivity';

type ResolveThreadFact = NonNullable<ResolveActivityFacts['threads']>[number];

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

    expect(owners.map((owner) => [owner.id, owner.kind, owner.text, owner.where])).toEqual([
      ['run:1', 'run', 'Which retry cap for cap?', 'Retry policy for payments-api'],
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

    expect(owners.map((owner) => [owner.id, owner.text, owner.where])).toEqual([
      ['agent:solo', 'Which retry cap for cap?', 'Step solo'],
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
      ['question:cap', 'question', 'Which retry cap for cap?'],
    ]);
  });

  it('keeps a stopped rebase without its repeat count and drops it once a later outcome settled it', () => {
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
      ['rebase', 'Rebase of feat/export stopped'],
    ]);
    expect(settled).toEqual([]);
  });

  it('drops a stopped rebase once git settled it outside the rebase flow', () => {
    const stopped = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-10-03T17:57:00.000Z',
      payload: { origin: 'rebase', reason: 'conflict', branch: 'feat/export', mountId: 'm1' },
    });
    const stopRow = row({
      id: 'event:ev-1',
      familyId: null,
      rowState: DONE_ROW_STATE,
      entry: { kind: 'event', id: 'event:ev-1', event: stopped },
      at: stopped.createdAt,
    });

    const open = needsYouOwners({ items: [stopRow], entries: [], events: [stopped] });
    const settled = needsYouOwners({
      items: [stopRow],
      entries: [],
      events: [stopped],
      settledStopIds: new Set(['ev-1']),
    });

    expect(open.map((owner) => owner.kind)).toEqual(['rebase']);
    expect(settled).toEqual([]);
  });

  it('splits a stopped rebase into a title and a short detail beside the full sentence', () => {
    const stopped = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-10-03T17:57:00.000Z',
      payload: {
        origin: 'rebase',
        reason: 'conflict',
        branch: 'hl/feat-ledger-postings',
        files: [
          'apps/web/src/domains/navigation/SideBarFooter.tsx',
          'apps/web/src/domains/paths/components/PastDue.tsx',
          'apps/web/src/domains/payments/A.tsx',
          'apps/web/src/domains/payments/B.tsx',
          'apps/web/src/domains/payments/C.tsx',
        ],
      },
    });
    const stopRow = row({
      id: 'event:ev-1',
      familyId: null,
      rowState: DONE_ROW_STATE,
      entry: { kind: 'event', id: 'event:ev-1', event: stopped },
      at: stopped.createdAt,
    });

    const [owner] = needsYouOwners({ items: [stopRow], entries: [], events: [stopped] });

    expect(owner?.stopLines).toEqual({
      title: 'Rebase of hl/feat-ledger-postings stopped',
      detail: 'Conflict in SideBarFooter.tsx, PastDue.tsx and 3 more',
    });
    expect(owner?.text.startsWith('Rebase of hl/feat-ledger-postings stopped · conflict in ')).toBe(
      true,
    );
  });

  it('names the branch of a stopped rebase by the mount of its event', () => {
    const stopped = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-10-03T17:57:00.000Z',
      payload: { origin: 'rebase', reason: 'origin-moved', branch: 'feat/export', mountId: 'm1' },
    });
    const stopRow = row({
      id: 'event:ev-1',
      familyId: null,
      rowState: DONE_ROW_STATE,
      entry: { kind: 'event', id: 'event:ev-1', event: stopped },
      at: stopped.createdAt,
    });

    const owners = needsYouOwners({ items: [stopRow], entries: [], events: [stopped] });

    expect(owners.map((owner) => [owner.kind, owner.mountId])).toEqual([['rebase', 'm1']]);
  });

  it('drops a stopped rebase once the agent that stopped it was deleted', () => {
    const stopped = event({
      id: 'ev-1',
      kind: 'history_stopped',
      at: '2026-10-03T17:57:00.000Z',
      payload: { origin: 'rebase', reason: 'conflict', branch: 'feat/export', agentId: 'agent-1' },
    });
    const stopRow = row({
      id: 'event:ev-1',
      familyId: null,
      rowState: DONE_ROW_STATE,
      entry: { kind: 'event', id: 'event:ev-1', event: stopped, repeatCount: 1 },
      at: stopped.createdAt,
    });

    const alive = needsYouOwners({
      items: [stopRow],
      entries: [],
      events: [stopped],
      liveAgentIds: new Set(['agent-1']),
    });
    const deleted = needsYouOwners({
      items: [stopRow],
      entries: [],
      events: [stopped],
      liveAgentIds: new Set(),
    });

    expect(alive).toHaveLength(1);
    expect(deleted).toEqual([]);
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

  describe('fix runs', () => {
    const thread = (threadId: string, state: ResolveThreadFact['state']): ResolveThreadFact => ({
      threadId,
      state,
      path: null,
      line: null,
    });

    const run = ({
      id,
      prNumber,
      threads,
      at,
    }: {
      readonly id: string;
      readonly prNumber: number;
      readonly threads: ReadonlyArray<ResolveThreadFact>;
      readonly at: string;
    }) => ({
      item: row({
        id: `agent:${id}`,
        familyId: `agent:${id}`,
        rowState: ASKING,
        at,
        entry: agentEntry({ id }),
      }),
      facts: [
        id,
        { state: 'needs', word: '', prNumber, mountId: null, threads },
      ] as const satisfies readonly [string, ResolveActivityFacts],
    });

    it('asks once for a run with the actions you owe, not once per comment', () => {
      const one = run({
        id: 'r1',
        prNumber: 318,
        at: '2026-10-03T09:00:00.000Z',
        threads: [
          thread('t1', 'ready'),
          thread('t2', 'ready'),
          thread('t3', 'ready'),
          thread('t4', 'ready'),
          thread('t5', 'ready'),
          thread('t6', 'needs'),
          thread('t7', 'drafting'),
          thread('t8', 'pushed'),
        ],
      });

      const owners = needsYouOwners({
        items: [one.item],
        entries: [],
        events: [],
        resolveFactsByAgentId: new Map([one.facts]),
      });

      expect(owners.map((owner) => owner.text)).toEqual(['#318 · 5 to review · 1 question']);
      expect(owners[0]?.kind).toBe('fixRun');
    });

    it('opens the first comment that waits on you: the question before the reviews', () => {
      const one = run({
        id: 'r1',
        prNumber: 318,
        at: '2026-10-03T09:00:00.000Z',
        threads: [thread('t1', 'ready'), thread('t2', 'failed'), thread('t3', 'needs')],
      });

      const owners = needsYouOwners({
        items: [one.item],
        entries: [],
        events: [],
        resolveFactsByAgentId: new Map([one.facts]),
      });

      expect(owners[0]?.owed?.target?.threadId).toBe('t3');
    });

    it('says nothing while the run only works or has nothing left to decide', () => {
      const working = run({
        id: 'r1',
        prNumber: 318,
        at: '2026-10-03T09:00:00.000Z',
        threads: [thread('t1', 'drafting'), thread('t2', 'pushed')],
      });

      const owners = needsYouOwners({
        items: [working.item],
        entries: [],
        events: [],
        resolveFactsByAgentId: new Map([working.facts]),
      });

      expect(owners).toEqual([]);
    });

    it('merges the runs of one pull request into one row with summed counts', () => {
      const newer = run({
        id: 'r2',
        prNumber: 318,
        at: '2026-10-03T12:00:00.000Z',
        threads: [thread('t9', 'failed')],
      });
      const older = run({
        id: 'r1',
        prNumber: 318,
        at: '2026-10-03T09:00:00.000Z',
        threads: [
          thread('t1', 'ready'),
          thread('t2', 'ready'),
          thread('t3', 'ready'),
          thread('t4', 'ready'),
          thread('t5', 'failed'),
        ],
      });
      const other = run({
        id: 'r3',
        prNumber: 402,
        at: '2026-10-03T08:00:00.000Z',
        threads: [thread('t6', 'failed'), thread('t7', 'failed')],
      });

      const owners = needsYouOwners({
        items: [newer.item, older.item, other.item],
        entries: [],
        events: [],
        resolveFactsByAgentId: new Map([newer.facts, older.facts, other.facts]),
      });

      expect(owners.map((owner) => owner.text)).toEqual([
        "#318 · 4 to review · 2 couldn't fix",
        "#402 · 2 couldn't fix",
      ]);
      expect(owners[0]?.owed?.target?.threadId).toBe('t1');
    });
  });
});
