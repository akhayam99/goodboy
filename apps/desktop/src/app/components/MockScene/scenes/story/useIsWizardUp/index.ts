import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../../store';

export const useIsWizardUp = (): boolean => {
  const draftWorkspaceId = useAppStore((state) => state.openSessionDraftWorkspaceId);
  const [hasHandedOff, setHasHandedOff] = useState(false);

  useEffect(() => {
    if (draftWorkspaceId !== null) {
      setHasHandedOff(true);
    }
  }, [draftWorkspaceId]);

  return draftWorkspaceId === null && !hasHandedOff;
};
