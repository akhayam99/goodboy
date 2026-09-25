import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import {
  Checkbox,
  InteractiveRow,
  WORK_META_COLUMN,
  WORK_NODE_GLYPH_SIZE,
  WORK_ROW,
  WorkNode,
  cn,
  inlineMarkdownText,
  tintClasses,
} from '@goodboy/ui';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';
import { RESOLVE_COMMENT_UNAVAILABLE, resolveSelectLabel } from '../../resolveQueueCopy';
import { heldBackChipLabel } from '../../resolvePublishCopy';
import type { HeldBackKind } from '../../heldBackByThreadId';
import type { ResolveUiState } from '../../resolveRowState';
import { firstSentence } from './firstSentence';

type Props = {
  readonly row: ResolveQueueRow;
  readonly isSelected: boolean;
  readonly isChecked: boolean;
  readonly onToggleChecked: ((isChecked: boolean) => void) | null;
  readonly heldBack: HeldBackKind | null;
  readonly onOpen: () => void;
  readonly action: ReactNode;
};

const SENTENCE_TONE: Record<ResolveUiState, string> = {
  new: 'text-muted-foreground',
  working: tintClasses('info').text,
  needs_you: tintClasses('warning').text,
  ready: tintClasses('warning').text,
  approved: 'text-muted-foreground',
  resolved: 'text-muted-foreground',
  failed: tintClasses('danger').text,
  later: 'text-faint-foreground',
};

export const ConversationRow = ({
  row,
  isSelected,
  isChecked,
  onToggleChecked,
  heldBack,
  onOpen,
  action,
}: Props) => {
  const note = row.reviewerNote;
  const body = note === null ? null : inlineMarkdownText({ text: note.body });
  const title = body === null ? RESOLVE_COMMENT_UNAVAILABLE : firstSentence({ text: body });
  const sentence = row.rowState.sentence;
  const isCheckable = onToggleChecked !== null;
  return (
    <InteractiveRow
      label={body ?? RESOLVE_COMMENT_UNAVAILABLE}
      isSelected={isSelected}
      onOpen={onOpen}
      dataAttributes={{ 'data-thread-id': row.thread.threadId }}
      frameClassName={cn(WORK_ROW.container, 'group/conversation')}
      className="flex min-h-10 min-w-0 items-center gap-2.5 px-2 py-1.5"
    >
      <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
        <span
          className={cn(
            'inline-flex',
            isCheckable && 'group-hover/conversation:invisible',
            isCheckable && isChecked && 'invisible',
          )}
        >
          <WorkNode
            state={row.rowState.node}
            label={sentence ?? row.status}
            mark={
              row.status === 'approved'
                ? {
                    kind: 'glyph',
                    glyph: (
                      <Check
                        size={WORK_NODE_GLYPH_SIZE}
                        className="text-faint-foreground"
                        aria-hidden
                      />
                    ),
                  }
                : { kind: 'dot' }
            }
          />
        </span>
        {isCheckable && (
          <Checkbox
            checked={isChecked}
            onChange={onToggleChecked}
            ariaLabel={resolveSelectLabel({ body: title })}
            className={cn(
              'pointer-events-auto absolute inset-0 items-center justify-center',
              isChecked ? 'flex' : 'hidden group-hover/conversation:flex',
            )}
          />
        )}
      </span>
      {note !== null && (
        <span
          aria-hidden
          title={note.author}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-subtle text-3xs font-medium uppercase text-muted-foreground"
        >
          {note.author.charAt(0)}
        </span>
      )}
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          className={cn(WORK_ROW.title, 'min-w-0 truncate text-sm leading-5 text-foreground')}
          title={body ?? undefined}
        >
          {title}
        </span>
        {note?.line != null && (
          <span className="shrink-0 font-mono text-2xs text-faint-foreground">:{note.line}</span>
        )}
        {heldBack !== null && (
          <span className={cn(WORK_ROW.state, 'shrink-0 text-2xs text-warning')}>
            {heldBackChipLabel({ kind: heldBack })}
          </span>
        )}
        {sentence !== null && (
          <span
            className={cn(
              WORK_ROW.state,
              'min-w-0 shrink-0 truncate text-xs leading-4',
              SENTENCE_TONE[row.status],
            )}
          >
            {sentence}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-2xs leading-4 tabular-nums text-muted-foreground">
        <span className={WORK_META_COLUMN.time}>
          {note === null
            ? ''
            : formatRelativeAge({ fromIso: new Date(note.createdAtMs).toISOString() })}
        </span>
      </span>
      <span className={cn(WORK_META_COLUMN.action, 'pointer-events-auto')}>{action}</span>
    </InteractiveRow>
  );
};
