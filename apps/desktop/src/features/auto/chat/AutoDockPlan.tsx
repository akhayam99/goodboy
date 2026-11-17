import { brandId, type ArtifactId, type SessionId } from '@goodboy/types';
import { Button, tintClasses } from '@goodboy/ui';
import { useAppStore, useSessionPlans } from '../../../store';
import { usePendingAction } from '../../../shared/hooks/usePendingAction';
import { useDraftPlanComments } from './hooks/useDraftPlanComments';
import { AUTO_PLAN_APPROVE_LABEL } from '../plan/autoPlanApproveLabel';
import { useAutoPlanApproval } from '../plan/useAutoPlanApproval';
import { AUTO_STATE_TONE } from './autoStateTone';
import { planNeedsApprovalOf } from '../../../shared/utils/planNeedsApprovalOf';
import { AutoDockPlanComments } from './AutoDockPlanComments';
import { AutoDockPlanFailed } from './AutoDockPlanFailed';
import { AutoDockPlanUpdating } from './AutoDockPlanUpdating';
import { focusAgentComposer } from './focusAgentComposer';
import type { DockPlan } from '../dockPlanOf';
import { planBlockedReasonOf } from '../planBlockedReasonOf';
import type { PlanDiscardAsk } from '../planDiscardAskOf';

type Props = {
  readonly sessionId: SessionId;
  readonly dockPlan: DockPlan;
  readonly onOpen: (artifactId: string) => void;
  readonly isApproveHidden: boolean;
  readonly isSettledHidden: boolean;
  readonly discardAsk: PlanDiscardAsk | null;
};

const SETTLED_COPY = {
  needs_approval: ' · changes asked',
  revising: ' · changes asked',
  approved: ' approved',
  used: ' used',
  not_needed: ' · no approval needed',
  superseded: ' superseded',
} as const;

export const AutoDockPlan = ({
  sessionId,
  dockPlan,
  onOpen,
  isApproveHidden,
  isSettledHidden,
  discardAsk,
}: Props) => {
  const artifactId = dockPlan.row.artifact.artifactId;
  const title = dockPlan.row.title;
  const model = useAutoPlanApproval({
    sessionId,
    artifactId: brandId<ArtifactId>({ value: artifactId }),
  });
  const plan = useSessionPlans(sessionId).find((candidate) => candidate.id === artifactId) ?? null;
  const hasUnsentComments = useDraftPlanComments({ sessionId, plan });
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const pending = usePendingAction({ sessionId });
  if (model === null) {
    return null;
  }
  const state = model.approval.state;
  const version = dockPlan.version;
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
          {`Plan v${version} approved. Couldn't send it to Lead.`}
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
  if (dockPlan.kind === 'updating') {
    return (
      <AutoDockPlanUpdating
        version={version}
        by={dockPlan.by}
        planner={dockPlan.planner}
        reason={planBlockedReasonOf({ plan: dockPlan }) ?? ''}
        openPlan={openPlan}
        isApproveHidden={isApproveHidden}
      />
    );
  }
  if (dockPlan.kind === 'failed') {
    const plannerAgentId = dockPlan.planner.childAgentId;
    return (
      <AutoDockPlanFailed
        version={version}
        reason={dockPlan.reason}
        openPlan={openPlan}
        isBusy={model.isBusy || pending.pendingKeys.has(plannerAgentId)}
        onKeep={() => void model.keep({ delegationId: dockPlan.planner.id })}
        onRetry={() =>
          void pending.run({
            key: plannerAgentId,
            failureTitle: `Couldn't retry plan v${version + 1}`,
            task: () => continueStoppedAgent({ sessionId, agentId: plannerAgentId }),
          })
        }
      />
    );
  }
  if (state === 'needs_approval' && discardAsk !== null && discardAsk.revision === model.version) {
    return (
      <div
        data-dock-plan="discard_asked"
        className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 text-meta"
      >
        <span
          role="status"
          aria-live="polite"
          className={tintClasses(AUTO_STATE_TONE.waitingOnYou).text}
        >
          {discardAsk.reason === ''
            ? `The Lead wants to drop plan v${version}`
            : `The Lead wants to drop plan v${version}: ${discardAsk.reason}`}
        </span>
        <span className="flex-1" />
        {openPlan}
        <Button variant="quiet" size="xs" disabled={model.isBusy} onClick={() => void model.drop()}>
          {`Drop plan v${version}`}
        </Button>
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
  if (state === 'needs_approval' && !isApproveHidden && plan !== null && hasUnsentComments) {
    return (
      <AutoDockPlanComments
        sessionId={sessionId}
        plan={plan}
        version={version}
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
          {planNeedsApprovalOf({ version })}
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
        Plan v{version}
        {SETTLED_COPY[state]}
      </span>
      <span className="flex-1" />
      {openPlan}
    </div>
  );
};
