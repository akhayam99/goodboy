import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Input, Tooltip } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { EditorMenu } from './EditorMenu';
import { LensShortcutActions } from './LensShortcutActions';
import { SessionGitActions } from '../SessionWorkspace/parts/SessionGitActions';
import { SessionDestructiveActions } from './SessionDestructiveActions';
import { LinkIssueAction } from './LinkIssueAction';
import { MountChangesChip } from './MountChangesChip';
import { ProjectChip } from './ProjectChip';
import { BranchChip } from './BranchChip';
import { BranchSyncStatus } from './BranchSyncStatus';
import { ContextChip } from './ContextChip';
import { StatusRowRequest } from './StatusRowRequest';
import { LinkedWorkChips } from './LinkedWorkChips';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
  readonly goal: ReactNode;
};

export const HeaderBand = ({ session, onSelectLens, goal }: Props) => {
  const sessionId = session.id as SessionId;
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  const pendingTitleFocus = useAppStore((s) => s.pendingTitleFocusSessionId);
  const clearPendingTitleFocus = useAppStore((s) => s.clearPendingTitleFocus);
  const hasProjects = useAppStore((s) =>
    s.projects.some((project) => project.workspaceId === session.workspaceId),
  );
  const hasLinkedWork = useAppStore((s) => {
    const linkedIssues = s.sessionGithub[sessionId]?.linkedIssues ?? EMPTY_ARRAY;
    const externalTasks = s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY;
    return linkedIssues.length > 0 || externalTasks.length > 0;
  });
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

  const goalText = session.goal === '' ? 'Untitled session' : session.goal;

  return (
    <div className="flex flex-col gap-2.5">
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
          <EditorMenu sessionId={sessionId} density="compact" />
          <LensShortcutActions onSelectLens={onSelectLens} />
          <SessionDestructiveActions session={session} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ContextChip sessionId={sessionId} onSelectLens={onSelectLens} />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <LinkedWorkChips sessionId={sessionId} onSelectLens={onSelectLens} />
          <LinkIssueAction session={session} presentation="chip" isCollapsed={hasLinkedWork} />
        </div>
      </div>
      {hasProjects ? (
        <div className="flex flex-wrap items-center gap-2">
          <ProjectChip
            sessionId={sessionId}
            workspaceId={session.workspaceId}
            onSelectLens={onSelectLens}
          />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <BranchSyncStatus sessionId={sessionId} />
            <BranchChip sessionId={sessionId} />
            <SessionGitActions session={session} density="compact" />
            <MountChangesChip sessionId={sessionId} />
            <StatusRowRequest sessionId={sessionId} />
          </div>
        </div>
      ) : null}
      {goal}
    </div>
  );
};
