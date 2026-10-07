import { Info } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PlanApproveConfirm } from '../../../plans/planSurfaces';
import type { PlanApproveConfirm as PlanApproveConfirmState } from '../../../plans/usePlanPrimaryAction';

type Props = {
  readonly confirm: PlanApproveConfirmState | null;
  readonly reason: string | null;
  readonly note: string | null;
};

export const PlanDrawerLine = ({ confirm, reason, note }: Props) => {
  if (confirm !== null) {
    return <PlanApproveConfirm confirm={confirm} />;
  }
  if (reason !== null) {
    return (
      <p
        data-testid="plan-drawer-reason"
        className="flex min-w-0 items-center gap-2 text-meta text-faint-foreground"
      >
        <Info size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="min-w-0">{reason}</span>
      </p>
    );
  }
  if (note !== null) {
    return (
      <p data-testid="plan-drawer-note" className="min-w-0 text-meta text-muted-foreground">
        {note}
      </p>
    );
  }
  return null;
};
