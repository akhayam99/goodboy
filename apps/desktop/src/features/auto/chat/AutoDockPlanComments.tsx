import type { ReactNode } from 'react';
import { Button, tintClasses } from '@goodboy/ui';
import type { PlanWithCount, SessionId } from '@goodboy/types';
import { pluralize } from '../../../shared/utils/pluralize';
import { useAppStore } from '../../../store';
import { ObjectOverflowMenu } from '../../actions/ObjectOverflowMenu';
import { usePlanComments } from '../../plans/planComments/usePlanComments';
import { AUTO_STATE_TONE } from './autoStateTone';

type Props = {
  readonly sessionId: SessionId;
  readonly plan: PlanWithCount;
  readonly version: number;
  readonly openPlan: ReactNode;
  readonly isBusy: boolean;
  readonly onApproveAnyway: () => void;
};

export const AutoDockPlanComments = ({
  sessionId,
  plan,
  version,
  openPlan,
  isBusy,
  onApproveAnyway,
}: Props) => {
  const model = usePlanComments({ sessionId, plan });
  const removeArtifactComment = useAppStore((state) => state.removeArtifactComment);
  const reportError = useAppStore((state) => state.reportError);
  const count = pluralize(model.drafts.length, 'comment');
  const discard = async () => {
    const results = await Promise.allSettled(
      model.drafts.map((draft) => removeArtifactComment({ sessionId, commentId: draft.id })),
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed !== undefined) {
      await reportError({
        title: "Couldn't discard the comments",
        error: failed.reason,
        sessionId,
      });
    }
  };
  return (
    <div
      data-dock-plan="comments"
      className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 text-meta"
    >
      <span
        role="status"
        aria-live="polite"
        className={tintClasses(AUTO_STATE_TONE.waitingOnYou).text}
      >
        {`${count} on plan v${version} not sent to the Planner`}
      </span>
      {model.sendError === null ? null : (
        <span role="alert" className="text-danger">
          {model.sendError}
        </span>
      )}
      <span className="flex-1" />
      {openPlan}
      <ObjectOverflowMenu
        label="More plan actions"
        size="control"
        target={{
          kind: 'planComments',
          facts: { count, isBusy, onApproveAnyway, onDiscard: () => void discard() },
        }}
      />
      <Button
        variant="primary"
        size="sm"
        disabled={!model.guard.canSend}
        isBusy={model.isSending}
        title={model.guard.reason ?? undefined}
        onClick={() => void model.send()}
      >
        Send to planner
      </Button>
    </div>
  );
};
