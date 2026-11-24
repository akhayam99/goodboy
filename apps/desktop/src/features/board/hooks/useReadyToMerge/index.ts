import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PullRequestChecks, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { stageInfosOf } from '../../../../store/slices/session-view/stageInfosOf';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { readyToMergeOf, type ReadyRow } from '../../mergeTrain/readyToMergeOf';
import { requestChecksOf } from '../../mergeTrain/requestChecksOf';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
};

type ReadyToMerge = Readonly<{
  ready: ReadonlyArray<ReadyRow>;
  sessionTitles: ReadonlyMap<string, string>;
}>;

export const useReadyToMerge = ({ sessions }: Params): ReadyToMerge => {
  const infos = useAppStore((state) => stageInfosOf({ state, sessions }));
  const numbers = useAppStore(
    useShallow((state) => {
      const picked: Record<string, number> = {};
      for (const session of sessions) {
        const number = state.sessionGithub[session.id]?.pr?.number;
        if (number !== undefined) {
          picked[session.id] = number;
        }
      }
      return picked;
    }),
  );
  const checks = useAppStore(
    useShallow((state) => {
      const picked: Record<string, PullRequestChecks> = {};
      for (const session of sessions) {
        picked[session.id] = requestChecksOf({ state, sessionId: session.id });
      }
      return picked;
    }),
  );
  const ready = useMemo(
    () => readyToMergeOf({ sessions, infos, numbers, checks }),
    [checks, infos, numbers, sessions],
  );
  const sessionTitles = useMemo(
    () => new Map(sessions.map((session) => [session.id, sessionTitle({ session })])),
    [sessions],
  );
  return { ready, sessionTitles };
};
