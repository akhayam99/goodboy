import { useState } from 'react';
import { Button, Tooltip } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { hasSessionDraftContent } from '../../../../store/slices/sessionDraft/hasSessionDraftContent';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onDiscarded: () => void;
};

const START_BLANK_HINT = 'Create the session now. Set the goal and the rest on its Overview.';

export const SessionDraftHeader = ({ workspaceId, onDiscarded }: Props) => {
  const hasContent = useAppStore((state) =>
    hasSessionDraftContent({ draft: selectSessionDraft({ state, workspaceId }) }),
  );
  const discardSessionDraft = useAppStore((state) => state.discardSessionDraft);
  const startBlankSession = useAppStore((state) => state.startBlankSession);
  const reportError = useAppStore((state) => state.reportError);
  const [isStarting, setIsStarting] = useState(false);

  const startBlank = async () => {
    if (isStarting) {
      return;
    }
    setIsStarting(true);
    try {
      await startBlankSession({ workspaceId });
    } catch (error) {
      setIsStarting(false);
      void reportError({ severity: 'error', title: "Couldn't create the session", error });
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="min-w-0 flex-1 truncate text-title text-faint-foreground">New session</h1>
      {hasContent ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            discardSessionDraft({ workspaceId });
            onDiscarded();
          }}
        >
          Discard draft
        </Button>
      ) : null}
      <Tooltip content={START_BLANK_HINT}>
        <Button
          variant="secondary"
          size="sm"
          isBusy={isStarting}
          busyLabel="Creating the session"
          onClick={() => void startBlank()}
          className="gap-1.5"
        >
          <CONCEPT_ICONS.goal size={ICON_SIZE.row} aria-hidden />
          Start blank
        </Button>
      </Tooltip>
    </div>
  );
};
