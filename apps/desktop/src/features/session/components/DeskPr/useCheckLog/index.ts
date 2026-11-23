import { useEffect, useState } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { useSessionRepo } from '../../../../../store/slices/worktrees/useSessionRepo';
import { fetchFailedCheckLog } from '../../../../branch/checks/fetchFailedCheckLog';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly name: string | null;
  readonly url: string | null;
};

type ReadLog = {
  readonly key: string;
  readonly text: string | null;
};

export type CheckLog = {
  readonly isReading: boolean;
  readonly text: string | null;
};

export const useCheckLog = ({ sessionId, mountId, name, url }: Params): CheckLog => {
  const repo = useSessionRepo({ sessionId, mountId });
  const workspaceId = useAppStore((state) => sessionById(state.sessions, sessionId)?.workspaceId);
  const cwd = repo?.worktreePath ?? null;
  const projectId = repo?.projectId ?? null;
  const key = `${name ?? ''}\n${url ?? ''}`;
  const [read, setRead] = useState<ReadLog | null>(null);

  useEffect(() => {
    if (name === null || cwd === null || projectId === null || workspaceId === undefined) {
      return;
    }
    let isCurrent = true;
    void fetchFailedCheckLog({
      check: { name, conclusion: 'failure', detailsUrl: url, durationMs: null },
      cwd,
      workspaceId,
      projectId,
    }).then((text) => {
      if (isCurrent) {
        setRead({ key, text });
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [key, name, url, cwd, projectId, workspaceId]);

  if (name === null || cwd === null || projectId === null || workspaceId === undefined) {
    return { isReading: false, text: null };
  }
  return read?.key === key
    ? { isReading: false, text: read.text }
    : { isReading: true, text: null };
};
