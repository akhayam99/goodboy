import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import type { RunDefaultScope } from '../../../session/startRun/runDefaultSetting';
import { RUN_ROUTE_COPY } from '../../../session/startRun/runRouteCopy';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { RunDefaultRow } from './RunDefaultRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const RunDefaultField = ({ workspaceId }: Props) => {
  const session = useAppStore((state) => {
    const sessionId = state.currentSessionId;
    return sessionId === null ? null : (sessionById(state.sessions, sessionId) ?? null);
  });
  const isSessionHere =
    session !== null && session.workspaceId === workspaceId && session.archivedAt == null;
  const sessionId = isSessionHere ? session.id : null;
  const workspaceScope = useMemo(
    (): RunDefaultScope => ({ kind: 'workspace', workspaceId }),
    [workspaceId],
  );
  const sessionScope = useMemo(
    (): RunDefaultScope | null => (sessionId === null ? null : { kind: 'session', sessionId }),
    [sessionId],
  );
  return (
    <>
      <RunDefaultRow
        scope={workspaceScope}
        label={RUN_ROUTE_COPY.workspaceDefault}
        help={RUN_ROUTE_COPY.workspaceDefaultHelp}
        fallback="auto"
      />
      {sessionScope === null || session === null ? null : (
        <RunDefaultRow
          scope={sessionScope}
          label={RUN_ROUTE_COPY.sessionDefault}
          help={RUN_ROUTE_COPY.sessionDefaultHelp({ name: sessionTitle({ session }) })}
          fallback={null}
        />
      )}
    </>
  );
};
