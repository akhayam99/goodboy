import type { Session, SessionId } from '@goodboy/types';
import { LiveAgentBlock } from './LiveAgentBlock';
import { LiveAutoBlock } from './LiveAutoBlock';
import { LiveRunBlock } from './LiveRunBlock';
import type { LiveGroupModel } from './liveGroupsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly session: Session | null;
  readonly group: LiveGroupModel;
  readonly where: string | null;
  readonly isLead?: boolean;
};

export const LiveGroup = ({ sessionId, session, group, where, isLead = false }: Props) => {
  switch (group.kind) {
    case 'run':
    case 'orchestrated':
      return (
        <LiveRunBlock
          sessionId={sessionId}
          session={session}
          group={group}
          where={where}
          isLead={isLead}
        />
      );
    case 'auto':
      return <LiveAutoBlock sessionId={sessionId} group={group} where={where} />;
    case 'agent':
      return <LiveAgentBlock sessionId={sessionId} group={group} where={where} />;
    default: {
      const exhaustive: never = group;
      return exhaustive;
    }
  }
};
