import { Pencil } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ResolvedAction } from '../../../actions/types';
import { PlanPrimaryButton } from '../../../plans/planSurfaces';
import type { PlanPrimaryAction } from '../../../plans/usePlanPrimaryAction';

type Props = {
  readonly action: PlanPrimaryAction;
  readonly editAction: ResolvedAction | null;
  readonly onEdit: () => void;
};

export const PlanDrawerReadingActions = ({ action, editAction, onEdit }: Props) => (
  <>
    <PlanPrimaryButton action={action} isReasonShown={false} />
    {editAction === null ? null : (
      <Button
        variant="ghost"
        size="sm"
        disabled={editAction.blockedReason !== null}
        title={editAction.blockedReason ?? undefined}
        onClick={onEdit}
        data-testid="plan-drawer-edit"
      >
        <Pencil size={ICON_SIZE.row} aria-hidden />
        Edit
      </Button>
    )}
  </>
);
