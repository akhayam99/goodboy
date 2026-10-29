import type { Agent, SessionId } from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../../features/workflows/workflows';
import type { GetFn, SetFn } from '../types';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  child: Agent;
}>;

export const blockUnreadablePart = async ({
  set,
  get,
  sessionId,
  child,
}: Params): Promise<void> => {
  await invokeAgentUpdateStatus(child.id, { status: 'blocked', completedAt: isoNow() });
  const blocked = await invokeAgentList(sessionId);
  set((s) => ({ sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: blocked } }));
  void get().refreshUnreadWorkspaces();
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: `Subagent ${child.name} is blocked`,
    body: 'the plan that defines this subagent is no longer readable, so there are no instructions to send. open the plan and re-run the implementer.',
    sessionId,
  });
};
