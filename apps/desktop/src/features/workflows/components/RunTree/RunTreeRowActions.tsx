import { Button, WORK_META_COLUMN } from '@goodboy/ui';
import type { OpenQuestion, PlanWithCount, SessionId } from '@goodboy/types';
import { openPlanDrawer } from '../../../plans/openPlanDrawer';
import { ROW_ACTION_LABEL } from '../../../workTreeModel/rowActionLabels';

type Props = {
  readonly sessionId: SessionId;
  readonly answer: { readonly question: OpenQuestion | null } | null;
  readonly plan: PlanWithCount | null;
  readonly isPlanHeld: boolean;
  readonly onAnswer: (question: OpenQuestion | null) => void;
};

export const RunTreeRowActions = ({ sessionId, answer, plan, isPlanHeld, onAnswer }: Props) => (
  <span data-meta-column="action" className={WORK_META_COLUMN.action}>
    {answer === null ? null : (
      <Button
        variant="secondary"
        size="xs"
        className="shrink-0"
        onClick={() => onAnswer(answer.question)}
      >
        {ROW_ACTION_LABEL.answer}
      </Button>
    )}
    {plan === null || isPlanHeld ? null : (
      <Button
        variant="ghost"
        size="xs"
        className="shrink-0"
        onClick={() => openPlanDrawer({ sessionId, planId: plan.id })}
      >
        {ROW_ACTION_LABEL.openPlan}
      </Button>
    )}
  </span>
);
