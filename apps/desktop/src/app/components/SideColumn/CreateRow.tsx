import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { requestNewSession } from '../../../features/session/requestNewSession';
import { selectSessionDraft } from '../../../store/slices/sessionDraft/selectSessionDraft';
import { hasSessionDraftContent } from '../../../store/slices/sessionDraft/hasSessionDraftContent';
import { CreateButton } from './CreateButton';
import type { ColumnActions } from './columnDoors';
import type { ColumnPlace } from './columnPlace';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly place: ColumnPlace;
  readonly actions: Pick<ColumnActions, 'openNewChat' | 'openNewTerminal'>;
  readonly onNavigate?: () => void;
};

const DRAFT_IN_PROGRESS = 'Draft in progress';

export const CreateRow = ({ workspaceId, place, actions, onNavigate }: Props) => {
  const hasDraft = useAppStore((state) =>
    hasSessionDraftContent({ draft: selectSessionDraft({ state, workspaceId }) }),
  );
  const isDraftWaiting = hasDraft && place !== 'new';

  return (
    <div data-column-create="" className="grid shrink-0 grid-cols-3 gap-1 px-2">
      <CreateButton
        id="session"
        label="Session"
        accessibleName={isDraftWaiting ? `New session, ${DRAFT_IN_PROGRESS}` : 'New session'}
        tooltip="New session"
        shortcut="session.new"
        isPrimary
        isCurrent={place === 'new'}
        hasDot={isDraftWaiting}
        onSelect={() => {
          requestNewSession();
          onNavigate?.();
        }}
      />
      <CreateButton
        id="chat"
        label="Chat"
        accessibleName="New chat"
        tooltip="New chat"
        shortcut="chat.new"
        onSelect={() => {
          actions.openNewChat();
          onNavigate?.();
        }}
      />
      <CreateButton
        id="terminal"
        label="Terminal"
        accessibleName="New terminal"
        tooltip="New terminal"
        onSelect={() => {
          actions.openNewTerminal();
          onNavigate?.();
        }}
      />
    </div>
  );
};
