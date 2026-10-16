import { useState } from 'react';
import { Button, Tooltip } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const START_BLANK_HINT = 'Create the session now. Set the goal and the rest on its Overview.';

export const SessionDraftActions = ({ workspaceId }: Props) => {
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
    <Tooltip content={START_BLANK_HINT}>
      <Button
        variant="secondary"
        size="sm"
        isBusy={isStarting}
        busyLabel="Creating the session"
        onClick={() => void startBlank()}
        className="gap-2"
      >
        <CONCEPT_ICONS.goal size={ICON_SIZE.row} aria-hidden />
        Start blank
      </Button>
    </Tooltip>
  );
};
