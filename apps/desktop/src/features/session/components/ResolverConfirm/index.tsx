import { InlineConfirm } from '@goodboy/ui';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import { RESOLVER_ACTION_BUSY_LABEL } from '../../resolverActionBusyLabel';
import type { ResolverAction } from '../../resolverActions';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly action: ResolverAction;
  readonly className?: string;
  readonly isBusy?: boolean;
  readonly onConfirm: () => Promise<void>;
  readonly onCancel: () => void;
};

export const ResolverConfirm = ({
  action,
  className,
  isBusy = false,
  onConfirm,
  onCancel,
}: Props) => {
  if (action.confirm === null) {
    return null;
  }
  const Icon = RESOLVER_ACTION_ICON[action.kind];

  return (
    <InlineConfirm
      role={action.confirm.role}
      icon={<Icon size={ICON_SIZE.row} aria-hidden />}
      title={action.confirm.title}
      description={action.confirm.description}
      confirmLabel={isBusy ? RESOLVER_ACTION_BUSY_LABEL[action.kind] : action.confirm.confirmLabel}
      isBusy={isBusy}
      className={className}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
