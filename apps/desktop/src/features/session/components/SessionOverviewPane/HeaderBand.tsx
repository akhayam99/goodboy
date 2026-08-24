import { useEffect, useRef } from 'react';
import { Input, Tooltip } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { EditorMenu } from './EditorMenu';
import { SessionGitActions } from '../SessionWorkspace/parts/SessionGitActions';
import { SessionDestructiveActions } from './SessionDestructiveActions';
import { LinkIssueAction } from './LinkIssueAction';
import { MountChangesChip } from './MountChangesChip';
import { ProjectScopeChip } from './ProjectScopeChip';
import { ContextChip } from './ContextChip';
import { StatusRowRequest } from './StatusRowRequest';
import { LinkedWorkChips } from './LinkedWorkChips';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const HeaderBand = ({ session, onSelectLens }: Props) => {
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

  const goalText = session.goal === '' ? 'Untitled session' : session.goal;

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
      <div className="flex flex-wrap items-center gap-2">
        <ProjectScopeChip
          sessionId={sessionId}
          workspaceId={session.workspaceId}
          onSelectLens={onSelectLens}
        />
        <MountChangesChip sessionId={sessionId} />
        <ContextChip sessionId={sessionId} onSelectLens={onSelectLens} />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <LinkedWorkChips sessionId={sessionId} onSelectLens={onSelectLens} />
          <StatusRowRequest sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
};
