import { useEffect, useState } from 'react';
import { RIGHT_DRAWER_MIN, RIGHT_DRAWER_STORAGE_KEY } from '@goodboy/ui';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { turnRefusalMessage } from '../../../../../store/slices/turn/refusal/turnRefusalMessage';
import type { AgentQueuedTurn } from '../../../../../store/slices/agentQueue/types';
import { AppFrame } from '../audit/AppFrame';
import { SESSION } from '../activityRunSeed';
import { IMPLEMENTER_ID } from '../u24/autoSceneSeed';
import { seedC07 } from '../u25/c07/c07AutoSeed';

type SceneProps = {
  readonly isStopped: boolean;
};

const SENT_AT = brandId<IsoDateTime>({ value: '2026-11-06T09:14:00.000Z' });

const HELD: AgentQueuedTurn = {
  id: 'u36-p2-held',
  agentId: IMPLEMENTER_ID,
  content: 'Also cover the 402 path in payments-api, then run the replay again.',
  attachments: [],
  override: undefined,
  status: 'queued',
  createdAt: SENT_AT,
  isDirect: true,
  hold: { reason: turnRefusalMessage({ refusal: 'provider_limit' }) },
};

const WAITING: AgentQueuedTurn = {
  id: 'u36-p2-waiting',
  agentId: IMPLEMENTER_ID,
  content: 'Keep the retry window at 30 seconds in notify-relay.',
  attachments: [],
  override: undefined,
  status: 'queued',
  createdAt: SENT_AT,
};

const SendScene = ({ isStopped }: SceneProps) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, String(RIGHT_DRAWER_MIN));
    seedC07({ state: 'working', place: 'auto', pane: 'implementer' });
    const current = useAppStore.getState();
    useAppStore.setState({
      sessions: [{ ...SESSION, permissionMode: 'bypassPermissions' }],
      agentTurnState: {
        ...current.agentTurnState,
        [IMPLEMENTER_ID]: { kind: 'idle', lastActivityAt: SENT_AT },
      },
      sessionPhaseRuns: {
        ...current.sessionPhaseRuns,
        [SESSION.id]: (current.sessionPhaseRuns[SESSION.id] ?? []).map((agent) =>
          agent.id === IMPLEMENTER_ID && isStopped
            ? { ...agent, status: 'stopped', stoppedBy: 'user' }
            : agent,
        ),
      },
      agentQueue: { ...current.agentQueue, [IMPLEMENTER_ID]: [isStopped ? WAITING : HELD] },
    });
    setIsReady(true);
  }, [isStopped]);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} hasPane />;
};

export const U36_P2_SEND_SCENES = {
  'u36-p2-send-held': () => <SendScene isStopped={false} />,
  'u36-p2-send-stopped': () => <SendScene isStopped />,
};
