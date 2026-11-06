import type { ReactNode } from 'react';
import { Button, OverflowMenu, tintClasses } from '@goodboy/ui';
import type { PlanWithCount, SessionId } from '@goodboy/types';
import { pluralize } from '../../../shared/utils/pluralize';
import { useAppStore } from '../../../store';
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
  const discard = () => {
    for (const draft of model.drafts) {
      void removeArtifactComment({ sessionId, commentId: draft.id });
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
        {`${pluralize(model.drafts.length, 'comment')} on plan v${version} not sent to the Planner`}
      </span>
      {model.sendError === null ? null : (
        <span role="alert" className="text-danger">
          {model.sendError}
        </span>
      )}
      <span className="flex-1" />
      {openPlan}
      <OverflowMenu
        label="More plan actions"
        size="control"
        entries={[
          {
            kind: 'item',
            key: 'approve-anyway',
            label: 'Approve anyway',
            isDisabled: isBusy,
            onSelect: onApproveAnyway,
          },
          {
            kind: 'item',
            key: 'discard-comments',
            label: 'Discard my comments',
            onSelect: discard,
          },
        ]}
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
