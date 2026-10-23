import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { AGENT_KIND_META } from '../../agent-kind';
import type { LiveChild } from './liveGroupsOf';
import { LiveSpine } from './LiveSpine';
import { LIVE_TONE } from './liveTone';

type Props = {
  readonly sessionId: SessionId;
  readonly parentTitle: string;
  readonly items: ReadonlyArray<LiveChild>;
};

export const LiveChildren = ({ sessionId, parentTitle, items }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  if (items.length === 0) {
    return null;
  }
  return (
    <LiveSpine
      label={`Under ${parentTitle}`}
      items={items.map((child) => ({
        key: child.agentId,
        kind: child.agentKind,
        noun: AGENT_KIND_META[child.agentKind].noun,
        title: child.title,
        word: LIVE_TONE.phase[child.phase].word,
        tone: LIVE_TONE.phase[child.phase].tone,
        time: <DelegationClock agentId={child.agentId} isLive={child.phase === 'running'} />,
        openLabel: `Open ${child.title}`,
        onOpen: () => navigate({ to: agentPlace({ sessionId, agentId: child.agentId }) }),
      }))}
    />
  );
};
