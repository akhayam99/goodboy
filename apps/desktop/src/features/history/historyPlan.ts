import type { BranchCommit, HistoryStep } from '@goodboy/types';

export type CombineMode = 'fixup' | 'squash';

type CommitsParams = {
  readonly commits: ReadonlyArray<BranchCommit>;
};

export const initialPlanItems = ({ commits }: CommitsParams): ReadonlyArray<HistoryStep> =>
  [...commits].reverse().map((commit) => ({ sha: commit.sha, verb: 'pick' as const }));

type StepParams = {
  readonly step: HistoryStep;
};

export const targetOf = ({ step }: StepParams): string | null =>
  step.target === undefined || step.target === null || step.target === '' ? null : step.target;

export const isFolded = ({ step }: StepParams): boolean =>
  (step.verb === 'fixup' || step.verb === 'squash') && targetOf({ step }) !== null;

export const messageOf = ({ step }: StepParams): string | null =>
  step.message === undefined || step.message === null || step.message.trim() === ''
    ? null
    : step.message;

type ItemsParams = {
  readonly items: ReadonlyArray<HistoryStep>;
};

type ShaParams = ItemsParams & {
  readonly sha: string;
};

export const planOrder = ({ items }: ItemsParams): ReadonlyArray<string> =>
  items.filter((step) => !isFolded({ step })).map((step) => step.sha);

export const keptOrder = ({ items }: ItemsParams): ReadonlyArray<string> =>
  items.filter((step) => !isFolded({ step }) && step.verb !== 'drop').map((step) => step.sha);

const stepOf = ({ items, sha }: ShaParams): HistoryStep | null =>
  items.find((step) => step.sha === sha) ?? null;

const rootOf = ({ items, sha }: ShaParams): string | null => {
  const seen = new Set<string>();
  let current = stepOf({ items, sha });
  while (current !== null && isFolded({ step: current })) {
    if (seen.has(current.sha)) {
      return null;
    }
    seen.add(current.sha);
    current = stepOf({ items, sha: targetOf({ step: current }) ?? '' });
  }
  return current === null || current.verb === 'drop' ? null : current.sha;
};

export const normalizePlanItems = ({ items }: ItemsParams): ReadonlyArray<HistoryStep> => {
  let previousKept: string | null = null;
  const withTargets = items.map((step): HistoryStep => {
    const isCombine = step.verb === 'fixup' || step.verb === 'squash';
    if (isCombine && targetOf({ step }) === null) {
      if (previousKept === null) {
        return { sha: step.sha, verb: 'pick' };
      }
      return { sha: step.sha, verb: step.verb, target: previousKept };
    }
    if (!isCombine && step.verb !== 'drop') {
      previousKept = step.sha;
    }
    return step;
  });
  const next = withTargets.map((step): HistoryStep => {
    if (!isFolded({ step })) {
      return step;
    }
    const root = rootOf({ items: withTargets, sha: targetOf({ step }) ?? '' });
    if (root === null || root === step.sha) {
      return { sha: step.sha, verb: 'pick' };
    }
    return root === step.target ? step : { ...step, target: root };
  });
  return next.every((step, index) => step === items[index]) ? items : next;
};

const replace = ({
  items,
  sha,
  next,
}: ShaParams & { readonly next: (step: HistoryStep) => HistoryStep }) =>
  items.map((step) => (step.sha === sha ? next(step) : step));

const takenInBy = ({ items, sha }: ShaParams): ReadonlyArray<HistoryStep> =>
  items.filter((step) => isFolded({ step }) && step.target === sha);

export const canRemove = ({ items, sha }: ShaParams): boolean =>
  takenInBy({ items, sha }).length === 0;

export const setVerb = ({
  items,
  sha,
  verb,
}: ShaParams & { readonly verb: 'pick' | 'drop' }): ReadonlyArray<HistoryStep> => {
  if (verb === 'drop' && !canRemove({ items, sha })) {
    return items;
  }
  const current = stepOf({ items, sha });
  if (current === null || (current.verb === verb && messageOf({ step: current }) === null)) {
    return items;
  }
  return replace({ items, sha, next: (step) => ({ sha: step.sha, verb }) });
};

export const resetStep = ({ items, sha }: ShaParams): ReadonlyArray<HistoryStep> => {
  const current = stepOf({ items, sha });
  if (current === null || (current.verb === 'pick' && messageOf({ step: current }) === null)) {
    return items;
  }
  return replace({ items, sha, next: (step) => ({ sha: step.sha, verb: 'pick' }) });
};

export const rewordStep = ({
  items,
  sha,
  message,
  original,
}: ShaParams & {
  readonly message: string;
  readonly original: string;
}): ReadonlyArray<HistoryStep> => {
  const trimmed = message.trim();
  const current = stepOf({ items, sha });
  if (trimmed === '' || current === null || isFolded({ step: current })) {
    return items;
  }
  if (trimmed === original.trim()) {
    return current.verb === 'reword' ? resetStep({ items, sha }) : items;
  }
  if (current.verb === 'reword' && current.message === trimmed) {
    return items;
  }
  return replace({
    items,
    sha,
    next: (step) => ({ sha: step.sha, verb: 'reword', message: trimmed }),
  });
};

type CombineParams = ShaParams & {
  readonly target: string;
  readonly mode: CombineMode;
};

export const canCombine = ({
  items,
  sha,
  target,
}: ShaParams & { readonly target: string }): boolean => {
  const step = stepOf({ items, sha });
  const into = stepOf({ items, sha: target });
  return (
    sha !== target &&
    step !== null &&
    into !== null &&
    !isFolded({ step }) &&
    !isFolded({ step: into }) &&
    step.verb !== 'drop' &&
    into.verb !== 'drop'
  );
};

export const combineInto = ({
  items,
  sha,
  target,
  mode,
}: CombineParams): ReadonlyArray<HistoryStep> => {
  if (!canCombine({ items, sha, target })) {
    return items;
  }
  return items.map((step): HistoryStep => {
    if (step.sha === sha) {
      return { sha, verb: mode, target };
    }
    if (isFolded({ step }) && step.target === sha) {
      return { ...step, target };
    }
    return step;
  });
};

export const setCombineMode = ({
  items,
  sha,
  mode,
}: ShaParams & { readonly mode: CombineMode }): ReadonlyArray<HistoryStep> => {
  const current = stepOf({ items, sha });
  if (current === null || !isFolded({ step: current }) || current.verb === mode) {
    return items;
  }
  return replace({ items, sha, next: (step) => ({ ...step, verb: mode }) });
};

export const combineDown = ({
  items,
  sha,
  mode,
}: ShaParams & { readonly mode: CombineMode }): ReadonlyArray<HistoryStep> => {
  const order = planOrder({ items });
  const index = order.indexOf(sha);
  const older = order
    .slice(0, Math.max(index, 0))
    .reverse()
    .find((candidate) => stepOf({ items, sha: candidate })?.verb !== 'drop');
  if (index < 0 || older === undefined) {
    return items;
  }
  return combineInto({ items, sha, target: older, mode });
};

const sameOrder = ({
  left,
  right,
}: {
  readonly left: ReadonlyArray<HistoryStep>;
  readonly right: ReadonlyArray<HistoryStep>;
}): boolean => left.every((step, index) => step.sha === right[index]?.sha);

export const moveAbove = ({
  items,
  sha,
  anchor,
}: ShaParams & { readonly anchor: string | null }): ReadonlyArray<HistoryStep> => {
  const step = stepOf({ items, sha });
  if (step === null || isFolded({ step }) || anchor === sha) {
    return items;
  }
  const rest = items.filter((candidate) => candidate.sha !== sha);
  const at = anchor === null ? 0 : rest.findIndex((candidate) => candidate.sha === anchor) + 1;
  if (anchor !== null && at === 0) {
    return items;
  }
  const next = [...rest.slice(0, at), step, ...rest.slice(at)];
  return sameOrder({ left: next, right: items }) ? items : next;
};

export const moveBy = ({
  items,
  sha,
  direction,
}: ShaParams & { readonly direction: 'newer' | 'older' }): ReadonlyArray<HistoryStep> => {
  const order = planOrder({ items });
  const index = order.indexOf(sha);
  if (index < 0) {
    return items;
  }
  if (direction === 'newer') {
    const newer = order[index + 1];
    return newer === undefined ? items : moveAbove({ items, sha, anchor: newer });
  }
  if (index === 0) {
    return items;
  }
  return moveAbove({ items, sha, anchor: order[index - 2] ?? null });
};

export const slotAnchorIsNoop = ({
  items,
  sha,
  anchor,
}: ShaParams & { readonly anchor: string | null }): boolean =>
  moveAbove({ items, sha, anchor }) === items;
