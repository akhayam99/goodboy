import { Chip, cn } from '@goodboy/ui';
import type { PlanStatus } from '@goodboy/types';
import { describePlanStatus } from '../../plan-status';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

const PLAN_STATUS_OVERRIDE: Partial<Record<PlanStatus, string>> = {
  discarded: 'bg-muted/60 text-muted-foreground/70 line-through',
};

type Props = {
  readonly status: PlanStatus;
  readonly openQuestionCount?: number;
};

export const PlanStatusChip = ({ status, openQuestionCount = 0 }: Props) => {
  const presentation = describePlanStatus({ status, openQuestionCount });
  const Icon = presentation.icon;

  return (
    <Chip
      tone={presentation.tone}
      size="xs"
      bordered={false}
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      label={presentation.label}
      title={stateDescription({ presentation })}
      className={cn('shrink-0', PLAN_STATUS_OVERRIDE[status])}
    />
  );
};
