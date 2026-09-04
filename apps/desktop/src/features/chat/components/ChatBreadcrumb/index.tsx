import { useMemo } from 'react';
import { ChevronRight, CornerLeftUp, GitBranch } from 'lucide-react';
import type { Agent, AgentId, Session, Workflow, WorkspaceId } from '@goodboy/types';
import { Divider, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  AGENT_KIND_META,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../session/agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { InlineMarkdown } from '../../../../shared/components/InlineMarkdown';
import { stripInlineMarkdown } from '../../../../shared/components/InlineMarkdown/stripInlineMarkdown';
import { tintClasses } from '@goodboy/ui';

const workflowAccent = tintClasses('primary');

type Props = {
  readonly session: Session;
};

type WorkflowProgress = {
  readonly workflow: Workflow;
  readonly currentOrdinal: number;
  readonly total: number;
};

const EMPTY_WORKFLOWS: ReadonlyArray<Workflow> = [];

export const ChatBreadcrumb = ({ session }: Props) => {
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
  const selectAgent = useAppStore((s) => s.selectAgent);

  const workflowProgress: WorkflowProgress | null = useMemo(() => {
    if (session.workflowRuns.length === 0) {
      return null;
    }
    const selected = selectedAgentId ? phaseRuns.find((a) => a.id === selectedAgentId) : undefined;
    const activeRun =
      (selected?.workflowRunId
        ? session.workflowRuns.find((r) => r.id === selected.workflowRunId)
        : undefined) ??
      session.workflowRuns.find((r) => !r.discardedAt) ??
      null;
    if (!activeRun) {
      return null;
    }
    const workflow = sessionWorkflows.find((w) => w.id === activeRun.workflowId);
    if (!workflow) {
      return null;
    }
    const total = workflow.steps.length;
    if (total === 0) {
      return null;
    }
    const sorted = [...workflow.steps].sort((a, b) => a.ordinal - b.ordinal);
    const runAgents = phaseRuns.filter((r) => r.workflowRunId === activeRun.id);
    let currentOrdinal = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      const step = sorted[i]!;
      const agent = runAgents.find((r) => r.stepId === step.id);
      if (agent && agent.status !== 'pending') {
        currentOrdinal = i + 1;
      }
    }
    if (currentOrdinal === 0) {
      currentOrdinal = 1;
    }
    return { workflow, currentOrdinal, total };
  }, [session.workflowRuns, sessionWorkflows, phaseRuns, selectedAgentId]);

  const selectedAgent: Agent | null = useMemo(() => {
    if (!selectedAgentId) {
      return null;
    }
    return phaseRuns.find((a) => a.id === selectedAgentId) ?? null;
  }, [selectedAgentId, phaseRuns]);

  const parentAgent: Agent | null = useMemo(() => {
    if (!selectedAgent?.parentAgentId) {
      return null;
    }
    return phaseRuns.find((a) => a.id === selectedAgent.parentAgentId) ?? null;
  }, [selectedAgent, phaseRuns]);

  const onPickParent = () => {
    if (!parentAgent) {
      return;
    }
    void selectAgent(session.id, parentAgent.id);
    window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
  };

  const agentKind: AgentKind | null = useMemo(() => {
    if (!selectedAgent) {
      return null;
    }
    const override = agentKindOverride[selectedAgent.id];
    if (override) {
      return override;
    }
    return inferAgentKindFromName(selectedAgent.name);
  }, [selectedAgent, agentKindOverride]);

  const sessionLabel = session.goal.trim() || 'untitled session';

  return (
    <>
      <nav
        className={cn(
          'flex h-[var(--chat-header-h)] shrink-0 items-center justify-between gap-2 text-2xs text-muted-foreground',
          PANE_RHYTHM.inset,
        )}
        aria-label="Chat breadcrumb"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {workspace ? (
            <span className="truncate font-medium" title={`Workspace: ${workspace.name}`}>
              {workspace.name}
            </span>
          ) : (
            <span className="truncate text-muted-foreground/50">no workspace</span>
          )}

          <Separator />

          <span
            className="min-w-0 truncate font-medium text-foreground/90"
            title={stripInlineMarkdown({ text: sessionLabel })}
          >
            <InlineMarkdown text={sessionLabel} />
          </span>

          {workflowProgress ? (
            <>
              <Separator />
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium ${workflowAccent.bg} ${workflowAccent.text}`}
                title={`Workflow: ${workflowProgress.workflow.name} · step ${workflowProgress.currentOrdinal} of ${workflowProgress.total}`}
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
        </div>

        {parentAgent ? (
          <button
            type="button"
            onClick={onPickParent}
            title={`Spawned by ${parentAgent.name}. go to parent`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CornerLeftUp size={10} aria-hidden />
            <span className="max-w-[8rem] truncate">{parentAgent.name}</span>
          </button>
        ) : null}

        {selectedAgent && agentKind ? (
          <AgentAvatar
            kind={agentKind}
            size="md"
            title={`${selectedAgent.name} (${AGENT_KIND_META[agentKind].label})`}
          />
        ) : null}
      </nav>
      <Divider className="shrink-0" />
    </>
  );
};

function Separator() {
  return <ChevronRight size={11} aria-hidden className="shrink-0 text-muted-foreground/40" />;
}
