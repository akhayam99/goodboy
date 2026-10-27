import type { SessionDecisionChange } from '@goodboy/types';
import { isEmptyDecisionDiff } from '../sessionEventPresentation';
import { historyBatchByEventIdOf } from '../historyBatchesOf';
import {
  historyBatchBaseOf,
  historyBatchFactsOf,
  historyBatchSubOf,
  historyBatchTitleOf,
} from '../historyBatchText';
import { addDecisionTotals, type DecisionTotals } from '../laneFacts';
import type { DraftRow } from './streamTypes';
import { dayKeyOf } from './ordering';

type DraftParams = {
  readonly draft: DraftRow;
};

const isDecisionChangeRow = ({ draft }: DraftParams): boolean =>
  draft.groupId == null &&
  draft.entry.kind === 'event' &&
  draft.entry.event.kind === 'decisions_changed' &&
  draft.entry.event.payload?.consolidatedAfter === undefined;

export const isEmptyDecisionRow = ({ draft }: DraftParams): boolean =>
  draft.entry.kind === 'event' &&
  draft.entry.event.kind === 'decisions_changed' &&
  isEmptyDecisionDiff({ payload: draft.entry.event.payload });

type MergeDecisionRowsParams = {
  readonly drafts: ReadonlyArray<DraftRow>;
};

export const mergeConsecutiveDecisionRows = ({
  drafts,
}: MergeDecisionRowsParams): ReadonlyArray<DraftRow> => {
  const merged: DraftRow[] = [];
  let index = 0;

  while (index < drafts.length) {
    const newest = drafts[index];
    if (newest === undefined) {
      break;
    }
    if (!isDecisionChangeRow({ draft: newest }) || newest.entry.kind !== 'event') {
      merged.push(newest);
      index += 1;
      continue;
    }

    let totals: DecisionTotals = {};
    let changes: ReadonlyArray<SessionDecisionChange> = [];
    let runIndex = index;
    const newestDayKey = newest.at === null ? null : dayKeyOf({ at: newest.at });
    while (runIndex < drafts.length) {
      const draft = drafts[runIndex];
      if (draft === undefined || !isDecisionChangeRow({ draft }) || draft.entry.kind !== 'event') {
        break;
      }
      const draftDayKey = draft.at === null ? null : dayKeyOf({ at: draft.at });
      if (runIndex > index && draftDayKey !== newestDayKey) {
        break;
      }
      totals = addDecisionTotals({ totals, payload: draft.entry.event.payload });
      changes = [...changes, ...(draft.entry.event.payload?.decisionChanges ?? [])];
      runIndex += 1;
    }

    if (runIndex === index + 1) {
      merged.push(newest);
      index = runIndex;
      continue;
    }

    merged.push({
      ...newest,
      entry: {
        ...newest.entry,
        event: {
          ...newest.entry.event,
          payload: {
            ...newest.entry.event.payload,
            ...totals,
            ...(changes.length > 0 && { decisionChanges: changes }),
          },
        },
      },
    });
    index = runIndex;
  }

  return merged;
};

type ProjectRunPart = {
  readonly verb: 'mounted' | 'detached';
  readonly name: string;
};

const projectRunPartOf = ({ draft }: { readonly draft: DraftRow }): ProjectRunPart | null => {
  if (draft.groupId != null || draft.entry.kind !== 'event') {
    return null;
  }
  const { event } = draft.entry;
  const name = event.payload?.projectName ?? null;
  if (name == null) {
    return null;
  }
  if (event.kind === 'project_materialized') {
    return { verb: 'mounted', name };
  }
  if (event.kind === 'project_detached') {
    return { verb: 'detached', name };
  }
  return null;
};

type MergeProjectRowsParams = {
  readonly drafts: ReadonlyArray<DraftRow>;
};

export const mergeConsecutiveProjectRows = ({
  drafts,
}: MergeProjectRowsParams): ReadonlyArray<DraftRow> => {
  const merged: DraftRow[] = [];
  let index = 0;

  while (index < drafts.length) {
    const newest = drafts[index];
    if (newest === undefined) {
      break;
    }
    if (projectRunPartOf({ draft: newest }) == null || newest.entry.kind !== 'event') {
      merged.push(newest);
      index += 1;
      continue;
    }

    const mounted: string[] = [];
    const detached: string[] = [];
    let runIndex = index;
    const newestDayKey = newest.at === null ? null : dayKeyOf({ at: newest.at });
    while (runIndex < drafts.length) {
      const draft = drafts[runIndex];
      if (draft === undefined) {
        break;
      }
      const part = projectRunPartOf({ draft });
      if (part == null) {
        break;
      }
      const draftDayKey = draft.at === null ? null : dayKeyOf({ at: draft.at });
      if (runIndex > index && draftDayKey !== newestDayKey) {
        break;
      }
      if (part.verb === 'mounted') {
        mounted.push(part.name);
      }
      if (part.verb === 'detached') {
        detached.push(part.name);
      }
      runIndex += 1;
    }

    if (runIndex === index + 1) {
      merged.push(newest);
      index = runIndex;
      continue;
    }

    merged.push({
      ...newest,
      entry: {
        ...newest.entry,
        event: {
          ...newest.entry.event,
          kind: mounted.length > 0 ? 'project_materialized' : 'project_detached',
        },
        projectRun: { mounted, detached },
      },
    });
    index = runIndex;
  }

  return merged;
};

type StoppedKey = {
  readonly branch: string | null;
  readonly origin: string | null;
};

const stoppedKeyOf = ({ draft }: { readonly draft: DraftRow }): StoppedKey | null => {
  if (draft.groupId != null || draft.entry.kind !== 'event') {
    return null;
  }
  const { event } = draft.entry;
  if (event.kind !== 'history_stopped') {
    return null;
  }
  return { branch: event.payload?.branch ?? null, origin: event.payload?.origin ?? null };
};

const isSameStoppedKey = ({
  first,
  second,
}: {
  readonly first: StoppedKey;
  readonly second: StoppedKey;
}): boolean => first.branch === second.branch && first.origin === second.origin;

export const mergeConsecutiveStoppedRows = ({
  drafts,
}: {
  readonly drafts: ReadonlyArray<DraftRow>;
}): ReadonlyArray<DraftRow> => {
  const merged: DraftRow[] = [];
  let index = 0;

  while (index < drafts.length) {
    const newest = drafts[index];
    if (newest === undefined) {
      break;
    }
    const key = stoppedKeyOf({ draft: newest });
    if (key === null || newest.entry.kind !== 'event') {
      merged.push(newest);
      index += 1;
      continue;
    }
    const newestDayKey = newest.at === null ? null : dayKeyOf({ at: newest.at });
    let runIndex = index + 1;
    while (runIndex < drafts.length) {
      const draft = drafts[runIndex];
      const other = draft === undefined ? null : stoppedKeyOf({ draft });
      if (
        draft === undefined ||
        other === null ||
        !isSameStoppedKey({ first: key, second: other })
      ) {
        break;
      }
      const draftDayKey = draft.at === null ? null : dayKeyOf({ at: draft.at });
      if (draftDayKey !== newestDayKey) {
        break;
      }
      runIndex += 1;
    }
    const count = runIndex - index;
    merged.push(
      count === 1 ? newest : { ...newest, entry: { ...newest.entry, repeatCount: count } },
    );
    index = runIndex;
  }

  return merged;
};

export const mergeHistoryBatches = ({
  drafts,
}: {
  readonly drafts: ReadonlyArray<DraftRow>;
}): ReadonlyArray<DraftRow> => {
  const events = drafts.flatMap((draft) =>
    draft.groupId == null && draft.entry.kind === 'event' ? [draft.entry.event] : [],
  );
  const batchByEventId = historyBatchByEventIdOf({ events });
  if (batchByEventId.size === 0) {
    return drafts;
  }
  const folded = new Set<string>();
  return drafts.flatMap((draft): ReadonlyArray<DraftRow> => {
    if (draft.groupId != null || draft.entry.kind !== 'event') {
      return [draft];
    }
    const batch = batchByEventId.get(draft.entry.event.id);
    if (batch === undefined) {
      return [draft];
    }
    if (folded.has(batch.key)) {
      return [];
    }
    folded.add(batch.key);
    const newest = batch.events[batch.events.length - 1] ?? draft.entry.event;
    const facts = historyBatchFactsOf({ branches: batch.branches });
    return [
      {
        ...draft,
        id: batch.entryId,
        at: newest.createdAt,
        entry: {
          ...draft.entry,
          id: batch.entryId,
          at: newest.createdAt,
          event: newest,
          historyBatch: {
            key: batch.key,
            title: historyBatchTitleOf({
              origin: batch.origin,
              facts,
              base: historyBatchBaseOf({ batch, events }),
            }),
            sub: historyBatchSubOf({ origin: batch.origin, facts }),
            events: batch.events,
          },
        },
      },
    ];
  });
};
