import type { ReactNode } from 'react';
import type { SessionId } from '@goodboy/types';
import { LiveAgentBlock } from './LiveAgentBlock';
import { LiveAutoBlock } from './LiveAutoBlock';
import { LiveRunBlock } from './LiveRunBlock';
import type { LiveGroupModel } from './liveGroupsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly group: LiveGroupModel;
  readonly chip?: ReactNode;
};

export const LiveGroup = ({ sessionId, group, chip }: Props) => {
  switch (group.kind) {
    case 'run':
    case 'orchestrated':
      return <LiveRunBlock sessionId={sessionId} group={group} chip={chip} />;
    case 'auto':
      return <LiveAutoBlock sessionId={sessionId} group={group} chip={chip} />;
    case 'agent':
      return <LiveAgentBlock sessionId={sessionId} group={group} chip={chip} />;
    default: {
      const exhaustive: never = group;
      return exhaustive;
    }
  }
};
