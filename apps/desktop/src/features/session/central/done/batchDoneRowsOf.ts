import {
  historyBatchBranchesOf,
  historyBranchKeyOf,
  type HistoryBatch,
} from '../../timeline/historyBatchesOf';
import {
  historyBatchBaseOf,
  historyBatchBranchFactOf,
  historyBatchFactsOf,
  historyBatchSubOf,
  historyBatchTitleOf,
} from '../../timeline/historyBatchText';
import type { DoneBranchLine, DoneModel, DoneRowModel } from './doneTypes';
import { isEventOwnedByRow } from './isEventOwnedByRow';

type Params = {
  readonly model: DoneModel;
  readonly batchByEventId: ReadonlyMap<string, HistoryBatch>;
};

type BatchParams = {
  readonly batch: HistoryBatch;
  readonly model: DoneModel;
};

const NO_STEPS: DoneRowModel['detail']['steps'] = [];

const foldedRowOf = ({ batch, model }: BatchParams) => {
  const rewrites = batch.events.filter(
    (event) => event.kind === 'history_rewritten' && !isEventOwnedByRow({ event, model }),
  );
  const keys = new Set(rewrites.map((event) => historyBranchKeyOf({ event })));
  if (keys.size < 2) {
    return null;
  }
  const members = batch.events.filter((event) => keys.has(historyBranchKeyOf({ event })));
  const branches = historyBatchBranchesOf({ events: members });
  const facts = historyBatchFactsOf({ branches });
  const newest = members[members.length - 1];
  const first = rewrites[0];
  if (newest === undefined || first === undefined) {
    return null;
  }
  const lines = branches.map((branch): DoneBranchLine => ({
    id: branch.key,
    project: branch.projectName,
    branch: branch.branch ?? branch.key,
    fact: historyBatchBranchFactOf({ branch, origin: batch.origin }),
  }));
  const row: DoneRowModel = {
    id: `batch:${batch.key}`,
    entryId: batch.entryId,
    title: historyBatchTitleOf({
      origin: batch.origin,
      facts,
      base: historyBatchBaseOf({ batch, events: model.events }),
    }),
    by: historyBatchSubOf({ origin: batch.origin, facts }),
    at: newest.createdAt,
    mountId: null,
    retryAgentId: null,
    agentIds: [],
    detail: {
      model: null,
      effort: null,
      duration: null,
      costUsd: null,
      fullText: null,
      steps: NO_STEPS,
      auto: null,
      branches: lines,
      files: null,
    },
  };
  return { row, firstId: first.id, rewriteIds: rewrites.map((event) => event.id) };
};

export const batchDoneRowsOf = ({
  model,
  batchByEventId,
}: Params): ReadonlyMap<string, DoneRowModel | null> => {
  const rows = new Map<string, DoneRowModel | null>();
  const seen = new Set<string>();
  for (const batch of batchByEventId.values()) {
    if (seen.has(batch.key) || batch.origin !== 'rebase') {
      continue;
    }
    seen.add(batch.key);
    const folded = foldedRowOf({ batch, model });
    if (folded === null) {
      continue;
    }
    for (const id of folded.rewriteIds) {
      rows.set(id, id === folded.firstId ? folded.row : null);
    }
  }
  return rows;
};
