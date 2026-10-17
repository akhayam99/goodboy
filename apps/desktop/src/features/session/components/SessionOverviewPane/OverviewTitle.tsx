import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { Session, SessionExternalTask } from '@goodboy/types';
import { InlineMarkdown, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { TitleField } from '../../../../shared/components/TitleField';
import { sessionRowTitle } from '../../sessionTitle';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';

const NO_TASKS: ReadonlyArray<SessionExternalTask> = [];

const TITLE_LINE = 'relative inline-flex max-w-full min-w-0 items-baseline gap-2';

type Props = {
  readonly session: Session;
};

export const OverviewTitle = ({ session }: Props) => {
  const sessionId = session.id;
  const tasks = useAppStore((state) => state.sessionExternalTasks[sessionId] ?? NO_TASKS);
  const rowTitle = sessionRowTitle({ session, tasks });
  const { keys, title } = rowTitle;
  const rename = useSessionTitleRename({ sessionId, goal: session.goal, ...rowTitle });
  const canRename = session.archivedAt == null;
  const titleRef = useRef<HTMLButtonElement>(null);
  const shouldRefocus = useRef(false);
  const keyLead =
    keys.length === 0 ? null : (
      <span data-session-key="" className="shrink-0 font-mono text-muted-foreground">
        {keys.join(' ')}
      </span>
    );

  useEffect(() => {
    if (rename.editing || !shouldRefocus.current) {
      return;
    }
    shouldRefocus.current = false;
    titleRef.current?.focus();
  }, [rename.editing]);

  if (rename.editing) {
    return (
      <TitleField
        density="title"
        ariaLabel="Session title"
        draft={rename.draft}
        maxLength={rename.maxLength}
        used={rename.used}
        limit={rename.limit}
        error={rename.error}
        lead={keyLead}
        onDraftChange={rename.setDraft}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          shouldRefocus.current = true;
          rename.onKeyDown(event);
        }}
        onBlur={() => {
          shouldRefocus.current = false;
          rename.onBlur();
        }}
      />
    );
  }

  const text = (
    <>
      {keyLead}
      <InlineMarkdown text={title} className="min-w-0 truncate" />
    </>
  );

  if (!canRename) {
    return (
      <span data-testid="overview-title" className={TITLE_LINE}>
        {text}
      </span>
    );
  }

  return (
    <button
      ref={titleRef}
      type="button"
      data-testid="overview-title"
      aria-keyshortcuts="Enter F2"
      onClick={rename.start}
      onKeyDown={(event) => {
        if (event.key !== 'F2') {
          return;
        }
        event.preventDefault();
        rename.start();
      }}
      className={cn(TITLE_LINE, 'group/title cursor-text text-left focus-visible:outline-none')}
    >
      {text}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded-full group-hover/title:bg-border-soft group-focus-visible/title:bg-focus-ring"
      />
    </button>
  );
};
