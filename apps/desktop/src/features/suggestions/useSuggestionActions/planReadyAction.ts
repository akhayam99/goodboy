import type { ArtifactComment, PlanId, SessionId } from '@goodboy/types';
import type { ShowToast } from '../../../shared/components/Toast';
import type { AppStore } from '../../../store/store';
import { DRAFT_RUN_WORDS } from '../../plans/planComments/DRAFT_RUN_WORDS';
import { guardDraftRun } from '../../plans/planComments/guardDraftRun';
import { unsentCommentsConfirmOf } from '../../plans/unsentCommentsConfirmOf';
import type { RunPlanResult } from '../../../store/slices/plans/types';

type AnnounceParams = Readonly<{ result: RunPlanResult; sessionId: SessionId }>;

type Params = Readonly<{
  sessionId: SessionId;
  planId: PlanId;
  comments: ReadonlyArray<ArtifactComment>;
  readComments: () => ReadonlyArray<ArtifactComment>;
  runPlan: AppStore['runPlan'];
  announcePlanRun: (params: AnnounceParams) => void;
  showToast: ShowToast;
}>;

type DraftCountParams = Readonly<{
  comments: ReadonlyArray<ArtifactComment>;
  planId: PlanId;
}>;

const draftCountOf = ({ comments, planId }: DraftCountParams): number =>
  comments.filter((comment) => comment.artifactId === planId && comment.status === 'draft').length;

export const planReadyAction = ({
  sessionId,
  planId,
  comments,
  readComments,
  runPlan,
  announcePlanRun,
  showToast,
}: Params) => {
  const draftCount = draftCountOf({ comments, planId });
  const unsent = unsentCommentsConfirmOf({ primary: { kind: 'run' }, count: draftCount });
  return {
    label: 'Start implementer',
    shortLabel: 'Start',
    agentKind: 'implementer' as const,
    isDisabled: false,
    failureTitle: "Couldn't start the implementer",
    ...(unsent !== null && { requiresConfirm: true, confirm: unsent }),
    run: async (): Promise<void> => {
      const guard = await guardDraftRun({
        artifactId: planId,
        confirmedCount: draftCount,
        countDrafts: () => draftCountOf({ comments: readComments(), planId }),
      });
      if (guard !== 'ok') {
        showToast({
          kind: 'warning',
          title: DRAFT_RUN_WORDS.title,
          message: guard === 'blocked' ? DRAFT_RUN_WORDS.held : DRAFT_RUN_WORDS.changed,
        });
        return;
      }
      announcePlanRun({ result: await runPlan(sessionId, planId), sessionId });
    },
  };
};
