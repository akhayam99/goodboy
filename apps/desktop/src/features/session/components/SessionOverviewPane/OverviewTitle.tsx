import { useEffect, useRef } from 'react';
import type { Session, SessionExternalTask } from '@goodboy/types';
import { InlineMarkdown, Input, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { sessionRowTitle } from '../../sessionTitle';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { overviewTitleHost } from '../../overviewTitleHost';
import { RenameStatus } from '../../../../shared/components/RenameStatus';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { SESSION_HEADER_ANCHOR, sessionObjectKey } from '../../../actions/kinds/session';

const NO_TASKS: ReadonlyArray<SessionExternalTask> = [];

type Props = {
  readonly session: Session;
};

export const OverviewTitle = ({ session }: Props) => {
  const sessionId = session.id;
  const tasks = useAppStore((state) => state.sessionExternalTasks[sessionId] ?? NO_TASKS);
  const { keys, title } = sessionRowTitle({ session, tasks });
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  const canRename = session.archivedAt == null;
  const startRef = useRef(rename.start);
  startRef.current = rename.start;

  useEffect(() => {
    if (!canRename) {
      return;
    }
    return overviewTitleHost.attach({ sessionId, start: () => startRef.current() });
  }, [canRename, sessionId]);

  useRenameRequest({
    objectKey: sessionObjectKey({ sessionId }),
    anchorKeys: canRename ? [SESSION_HEADER_ANCHOR, null, `sidebar:${sessionId}`] : [],
    onRename: rename.start,
  });

  if (rename.editing) {
    const hasError = rename.error !== null;
    return (
      <span className="flex min-w-0 items-center gap-3">
        <Input
          autoFocus
          size="md"
          value={rename.draft}
          maxLength={rename.maxLength}
          aria-label="Session title"
          aria-invalid={hasError}
          aria-busy={rename.isPending}
          readOnly={rename.isPending}
          onChange={(event) => rename.setDraft(event.target.value)}
          onKeyDown={rename.onKeyDown}
          onBlur={rename.onBlur}
          className={cn('min-w-0 flex-1 text-title', hasError && 'border-danger')}
        />
        <RenameStatus
          isPending={rename.isPending}
          error={rename.error}
          onRetry={() => void rename.commit()}
          className="max-w-[40%] shrink-0"
        />
      </span>
    );
  }

  return (
    <span
      data-testid="overview-title"
      className="flex min-w-0 items-baseline gap-2"
      onDoubleClick={canRename ? rename.start : undefined}
    >
      {keys.length === 0 ? null : (
        <span data-session-key="" className="shrink-0 font-mono text-muted-foreground">
          {keys.join(' ')}
        </span>
      )}
      <InlineMarkdown text={title} className="min-w-0 truncate" />
    </span>
  );
};
