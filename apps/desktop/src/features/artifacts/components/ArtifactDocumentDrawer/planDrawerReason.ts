import type { ArtifactComment } from '@goodboy/types';
import type { PlanPrimary } from '../../../plans/planPrimaryOf';

type Params = Readonly<{
  isEditing: boolean;
  primary: PlanPrimary;
  drafts: ReadonlyArray<ArtifactComment>;
  editBlock: string | null;
}>;

export const planDrawerReasonOf = ({
  isEditing,
  primary,
  drafts,
  editBlock,
}: Params): string | null => {
  if (isEditing) {
    return null;
  }
  if (primary.kind === 'disabled') {
    return primary.reason;
  }
  if (drafts.length > 0) {
    return null;
  }
  return editBlock;
};
