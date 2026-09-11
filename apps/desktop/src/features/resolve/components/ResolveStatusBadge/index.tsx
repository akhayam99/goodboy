import { Chip } from '@goodboy/ui';
import type { ResolveQueueStatus } from '../../../../store/slices/resolve/deriveResolveQueueStatus';
import { RESOLVE_QUEUE_NEXT_STEP, RESOLVE_QUEUE_STATUS_LABEL } from '../../resolveQueueCopy';
import { BADGE_ICON_BY_STATUS, BADGE_TONE_BY_STATUS } from './statusTone';

type Props = {
  readonly status: ResolveQueueStatus;
  readonly bordered?: boolean;
  readonly width?: 'auto' | 'lg';
};

export const resolveStatusAccessibleName = ({
  status,
}: {
  readonly status: ResolveQueueStatus;
}): string => {
  const label = RESOLVE_QUEUE_STATUS_LABEL[status];
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
      label={RESOLVE_QUEUE_STATUS_LABEL[status]}
      title={name}
    />
  );
};
