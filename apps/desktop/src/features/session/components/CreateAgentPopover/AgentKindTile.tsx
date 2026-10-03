import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AGENT_KIND_META, agentKindPalette, type AgentKind } from '../../agent-kind';

type Props = {
  readonly kind: AgentKind;
  readonly isActive: boolean;
  readonly onSelect: () => void;
};

export const AgentKindTile = ({ kind, isActive, onSelect }: Props) => {
  const meta = AGENT_KIND_META[kind];
  const palette = agentKindPalette({ kind });
  const Icon = palette.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      aria-label={meta.label}
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-background hover:text-foreground',
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', palette.fg)} />
      <span className="truncate text-label font-medium">{meta.label}</span>
    </button>
  );
};
