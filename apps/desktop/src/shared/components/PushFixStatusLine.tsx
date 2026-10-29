import { X } from 'lucide-react';
import { Button, IconButton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { agentPlace } from '../../store/slices/navigation/place';
import type { PushFixState } from '../../store/slices/history/pushFix/pushFixStateOf';

type ActiveState = Exclude<PushFixState, { readonly kind: 'none' }>;

type Props = {
  readonly sessionId: SessionId;
  readonly state: ActiveState;
  readonly onDismiss?: () => void;
};

const WORKING_LABEL = 'An agent is fixing the push';
const PUSHED_LABEL = "The agent's fix is pushed.";
const AGENT_FAILED_LABEL = "The agent didn't finish.";
const OPEN_LABEL = 'Open the agent';
const DISMISS_LABEL = 'Dismiss';

type SentenceParams = {
  readonly state: ActiveState;
};

const statusSentenceOf = ({ state }: SentenceParams): string => {
  if (state.kind === 'working') {
    return WORKING_LABEL;
  }
  if (state.kind === 'pushed') {
    return state.followUp === null ? PUSHED_LABEL : `${PUSHED_LABEL} ${state.followUp.sentence}`;
  }
  if (state.step === 'push') {
    return `The fix couldn't be pushed: ${state.reason ?? 'the push failed'}.`;
  }
  return state.reason === null ? AGENT_FAILED_LABEL : state.reason;
};

export const PushFixStatusLine = ({ sessionId, state, onDismiss }: Props) => {
  const isAlert =
    state.kind === 'failed' || (state.kind === 'pushed' && state.followUp?.tone === 'failed');
  return (
    <>
      <span role={isAlert ? 'alert' : 'status'} className="min-w-0 text-meta text-muted-foreground">
        {statusSentenceOf({ state })}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          useAppStore.getState().navigate({ to: agentPlace({ sessionId, agentId: state.agentId }) })
        }
      >
        {OPEN_LABEL}
      </Button>
      {onDismiss !== undefined && state.kind !== 'working' && (
        <IconButton icon={X} label={DISMISS_LABEL} variant="ghost" onClick={onDismiss} />
      )}
    </>
  );
};
