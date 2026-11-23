import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { OpenQuestion, PullRequestChecks, Session, WorkspaceId } from '@goodboy/types';
import { useAppStore, useProjectFilteredSessions } from '../../../../../store';
import { stageInfosOf } from '../../../../../store/slices/session-view/stageInfosOf';
import { sessionTitle } from '../../../../../shared/utils/sessionTitle';
import { needsYouOf, type NeedsYou } from '../../needsYouOf';
import { readyToMergeOf, type ReadyRow } from '../../readyToMergeOf';
import { requestChecksOf } from '../../requestChecksOf';
import { useQueueSends, type PendingSend } from '../useQueueSends';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

export type QueueModel = Readonly<{
  sessions: ReadonlyArray<Session>;
  needsYou: NeedsYou;
  ready: ReadonlyArray<ReadyRow>;
  sessionTitles: ReadonlyMap<string, string>;
  pending: ReadonlyArray<PendingSend>;
}>;

export const useQueueModel = ({ workspaceId, sessions }: Params): QueueModel => {
  const shown = useProjectFilteredSessions({ workspaceId, sessions });
  const infos = useAppStore((state) => stageInfosOf({ state, sessions: shown }));
  const openQuestions = useAppStore(
    useShallow((state) => {
      const picked: Record<string, ReadonlyArray<OpenQuestion>> = {};
      for (const session of shown) {
        const questions = state.sessionOpenQuestions[session.id];
        if (questions !== undefined) {
          picked[session.id] = questions;
        }
      }
      return picked;
    }),
  );
  const numbers = useAppStore(
    useShallow((state) => {
      const picked: Record<string, number> = {};
      for (const session of shown) {
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
      for (const session of shown) {
        picked[session.id] = requestChecksOf({ state, sessionId: session.id });
      }
      return picked;
    }),
  );
  const pendingById = useQueueSends((state) => state.pending);
  const notNow = useQueueSends((state) => state.notNow);
  const pending = useMemo(() => Object.values(pendingById), [pendingById]);
  const needsYou = useMemo(
    () => needsYouOf({ sessions: shown, infos, openQuestions, notNow }),
    [infos, notNow, openQuestions, shown],
  );
  const ready = useMemo(
    () => readyToMergeOf({ sessions: shown, infos, numbers, checks }),
    [checks, infos, numbers, shown],
  );
  const sessionTitles = useMemo(
    () => new Map(shown.map((session) => [session.id, sessionTitle({ session })])),
    [shown],
  );
  return { sessions: shown, needsYou, ready, sessionTitles, pending };
};
