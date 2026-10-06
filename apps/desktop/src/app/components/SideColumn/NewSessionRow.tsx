import { Plus } from 'lucide-react';
import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { requestNewSession } from '../../../features/session/requestNewSession';
import { selectSessionDraft } from '../../../store/slices/sessionDraft/selectSessionDraft';
import { hasSessionDraftContent } from '../../../store/slices/sessionDraft/hasSessionDraftContent';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isCurrent: boolean;
  readonly onNavigate?: () => void;
};

const DRAFT_IN_PROGRESS = 'Draft in progress';
const PRIMARY = tintClasses('primary');

export const NewSessionRow = ({ workspaceId, isCurrent, onNavigate }: Props) => {
  const hasDraft = useAppStore((state) =>
    hasSessionDraftContent({ draft: selectSessionDraft({ state, workspaceId }) }),
  );
  const isDraftWaiting = hasDraft && !isCurrent;

  const row = (
    <button
      type="button"
      data-column-door="new"
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={isDraftWaiting ? `New session, ${DRAFT_IN_PROGRESS}` : 'New session'}
      onClick={() => {
        requestNewSession();
        onNavigate?.();
      }}
      className={cn(
        'group relative flex h-7 w-full min-w-0 shrink-0 items-center gap-2 rounded-md px-2 text-row text-foreground ring-1 ring-inset motion-safe:transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        PRIMARY.ring,
        isCurrent ? 'bg-selected' : cn(PRIMARY.bg, PRIMARY.hoverBg),
      )}
    >
      <Plus size={ICON_SIZE.control} aria-hidden className={cn('shrink-0', PRIMARY.icon)} />
      <span className="min-w-0 flex-1 truncate text-left">New session</span>
      {isDraftWaiting ? (
        <span
          aria-hidden
          data-slot="draft-dot"
          className="size-1.5 shrink-0 rounded-full bg-primary"
        />
      ) : null}
      <span
        aria-hidden
        className="shrink-0 text-chip text-faint-foreground opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {shortcutGlyphs('session.new')}
      </span>
    </button>
  );

  return isDraftWaiting ? (
    <Tooltip content={DRAFT_IN_PROGRESS} side="right">
      {row}
    </Tooltip>
  ) : (
    row
  );
};
