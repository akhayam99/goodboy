import { Copy, Mail, MailOpen } from 'lucide-react';
import type { Session } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { sessionTitle } from '../../../shared/utils/sessionTitle';
import { archiveSessions, restoreSessions } from '../../session/sessionArchive';
import { archiveConfirmOf } from '../../session/archiveConfirmOf';
import { runningAgentCountOf } from '../../../store/runtime/live-work/runningAgentCountOf';
import { unreadTargetOf } from '../../../store/slices/agents/unreadTargetOf';
import { sessionHasUnread } from '../../../store/slices/session-view/sessionHasUnread';
import type { ObjectKindDefinition, SessionsActionTarget } from '../types';
import { lifecyclePortsOf } from './lifecyclePortsOf';

export type SessionsFacts = {
  readonly sessions: ReadonlyArray<Session>;
  readonly active: ReadonlyArray<Session>;
  readonly archived: ReadonlyArray<Session>;
  readonly runningAgentCount: number;
  readonly unread: ReadonlyArray<Session>;
  readonly markable: ReadonlyArray<Session>;
};

const countLabel = ({ verb, count }: { readonly verb: string; readonly count: number }): string =>
  `${verb} ${count} ${count === 1 ? 'session' : 'sessions'}`;

type NotArchivedParams = {
  readonly failed: ReadonlyArray<Session>;
  readonly archivedCount: number;
};

const notArchivedMessage = ({ failed, archivedCount }: NotArchivedParams): string => {
  const names = failed.map((session) => sessionTitle({ session })).join(', ');
  if (archivedCount === 0) {
    return `Couldn't archive ${names}.`;
  }
  const rest = archivedCount === 1 ? 'The other one is' : `The other ${archivedCount} are`;
  return `Couldn't archive ${names}. ${rest} archived.`;
};

type MarkLabelParams = {
  readonly count: number;
  readonly verb: string;
};

const markLabel = ({ count, verb }: MarkLabelParams): string =>
  count === 1 ? `Mark as ${verb}` : `Mark ${count} as ${verb}`;

export const SESSIONS_KIND: ObjectKindDefinition<SessionsActionTarget, SessionsFacts> = {
  noun: 'sessions',
  facts: ({ state, target }) => {
    const known = [...state.sessions, ...Object.values(state.archivedSessions).flat()];
    const sessions = target.sessionIds.flatMap((sessionId) => {
      const session = known.find((candidate) => candidate.id === sessionId);
      return session === undefined ? [] : [session];
    });
    if (sessions.length === 0) {
      return null;
    }
    const active = sessions.filter((session) => session.archivedAt == null);
    return {
      sessions,
      active,
      archived: sessions.filter((session) => session.archivedAt != null),
      runningAgentCount: active.reduce(
        (count, session) => count + runningAgentCountOf({ state, sessionId: session.id }),
        0,
      ),
      unread: active.filter((session) => sessionHasUnread({ state, sessionId: session.id })),
      markable: active.filter(
        (session) =>
          !sessionHasUnread({ state, sessionId: session.id }) &&
          unreadTargetOf({ state, sessionId: session.id }) !== null,
      ),
    };
  },
  actions: [
    {
      id: 'sessions.copyTitles',
      label: 'Copy titles',
      icon: Copy,
      group: 'copy',
      when: () => true,
      run: ({ facts, env }) =>
        env.copyText({
          text: facts.sessions.map((session) => sessionTitle({ session })).join('\n'),
        }),
    },
    {
      id: 'sessions.markRead',
      label: ({ facts }) => markLabel({ count: facts.unread.length, verb: 'read' }),
      shortLabel: () => 'Mark as read',
      icon: MailOpen,
      group: 'act',
      when: ({ facts }) => facts.unread.length > 0,
      run: ({ facts, env }) =>
        env.getState().markSessionsRead({ sessionIds: facts.unread.map((session) => session.id) }),
    },
    {
      id: 'sessions.markUnread',
      label: ({ facts }) => markLabel({ count: facts.markable.length, verb: 'unread' }),
      shortLabel: () => 'Mark as unread',
      icon: Mail,
      group: 'act',
      when: ({ facts }) => facts.markable.length > 0,
      run: async ({ facts, env }) => {
        for (const session of facts.markable) {
          await env.getState().markSessionUnread({ sessionId: session.id });
        }
      },
    },
    {
      id: 'sessions.archive',
      label: ({ facts }) => countLabel({ verb: 'Archive', count: facts.active.length }),
      shortLabel: () => 'Archive',
      icon: CONCEPT_ICONS.archive,
      group: 'danger',
      isUndoable: true,
      when: ({ facts }) => facts.active.length > 0,
      confirm: ({ facts }) =>
        archiveConfirmOf({
          sessionCount: facts.active.length,
          runningAgentCount: facts.runningAgentCount,
        }),
      run: async ({ facts, env }) => {
        const { archived, failed } = await archiveSessions({
          sessions: facts.active,
          ...lifecyclePortsOf({ env }),
        });
        if (failed.length > 0) {
          throw new Error(notArchivedMessage({ failed, archivedCount: archived.length }));
        }
      },
    },
    {
      id: 'sessions.restore',
      label: ({ facts }) => countLabel({ verb: 'Restore', count: facts.archived.length }),
      shortLabel: () => 'Restore',
      icon: CONCEPT_ICONS.restore,
      group: 'act',
      when: ({ facts }) => facts.archived.length > 0,
      run: async ({ facts, env }) => {
        await restoreSessions({ sessions: facts.archived, ...lifecyclePortsOf({ env }) });
      },
    },
    {
      id: 'sessions.delete',
      label: ({ facts }) => countLabel({ verb: 'Delete', count: facts.sessions.length }),
      shortLabel: () => 'Delete',
      icon: CONCEPT_ICONS.delete,
      group: 'danger',
      when: () => true,
      confirm: ({ facts }) => ({
        title: `${countLabel({ verb: 'Delete', count: facts.sessions.length })}?`,
        description:
          "Removes these sessions and their transcripts from this device. This can't be undone.",
        confirmLabel: countLabel({ verb: 'Delete', count: facts.sessions.length }),
        role: 'danger',
        goes: 'The sessions and their transcripts, from this device.',
        stays:
          'Branches and their commits. A worktree with uncommitted work is kept, under Settings, Storage.',
        items: facts.sessions.map((session) => sessionTitle({ session })),
        ...(facts.active.length > 0 && { altActionId: 'sessions.archive' }),
      }),
      run: async ({ facts, env }) => {
        await env.getState().bulkDeleteTask(facts.sessions.map((session) => session.id));
      },
    },
  ],
};
