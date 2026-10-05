import { Play } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PLAN_REVISING_REASON } from '../../planRevising';
import type { PlanModel } from '../../usePlanModel';
import { usePlanRun } from '../../usePlanRun';

type Props = {
  readonly sessionId: SessionId;
  readonly model: PlanModel;
};

export const PlanRunButton = ({ sessionId, model }: Props) => {
  const { plan, revising } = model;
  const { run, isSpawning, error } = usePlanRun({ sessionId, planId: plan.id });
  if (plan.status !== 'active') {
    return null;
  }
  const blockedReason = revising.kind === 'revising' ? PLAN_REVISING_REASON : null;

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => void run()}
        disabled={blockedReason !== null}
        isBusy={isSpawning}
        title={blockedReason ?? error ?? undefined}
        data-testid="plan-run"
      >
        <Play size={ICON_SIZE.row} aria-hidden />
        Run plan
      </Button>
      {error === null ? null : (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
    </>
  );
};
