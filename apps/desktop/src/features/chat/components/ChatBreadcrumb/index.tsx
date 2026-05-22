import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Agent, AgentId, Session, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  AGENT_KIND_META,
  AGENT_KIND_PALETTE,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../session/agent-kind';

interface ChatBreadcrumbProps {
  readonly session: Session;
}

/**
 * Sticky 32px breadcrumb header at the top of ChatView. Shows
 * workspace › session › agent · [kind] so the user always knows
 * which agent is talking — before this header the active agent's
 * name was nowhere in the chat surface (only in the sidebar).
 *
 * Segments are interactive: workspace opens its settings, session
 * opens its settings, agent shows the kind chip. Open Linear-style
 * — segments are anchors, not just labels.
 *
 * Per plan §A.4.
 */
export function ChatBreadcrumb({ session }: ChatBreadcrumbProps) {
  const workspace = useAppStore((s) =>
    s.workspaces.find((w) => w.id === (session.workspaceId as WorkspaceId)),
  );
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[session.id] ?? null,
  ) as AgentId | null;
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);

  const selectedAgent: Agent | null = useMemo(() => {
    if (!selectedAgentId) return null;
    return phaseRuns.find((a) => a.id === selectedAgentId) ?? null;
  }, [selectedAgentId, phaseRuns]);

  const agentKind: AgentKind | null = useMemo(() => {
    if (!selectedAgent) return null;
    const override = agentKindOverride[selectedAgent.id];
    if (override) return override;
    return inferAgentKindFromName(selectedAgent.name);
  }, [selectedAgent, agentKindOverride]);

  const openWorkspaceSettings = () => {
    window.dispatchEvent(new CustomEvent('goodboy:open-settings', { detail: { section: 'app' } }));
  };

  const sessionLabel = session.goal.trim() || 'untitled session';

  return (
    <div
      className="m-2 flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-border-soft bg-subtle/30 px-3 text-2xs"
      role="navigation"
      aria-label="chat breadcrumb"
    >
      {/* workspace */}
      {workspace ? (
        <button
          type="button"
          onClick={openWorkspaceSettings}
          className="truncate font-medium text-muted-foreground transition-colors hover:text-foreground"
          title={`workspace: ${workspace.name}`}
        >
          {workspace.name}
        </button>
      ) : (
        <span className="truncate text-muted-foreground/50">no workspace</span>
      )}

      <Separator />

      {/* session */}
      <span className="min-w-0 truncate font-medium text-foreground/90" title={sessionLabel}>
        {sessionLabel}
      </span>

      {/* agent — only when one is selected; the chat empties otherwise */}
      {selectedAgent && agentKind ? (
        <>
          <Separator />
          <span
            className="inline-flex shrink-0 items-center gap-1 text-foreground/90"
            title={`agent: ${selectedAgent.name}`}
          >
            <span
              aria-hidden
              className={cn('size-1.5 rounded-full', AGENT_KIND_PALETTE[agentKind].bg)}
            />
            <span className="font-medium">{selectedAgent.name}</span>
            <span
              className={cn('text-2xs uppercase tracking-wide', AGENT_KIND_PALETTE[agentKind].fg)}
            >
              {AGENT_KIND_META[agentKind].label}
            </span>
          </span>
        </>
      ) : null}
    </div>
  );
}

function Separator() {
  return <ChevronRight size={11} aria-hidden className="shrink-0 text-muted-foreground/40" />;
}
