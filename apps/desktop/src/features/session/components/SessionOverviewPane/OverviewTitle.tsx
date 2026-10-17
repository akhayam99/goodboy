import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { Session, SessionExternalTask } from '@goodboy/types';
import { InlineMarkdown, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { TitleField } from '../../../../shared/components/TitleField';
import { caretOffsetAt } from '../../../../shared/utils/caretOffsetAt';
import { sessionRowTitle } from '../../sessionTitle';
import { useSessionTitleRename } from '../../hooks/useSessionTitleRename';
import { overviewTitleHost } from '../../overviewTitleHost';
import { useRenameRequest } from '../../../actions/useRenameRequest';
import { SESSION_HEADER_ANCHOR, sessionObjectKey } from '../../../actions/kinds/session';

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
  const caretRef = useRef<number | null>(null);
  const startRef = useRef(rename.start);
  startRef.current = rename.start;
  const keyLead =
    keys.length === 0 ? null : (
      <span data-session-key="" className="shrink-0 font-mono text-muted-foreground">
        {keys.join(' ')}
      </span>
    );

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

  useEffect(() => {
    if (rename.editing) {
      caretRef.current = null;
      return;
    }
    if (!shouldRefocus.current) {
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
        canRetry={rename.canRetry}
        isPending={rename.isPending}
        onRetry={() => void rename.commit()}
        lead={keyLead}
        initialCaret={caretRef.current}
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
      onClick={(event) => {
        const offset =
          event.detail === 0
            ? null
            : caretOffsetAt({
                root: event.currentTarget,
                clientX: event.clientX,
                clientY: event.clientY,
              });
        const keysLength = keys.join(' ').length;
        caretRef.current = offset === null || offset < keysLength ? null : offset - keysLength;
        rename.start();
      }}
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
