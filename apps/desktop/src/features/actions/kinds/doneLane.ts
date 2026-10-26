import type { Session, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { runningAgentCountOf } from '../../../store/runtime/live-work/runningAgentCountOf';
import { inactivityInputsOf } from '../../../store/slices/session-view/inactivityInputsOf';
import { sessionLastActivityMs } from '../../../store/slices/session-view/sessionInactivityOf';
import { archiveConfirmOf } from '../../session/archiveConfirmOf';
import { archiveSessions } from '../../session/sessionArchive';
import type { ActionDefinition, DoneLaneActionTarget, ObjectKindDefinition } from '../types';
import { doneLaneArchivesOf, type DoneLaneArchive } from './doneLaneArchivesOf';
import { lifecyclePortsOf } from './lifecyclePortsOf';

type ArchiveId = DoneLaneArchive['id'];

export type DoneLaneFacts = {
  readonly allSessions: ReadonlyArray<Session>;
  readonly allLabel: string;
  readonly allBlockedReason: string | null;
  readonly allRunningAgentCount: number;
  readonly olderSessions: ReadonlyArray<Session>;
  readonly olderLabel: string;
  readonly olderBlockedReason: string | null;
  readonly olderRunningAgentCount: number;
};

type ArchiveFacts = {
  readonly sessions: ReadonlyArray<Session>;
  readonly label: string;
  readonly blockedReason: string | null;
  readonly runningAgentCount: number;
};

type RunningParams = {
  readonly archive: DoneLaneArchive;
};

type PickParams = {
  readonly facts: DoneLaneFacts;
  readonly id: ArchiveId;
};

const pick = ({ facts, id }: PickParams): ArchiveFacts =>
  id === 'all'
    ? {
        sessions: facts.allSessions,
        label: facts.allLabel,
        blockedReason: facts.allBlockedReason,
        runningAgentCount: facts.allRunningAgentCount,
      }
    : {
        sessions: facts.olderSessions,
        label: facts.olderLabel,
        blockedReason: facts.olderBlockedReason,
        runningAgentCount: facts.olderRunningAgentCount,
      };

type ArchiveActionParams = {
  readonly id: ArchiveId;
  readonly actionId: string;
};

const archiveAction = ({ id, actionId }: ArchiveActionParams): ActionDefinition<DoneLaneFacts> => ({
  id: actionId,
  label: ({ facts }) => pick({ facts, id }).label,
  icon: CONCEPT_ICONS.archive,
  group: 'danger',
  isUndoable: true,
  when: () => true,
  blockedReason: ({ facts }) => pick({ facts, id }).blockedReason,
  confirm: ({ facts }) =>
    archiveConfirmOf({
      sessionCount: pick({ facts, id }).sessions.length,
      runningAgentCount: pick({ facts, id }).runningAgentCount,
    }),
  run: async ({ facts, env }) => {
    const { sessions } = pick({ facts, id });
    const { failed } = await archiveSessions({ sessions, ...lifecyclePortsOf({ env }) });
    if (failed.length > 0) {
      throw new Error(
        `Couldn't archive everything. ${failed.length} of ${sessions.length} stay in Done.`,
      );
    }
  },
});

export const DONE_LANE_KIND: ObjectKindDefinition<DoneLaneActionTarget, DoneLaneFacts> = {
  noun: 'done sessions',
  facts: ({ state, target }) => {
    const wanted = new Set<SessionId>(target.sessionIds);
    const sessions = state.sessions.filter((session) => wanted.has(session.id));
    const byId = new Map<SessionId, Session>(sessions.map((session) => [session.id, session]));
    const archives = doneLaneArchivesOf({
      sessions,
      nowMs: Date.now(),
      lastActivityMsOf: ({ sessionId }) => {
        const session = byId.get(sessionId);
        return session === undefined
          ? null
          : sessionLastActivityMs({
              session,
              seenActivityAt: inactivityInputsOf({ state, sessionId }).seenActivityAt,
            });
      },
    });
    const all = archives.find((archive) => archive.id === 'all');
    const older = archives.find((archive) => archive.id === 'older');
    if (all === undefined || older === undefined) {
      return null;
    }
    const runningIn = ({ archive }: RunningParams): number =>
      archive.sessions.reduce(
        (total, session) => total + runningAgentCountOf({ state, sessionId: session.id }),
        0,
      );
    return {
      allSessions: all.sessions,
      allLabel: all.label,
      allBlockedReason: all.blockedReason,
      allRunningAgentCount: runningIn({ archive: all }),
      olderSessions: older.sessions,
      olderLabel: older.label,
      olderBlockedReason: older.blockedReason,
      olderRunningAgentCount: runningIn({ archive: older }),
    };
  },
  actions: [
    archiveAction({ id: 'all', actionId: 'doneLane.archiveAll' }),
    archiveAction({ id: 'older', actionId: 'doneLane.archiveOlder' }),
  ],
};
