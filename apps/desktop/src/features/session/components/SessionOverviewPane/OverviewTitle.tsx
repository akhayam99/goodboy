import type { Session, SessionExternalTask } from '@goodboy/types';
import { InlineMarkdown, Input, cn } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { sessionRowTitle } from '../../sessionTitle';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';

type Props = {
  readonly session: Session;
};

export const OverviewTitle = ({ session }: Props) => {
  const sessionId = session.id;
  const tasks = useAppStore(
    (state) =>
      state.sessionExternalTasks[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<SessionExternalTask>),
  );
  const { keys, title } = sessionRowTitle({ session, tasks });
  const rename = useSessionTitleRename({ sessionId, currentTitle: session.goal });
  const canRename = session.archivedAt == null;

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
          onChange={(event) => rename.setDraft(event.target.value)}
          onKeyDown={rename.onKeyDown}
          onBlur={rename.onBlur}
          className={cn('min-w-0 flex-1 text-title', hasError && 'border-danger')}
        />
        {hasError ? (
          <span role="alert" className="max-w-[40%] shrink-0 truncate text-meta text-danger">
            {rename.error}
          </span>
        ) : null}
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
        <span className="shrink-0 font-mono text-muted-foreground">{keys.join(' ')}</span>
      )}
      <InlineMarkdown text={title} className="min-w-0 truncate" />
    </span>
  );
};
