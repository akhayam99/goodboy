import type { ReactNode } from 'react';
import { ConfirmPopover, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { unsentCommentsQuestion } from '../../unsentCommentsQuestion';
import type { PlanApproveConfirm as PlanApproveConfirmState } from '../../usePlanPrimaryAction';

type Props = {
  readonly confirm: PlanApproveConfirmState | null;
  readonly trigger: () => ReactNode;
};

const CommentIcon = CONCEPT_ICONS.comments;

const settle = async (): Promise<void> => undefined;

export const PlanApproveConfirm = ({ confirm, trigger }: Props) => (
  <ConfirmPopover
    role="primary"
    icon={<CommentIcon size={ICON_SIZE.row} aria-hidden />}
    title={unsentCommentsQuestion({ count: confirm?.count ?? 0 })}
    description="Approving starts the run without them. They stay on the plan as drafts."
    confirmLabel="Approve anyway"
    isOpen={confirm !== null}
    onConfirm={confirm?.confirm ?? settle}
    onCancel={confirm?.cancel}
    trigger={trigger}
  />
);
