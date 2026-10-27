import { Pencil } from 'lucide-react';
import { Button, HeaderActions, ICON_SIZE } from '@goodboy/ui';

import type { ResolvedAction } from '../../../actions/types';
import { PlanPrimaryButton } from '../../../plans/planSurfaces';
import type { PlanPrimaryAction } from '../../../plans/usePlanPrimaryAction';

type Props = {
  readonly action: PlanPrimaryAction;
  readonly editAction: ResolvedAction | null;
  readonly onEdit: () => void;
};

export const PlanDrawerReadingActions = ({ action, editAction, onEdit }: Props) => (
  <HeaderActions
    button={
      editAction === null ? null : (
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
      )
    }
    primary={<PlanPrimaryButton action={action} isReasonShown={false} />}
  />
);
