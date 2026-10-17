import type { ArtifactComment } from '@goodboy/types';
import type { PlanPrimary } from '../../../plans/planPrimaryOf';
import type { ArtifactState } from '../../artifactStateOf';
import { PLANNER_QUESTION_REASON } from '../../../plans/plannerQuestions';

type Params = Readonly<{
  isEditing: boolean;
  primary: PlanPrimary;
  state: ArtifactState | null;
  drafts: ReadonlyArray<ArtifactComment>;
  editBlock: string | null;
}>;

export const planDrawerReasonOf = ({
  isEditing,
  primary,
  state,
  drafts,
  editBlock,
}: Params): string | null => {
  if (isEditing) {
    return null;
  }
  if (primary.kind === 'disabled') {
    return primary.reason === PLANNER_QUESTION_REASON ? null : primary.reason;
  }
  if (state?.key === 'approved') {
    return state.reason;
  }
  if (drafts.length > 0) {
    return null;
  }
  return editBlock;
};
