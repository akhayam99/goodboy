import { CheckCheck, Pencil } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button, cn, Input, StatusDot } from '@goodboy/ui';
import type { Session, SessionId, SessionStageInfo } from '@goodboy/types';
import { agentHasUnread, EMPTY_ARRAY, useAppStore, useCurrentWorkspace } from '../../../../store';
import { SESSION_STAGE_META, STAGE_TONE } from '../../session-stage';
import { formatAdaptiveAge } from '../../../../shared/utils/relativeDate';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { SummarizerBadge } from '../SummarizerBadge';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { BranchChip } from './BranchChip';
import { SessionCostChip } from './SessionCostChip';
import { PrStatusLine } from './PrStatusLine';
import { definitionOfDone } from './definitionOfDone';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';

type Props = {
  readonly session: Session;
  readonly stage: SessionStageInfo;
};

export const HeaderBand = ({ session, stage }: Props) => {
  const sessionId = session.id as SessionId;
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  const workspace = useCurrentWorkspace();
  const repo = useAppStore(useShallow((state) => resolveSessionRepo({ state, sessionId })));
  const storedBranch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const branch = repo != null && repo.mountName != null ? repo.branch : storedBranch;
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const mergeRequest = useAppStore((s) => s.sessionGitlabMr[sessionId]?.mr ?? null);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const sessionAgents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const markAllAgentsSeen = useAppStore((s) => s.markAllAgentsSeen);
  const pullRequest = github?.pr ?? null;
  const hasUnreadAgents = sessionAgents.some((agent) => agentHasUnread(agent, false));
  const done = definitionOfDone({
    pr: pullRequest,
    mergeRequest,
    linkedIssues: github?.linkedIssues ?? EMPTY_ARRAY,
    externalTasks,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot tone={STAGE_TONE[stage.stage]} pulsing={stage.stage === 'running'} />
          <span className="shrink-0 text-xs font-medium text-foreground">
            {SESSION_STAGE_META[stage.stage].label}
          </span>
          {stage.reason !== '' ? (
            <span className="min-w-0 truncate text-xs text-muted-foreground/70">
              {stage.reason}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasUnreadAgents && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => void markAllAgentsSeen(sessionId)}
            >
              <CheckCheck size={13} aria-hidden />
              Mark all seen
            </Button>
          )}
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
        <div className="group/goal flex items-start gap-2">
          <h1 className="text-balance text-xl font-semibold leading-snug text-foreground">
            {session.goal || 'Untitled session'}
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
      )}
      {done !== '' ? (
        <p
          aria-label="Definition of done"
          className="text-sm leading-relaxed text-muted-foreground"
        >
          {done}
        </p>
      ) : null}
      {pullRequest != null ? <PrStatusLine pr={pullRequest} sessionId={sessionId} /> : null}
      <div className="flex flex-wrap items-center gap-2">
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
        <SummarizerBadge sessionId={sessionId} />
        <span className="text-2xs text-muted-foreground/70">
          {formatAdaptiveAge({ iso: session.createdAt })}
        </span>
      </div>
    </div>
  );
};
