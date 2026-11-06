import { useEffect } from 'react';
import type { ArtifactComment, PlanWithCount, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { planPrimaryOf } from '../../../../plans/planPrimaryOf';

type Params = {
  readonly sessionId: SessionId;
  readonly plan: PlanWithCount | null;
};

const NO_COMMENTS: ReadonlyArray<ArtifactComment> = [];

export const useDraftPlanComments = ({ sessionId, plan }: Params): boolean => {
  const comments = useAppStore((state) => state.artifactComments[sessionId]) ?? NO_COMMENTS;
  const loadArtifactComments = useAppStore((state) => state.loadArtifactComments);
  const planId = plan?.id ?? null;

  useEffect(() => {
    if (planId === null) {
      return;
    }
    void loadArtifactComments({ sessionId });
  }, [loadArtifactComments, planId, sessionId]);

  if (plan === null) {
    return false;
  }
  const drafts = comments.filter(
    (comment) => comment.artifactId === plan.id && comment.status === 'draft',
  );
  return planPrimaryOf({ plan, run: null, drafts }).isSecondary;
};
