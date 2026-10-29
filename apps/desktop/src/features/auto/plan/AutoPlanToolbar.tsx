import { Check, MessageSquare } from 'lucide-react';
import { Button, Chip, ICON_SIZE } from '@goodboy/ui';
import { PLAN_REVISING_REASON } from '../../plans/planRevising';
import type { AutoPlanApprovalModel } from './useAutoPlanApproval';

type Props = {
  readonly model: AutoPlanApprovalModel;
};

export const AutoPlanToolbar = ({ model }: Props) => {
  const isRevising = model.approval.state === 'revising';
  return (
    <div data-testid="auto-plan-toolbar" className="@container flex min-w-0 items-center gap-2">
      <Chip kind="state" tone={model.approval.tone} label={model.approval.word} />
      <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
        v{model.version}
      </span>
      <span aria-hidden className="min-w-0 flex-1" />
      {model.isToldFailed ? (
        <>
          <span className="min-w-0 truncate text-meta text-muted-foreground">
            Approved, Auto did not hear it
          </span>
          <Button
            size="sm"
            disabled={model.isBusy}
            isBusy={model.isBusy}
            busyLabel="Telling Auto"
            onClick={() => void model.tellAuto()}
          >
            Tell Auto
          </Button>
        </>
      ) : null}
      {model.approval.state === 'approved' ? null : (
        <>
          <Button variant="ghost" size="sm" onClick={model.askForChanges}>
            <MessageSquare size={ICON_SIZE.control} aria-hidden />
            Ask for changes
          </Button>
          <Button
            size="sm"
            disabled={isRevising || model.isBusy}
            isBusy={model.isBusy}
            busyLabel="Approving"
            title={isRevising ? PLAN_REVISING_REASON : undefined}
            onClick={() => void model.approve()}
          >
            <Check size={ICON_SIZE.control} aria-hidden />
            Approve plan
          </Button>
        </>
      )}
    </div>
  );
};
