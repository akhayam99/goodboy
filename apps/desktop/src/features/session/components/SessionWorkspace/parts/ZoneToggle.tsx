import { useMemo } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';

type Props = {
  readonly sessionId: SessionId;
};

const zoneButton = (isActive: boolean): string =>
  cn(
    'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium motion-safe:transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
    isActive
      ? 'bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
  );

export const ZoneToggle = ({ sessionId }: Props) => {
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setActiveLens = useAppStore((s) => s.setActiveLens);

  const chatTarget = useMemo(() => {
    if (selectedAgentId != null) {
      return selectedAgentId;
    }
    const roots = phaseRuns.filter((agent) => agent.parentAgentId == null);
    const running = roots.find((agent) => agent.status === 'running');
    const last = roots[roots.length - 1];
    return (running ?? last)?.id ?? null;
  }, [phaseRuns, selectedAgentId]);

  if (chatTarget === null) {
    return null;
  }

  const isChat = selectedAgentId != null;

  return (
    <div
      role="tablist"
      aria-label="Session zones"
      className="flex items-center gap-0.5 rounded-lg border border-border-soft/60 bg-subtle/30 p-0.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!isChat}
        onClick={() => setActiveLens(sessionId, null)}
        className={zoneButton(!isChat)}
      >
        <FileText size={12} aria-hidden />
        Overview
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isChat}
        onClick={() => void selectAgent(sessionId, chatTarget)}
        className={zoneButton(isChat)}
      >
        <MessageSquare size={12} aria-hidden />
        Chat
      </button>
    </div>
  );
};
