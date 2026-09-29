import { Plus } from 'lucide-react';
import { Button, KbdPill, Tooltip, cn } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { requestNewSession } from '../../../session/requestNewSession';
import { selectIsSessionDraftShown } from '../../../../store/slices/sessionDraft/selectIsSessionDraftShown';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { hasSessionDraftContent } from '../../../../store/slices/sessionDraft/hasSessionDraftContent';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const DRAFT_IN_PROGRESS = 'Draft in progress';

export const NewSessionButton = ({ workspaceId }: Props) => {
  const isDraftShown = useAppStore((state) => selectIsSessionDraftShown({ state }));
  const hasDraft = useAppStore((state) =>
    hasSessionDraftContent({ draft: selectSessionDraft({ state, workspaceId }) }),
  );
  const isDraftWaiting = hasDraft && !isDraftShown;

  const button = (
    <Button
      variant="secondary"
      size="sm"
      onClick={requestNewSession}
      aria-label={
        isDraftWaiting ? `Create new session, ${DRAFT_IN_PROGRESS}` : 'Create new session'
      }
      aria-pressed={isDraftShown}
      className={cn(
        'group relative min-w-0 flex-1 justify-center gap-1.5 px-2 text-label',
        isDraftShown && 'bg-selected',
      )}
    >
      {isDraftWaiting ? (
        <span
          aria-hidden
          data-slot="draft-dot"
          className="absolute left-2 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary"
        />
      ) : null}
      <Plus size={ICON_SIZE.row} aria-hidden />
      New
      <KbdPill
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-4 min-w-4 -translate-y-1/2 px-1 text-meta opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {shortcutGlyphs('session.new')}
      </KbdPill>
    </Button>
  );

  return isDraftWaiting ? <Tooltip content={DRAFT_IN_PROGRESS}>{button}</Tooltip> : button;
};
