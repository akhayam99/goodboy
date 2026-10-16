import { useRef } from 'react';
import { formatUsd } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { TailLine } from '../../live-state/TailLine';
import { autoTreeLive } from '../../live-state/adapters/autoTreeLive';
import type { TailActionId, TailFacts } from '../../live-state/tailFacts';
import { autoLimitOpenEvent } from './autoLimitOpenEvent';
import { raisedCapOf } from './raisedCapOf';
import { useAutoTreeActions } from './useAutoTreeActions';
import { useAutoTreeCap } from './useAutoTreeCap';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
  readonly rootAgent: Agent;
};

type LabelParams = {
  readonly facts: TailFacts;
  readonly raisedTo: number | null;
};

const withRaiseLabel = ({ facts, raisedTo }: LabelParams): TailFacts =>
  raisedTo === null
    ? facts
    : {
        ...facts,
        actions: facts.actions.map((action) =>
          action.id === 'raiseLimit'
            ? { ...action, label: `Raise to ${formatUsd(raisedTo)}` }
            : action,
        ),
      };

type StopParams = {
  readonly facts: TailFacts;
};

const withPlainStop = ({ facts }: StopParams): TailFacts => ({
  ...facts,
  actions: facts.actions.map((action) =>
    action.id === 'stopAuto' ? { ...action, label: 'Stop' } : action,
  ),
});

export const AutoTail = ({ sessionId, view, rootAgent }: Props) => {
  const rootTurn = useAppStore((state) => state.agentTurnState[rootAgent.id] ?? null);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const reportError = useAppStore((state) => state.reportError);
  const actions = useAutoTreeActions({ sessionId });
  const saveCap = useAutoTreeCap({ sessionId, treeId: view.tree.id });
  const isRaisingRef = useRef(false);
  if (rootTurn?.kind === 'running' || rootTurn?.kind === 'starting') {
    return null;
  }
  const live = autoTreeLive({ view, rootTurn, rootAgent, lastTool: null, project: null });
  if (live === null || live.state === 'idle') {
    return null;
  }
  const facts = view.delegations.length > 0 ? live : withPlainStop({ facts: live });
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
    stopAuto: () => void actions.stop({ view }),
    changeApproach: () => void actions.changeApproach({ view }),
    raiseLimit: () => void raise(),
    changeLimit: () =>
      window.dispatchEvent(new Event(autoLimitOpenEvent({ treeId: view.tree.id }))),
    viewTranscript: () =>
      openDrawer({ kind: 'transcript', sessionId, payload: { agentId: rootAgent.id } }),
  };
  const onAction = (id: TailActionId) => handlers[id]?.();

  return (
    <div role="status" aria-live="polite" data-auto-tail="">
      <TailLine facts={withRaiseLabel({ facts, raisedTo })} onAction={onAction} />
    </div>
  );
};
