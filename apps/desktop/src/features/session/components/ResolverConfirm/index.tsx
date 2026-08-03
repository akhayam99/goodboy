import { InlineConfirm } from '@goodboy/ui';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import type { ResolverAction } from '../../resolverActions';

type Props = {
  readonly action: ResolverAction;
  readonly className?: string;
  readonly onConfirm: () => Promise<void>;
  readonly onCancel: () => void;
};

export const ResolverConfirm = ({ action, className, onConfirm, onCancel }: Props) => {
  if (action.confirm === null) {
    return null;
  }
  const Icon = RESOLVER_ACTION_ICON[action.kind];

  return (
    <InlineConfirm
      role={action.confirm.role}
      icon={<Icon size={12} aria-hidden />}
      title={action.confirm.title}
      description={action.confirm.description}
      confirmLabel={action.confirm.confirmLabel}
      className={className}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
