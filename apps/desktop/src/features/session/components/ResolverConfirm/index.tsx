import { InlineConfirm, Textarea } from '@goodboy/ui';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import type { ResolverAction } from '../../resolverActions';

type Props = {
  readonly action: ResolverAction;
  readonly explanation: string;
  readonly threadCount: number;
  readonly className?: string;
  readonly onExplanationChange: (value: string) => void;
  readonly onConfirm: () => Promise<void>;
  readonly onCancel: () => void;
};

const placeholderFor = ({ action, threadCount }: Pick<Props, 'action' | 'threadCount'>): string => {
  if (action.explanation === 'required') {
    return threadCount > 1
      ? `Explain why all ${threadCount} threads can be closed`
      : 'Explain why this can be closed';
  }
  return threadCount > 1 ? `Optional note for all ${threadCount} threads` : 'Optional note';
};

export const ResolverConfirm = ({
  action,
  explanation,
  threadCount,
  className,
  onExplanationChange,
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
      icon={<Icon size={12} aria-hidden />}
      title={action.confirm.title}
      description={action.confirm.description}
      confirmLabel={action.confirm.confirmLabel}
      isConfirmDisabled={action.explanation === 'required' && explanation.trim() === ''}
      className={className}
      note={
        action.explanation === null ? undefined : (
          <Textarea
            value={explanation}
            onChange={(event) => onExplanationChange(event.target.value)}
            aria-label={
              threadCount > 1
                ? `resolution explanation for all ${threadCount} threads`
                : 'resolution explanation'
            }
            placeholder={placeholderFor({ action, threadCount })}
            autoGrow
            maxRows={6}
            className="min-h-12 resize-none bg-background/60 px-2 py-1.5 text-xs leading-relaxed"
          />
        )
      }
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
