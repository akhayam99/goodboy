import { Tooltip, cn } from '@goodboy/ui';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { agentKindPalette, type AgentKind } from '../../agent-kind';

export type AgentKindChipDensity = 'label' | 'glyph';

type Props = {
  readonly kind: AgentKind;
  readonly density?: AgentKindChipDensity;
  readonly label?: string;
  readonly muted?: boolean;
  readonly title?: string;
  readonly className?: string;
};

export const AgentKindChip = ({
  kind,
  density = 'label',
  label,
  muted,
  title,
  className,
}: Props) => {
  const palette = agentKindPalette({ kind });
  const text = label ?? palette.label;

  if (density === 'glyph') {
    return (
      <Tooltip content={title ?? text} anchorClassName="inline-flex shrink-0">
        <span role="img" aria-label={title ?? text} className={cn('inline-flex', className)}>
          <AgentAvatar kind={kind} size="xs" />
        </span>
      </Tooltip>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-4.5 w-20 shrink-0 items-center justify-center rounded-sm px-1.5 text-secondary font-medium',
        muted ? 'bg-muted text-faint-foreground' : [palette.fg, 'bg-current/12'],
        className,
      )}
      title={title}
    >
      {text}
    </span>
  );
};
