import { Check } from 'lucide-react';
import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AGENT_KIND_META, agentKindPalette, type AgentKind } from '../../agent-kind';

type Props = {
  readonly kind: AgentKind;
  readonly isActive: boolean;
  readonly onSelect: () => void;
};

export const AgentKindOption = ({ kind, isActive, onSelect }: Props) => {
  const meta = AGENT_KIND_META[kind];
  const palette = agentKindPalette({ kind });
  const Icon = palette.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      aria-label={meta.noun}
      aria-description={meta.hint}
      className={cn(
        'flex w-full min-w-0 items-start gap-2 rounded-sm px-2 py-2 text-left',
        ROW_INTERACTIVE,
        isActive && 'bg-selected',
      )}
    >
      <span aria-hidden className="flex h-5 shrink-0 items-center">
        <Icon size={ICON_SIZE.row} className={palette.fg} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-row text-foreground">{meta.noun}</span>
        <span className="truncate text-meta text-faint-foreground">{meta.hint}</span>
      </span>
      {isActive ? (
        <span aria-hidden className="flex h-5 shrink-0 items-center text-foreground">
          <Check size={ICON_SIZE.control} />
        </span>
      ) : null}
    </button>
  );
};
