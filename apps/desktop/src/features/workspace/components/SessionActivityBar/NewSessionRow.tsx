import { Plus } from 'lucide-react';
import { PANE_RHYTHM, ROW_INTERACTIVE, StatusDot, Tooltip, cn } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { selectIsSessionDraftShown } from '../../../../store/slices/sessionDraft/selectIsSessionDraftShown';
import { hasSessionDraftContent } from '../../../../store/slices/sessionDraft/hasSessionDraftContent';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { requestNewSession } from '../../../session/requestNewSession';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onNavigate?: () => void;
};

export const NewSessionRow = ({ workspaceId, onNavigate }: Props) => {
  const isCurrent = useAppStore((state) => selectIsSessionDraftShown({ state }));
  const hasDraft = useAppStore((state) =>
    hasSessionDraftContent({ draft: selectSessionDraft({ state, workspaceId }) }),
  );
  const isDraftWaiting = hasDraft && !isCurrent;

  return (
    <Tooltip content="New session" shortcut="session.new" side="right">
      <button
        type="button"
        data-create="session"
        aria-label={isDraftWaiting ? 'New session, Draft in progress' : 'New session'}
        aria-current={isCurrent ? 'page' : undefined}
        onClick={() => {
          requestNewSession();
          onNavigate?.();
        }}
        className={cn(
          PANE_RHYTHM.navRail.door,
          'flex w-full shrink-0 items-center gap-2 rounded-md text-left text-ui text-faint-foreground',
          ROW_INTERACTIVE,
          isCurrent && 'bg-selected text-foreground',
        )}
      >
        <span data-nav-icon="" className={PANE_RHYTHM.navRail.icon}>
          <Plus size={ICON_SIZE.row} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">New session</span>
        {isDraftWaiting ? (
          <span aria-hidden data-slot="draft-dot" className="flex shrink-0">
            <StatusDot tone="primary" size="sm" />
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
};
