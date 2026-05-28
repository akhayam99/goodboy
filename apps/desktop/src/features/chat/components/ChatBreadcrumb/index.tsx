import { useMemo } from 'react';
import { ChevronRight, GitBranch } from 'lucide-react';
import type { Agent, AgentId, Session, Workflow, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  AGENT_KIND_META,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../session/agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';

interface Props {
  readonly session: Session;
}

interface WorkflowProgress {
  readonly workflow: Workflow;
  readonly currentOrdinal: number;
  readonly total: number;
}

const EMPTY_WORKFLOWS: ReadonlyArray<Workflow> = [];

/**
 * Sticky 32px breadcrumb header at the top of ChatView. Shows
 * workspace › session › agent · [kind] so the user always knows
 * which agent is talking, before this header the active agent's
 * name was nowhere in the chat surface (only in the sidebar).
 *
 * Segments are interactive: workspace opens its settings, session
 * opens its settings, agent shows the kind chip. Open Linear-style
 *, segments are anchors, not just labels.
 *
 * Per plan §A.4.
 */
export function ChatBreadcrumb({ session }: Props) {
  const workspace = useAppStore((s) =>
    s.workspaces.find((w) => w.id === (session.workspaceId as WorkspaceId)),
  );
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[session.id] ?? null,
  ) as AgentId | null;
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const sessionWorkflows = useAppStore((s) => s.sessionWorkflows[session.id] ?? EMPTY_WORKFLOWS);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);

  const workflowProgress: WorkflowProgress | null = useMemo(() => {
    if (sessionWorkflows.length === 0) return null;
    const workflow = sessionWorkflows[0];
    if (!workflow) return null;
    const total = workflow.steps.length;
    if (total === 0) return null;
    const sorted = [...workflow.steps].sort((a, b) => a.ordinal - b.ordinal);
    let currentOrdinal = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      const step = sorted[i]!;
      const agent = phaseRuns.find((r) => r.stepId === step.id);
      if (agent && agent.status !== 'pending') currentOrdinal = i + 1;
    }
    if (currentOrdinal === 0) currentOrdinal = 1;
    return { workflow, currentOrdinal, total };
  }, [sessionWorkflows, phaseRuns]);

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
      className="m-2 flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-border-soft bg-subtle/30 px-3 text-2xs"
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

      {/* workflow, only when one is attached. Surfaces "step N/M" so the user
          knows the workflow is driving and how far along it is. */}
      {workflowProgress ? (
        <>
          <Separator />
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            title={`workflow: ${workflowProgress.workflow.name} · step ${workflowProgress.currentOrdinal} of ${workflowProgress.total}`}
          >
            <GitBranch size={9} aria-hidden />
            <span className="max-w-[10rem] truncate">{workflowProgress.workflow.name}</span>
            <span aria-hidden className="opacity-60">
              ·
            </span>
            <span className="font-mono tabular-nums">
              {workflowProgress.currentOrdinal}/{workflowProgress.total}
            </span>
          </span>
        </>
      ) : null}

      {/* Spacer pushes the dog to the far right. Just the silhouette: the
          path on the left already says where you are, the dog is the quiet
          "who am I talking to" cue. */}
      <div className="flex-1" />

      {selectedAgent && agentKind ? (
        <AgentAvatar
          kind={agentKind}
          size="md"
          title={`${selectedAgent.name} (${AGENT_KIND_META[agentKind].label})`}
        />
      ) : null}
    </div>
  );
}

function Separator() {
  return <ChevronRight size={11} aria-hidden className="shrink-0 text-muted-foreground/40" />;
}
