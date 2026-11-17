import type { Step, Workflow } from '@goodboy/types';

type Params = {
  readonly workflow: Workflow | null;
};

export const liveStepsOf = ({ workflow }: Params): ReadonlyArray<Step> =>
  (workflow?.steps ?? []).filter((step) => step.deletedAt == null);
