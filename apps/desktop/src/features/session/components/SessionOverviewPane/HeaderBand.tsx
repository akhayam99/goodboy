import { Input, Tooltip, InlineMarkdown, inlineMarkdownText } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { sessionTitle } from '../../sessionTitle';
import { SessionDestructiveActions } from './SessionDestructiveActions';
import { SessionRefreshAction } from './SessionRefreshAction';
import { LinkIssueAction } from './LinkIssueAction';
import { ContextChip } from './ContextChip';
import { GoalTeaser } from './GoalTeaser';
import { LinkedWorkChips } from './LinkedWorkChips';
import { ArtifactsChip } from './ArtifactsChip';
import { ChatOriginRow } from './ChatOriginRow';
import { SessionCostChip } from './SessionCostChip';
import { ArchivedRestore } from './ArchivedRestore';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { SESSION_HEADER_ANCHOR, sessionObjectKey } from '../../../actions/kinds/session';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const HeaderBand = ({ session, onSelectLens }: Props) => {
  const isArchived = session.archivedAt != null;
  const sessionId = session.id as SessionId;
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  useRenameRequest({
    objectKey: sessionObjectKey({ sessionId }),
    anchorKeys: [null, SESSION_HEADER_ANCHOR],
    onRename: rename.start,
  });
  const titleText = sessionTitle({ session });
  const isNamedByGoodboy = useAppStore(
    (s) => s.goodboyNamedSessionId === sessionId && !session.titleUserEdited,
  );

  return (
    <div className="flex min-w-0 flex-col gap-2">
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
          {isArchived ? null : <SessionRefreshAction sessionId={sessionId} />}
          <SessionDestructiveActions session={session} />
        </div>
      </div>
      <ChatOriginRow session={session} />
      <GoalTeaser session={session} />
      <div aria-label="Session facts" className="flex min-w-0 flex-wrap items-center gap-2">
        {isArchived ? <ArchivedRestore session={session} /> : null}
        <ContextChip sessionId={sessionId} />
        <ArtifactsChip sessionId={sessionId} onSelectLens={onSelectLens} />
        <LinkedWorkChips sessionId={sessionId} onSelectLens={onSelectLens} />
        {isArchived ? null : <LinkIssueAction session={session} />}
        <SessionCostChip sessionId={sessionId} />
      </div>
    </div>
  );
};
