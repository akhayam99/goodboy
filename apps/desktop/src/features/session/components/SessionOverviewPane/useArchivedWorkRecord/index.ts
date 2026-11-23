import { useEffect } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { READ_FAILED } from '../../../../../store/slices/notifications/errorRecovery';

type Params = {
  readonly session: Session;
};

export const useArchivedWorkRecord = ({ session }: Params): void => {
  const sessionId = session.id;
  const isArchived = session.archivedAt != null;
  const loadSessionWorkRecord = useAppStore((state) => state.loadSessionWorkRecord);
  const reportError = useAppStore((state) => state.reportError);
  useEffect(() => {
    if (!isArchived) {
      return;
    }
    loadSessionWorkRecord({ sessionId }).catch((error: unknown) => {
      void reportError({
        recovery: READ_FAILED,
        title: "Couldn't read the branches of this session",
        error,
        sessionId,
      });
    });
  }, [isArchived, loadSessionWorkRecord, reportError, sessionId]);
};
