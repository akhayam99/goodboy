import type { FirstCommitPlan } from '@goodboy/types';

type Params = {
  readonly plan: FirstCommitPlan;
  readonly included: ReadonlyArray<string>;
};

export const firstCommitCount = ({ plan, included }: Params): number =>
  plan.entries.reduce(
    (total, entry) =>
      !entry.isLeftOut || (entry.canToggle && included.includes(entry.key))
        ? total + entry.files
        : total,
    0,
  );
