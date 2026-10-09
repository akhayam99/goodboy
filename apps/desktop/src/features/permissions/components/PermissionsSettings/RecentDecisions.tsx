import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useShallow } from 'zustand/react/shallow';
import { commandPrefix } from '@goodboy/core';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { EmptyState, STRIPED_LIST, cn, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { sessionTitle } from '../../../session/sessionTitle';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { useRecentDecisions } from '../../hooks/useRecentDecisions';
import type { RecentDecision } from '../../permissions';
import { useNow } from '../../../../shared/hooks/useNow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type WhatParams = {
  readonly decision: RecentDecision;
};

const commandIn = ({ input }: { readonly input: unknown }): string => {
  if (typeof input !== 'object' || input === null) {
    return '';
  }
  const value: unknown = Reflect.get(input, 'command');
  return typeof value === 'string' ? value : '';
};

const whatOf = ({ decision }: WhatParams): string => {
  if (decision.toolName !== 'Bash') {
    return decision.toolName;
  }
  const prefix = commandPrefix({ command: commandIn({ input: decision.input }) });
  return prefix === '' ? 'a command' : prefix;
};

export const RecentDecisions = ({ workspaceId }: Props) => {
  const now = useNow(30_000);
  const sessionIds = useAppStore(
    useShallow((s): ReadonlyArray<SessionId> =>
      s.sessions
        .filter((session) => session.workspaceId === workspaceId)
        .map((session) => session.id),
    ),
  );
  const titles = useAppStore(
    useShallow((s): ReadonlyArray<string> =>
      s.sessions
        .filter((session) => session.workspaceId === workspaceId)
        .map((session) => sessionTitle({ session })),
    ),
  );
  const { decisions, isLoading, error } = useRecentDecisions({ sessionIds });
  const titleOf = (id: SessionId): string => titles[sessionIds.indexOf(id)] ?? 'a closed session';

  if (error !== null) {
    return <p className="text-meta text-danger">{`Couldn't read the decisions: ${error}`}</p>;
  }
  if (!isLoading && decisions.length === 0) {
    return (
      <EmptyState
        size="section"
        icon={CONCEPT_ICONS.history}
        title="No decisions yet"
        description="Decisions appear when an agent asks to use a tool."
      />
    );
  }
  return (
    <ul
      aria-label="Recent decisions"
      className={cn('flex flex-col rounded-lg bg-subtle p-1', STRIPED_LIST)}
    >
      {decisions.map((decision) => (
        <li key={decision.id} className="flex min-w-0 items-center gap-2 px-3 py-2 text-label">
          <span
            className={cn(
              'shrink-0',
              tintClasses(decision.decision === 'allow' ? 'success' : 'danger').text,
            )}
          >
            {decision.decision === 'allow' ? 'Allowed' : 'Denied'}
          </span>
          <span className="min-w-0 truncate font-mono text-foreground">{whatOf({ decision })}</span>
          <span className="min-w-0 truncate text-muted-foreground">
            {`· session "${titleOf(decision.sessionId)}" · ${formatAge({ from: decision.decidedAt, now })}`}
          </span>
        </li>
      ))}
    </ul>
  );
};
