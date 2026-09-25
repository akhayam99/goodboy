import { Chip } from '@goodboy/ui';
import { RESOLVE_QUEUE_NEXT_STEP } from '../../resolveQueueCopy';
import { RESOLVE_UI_STATE_LABEL, type ResolveUiState } from '../../resolveRowState';
import { BADGE_ICON_BY_STATUS, BADGE_TONE_BY_STATUS } from './statusTone';

type Props = {
  readonly status: ResolveUiState;
  readonly bordered?: boolean;
  readonly width?: 'auto' | 'lg';
};

export const resolveStatusAccessibleName = ({
  status,
}: {
  readonly status: ResolveUiState;
}): string => {
  const label = RESOLVE_UI_STATE_LABEL[status];
  const next = RESOLVE_QUEUE_NEXT_STEP[status];
  return next === null ? label : `${label}. ${next}`;
};

export const ResolveStatusBadge = ({ status, bordered = false, width = 'auto' }: Props) => {
  const Icon = BADGE_ICON_BY_STATUS[status];
  const name = resolveStatusAccessibleName({ status });
  return (
    <Chip
      size="xs"
      width={width}
      bordered={bordered}
      tone={BADGE_TONE_BY_STATUS[status]}
      icon={<Icon className="size-3 shrink-0" aria-hidden />}
      label={RESOLVE_UI_STATE_LABEL[status]}
      title={name}
      ariaLabel={name}
    />
  );
};
