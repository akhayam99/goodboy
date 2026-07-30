import type { Agent, SessionId } from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';
import { ResolverActions } from '../ResolverActions';
import { InspectorSection } from '../InspectorSection';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly status: ResolverStatus;
  readonly commitSha: string | null;
};

const IDLE_NOTE: Partial<Record<ResolverStatus, string>> = {
  running: 'working on it, force close it if it is stuck',
  resolved: 'nothing left to do here',
  done: 'nothing left to do here',
  stopped: 'nothing left to do here',
};

export const ResolverActionsSection = ({ agent, sessionId, status, commitSha }: Props) => (
  <InspectorSection question="What you can do with the thread">
    <ResolverActions
      agent={agent}
      sessionId={sessionId}
      status={status}
      commitSha={commitSha}
      density="full"
      emptyNote={IDLE_NOTE[status] ?? 'no additional actions right now'}
    />
  </InspectorSection>
);
