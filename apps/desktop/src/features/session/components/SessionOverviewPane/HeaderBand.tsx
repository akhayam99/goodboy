import { CheckCheck, Pencil } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button, cn, Input, StatusDot, Tooltip } from '@goodboy/ui';
import type { Session, SessionId, SessionStageInfo } from '@goodboy/types';
import { agentHasUnread, useAppStore, useCurrentWorkspace } from '../../../../store';
import type { LensKind } from '../../../../store';
import { SESSION_STAGE_META, STAGE_TONE } from '../../session-stage';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { SummarizerBadge } from '../SummarizerBadge';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { EditorMenu } from './EditorMenu';
import { SessionGitActions } from '../SessionWorkspace/parts/SessionGitActions';
import { SessionDestructiveActions } from './SessionDestructiveActions';
import { BranchChip } from './BranchChip';
import { SessionCostChip } from './SessionCostChip';
import { StatusRowRequest } from './StatusRowRequest';
import { LinkedWorkChips } from './LinkedWorkChips';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';

type Props = {
  readonly session: Session;
  readonly stage: SessionStageInfo;
  readonly onSelectLens: (lens: LensKind) => void;
};

const REASON_HIDDEN: ReadonlySet<string> = new Set([
  'no PR yet',
  'checking GitHub',
  'GitHub unreachable',
]);

export const HeaderBand = ({ session, stage, onSelectLens }: Props) => {
  const sessionId = session.id as SessionId;
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  const workspace = useCurrentWorkspace();
  const repo = useAppStore(useShallow((state) => resolveSessionRepo({ state, sessionId })));
  const storedBranch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const branch = repo != null && repo.mountName != null ? repo.branch : storedBranch;
  const sessionAgents = useAppStore((s) => s.sessionPhaseRuns[sessionId]);
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const hasUnreadAgents = (sessionAgents ?? []).some((agent) => agentHasUnread(agent, false));
  const goalText = session.goal || 'Untitled session';
  const reasonVisible = stage.reason !== '' && !REASON_HIDDEN.has(stage.reason);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <StatusDot tone={STAGE_TONE[stage.stage]} pulsing={stage.stage === 'running'} />
          <span className="shrink-0 text-xs font-medium text-foreground">
            {SESSION_STAGE_META[stage.stage].label}
          </span>
          {reasonVisible ? (
            <Tooltip
              content={`${SESSION_STAGE_META[stage.stage].label} · ${stage.reason}`}
              side="top"
            >
              <span className="min-w-0 truncate text-xs text-muted-foreground/70">
                {stage.reason}
              </span>
            </Tooltip>
          ) : null}
          <StatusRowRequest sessionId={sessionId} />
          {branch != null ? (
            <BranchChip
              branch={branch}
              mountName={repo?.mountName ?? null}
              sessionId={sessionId}
              canEdit={
                workspace != null && !isBranchlessSession({ workspaceKind: workspace.kind, branch })
              }
            />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SummarizerBadge sessionId={sessionId} />
          {hasUnreadAgents ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => void markAllAgentsSeen(sessionId)}
            >
              <CheckCheck size={13} aria-hidden />
              Mark all seen
            </Button>
          ) : null}
          <EditorMenu sessionId={sessionId} density="compact" />
          <SessionGitActions session={session} density="compact" />
          <SessionDestructiveActions session={session} />
          <SessionCostChip sessionId={sessionId} />
        </div>
      </div>
      {rename.editing ? (
        <div className="flex flex-col gap-1">
          <Input
            autoFocus
            value={rename.draft}
            maxLength={rename.maxLength}
            onChange={(e) => rename.setDraft(e.target.value)}
            onBlur={() => void rename.commit()}
            onKeyDown={rename.onKeyDown}
            aria-label="Session goal"
            className="text-xl font-semibold"
          />
          {rename.error != null && <span className="text-2xs text-danger">{rename.error}</span>}
        </div>
      ) : (
        <div className="group/goal flex items-start gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <h1
              className={cn(
                'min-w-0 flex-1 text-balance text-xl font-semibold leading-snug text-foreground',
                'line-clamp-2',
              )}
            >
              {goalText}
            </h1>
            <button
              type="button"
              onClick={rename.start}
              aria-label="Edit goal"
              title="Edit goal"
              className={cn(
                'mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50',
                'opacity-0 transition-[opacity,color,background-color] hover:bg-muted hover:text-foreground',
                'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                'group-hover/goal:opacity-100 motion-reduce:opacity-60',
              )}
            >
              <Pencil size={13} aria-hidden />
            </button>
          </div>
          <LinkedWorkChips sessionId={sessionId} onSelectLens={onSelectLens} />
        </div>
      )}
    </div>
  );
};
