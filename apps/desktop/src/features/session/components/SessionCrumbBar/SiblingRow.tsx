import { cn } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import type { SwitcherEntry } from './switcherEntry';

type SiblingRowProps = {
  readonly entry: SwitcherEntry;
  readonly selectedAgentId: AgentId;
  readonly onSelect: (id: AgentId) => void;
};

export const SiblingRow = ({ entry, selectedAgentId, onSelect }: SiblingRowProps) => (
  <button
    key={entry.agent.id}
    type="button"
    role="menuitem"
    onClick={() => onSelect(entry.agent.id)}
    className={cn(
      'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
      entry.agent.id === selectedAgentId
        ? 'bg-background text-foreground'
        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
    )}
  >
    <AgentAvatar kind={entry.kind} size="sm" />
    <span className="min-w-0 flex-1 truncate">{entry.agent.name}</span>
    <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground/70">
      {entry.agent.status}
    </span>
  </button>
);
