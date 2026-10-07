import type { ArtifactComment, PlanWithCount } from '@goodboy/types';
import { PLAN_REVISING_REASON } from './planRevising';

type Params = Readonly<{
  plan: Pick<PlanWithCount, 'clusters'>;
  drafts: ReadonlyArray<ArtifactComment>;
  isRevising: boolean;
}>;

const countOf = ({ count, noun }: { readonly count: number; readonly noun: string }): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

export const planEditBlockOf = ({ plan, drafts, isRevising }: Params): string | null => {
  if (isRevising) {
    return PLAN_REVISING_REASON;
  }
  if (drafts.length > 0) {
    return `Send or discard your ${countOf({ count: drafts.length, noun: 'comment' })} first`;
  }
  const parts = plan.clusters?.length ?? 0;
  if (parts >= 2) {
    return `This plan runs as ${parts} parallel parts. Ask the planner to change it.`;
  }
  return null;
};
