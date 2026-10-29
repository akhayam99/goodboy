import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import type { ConversationRow } from '../utils/conversationRows';
import { readingOrderOf } from './readingOrderOf';

const RUN = brandId<ProviderRunId>({ value: 'run-harborline' });
const AT = brandId<IsoDateTime>({ value: '2026-10-29T10:00:00Z' });

const text = ({
  key,
  body,
  runId = RUN,
}: {
  key: string;
  body: string;
  runId?: ProviderRunId;
}): ConversationRow => ({
  kind: 'item',
  key,
  item: { kind: 'assistant_text', key, text: body, runId },
});

const user = ({ key }: { key: string }): ConversationRow => ({
  kind: 'item',
  key,
  item: { kind: 'user_text', key, text: 'review payments-api', at: AT },
});

const operations = ({ key }: { key: string }): ConversationRow => ({
  kind: 'operations',
  key,
  items: [],
});

const error = ({ key }: { key: string }): ConversationRow => ({
  kind: 'item',
  key,
  item: { kind: 'error', key, message: 'Provider stopped', runId: RUN },
});

describe('readingOrderOf', () => {
  it('keeps the last text of a finished turn as the answer and folds the earlier text into notes', () => {
    const roles = readingOrderOf({
      rows: [
        user({ key: 'u1' }),
        text({ key: 't1', body: 'Now I will read the diff' }),
        operations({ key: 'o1' }),
        text({ key: 't2', body: 'Looking at ledger-core' }),
        text({ key: 't3', body: 'Changes needed: 1 blocker.' }),
      ],
    });
    expect(roles.get('t3')).toEqual({ kind: 'answer', clampLines: 3 });
    expect(roles.get('t1')).toMatchObject({ kind: 'notes', isOpen: false, lineCount: 2 });
    expect(roles.get('t2')).toEqual({ kind: 'hidden' });
  });

  it('leaves a streaming turn in full', () => {
    const roles = readingOrderOf({
      rows: [
        user({ key: 'u1' }),
        text({ key: 't1', body: 'Reading notify-relay' }),
        text({ key: 't2', body: 'Almost done' }),
      ],
      activeRunId: RUN,
    });
    expect(roles.size).toBe(0);
  });

  it('opens the notes of a failed turn', () => {
    const roles = readingOrderOf({
      rows: [
        user({ key: 'u1' }),
        text({ key: 't1', body: 'Trying the push' }),
        text({ key: 't2', body: 'It failed' }),
        error({ key: 'e1' }),
      ],
    });
    expect(roles.get('t1')).toMatchObject({ kind: 'notes', isOpen: true });
  });

  it('gives a direct answer the long budget', () => {
    const roles = readingOrderOf({
      rows: [user({ key: 'u1' }), text({ key: 't1', body: 'Northwind uses two queues.' })],
    });
    expect(roles.get('t1')).toEqual({ kind: 'answer', clampLines: 12 });
  });

  it('does not give the long budget when the turn used tools', () => {
    const roles = readingOrderOf({
      rows: [user({ key: 'u1' }), operations({ key: 'o1' }), text({ key: 't1', body: 'Done.' })],
    });
    expect(roles.get('t1')).toEqual({ kind: 'answer', clampLines: 3 });
  });

  it('treats each user turn on its own', () => {
    const roles = readingOrderOf({
      rows: [
        user({ key: 'u1' }),
        text({ key: 't1', body: 'First answer' }),
        user({ key: 'u2' }),
        text({ key: 't2', body: 'Second answer' }),
      ],
    });
    expect(roles.get('t1')).toEqual({ kind: 'answer', clampLines: 12 });
    expect(roles.get('t2')).toEqual({ kind: 'answer', clampLines: 12 });
  });

  it('keeps narration that carries control markers out of the notes', () => {
    const verdict =
      'Checked it.\n<<comment-wontfix threadId="PRRT_ledger1" reason="already covered upstream">>';
    const outcome = 'Reviewed.\n<<outcome>>Changes needed<</outcome>>';
    const roles = readingOrderOf({
      rows: [
        user({ key: 'u1' }),
        text({ key: 't1', body: 'Reading notify-relay' }),
        text({ key: 't2', body: verdict }),
        text({ key: 't3', body: outcome }),
        text({ key: 't4', body: 'Changes needed: 1 blocker.' }),
      ],
    });
    expect(roles.get('t1')).toMatchObject({ kind: 'notes', lineCount: 1 });
    expect(roles.get('t2')).toBeUndefined();
    expect(roles.get('t3')).toBeUndefined();
    expect(roles.get('t4')).toEqual({ kind: 'answer', clampLines: 3 });
  });
});
