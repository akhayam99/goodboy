import type { Reminder } from '@goodboy/types';
import { sessionPlace } from '../../../store/slices/navigation/place';
import type { Place } from '../../../store/slices/navigation/types';
import type { AppState } from '../../../store/types';
import { selectSessionById } from '../../../store/slices/sessions/selectSessionById';
import { sessionTitle } from '../../../shared/utils/sessionTitle';
import { eventKindOf } from '../eventKindOf';
import { eventTitleOf } from '../eventTitleOf';
import { pullRequestOfReminderId } from './pullRequestOfReminderId';

export type ReminderOwner = Readonly<{
  reminder: Reminder;
  context: string | null;
  place: Place | null;
}>;

type Params = {
  readonly state: Pick<AppState, 'sessions' | 'archivedSessions' | 'calendarDay' | 'calendarRoles'>;
  readonly reminder: Reminder;
};

type SessionParams = Params & {
  readonly id: string;
};

const sessionOf = ({ state, id }: SessionParams) => selectSessionById(state, id);

export const reminderOwnerOf = ({ state, reminder }: Params): ReminderOwner => {
  const plain = { reminder, context: null, place: null };
  const { target } = reminder;
  if (target === null) {
    return plain;
  }
  if (target.kind === 'session') {
    const session = sessionOf({ state, reminder, id: target.id });
    return session === null
      ? plain
      : {
          reminder,
          context: sessionTitle({ session }),
          place: sessionPlace({ sessionId: session.id }),
        };
  }
  if (target.kind === 'pull_request') {
    const pr = pullRequestOfReminderId({ id: target.id });
    const session = pr === null ? null : sessionOf({ state, reminder, id: pr.sessionId });
    if (pr === null || session === null) {
      return plain;
    }
    return {
      reminder,
      context: sessionTitle({ session }),
      place: sessionPlace({
        sessionId: session.id,
        lens: 'branch',
        target: {
          kind: 'branch',
          mountId: pr.mountId,
          mountPath: null,
          tab: 'pr',
          threadId: null,
          focus: null,
        },
      }),
    };
  }
  const event = state.calendarDay?.events.find((candidate) => candidate.id === target.id);
  if (event === undefined) {
    return plain;
  }
  return {
    reminder,
    context: eventTitleOf({ event, kind: eventKindOf({ event, roles: state.calendarRoles }) }),
    place: null,
  };
};
