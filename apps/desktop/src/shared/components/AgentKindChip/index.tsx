import { Tooltip, cn } from '@goodboy/ui';
import { agentKindPalette, type AgentKind } from '../../../features/session/agent-kind';

type AgentKindChipDensity = 'label' | 'glyph';

type Props = {
  readonly kind: AgentKind;
  readonly density?: AgentKindChipDensity;
  readonly label?: string;
  readonly muted?: boolean;
  readonly title?: string;
  readonly className?: string;
};

const KIND_ICON_SIZE = 10;

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
  const Icon = palette.icon;

  if (density === 'glyph') {
    return (
      <Tooltip content={title ?? text} anchorClassName="inline-flex shrink-0">
        <span
          role="img"
          aria-label={title ?? text}
          className={cn(
            'inline-flex size-4.5 items-center justify-center rounded-sm',
            palette.fg,
            'bg-current/12',
            className,
          )}
        >
          <Icon size={KIND_ICON_SIZE} aria-hidden />
        </span>
      </Tooltip>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-4.5 w-24 shrink-0 items-center gap-1 rounded-sm px-1.5 text-secondary',
        muted ? 'bg-muted text-faint-foreground' : [palette.fg, 'bg-current/12'],
        className,
      )}
      title={title}
    >
      <Icon size={KIND_ICON_SIZE} aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">{text}</span>
    </span>
  );
};
