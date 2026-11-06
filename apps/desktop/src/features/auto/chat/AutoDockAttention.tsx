import { useRef } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { Button, formatUsd, type Tone } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { DockStateLine } from '../../../shared/components/DockStateLine';
import { DockStopButton } from '../../../shared/components/DockStopButton';
import type { ConversationStop } from '../../../shared/types/conversationStop';
import type { TailAction, TailActionId, TailFacts } from '../../live-state/tailFacts';
import { autoLimitOpenEvent } from './autoLimitOpenEvent';
import { raisedCapOf } from './raisedCapOf';
import type { AutoTreeActions } from './useAutoTreeActions';
import { useAutoTreeCap } from './useAutoTreeCap';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
  readonly rootAgent: Agent;
  readonly facts: TailFacts;
  readonly tone: Tone;
  readonly actions: AutoTreeActions;
  readonly stop: ConversationStop | null;
};

type LabelParams = {
  readonly action: TailAction;
  readonly raisedTo: number | null;
};

const moveLabelOf = ({ action, raisedTo }: LabelParams): string =>
  action.id === 'raiseLimit' && raisedTo !== null
    ? `Raise to ${formatUsd(raisedTo)}`
    : action.label;

export const AutoDockAttention = ({
  sessionId,
  view,
  rootAgent,
  facts,
  tone,
  actions,
  stop,
}: Props) => {
  const openDrawer = useAppStore((state) => state.openDrawer);
  const reportError = useAppStore((state) => state.reportError);
  const saveCap = useAutoTreeCap({ sessionId, treeId: view.tree.id });
  const isRaisingRef = useRef(false);
  const capUsd = view.budget?.capUsd ?? null;
  const raisedTo = capUsd === null ? null : raisedCapOf({ capUsd });

  const raise = async () => {
    if (raisedTo === null || isRaisingRef.current) {
      return;
    }
    isRaisingRef.current = true;
    try {
      const failure = await saveCap({ expectedCapUsd: capUsd, capUsd: raisedTo });
      if (failure !== null) {
        await reportError({
          title: "Couldn't raise the limit",
          error: new Error(failure),
          sessionId,
        });
      }
    } finally {
      isRaisingRef.current = false;
    }
  };

  const handlers: Partial<Record<TailActionId, () => void>> = {
    retry: () => void actions.retry({ view }),
    raiseLimit: () => void raise(),
    changeLimit: () =>
      window.dispatchEvent(new Event(autoLimitOpenEvent({ treeId: view.tree.id }))),
    viewTranscript: () =>
      openDrawer({ kind: 'transcript', sessionId, payload: { agentId: rootAgent.id } }),
  };
  const moves = facts.actions.filter((action) => action.id !== 'stopAuto');
  const canStop = stop !== null && facts.actions.some((action) => action.id === 'stopAuto');
  const filled = moves.filter(({ id }) => id === 'retry' || id === 'raiseLimit');
  const quiet = moves.filter((action) => !filled.includes(action));

  return (
    <DockStateLine state={facts.state} tone={tone} sentence={facts.phrase}>
      {quiet.map((action) => (
        <Button key={action.id} variant="quiet" size="xs" onClick={() => handlers[action.id]?.()}>
          {moveLabelOf({ action, raisedTo })}
        </Button>
      ))}
      {canStop ? <DockStopButton stop={stop} /> : null}
      {filled.map((action) => (
        <Button key={action.id} variant="primary" size="sm" onClick={() => handlers[action.id]?.()}>
          {moveLabelOf({ action, raisedTo })}
        </Button>
      ))}
    </DockStateLine>
  );
};
