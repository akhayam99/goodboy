import { Input, Tooltip, InlineMarkdown, inlineMarkdownText } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { sessionTitle } from '../../sessionTitle';
import { SessionDestructiveActions } from './SessionDestructiveActions';
import { LinkIssueAction } from './LinkIssueAction';
import { ContextChip } from './ContextChip';
import { GoalTeaser } from './GoalTeaser';
import { LinkedWorkChips } from './LinkedWorkChips';
import { AttentionChips } from './AttentionChips';
import { ProjectMountRows } from './ProjectMountRows';
import { SessionCostChip } from './SessionCostChip';
import { ArchivedRestore } from './ArchivedRestore';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { SESSION_HEADER_ANCHOR, sessionObjectKey } from '../../../actions/kinds/session';

type Props = {
  readonly session: Session;
  readonly isSettingUp?: boolean;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const HeaderBand = ({ session, isSettingUp = false, onSelectLens }: Props) => {
  const isArchived = session.archivedAt != null;
  const sessionId = session.id as SessionId;
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  useRenameRequest({
    objectKey: sessionObjectKey({ sessionId }),
    anchorKeys: [null, SESSION_HEADER_ANCHOR],
    onRename: rename.start,
  });
  const hasLinkedWork = useAppStore((s) => {
    const linkedIssues = s.sessionGithub[sessionId]?.linkedIssues ?? EMPTY_ARRAY;
    const externalTasks = s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY;
    return linkedIssues.length > 0 || externalTasks.length > 0;
  });

  const titleText = sessionTitle({ session });
  const isNamedByGoodboy = useAppStore(
    (s) => s.goodboyNamedSessionId === sessionId && !session.titleUserEdited,
  );

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
              <div className="flex items-center justify-between gap-2 text-secondary">
                <span className="min-w-0 truncate text-danger">{rename.error ?? ''}</span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {rename.draft.length}/{rename.maxLength}
                </span>
              </div>
            </div>
          ) : (
            <h1 className="flex min-w-0 flex-1 text-title text-foreground">
              <Tooltip content="Click to rename">
                <button
                  type="button"
                  onClick={rename.start}
                  title={inlineMarkdownText({ text: titleText })}
                  className="line-clamp-2 min-w-0 flex-1 cursor-text rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <span key={titleText} className="motion-safe:animate-fade-in">
                    <InlineMarkdown text={titleText} />
                  </span>
                </button>
              </Tooltip>
            </h1>
          )}
          {isNamedByGoodboy && !rename.editing ? (
            <span className="shrink-0 text-secondary text-faint-foreground">Named by Goodboy</span>
          ) : null}
          <div className="flex shrink-0 items-center gap-1">
            <SessionDestructiveActions session={session} />
          </div>
        </div>
        {isSettingUp ? null : <GoalTeaser session={session} />}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-auto flex-wrap items-center gap-2">
            {isArchived ? <ArchivedRestore session={session} /> : null}
            <ContextChip sessionId={sessionId} />
            <AttentionChips sessionId={sessionId} onSelectLens={onSelectLens} />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <LinkedWorkChips sessionId={sessionId} onSelectLens={onSelectLens} />
            <LinkIssueAction session={session} presentation="chip" isCollapsed={hasLinkedWork} />
            <SessionCostChip sessionId={sessionId} />
          </div>
        </div>
      </div>
      <ProjectMountRows session={session} isHiddenWhenEmpty={isSettingUp} />
    </div>
  );
};
