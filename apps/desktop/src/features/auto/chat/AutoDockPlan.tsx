import { brandId, type ArtifactId, type SessionId } from '@goodboy/types';
import { Button, tintClasses } from '@goodboy/ui';
import { useSessionPlans } from '../../../store';
import { useDraftPlanComments } from './hooks/useDraftPlanComments';
import { AUTO_PLAN_APPROVE_LABEL } from '../plan/autoPlanApproveLabel';
import { useAutoPlanApproval } from '../plan/useAutoPlanApproval';
import { AUTO_STATE_TONE } from './autoStateTone';
import { planNeedsApprovalOf } from '../../../shared/utils/planNeedsApprovalOf';
import { AutoDockPlanComments } from './AutoDockPlanComments';
import { focusAgentComposer } from './focusAgentComposer';

type Props = {
  readonly sessionId: SessionId;
  readonly artifactId: string;
  readonly title: string;
  readonly onOpen: (artifactId: string) => void;
  readonly isApproveHidden: boolean;
  readonly isChangeSent: boolean;
  readonly isSettledHidden: boolean;
};

const SETTLED_COPY = {
  needs_approval: ' · changes asked',
  revising: ' · changes asked',
  approved: ' approved',
  used: ' used',
  not_needed: ' · no approval needed',
} as const;

export const AutoDockPlan = ({
  sessionId,
  artifactId,
  title,
  onOpen,
  isApproveHidden,
  isChangeSent,
  isSettledHidden,
}: Props) => {
  const model = useAutoPlanApproval({
    sessionId,
    artifactId: brandId<ArtifactId>({ value: artifactId }),
  });
  const plan = useSessionPlans(sessionId).find((candidate) => candidate.id === artifactId) ?? null;
  const hasUnsentComments = useDraftPlanComments({ sessionId, plan });
  if (model === null) {
    return null;
  }
  const state = model.approval.state;
  const openPlan = (
    <Button
      variant="quiet"
      size="xs"
      aria-label={`Open plan ${title}`}
      onClick={() => onOpen(artifactId)}
    >
      Open plan
    </Button>
  );
  if (model.isToldFailed) {
    return (
      <div
        data-dock-plan="told_failed"
        className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 text-meta"
      >
        <span
          role="status"
          aria-live="polite"
          className={tintClasses(AUTO_STATE_TONE.waitingOnYou).text}
        >
          {`Plan v${model.version} approved. Couldn't send it to Lead.`}
        </span>
        <span className="flex-1" />
        {openPlan}
        <Button
          variant="primary"
          size="sm"
          disabled={model.isBusy}
          isBusy={model.isBusy}
          busyLabel="Sending"
          onClick={() => void model.tellAuto()}
        >
          Resend approval
        </Button>
      </div>
    );
  }
  if (state === 'needs_approval' && isChangeSent) {
    return (
      <div
        data-dock-plan="change_sent"
        className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 text-meta"
      >
        <span
          role="status"
          aria-live="polite"
          className={tintClasses(AUTO_STATE_TONE.running).text}
        >
          {`Sent as changes to plan v${model.version}`}
        </span>
        <span className="flex-1" />
        {openPlan}
      </div>
    );
  }
  if (state === 'needs_approval' && !isApproveHidden && plan !== null && hasUnsentComments) {
    return (
      <AutoDockPlanComments
        sessionId={sessionId}
        plan={plan}
        version={model.version}
        openPlan={openPlan}
        isBusy={model.isBusy}
        onApproveAnyway={() => void model.approve()}
      />
    );
  }
  if (state === 'needs_approval' && !isApproveHidden) {
    return (
      <div
        data-dock-plan={state}
        className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 text-meta"
      >
        <span
          role="status"
          aria-live="polite"
          className={tintClasses(AUTO_STATE_TONE.waitingOnYou).text}
        >
          {planNeedsApprovalOf({ version: model.version })}
        </span>
        <span className="flex-1" />
        <Button
          variant="quiet"
          size="xs"
          onClick={() => {
            model.askForChanges();
            requestAnimationFrame(focusAgentComposer);
          }}
        >
          Ask for changes
        </Button>
        {openPlan}
        <Button
          variant="primary"
          size="sm"
          disabled={model.isBusy}
          onClick={() => void model.approve()}
        >
          {AUTO_PLAN_APPROVE_LABEL}
        </Button>
      </div>
    );
  }
  if (isSettledHidden) {
    return null;
  }
  return (
    <div
      data-dock-plan={state}
      className="flex min-h-7 min-w-0 items-center gap-2 text-meta text-muted-foreground"
    >
      <span
        data-tone={state === 'approved' ? AUTO_STATE_TONE.done : undefined}
        className={state === 'approved' ? tintClasses(AUTO_STATE_TONE.done).text : undefined}
      >
        Plan v{model.version}
        {SETTLED_COPY[state]}
      </span>
      <span className="flex-1" />
      {openPlan}
    </div>
  );
};
