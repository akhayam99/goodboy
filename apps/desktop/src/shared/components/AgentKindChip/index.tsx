import { Chip, Tooltip, cn } from '@goodboy/ui';
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
            'inline-flex size-4.5 items-center justify-center rounded-full',
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
    <Chip
      tone="neutral"
      size="3xs"
      icon={<Icon size={KIND_ICON_SIZE} aria-hidden className="shrink-0" />}
      label={text}
      title={title}
      className={cn(
        'shrink-0 whitespace-nowrap',
        muted === true
          ? 'bg-muted text-faint-foreground'
          : [palette.fg, 'bg-current/12 ring-current/25'],
        className,
      )}
    />
  );
};
