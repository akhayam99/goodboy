import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Input, StatusDot, Tooltip } from '@goodboy/ui';
import type { Session, SessionId, SessionStageInfo } from '@goodboy/types';
import { useAppStore, useCurrentWorkspace } from '../../../../store';
import type { LensKind } from '../../../../store';
import { SESSION_STAGE_META, STAGE_TONE } from '../../session-stage';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { SummarizerBadge } from '../SummarizerBadge';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { EditorMenu } from './EditorMenu';
import { SessionGitActions } from '../SessionWorkspace/parts/SessionGitActions';
import { SessionDestructiveActions } from './SessionDestructiveActions';
import { BranchChip } from './BranchChip';
import { LinkIssueAction } from './LinkIssueAction';
import { ScopeSummary } from './ScopeSummary';
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
  const pendingTitleFocus = useAppStore((s) => s.pendingTitleFocusSessionId);
  const clearPendingTitleFocus = useAppStore((s) => s.clearPendingTitleFocus);
  const titleFieldRef = useRef<HTMLDivElement | null>(null);
  const selectOnEditRef = useRef(false);
  const startRenameRef = useRef(rename.start);
  startRenameRef.current = rename.start;

  useEffect(() => {
    if (pendingTitleFocus !== sessionId) {
      return;
    }
    clearPendingTitleFocus();
    selectOnEditRef.current = true;
    startRenameRef.current();
  }, [pendingTitleFocus, sessionId, clearPendingTitleFocus]);

  useEffect(() => {
    if (!rename.editing || !selectOnEditRef.current) {
      return;
    }
    selectOnEditRef.current = false;
    titleFieldRef.current?.querySelector('input')?.select();
  }, [rename.editing]);

  const workspace = useCurrentWorkspace();
  const repo = useAppStore(useShallow((state) => resolveSessionRepo({ state, sessionId })));
  const storedBranch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const branch = repo != null && repo.mountName != null ? repo.branch : storedBranch;
  const goalText = session.goal === '' ? 'Untitled session' : session.goal;
  const reasonVisible = stage.reason !== '' && !REASON_HIDDEN.has(stage.reason);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {rename.editing ? (
          <div ref={titleFieldRef} className="flex min-w-0 flex-1 flex-col gap-1">
            <Input
              autoFocus
              value={rename.draft}
              maxLength={rename.maxLength}
              onChange={(e) => rename.setDraft(e.target.value)}
              onBlur={() => void rename.commit()}
              onKeyDown={rename.onKeyDown}
              aria-label="Session title"
              className="text-xl font-semibold"
            />
            {rename.error != null ? (
              <span className="text-2xs text-danger">{rename.error}</span>
            ) : null}
          </div>
        ) : (
          <Tooltip content="Click to rename">
            <h1
              role="button"
              tabIndex={0}
              onClick={rename.start}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return;
                }
                event.preventDefault();
                rename.start();
              }}
              className="min-w-0 flex-1 cursor-text truncate rounded-md text-xl font-semibold leading-snug text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
              {goalText}
            </h1>
          </Tooltip>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <LinkIssueAction session={session} />
          <EditorMenu sessionId={sessionId} density="compact" />
          <SessionGitActions session={session} density="compact" />
          <SessionDestructiveActions session={session} />
        </div>
      </div>
      <div className="flex items-center gap-2">
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
          <SummarizerBadge sessionId={sessionId} />
          <SessionCostChip sessionId={sessionId} />
          {branch != null ? (
            <BranchChip
              branch={branch}
              mountName={repo?.mountName ?? null}
              sessionId={sessionId}
              canEdit={workspace != null && !isBranchlessSession({ branch })}
            />
          ) : null}
          <ScopeSummary
            sessionId={sessionId}
            workspaceId={session.workspaceId}
            onSelectLens={onSelectLens}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LinkedWorkChips sessionId={sessionId} onSelectLens={onSelectLens} />
          <StatusRowRequest sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
};
