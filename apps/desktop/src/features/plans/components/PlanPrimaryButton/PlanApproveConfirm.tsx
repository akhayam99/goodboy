import { InlineConfirm } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { PlanApproveConfirm as PlanApproveConfirmState } from '../../usePlanPrimaryAction';

type Props = {
  readonly confirm: PlanApproveConfirmState;
  readonly className?: string;
};

const CommentIcon = CONCEPT_ICONS.comments;

const questionOf = ({ count }: { readonly count: number }): string =>
  `${count === 1 ? '1 comment is' : `${count} comments are`} not sent. Approve anyway?`;

export const PlanApproveConfirm = ({ confirm, className }: Props) => (
  <InlineConfirm
    role="alert"
    icon={<CommentIcon size={ICON_SIZE.row} aria-hidden />}
    title={questionOf({ count: confirm.count })}
    confirmLabel="Approve anyway"
    onConfirm={confirm.confirm}
    onCancel={confirm.cancel}
    className={className}
  />
);
