import { useEffect, useState } from 'react';
import type { MountId, PrCheckRun, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { CheckLogReading } from '../../../../../store/slices/checks-log/types';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { actionsJobOf } from '../../../../suggestions/signals/actionsJobOf';
import { failingChecksOf } from '../../../checks/failingChecksOf';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly prNumber: number;
  readonly check: PrCheckRun;
  readonly isUnanalyzed: boolean;
};

type CheckLog = {
  readonly isReadable: boolean;
  readonly isShown: boolean;
  readonly reading: CheckLogReading | null;
  readonly toggle: () => void;
};

export const useCheckLog = ({
  sessionId,
  mountId,
  prNumber,
  check,
  isUnanalyzed,
}: Params): CheckLog => {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const isReadable = isUnanalyzed && actionsJobOf({ detailsUrl: check.detailsUrl }) !== null;
  const isFirstFailing = useAppStore(
    (state) =>
      failingChecksOf({ state, sessionId, mountId, prNumber })?.checks[0]?.name === check.name,
  );
  const reading = useAppStore((state) =>
    check.detailsUrl === null ? null : (state.checkLogs[check.detailsUrl] ?? null),
  );
  const readCheckLog = useAppStore((state) => state.readCheckLog);
  const isShown = isReadable && (isOpen ?? isFirstFailing);
  useEffect(() => {
    if (!isShown) {
      return;
    }
    const state = useAppStore.getState();
    const mount = (state.sessionProjectMounts[sessionId] ?? []).find(
      (candidate) => candidate.mountId === mountId,
    );
    const workspaceId = sessionById(state.sessions, sessionId)?.workspaceId ?? null;
    if (mount === undefined || workspaceId === null) {
      return;
    }
    void readCheckLog({ check, cwd: mount.worktreePath, workspaceId, projectId: mount.projectId });
  }, [check, isShown, mountId, readCheckLog, sessionId]);
  return { isReadable, isShown, reading, toggle: () => setIsOpen(!isShown) };
};
