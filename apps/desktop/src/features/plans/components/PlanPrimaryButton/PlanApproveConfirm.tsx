import { InlineConfirm } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { unsentCommentsQuestion } from '../../unsentCommentsQuestion';
import type { PlanApproveConfirm as PlanApproveConfirmState } from '../../usePlanPrimaryAction';

type Props = {
  readonly confirm: PlanApproveConfirmState;
  readonly className?: string;
};

const CommentIcon = CONCEPT_ICONS.comments;

export const PlanApproveConfirm = ({ confirm, className }: Props) => (
  <InlineConfirm
    role="alert"
    icon={<CommentIcon size={ICON_SIZE.row} aria-hidden />}
    title={unsentCommentsQuestion({ count: confirm.count })}
    confirmLabel="Approve anyway"
    onConfirm={confirm.confirm}
    onCancel={confirm.cancel}
    className={className}
  />
);
