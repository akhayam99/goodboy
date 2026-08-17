import { cn } from '@goodboy/ui';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { AGENT_KIND_META, type AgentKind } from '../../agent-kind';

type Props = {
  readonly kind: AgentKind;
  readonly isActive: boolean;
  readonly onSelect: () => void;
};

export const AgentKindTile = ({ kind, isActive, onSelect }: Props) => {
  const meta = AGENT_KIND_META[kind];
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
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      <AgentAvatar kind={kind} size="md" />
      <span className="truncate text-xs font-medium">{meta.label}</span>
    </button>
  );
};
