import type { ArtifactComment } from '@goodboy/types';
import type { PlanPrimary } from '../../../plans/planPrimaryOf';
import type { ArtifactState } from '../../artifactStateOf';

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
    return primary.reason;
  }
  if (state?.key === 'approved') {
    return state.reason;
  }
  if (drafts.length > 0) {
    return null;
  }
  return editBlock;
};
