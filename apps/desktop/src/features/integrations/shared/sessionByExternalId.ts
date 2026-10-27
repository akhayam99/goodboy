import type { Session, SessionExternalTaskProvider, SessionId } from '@goodboy/types';
import { linkedTaskKey } from '../hooks/useLinkedExternalIds';

type IssueParams<TIssue> = {
  readonly issue: TIssue;
};

type MatchParams<TIssue> = {
  readonly issue: TIssue;
  readonly session: Session;
};

type Params<TIssue> = {
  readonly issues: ReadonlyArray<TIssue>;
  readonly sessions: ReadonlyArray<Session>;
  readonly linkedSessions: ReadonlyMap<string, SessionId>;
  readonly provider: SessionExternalTaskProvider;
  readonly externalIdOf: (params: IssueParams<TIssue>) => string;
  readonly isSessionOfIssue: (params: MatchParams<TIssue>) => boolean;
};

export const sessionByExternalId = <TIssue>({
  issues,
  sessions,
  linkedSessions,
  provider,
  externalIdOf,
  isSessionOfIssue,
}: Params<TIssue>): Map<string, SessionId> => {
  const byIssue = new Map<string, SessionId>();
  for (const issue of issues) {
    const externalId = externalIdOf({ issue });
    const linked = linkedSessions.get(linkedTaskKey({ provider, externalId }));
    if (linked !== undefined) {
      byIssue.set(externalId, linked);
      continue;
    }
    for (const session of sessions) {
      if (isSessionOfIssue({ issue, session })) {
        byIssue.set(externalId, session.id);
        break;
      }
    }
  }
  return byIssue;
};
