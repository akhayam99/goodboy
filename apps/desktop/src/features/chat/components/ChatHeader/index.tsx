import { FolderOpen, MessagesSquare } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { Agent, AgentStatus, ProviderRunId, Session, SessionId } from '@kay-am/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentWorkspace,
  useSessionLoading,
} from '../../../../store';
import { OpenInEditorButton } from '../../../../app/components/OpenInEditorButton';
import { ParallelProgressPill } from '../ParallelProgressPill';
import { shortModel, formatCost } from '../../../session/agent-row-format';

interface ChatHeaderProps {
  session: Session;
  worktreePath: string | null;
  parallelRunIds?: ReadonlyArray<ProviderRunId>;
  onSelectRun?: (runId: ProviderRunId) => void;
}

export function ChatHeader({
  session,
  worktreePath,
  parallelRunIds,
  onSelectRun,
}: ChatHeaderProps) {
  const workspace = useCurrentWorkspace();
  const transcriptLoading = useSessionLoading(session.id).transcript;

  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const events = useAppStore((s) => {
    const agentId = s.selectedAgentId[session.id] ?? null;
    return agentId ? (s.transcripts[agentId] ?? EMPTY_ARRAY) : EMPTY_ARRAY;
  });
  const userTurns = events.filter((e) => e.kind === 'user_text').length;
  const assistantReplies = events.filter((e) => e.kind === 'done').length;

  const runStatuses = Object.fromEntries(
    (parallelRunIds ?? []).map((rid) => {
      const run = phaseRuns.find((r) => r.runId === rid);
      return [rid, run?.status ?? ('pending' as AgentStatus)];
    }),
  ) as Readonly<Record<ProviderRunId, AgentStatus>>;

  const isParallel = (parallelRunIds?.length ?? 0) > 1;

  return (
    <div className="sticky top-0 z-10 bg-background px-10 py-2.5 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-gradient-to-b after:from-background after:to-transparent">
      <div className="mx-auto flex w-full max-w-[880px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight">{session.goal}</h1>
            {isParallel && onSelectRun ? (
              <ParallelProgressPill
                parallelRunIds={parallelRunIds!}
                runStatuses={runStatuses}
                onSelectRun={onSelectRun}
              />
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {workspace ? (
              <span
                className="inline-flex items-center gap-1"
                title={workspace.rootPath}
                aria-label={`workspace: ${workspace.name}`}
              >
                <FolderOpen size={12} aria-hidden />
                <span className="truncate">{workspace.name}</span>
              </span>
            ) : null}
            <span
              className="inline-flex items-center gap-1"
              title={
                transcriptLoading
                  ? 'loading turn count'
                  : `${userTurns} message${userTurns === 1 ? '' : 's'} sent · ${assistantReplies} reply${assistantReplies === 1 ? '' : 'ies'}`
              }
            >
              <MessagesSquare size={12} aria-hidden />
              {transcriptLoading ? (
                <span
                  aria-label="loading turn count"
                  className="inline-block h-2.5 w-8 animate-pulse rounded bg-muted"
                />
              ) : (
                <>
                  <span className="font-mono text-foreground/85">{userTurns}</span>
                  <span>turn{userTurns === 1 ? '' : 's'}</span>
                  {assistantReplies > 0 ? (
                    <span className="text-muted-foreground/60">· {assistantReplies} replies</span>
                  ) : null}
                </>
              )}
            </span>
            <AgentInfoPill sessionId={session.id} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <OpenInEditorButton worktreePath={worktreePath ?? workspace?.rootPath ?? null} />
        </div>
      </div>
    </div>
  );
}

const STATUS_DOT: Record<AgentStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-muted-foreground/20',
};

function AgentInfoPill({ sessionId }: { sessionId: SessionId }) {
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const agentRunHistory = useAppStore((s) => s.agentRunHistory);
  const telemetry = useAppStore((s) => s.sessionTelemetry[sessionId] ?? EMPTY_ARRAY);

  if (!selectedAgentId) return null;

  const agent = phaseRuns.find((r) => r.id === selectedAgentId) as Agent | undefined;
  const runIds = new Set(agentRunHistory[selectedAgentId] ?? (agent?.runId ? [agent.runId] : []));

  const agentRecords = telemetry.filter((r) => r.kind === 'turn' && runIds.has(r.runId));
  const totalCost = agentRecords.reduce((sum, r) => sum + r.estimatedCostUsd, 0);
  const latestModel = agentRecords[agentRecords.length - 1]?.model ?? null;

  if (!latestModel && totalCost === 0) return null;

  const status = agent?.status ?? 'pending';

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-subtle px-2 py-0.5 text-2xs text-muted-foreground">
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full flex-none', STATUS_DOT[status])} />
      {latestModel ? <span className="font-mono">{shortModel(latestModel)}</span> : null}
      {totalCost > 0 ? (
        <span className="font-mono text-muted-foreground/70">{formatCost(totalCost)}</span>
      ) : null}
    </div>
  );
}
