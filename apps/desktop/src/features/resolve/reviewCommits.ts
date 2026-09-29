import type { BranchCommit, HistoryPlanPrediction, HistoryStep } from '@goodboy/types';
import {
  combineInto,
  isFolded,
  messageOf,
  normalizePlanItems,
  rewordStep,
  targetOf,
} from '../history/historyPlan';

export const REVIEW_COMMIT_PRESETS = ['keep', 'fold', 'one'] as const;

export type ReviewCommitPreset = (typeof REVIEW_COMMIT_PRESETS)[number];

export type ReviewCommitChoice =
  | { readonly kind: 'keep' }
  | { readonly kind: 'fold'; readonly target: string }
  | { readonly kind: 'reword'; readonly message: string };

export type ReviewCommitChoices = Readonly<Record<string, ReviewCommitChoice>>;

export type ReviewCommitThread = {
  readonly threadId: string;
  readonly author: string | null;
  readonly location: string | null;
};

export type ReviewThreadCommits = ReviewCommitThread & {
  readonly commitShas: ReadonlyArray<string>;
  readonly fixupOfSha: string | null;
};

export type ReviewCommitRow = {
  readonly sha: string;
  readonly shortSha: string;
  readonly subject: string;
  readonly isPushed: boolean;
  readonly isResolve: boolean;
  readonly threads: ReadonlyArray<ReviewCommitThread>;
  readonly folded: ReadonlyArray<ReviewCommitThread>;
  readonly fixupOf: string | null;
};

export type ReviewAfterCommit = {
  readonly sha: string;
  readonly newSha: string | null;
  readonly subject: string;
  readonly isChanged: boolean;
  readonly members: ReadonlyArray<string>;
  readonly threads: ReadonlyArray<ReviewCommitThread>;
};

const SHORT = 7;
const FIXUP_PREFIX = 'fixup! ';

const sameSha = ({ left, right }: { readonly left: string; readonly right: string }): boolean => {
  if (left.length < SHORT || right.length < SHORT) {
    return left === right;
  }
  return left.startsWith(right) || right.startsWith(left);
};

const fixupSubjectOf = ({ subject }: { readonly subject: string }): string | null => {
  let rest = subject;
  let isFixup = false;
  while (rest.startsWith(FIXUP_PREFIX)) {
    rest = rest.slice(FIXUP_PREFIX.length);
    isFixup = true;
  }
  return isFixup ? rest : null;
};

type RowsParams = {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly threads: ReadonlyArray<ReviewThreadCommits>;
};

export const reviewCommitRows = ({
  commits,
  threads,
}: RowsParams): ReadonlyArray<ReviewCommitRow> => {
  const oldest = [...commits].reverse();
  return oldest.map((commit, index) => {
    const earlier = oldest.slice(0, index);
    const touching = threads.filter((thread) =>
      thread.commitShas.some((sha) => sameSha({ left: sha, right: commit.sha })),
    );
    const isFoldedHere = (thread: ReviewThreadCommits): boolean =>
      thread.fixupOfSha !== null && sameSha({ left: thread.fixupOfSha, right: commit.sha });
    const hasFoldsHere = touching.some(isFoldedHere);
    const linked = hasFoldsHere ? [] : touching;
    const folded = hasFoldsHere ? touching : [];
    const byThread = linked
      .map((thread) => thread.fixupOfSha)
      .flatMap((sha) =>
        sha === null ? [] : earlier.filter((row) => sameSha({ left: row.sha, right: sha })),
      )[0];
    const wanted = fixupSubjectOf({ subject: commit.subject });
    const bySubject =
      wanted === null ? undefined : [...earlier].reverse().find((row) => row.subject === wanted);
    return {
      sha: commit.sha,
      shortSha: commit.shortSha,
      subject: commit.subject,
      isPushed: commit.pushed,
      isResolve: linked.length > 0,
      threads: linked.map(({ threadId, author, location }) => ({ threadId, author, location })),
      folded: folded.map(({ threadId, author, location }) => ({ threadId, author, location })),
      fixupOf: byThread?.sha ?? bySubject?.sha ?? null,
    };
  });
};

export const reviewCommitSubject = ({ prNumber }: { readonly prNumber: number | null }): string =>
  prNumber === null ? 'Address review comments' : `Address review on #${prNumber}`;

type PresetParams = {
  readonly rows: ReadonlyArray<ReviewCommitRow>;
  readonly preset: ReviewCommitPreset;
  readonly prNumber: number | null;
};

export const presetChoices = ({ rows, preset, prNumber }: PresetParams): ReviewCommitChoices => {
  if (preset === 'keep') {
    return {};
  }
  if (preset === 'fold') {
    const choices: Record<string, ReviewCommitChoice> = {};
    for (const row of rows) {
      if (row.isResolve && row.fixupOf !== null) {
        choices[row.sha] = { kind: 'fold', target: row.fixupOf };
      }
    }
    return choices;
  }
  const resolves = rows.filter((row) => row.isResolve);
  const first = resolves[0];
  if (first === undefined || resolves.length < 2) {
    return {};
  }
  const choices: Record<string, ReviewCommitChoice> = {
    [first.sha]: { kind: 'reword', message: reviewCommitSubject({ prNumber }) },
  };
  for (const row of resolves.slice(1)) {
    choices[row.sha] = { kind: 'fold', target: first.sha };
  }
  return choices;
};

type ChoicesParams = {
  readonly rows: ReadonlyArray<ReviewCommitRow>;
  readonly choices: ReviewCommitChoices;
};

const rootTargetOf = ({
  choices,
  target,
}: {
  readonly choices: ReviewCommitChoices;
  readonly target: string;
}): string => {
  const seen = new Set<string>();
  let current = target;
  while (!seen.has(current)) {
    seen.add(current);
    const choice = choices[current];
    if (choice === undefined || choice.kind !== 'fold') {
      return current;
    }
    current = choice.target;
  }
  return current;
};

export const reviewPlanItems = ({ rows, choices }: ChoicesParams): ReadonlyArray<HistoryStep> => {
  let items: ReadonlyArray<HistoryStep> = rows.map((row) => ({ sha: row.sha, verb: 'pick' }));
  const indexOf = new Map(rows.map((row, index) => [row.sha, index]));
  for (const row of rows) {
    const choice = choices[row.sha];
    if (choice?.kind === 'reword') {
      items = rewordStep({ items, sha: row.sha, message: choice.message, original: row.subject });
    }
  }
  for (const row of rows) {
    const choice = choices[row.sha];
    if (choice?.kind !== 'fold') {
      continue;
    }
    const target = rootTargetOf({ choices, target: choice.target });
    const at = indexOf.get(target);
    if (at === undefined || at >= (indexOf.get(row.sha) ?? -1)) {
      continue;
    }
    items = combineInto({ items, sha: row.sha, target, mode: 'fixup' });
  }
  return normalizePlanItems({ items });
};

export const samePlanItems = ({
  left,
  right,
}: {
  readonly left: ReadonlyArray<HistoryStep>;
  readonly right: ReadonlyArray<HistoryStep>;
}): boolean =>
  left.length === right.length &&
  left.every((step, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      step.sha === other.sha &&
      step.verb === other.verb &&
      targetOf({ step }) === targetOf({ step: other }) &&
      messageOf({ step }) === messageOf({ step: other })
    );
  });

export const presetOf = ({
  rows,
  choices,
  prNumber,
}: ChoicesParams & { readonly prNumber: number | null }): ReviewCommitPreset | null => {
  const current = reviewPlanItems({ rows, choices });
  return (
    REVIEW_COMMIT_PRESETS.find((preset) =>
      samePlanItems({
        left: current,
        right: reviewPlanItems({ rows, choices: presetChoices({ rows, preset, prNumber }) }),
      }),
    ) ?? null
  );
};

type ItemsParams = {
  readonly rows: ReadonlyArray<ReviewCommitRow>;
  readonly items: ReadonlyArray<HistoryStep>;
};

export const cleanPrefixLength = ({ rows, items }: ItemsParams): number => {
  const targets = new Set(
    items.flatMap((step) => (isFolded({ step }) ? [targetOf({ step }) ?? ''] : [])),
  );
  const index = rows.findIndex((row, at) => {
    const step = items[at];
    return (
      step === undefined || step.sha !== row.sha || step.verb !== 'pick' || targets.has(row.sha)
    );
  });
  return index === -1 ? rows.length : index;
};

export const hasReviewRewrite = ({ rows, items }: ItemsParams): boolean =>
  cleanPrefixLength({ rows, items }) < rows.length;

export const replacedOnOrigin = ({ rows, items }: ItemsParams): number => {
  const clean = cleanPrefixLength({ rows, items });
  return rows.filter((row, index) => index >= clean && row.isPushed).length;
};

export const predictedConflicts = ({
  prediction,
}: {
  readonly prediction: HistoryPlanPrediction | null;
}): ReadonlyArray<string> => [
  ...new Set(
    (prediction?.steps ?? [])
      .filter((step) => step.outcome === 'conflict')
      .flatMap((step) => step.files),
  ),
];

export const reviewAfterCommits = ({
  rows,
  items,
  prediction,
}: ItemsParams & {
  readonly prediction: HistoryPlanPrediction | null;
}): ReadonlyArray<ReviewAfterCommit> => {
  const clean = cleanPrefixLength({ rows, items });
  const rowOf = new Map(rows.map((row, index) => [row.sha, { row, index }]));
  const groupOf = new Map<string, string>();
  for (const step of items) {
    groupOf.set(step.sha, isFolded({ step }) ? (targetOf({ step }) ?? step.sha) : step.sha);
  }
  const newShaOf = new Map<string, string | null>();
  for (const step of prediction?.steps ?? []) {
    const group = groupOf.get(step.sha);
    if (group !== undefined) {
      newShaOf.set(group, step.newSha);
    }
  }
  const kept = items.filter((step) => !isFolded({ step }) && step.verb !== 'drop');
  return kept.map((step) => {
    const found = rowOf.get(step.sha);
    const memberRows = items.flatMap((other) => {
      const entry = groupOf.get(other.sha) === step.sha ? rowOf.get(other.sha) : undefined;
      return entry === undefined ? [] : [entry.row];
    });
    const isChanged = found === undefined || found.index >= clean;
    return {
      sha: step.sha,
      newSha: isChanged ? (newShaOf.get(step.sha) ?? null) : step.sha,
      subject: messageOf({ step }) ?? found?.row.subject ?? step.sha.slice(0, SHORT),
      isChanged,
      members: memberRows.map((row) => row.shortSha),
      threads: memberRows.flatMap((row) => row.threads),
    };
  });
};

type DraftShape = {
  readonly headSha: string;
  readonly items: ReadonlyArray<HistoryStep>;
  readonly onto: string | null;
};

export const reviewDraftSignature = ({ headSha, items, onto }: DraftShape): string =>
  JSON.stringify({
    headSha,
    onto,
    items: items.map((step) => [step.sha, step.verb, targetOf({ step }), messageOf({ step })]),
  });

export const isHistoryPlanDraft = ({
  commits,
  items,
  onto,
}: {
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly items: ReadonlyArray<HistoryStep>;
  readonly onto: string | null;
}): boolean =>
  onto !== null ||
  !samePlanItems({
    left: items,
    right: [...commits].reverse().map((commit) => ({ sha: commit.sha, verb: 'pick' })),
  });
