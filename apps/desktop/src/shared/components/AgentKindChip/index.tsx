import { Chip, Tooltip, cn } from '@goodboy/ui';
import { agentKindPalette, type AgentKind } from '../../../features/session/agent-kind';

type AgentKindChipDensity = 'label' | 'glyph';

type Props = {
  readonly kind: AgentKind;
  readonly density?: AgentKindChipDensity;
  readonly label?: string;
  readonly muted?: boolean;
  readonly title?: string;
  readonly isDecorative?: boolean;
  readonly className?: string;
};

const KIND_ICON_SIZE = 10;

export const AgentKindChip = ({
  kind,
  density = 'label',
  label,
  muted,
  title,
  isDecorative = false,
  className,
}: Props) => {
  const palette = agentKindPalette({ kind });
  const text = label ?? palette.label;
  const Icon = palette.icon;

  if (density === 'glyph') {
    const glyph = (
      <span
        role={isDecorative ? undefined : 'img'}
        aria-label={isDecorative ? undefined : (title ?? text)}
        aria-hidden={isDecorative ? true : undefined}
        className={cn(
          'inline-flex size-4.5 shrink-0 items-center justify-center rounded-full',
          palette.fg,
          'bg-current/12',
          className,
        )}
      >
        <Icon size={KIND_ICON_SIZE} aria-hidden />
      </span>
    );
    if (isDecorative) {
      return glyph;
    }
    return (
      <Tooltip content={title ?? text} anchorClassName="inline-flex shrink-0">
        {glyph}
      </Tooltip>
    );
  }

  return (
    <Chip
      tone="neutral"
      kind="state"
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
