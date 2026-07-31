import type { Agent, AgentId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { Check, Clock, Loader2 } from 'lucide-react';
import { tintClasses } from '@goodboy/ui';

const accent = tintClasses('merged');
const infoAccent = tintClasses('info');
const successAccent = tintClasses('success');

export type SpawnStatus = Agent['status'] | 'planned';

export type SpawnedAgentItem = Readonly<{
  key: string;
  index: number;
  total: number;
  name: string;
  body: string | null;
  status: SpawnStatus;
  agentId: AgentId | null;
}>;

type Props = {
  readonly items: ReadonlyArray<SpawnedAgentItem>;
  readonly selectedAgentId?: AgentId | undefined;
  readonly onSelect?: (agentId: AgentId) => void;
  readonly variant?: 'inline' | 'dashboard';
};

const statusIcon = (status: SpawnStatus) =>
  status === 'running' ? (
    <Loader2 size={14} className={cn('animate-spin', infoAccent.icon)} aria-hidden />
  ) : status === 'completed' ? (
    <span className={cn('flex size-4 items-center justify-center rounded-full', successAccent.bg)}>
      <Check size={10} className={successAccent.icon} aria-hidden />
    </span>
  ) : status === 'failed' ? (
    <span className="size-2 rounded-full bg-danger" aria-hidden />
  ) : (
    <Clock size={14} className="text-muted-foreground/60" aria-hidden />
  );

const statusLabel = (status: SpawnStatus): string =>
  status === 'running'
    ? 'running…'
    : status === 'completed'
      ? 'done'
      : status === 'failed'
        ? 'stalled'
        : status === 'planned'
          ? 'planned'
          : 'queued';

export const SpawnedAgentList = ({
  items,
  selectedAgentId,
  onSelect,
  variant = 'dashboard',
}: Props) => {
  const dense = variant === 'inline';
  return (
    <div className={cn('flex flex-col', dense ? 'gap-1' : 'gap-3')}>
      {items.map((item) => {
        const isSelected = item.agentId != null && item.agentId === selectedAgentId;
        const navigable = item.agentId != null && onSelect != null;
        const rowClass = cn(
          'flex w-full items-start gap-3 rounded-lg border text-left transition-colors',
          dense ? 'px-2 py-1.5' : 'px-3 py-2.5',
          isSelected
            ? cn(accent.border, accent.bg)
            : navigable
              ? cn('border-border', accent.hoverBorder, accent.hoverBgSoft)
              : 'border-border-soft/60',
        );
        const inner = (
          <>
            <span className="mt-0.5 shrink-0 tabular-nums text-xs text-muted-foreground/60">
              {item.index + 1}/{item.total}
            </span>
            <span className="mt-0.5 shrink-0">{statusIcon(item.status)}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'min-w-0 truncate font-medium text-foreground',
                    dense ? 'text-xs' : 'text-sm',
                  )}
                >
                  {item.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground/70">
                  {statusLabel(item.status)}
                </span>
              </span>
              {item.body ? (
                <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
              ) : null}
            </span>
          </>
        );
        if (navigable) {
          const agentId = item.agentId as AgentId;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(agentId)}
              className={cn(rowClass, 'cursor-pointer')}
            >
              {inner}
            </button>
          );
        }
        return (
          <div key={item.key} className={rowClass}>
            {inner}
          </div>
        );
      })}
    </div>
  );
};
