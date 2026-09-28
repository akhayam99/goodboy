import type { BranchCommit, HistoryGraph, HistoryStep } from '@goodboy/types';
import { isFolded, keptOrder, messageOf, planOrder, targetOf } from './historyPlan';

export type HistoryGraphModel = {
  readonly rows: ReadonlyArray<BranchCommit>;
  readonly headSha: string | null;
  readonly remoteRowSha: string | null;
  readonly prRowSha: string | null;
  readonly ownCount: number;
  readonly afterCount: number;
  readonly onlineCount: number;
  readonly behind: number;
  readonly rewritten: ReadonlySet<string>;
  readonly touchedOnline: number;
};

type ReplayParams = {
  readonly items: ReadonlyArray<HistoryStep>;
};

export const replayOrder = ({ items }: ReplayParams): ReadonlyArray<HistoryStep> => {
  const ordered = planOrder({ items }).flatMap((sha) => {
    const step = items.find((candidate) => candidate.sha === sha);
    return step === undefined ? [] : [step];
  });
  const folds = items.filter((step) => isFolded({ step }));
  for (const fold of folds) {
    const target = targetOf({ step: fold });
    const index = ordered.findIndex((step) => step.sha === target);
    if (index < 0) {
      continue;
    }
    let at = index + 1;
    while (at < ordered.length && isFolded({ step: ordered[at] ?? fold })) {
      at += 1;
    }
    ordered.splice(at, 0, fold);
  }
  return ordered;
};

type RewrittenParams = ReplayParams & {
  readonly original: ReadonlyArray<string>;
  readonly onto: string | null;
};

export const rewrittenFrom = ({ items, original, onto }: RewrittenParams): number => {
  if (onto !== null) {
    return 0;
  }
  const ordered = replayOrder({ items });
  let index = 0;
  while (index < original.length) {
    const step = ordered[index];
    const next = ordered[index + 1];
    const isSame =
      step !== undefined &&
      step.verb === 'pick' &&
      messageOf({ step }) === null &&
      step.sha === original[index] &&
      (next === undefined || !isFolded({ step: next }));
    if (!isSame) {
      return index;
    }
    index += 1;
  }
  return index;
};

type Params = RewrittenParams & {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly graph: HistoryGraph | null;
  readonly prHeadSha: string | null;
};

export const historyGraphModel = ({
  commits,
  items,
  original,
  onto,
  graph,
  prHeadSha,
}: Params): HistoryGraphModel => {
  const shas = new Set(commits.map((commit) => commit.sha));
  const rewritten = new Set(original.slice(rewrittenFrom({ items, original, onto })));
  const remoteSha = graph?.remoteSha ?? null;
  return {
    rows: commits,
    headSha: commits[0]?.sha ?? null,
    remoteRowSha: remoteSha !== null && shas.has(remoteSha) ? remoteSha : null,
    prRowSha: prHeadSha !== null && shas.has(prHeadSha) ? prHeadSha : null,
    ownCount: commits.length,
    afterCount: keptOrder({ items }).length,
    onlineCount: commits.filter((commit) => commit.pushed).length,
    behind: onto === null ? (graph?.behind ?? 0) : 0,
    rewritten,
    touchedOnline: commits.filter((commit) => commit.pushed && rewritten.has(commit.sha)).length,
  };
};
