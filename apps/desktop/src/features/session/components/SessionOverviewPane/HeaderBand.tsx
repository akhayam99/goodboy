import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Input, Tooltip } from '@goodboy/ui';
import type { Session, SessionId, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { EditorMenu } from './EditorMenu';
import { SessionDestructiveActions } from './SessionDestructiveActions';
import { LinkIssueAction } from './LinkIssueAction';
import { ContextChip } from './ContextChip';
import { LinkedWorkChips } from './LinkedWorkChips';
import { MountProjectAction } from './ProjectMountRows/MountProjectAction';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { InlineMarkdown } from '../../../../shared/components/InlineMarkdown';
import { ProjectMountRows } from './ProjectMountRows';
import { SessionCostChip } from './SessionCostChip';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
  readonly goal: ReactNode;
};

const ICON_BUTTON =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

export const HeaderBand = ({ session, onSelectLens, goal }: Props) => {
  const sessionId = session.id as SessionId;
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  const pendingTitleFocus = useAppStore((s) => s.pendingTitleFocusSessionId);
  const clearPendingTitleFocus = useAppStore((s) => s.clearPendingTitleFocus);
  const setScriptsLensScope = useAppStore((s) => s.setScriptsLensScope);
  const hasLinkedWork = useAppStore((s) => {
    const linkedIssues = s.sessionGithub[sessionId]?.linkedIssues ?? EMPTY_ARRAY;
    const externalTasks = s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY;
    return linkedIssues.length > 0 || externalTasks.length > 0;
  });
  const hasRepoMount = useAppStore((s) => {
    const mounts =
      s.sessionProjectMounts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionProjectMount>);
    return mounts.some((mount) =>
      s.projects.some((project) => project.id === mount.projectId && project.kind === 'repo'),
    );
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

  const openScripts = () => {
    setScriptsLensScope({ scope: null });
    onSelectLens('scripts');
  };

  return (
    <div className="flex flex-col gap-3">
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
              <InlineMarkdown text={goalText} />
            </h1>
          </Tooltip>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content="Scripts (⌘⌥S)">
            <button
              type="button"
              aria-label="Scripts"
              onClick={openScripts}
              className={ICON_BUTTON}
            >
              <CONCEPT_ICONS.scripts size={ICON_SIZE.row} aria-hidden />
            </button>
          </Tooltip>
          {hasRepoMount ? null : <EditorMenu sessionId={sessionId} density="compact" />}
          <MountProjectAction sessionId={sessionId} workspaceId={session.workspaceId} />
          <SessionDestructiveActions session={session} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ContextChip sessionId={sessionId} onSelectLens={onSelectLens} />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <LinkedWorkChips sessionId={sessionId} onSelectLens={onSelectLens} />
          <LinkIssueAction session={session} presentation="chip" isCollapsed={hasLinkedWork} />
          <SessionCostChip sessionId={sessionId} />
        </div>
      </div>
      <ProjectMountRows session={session} onSelectLens={onSelectLens} />
      {goal}
    </div>
  );
};
