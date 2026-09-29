import type { ChatSessionLink, Session, SessionStage } from '@goodboy/types';

export type ChatSessionEntry = {
  readonly link: ChatSessionLink;
  readonly session: Session;
  readonly stage: SessionStage;
};

type Params = {
  readonly links: ReadonlyArray<ChatSessionLink>;
  readonly sessions: ReadonlyArray<Session>;
  readonly stages: Readonly<Record<string, SessionStage>>;
};

const URGENCY: Record<SessionStage, number> = {
  attention: 4,
  running: 3,
  review: 2,
  building: 1,
  done: 0,
};

export const chatSessionEntries = ({
  links,
  sessions,
  stages,
}: Params): ReadonlyArray<ChatSessionEntry> => {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  return links.flatMap((link): ReadonlyArray<ChatSessionEntry> => {
    const session = byId.get(link.sessionId);
    if (session === undefined || session.deletedAt !== undefined) {
      return [];
    }
    return [{ link, session, stage: stages[session.id] ?? 'building' }];
  });
};

export const mostUrgentStage = ({
  entries,
}: {
  readonly entries: ReadonlyArray<ChatSessionEntry>;
}): SessionStage | null =>
  entries.reduce<SessionStage | null>(
    (urgent, entry) =>
      urgent === null || URGENCY[entry.stage] > URGENCY[urgent] ? entry.stage : urgent,
    null,
  );
