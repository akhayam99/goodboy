import { describe, expect, it } from 'vitest';
import type { OpenQuestion } from '@goodboy/types';
import { DONE_ROW_STATE, type RowState } from '../../workTreeModel/rowState';
import type { TimelineTopLevelEntry } from './buildTimelineGroups';
import type { TimelineStreamItem } from './buildTimelineStream';
import { firstNeedsYouRowId, needsYouEntries, needsYouRootIds } from './needsYou';

const ASKING: RowState = {
  phase: 'waiting',
  reason: null,
  ask: { kind: 'answer', question: null },
};

type RowParams = {
  readonly id: string;
  readonly familyId: string | null;
  readonly rowState: RowState;
};

const row = ({ id, familyId, rowState }: RowParams): TimelineStreamItem =>
  ({ kind: 'row', id, familyId, rowState }) as unknown as TimelineStreamItem;

const NOW = { kind: 'now', id: 'now' } as unknown as TimelineStreamItem;

const entry = ({ id, kind }: { readonly id: string; readonly kind: string }) =>
  ({ id, kind }) as unknown as TimelineTopLevelEntry;

const question = ({ status }: { readonly status: string }) =>
  ({ id: `q-${status}`, status }) as unknown as OpenQuestion;

const laneQuestion = ({
  id,
  rootEntryId,
  status,
}: {
  readonly id: string;
  readonly rootEntryId: string;
  readonly status: string;
}) =>
  ({
    id,
    kind: 'question',
    questions: [question({ status })],
    lane: { rootEntryId },
  }) as unknown as TimelineTopLevelEntry;

describe('needsYouRootIds', () => {
  it('counts one root per run, however many of its steps ask', () => {
    const roots = needsYouRootIds({
      items: [
        NOW,
        row({ id: 'step-2', familyId: 'run:1', rowState: ASKING }),
        row({ id: 'run:1', familyId: 'run:1', rowState: ASKING }),
        row({ id: 'agent:solo', familyId: 'agent:solo', rowState: ASKING }),
        row({ id: 'plan:1', familyId: null, rowState: DONE_ROW_STATE }),
        row({ id: 'question:loose', familyId: null, rowState: ASKING }),
      ],
    });

    expect([...roots]).toEqual(['run:1', 'agent:solo', 'question:loose']);
  });
});

describe('firstNeedsYouRowId', () => {
  it('finds the newest row that asks, and nothing when none does', () => {
    expect(
      firstNeedsYouRowId({
        items: [
          NOW,
          row({ id: 'plan:1', familyId: null, rowState: DONE_ROW_STATE }),
          row({ id: 'agent:a', familyId: 'agent:a', rowState: ASKING }),
        ],
      }),
    ).toBe('agent:a');
    expect(firstNeedsYouRowId({ items: [NOW] })).toBeNull();
  });
});

describe('needsYouEntries', () => {
  it('keeps the asking roots and their open lane questions only', () => {
    const rootIds = new Set(['run:1', 'agent:a']);
    const kept = needsYouEntries({
      entries: [
        entry({ id: 'run:1', kind: 'run' }),
        entry({ id: 'agent:b', kind: 'agent' }),
        entry({ id: 'agent:a', kind: 'agent' }),
        laneQuestion({ id: 'question:open', rootEntryId: 'agent:a', status: 'open' }),
        laneQuestion({ id: 'question:done', rootEntryId: 'agent:a', status: 'answered' }),
        laneQuestion({ id: 'question:other', rootEntryId: 'agent:b', status: 'open' }),
        entry({ id: 'plan:1', kind: 'plan' }),
      ],
      rootIds,
    });

    expect(kept.map((item) => item.id)).toEqual(['run:1', 'agent:a', 'question:open']);
  });
});
