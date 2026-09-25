import type { ReactNode } from 'react';
import { cn, Input, Tooltip, InlineMarkdown, inlineMarkdownText } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { sessionTitle } from '../../sessionTitle';
import { isUntitledSessionTitle } from '../../../../store/slices/sessions/untitledTitle';
import { SessionDestructiveActions } from './SessionDestructiveActions';
import { SessionActionsMenu } from './SessionActionsMenu';
import { LinkIssueAction } from './LinkIssueAction';
import { ContextChip } from './ContextChip';
import { ContextDigest } from './ContextDigest';
import { LinkedWorkChips } from './LinkedWorkChips';
import { AttentionChips } from './AttentionChips';
import { ProjectMountRows } from './ProjectMountRows';
import { SessionCostChip } from './SessionCostChip';
import { ArchivedRestore } from './ArchivedRestore';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
  readonly goal: ReactNode;
  readonly titleAction?: ReactNode;
  readonly isEmpty?: boolean;
};

export const HeaderBand = ({
  session,
  onSelectLens,
  goal,
  titleAction = null,
  isEmpty = false,
}: Props) => {
  const isArchived = session.archivedAt != null;
  const sessionId = session.id as SessionId;
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  const hasLinkedWork = useAppStore((s) => {
    const linkedIssues = s.sessionGithub[sessionId]?.linkedIssues ?? EMPTY_ARRAY;
    const externalTasks = s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY;
    return linkedIssues.length > 0 || externalTasks.length > 0;
  });

  const titleText = sessionTitle({ session });
  const isPlaceholderTitle = !session.titleUserEdited && isUntitledSessionTitle(session.goal);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {rename.editing ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1">
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
              <div className="flex items-center justify-between gap-2 text-2xs">
                <span className="min-w-0 truncate text-danger">{rename.error ?? ''}</span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {rename.draft.length}/{rename.maxLength}
                </span>
              </div>
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
                title={inlineMarkdownText({ text: titleText })}
                className={cn(
                  'line-clamp-2 min-w-0 flex-1 cursor-text rounded-md text-xl font-semibold leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                  isPlaceholderTitle ? 'text-faint-foreground' : 'text-foreground',
                )}
              >
                <InlineMarkdown text={titleText} />
              </h1>
            </Tooltip>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {isEmpty ? (
              <SessionActionsMenu session={session} />
            ) : (
              <>
                {titleAction}
                <SessionDestructiveActions session={session} />
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-auto flex-wrap items-center gap-2">
            {isArchived ? <ArchivedRestore session={session} /> : null}
            {isEmpty ? null : <ContextChip sessionId={sessionId} onSelectLens={onSelectLens} />}
            <AttentionChips sessionId={sessionId} onSelectLens={onSelectLens} />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <LinkedWorkChips sessionId={sessionId} onSelectLens={onSelectLens} />
            {isEmpty ? null : (
              <LinkIssueAction session={session} presentation="chip" isCollapsed={hasLinkedWork} />
            )}
            <SessionCostChip sessionId={sessionId} />
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {goal}
        <ContextDigest sessionId={sessionId} onSelectLens={onSelectLens} />
      </div>
      <ProjectMountRows session={session} onSelectLens={onSelectLens} />
    </div>
  );
};
