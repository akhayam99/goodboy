import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ChatId, Session, SessionStage } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../session/session-stage';
import { sessionTitle } from '../../../session/sessionTitle';
import { useAppStore, useSessionStages } from '../../../../store';

export type ChatSessionEntry = {
  readonly sessionId: string;
  readonly title: string;
  readonly stage: SessionStage;
  readonly stageLabel: string;
};

export type ChatSessionMarker = {
  readonly count: number;
  readonly tone: Tone;
  readonly isPulsing: boolean;
  readonly entries: ReadonlyArray<ChatSessionEntry>;
};

type Params = {
  readonly chatId: ChatId;
};

const NO_SESSIONS: ReadonlyArray<Session> = [];

const URGENCY: ReadonlyArray<SessionStage> = ['attention', 'running', 'review', 'building', 'done'];

const urgencyOf = (stage: SessionStage): number => URGENCY.indexOf(stage);

export const useChatSessionMarker = ({ chatId }: Params): ChatSessionMarker | null => {
  const links = useAppStore((state) => state.chatLinks[chatId]);
  const sessions = useAppStore(
    useShallow((state) => {
      if (links === undefined || links.length === 0) {
        return NO_SESSIONS;
      }
      const ids = new Set<string>(links.map((link) => link.sessionId));
      return state.sessions.filter(
        (session) => ids.has(session.id) && session.deletedAt === undefined,
      );
    }),
  );
  const stages = useSessionStages(sessions);
  return useMemo(() => {
    if (sessions.length === 0) {
      return null;
    }
    const entries = sessions
      .map<ChatSessionEntry>((session) => {
        const stage = stages[session.id] ?? 'building';
        return {
          sessionId: session.id,
          title: sessionTitle({ session }),
          stage,
          stageLabel: SESSION_STAGE_META[stage].label,
        };
      })
      .sort((a, b) => urgencyOf(a.stage) - urgencyOf(b.stage));
    const lead = entries[0];
    if (lead === undefined) {
      return null;
    }
    return {
      count: entries.length,
      tone: STAGE_TONE[lead.stage],
      isPulsing: lead.stage === 'running',
      entries,
    };
  }, [sessions, stages]);
};
