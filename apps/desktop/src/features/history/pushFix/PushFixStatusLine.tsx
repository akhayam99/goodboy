import { X } from '@goodboy/ui/icons';
import { Button, IconButton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useTranscript } from '../../../store/slices/transcripts/selectors';
import type { PushFixState } from '../../../store/slices/history/pushFix/pushFixStateOf';
import { useAgentStop } from '../../../shared/hooks/useAgentStop';
import { actionButtonLookOf } from '../../actions/actionButtonLookOf';
import { ItemWorkLine } from '../../live-state/itemWork/ItemWorkLine';
import { agentStepPhraseOf } from '../../live-state/itemWork/agentStepPhraseOf';
import { ITEM_WORK_WORDS, type ItemWorkState } from '../../live-state/itemWork/itemWorkWords';

type ActiveState = Exclude<PushFixState, { readonly kind: 'none' }>;

type Props = {
  readonly sessionId: SessionId;
  readonly state: ActiveState;
  readonly onDismiss?: () => void;
};

type StateParams = {
  readonly state: ActiveState;
};

const STOPPED_DETAIL = 'Nothing was pushed; its edits stay on the branch.';
const AGENT_FAILED_DETAIL = 'Nothing was pushed.';
const DISMISS_LABEL = 'Dismiss';
const STOP_LOOK = actionButtonLookOf({ verb: ITEM_WORK_WORDS.verb.stop, variant: 'quiet' });

const itemWorkStateOf = ({ state }: StateParams): ItemWorkState => {
  switch (state.kind) {
    case 'working':
      return 'fixing';
    case 'pushed':
      return state.followUp?.tone === 'failed' ? 'failed' : 'pushed';
    case 'stopped':
      return 'stopped';
    case 'failed':
      return 'failed';
    default:
      return state satisfies never;
  }
};

const outcomeDetailOf = ({ state }: StateParams): string | null => {
  switch (state.kind) {
    case 'working':
      return null;
    case 'pushed':
      if (state.followUp === null) {
        return null;
      }
      return state.followUp.tone === 'failed'
        ? `The fix is pushed. ${state.followUp.sentence}`
        : state.followUp.sentence;
    case 'stopped':
      return STOPPED_DETAIL;
    case 'failed':
      if (state.step === 'push') {
        return `The fix couldn't be pushed: ${state.reason ?? 'the push failed'}.`;
      }
      return state.reason ?? AGENT_FAILED_DETAIL;
    default:
      return state satisfies never;
  }
};

export const PushFixStatusLine = ({ sessionId, state, onDismiss }: Props) => {
  const isWorking = state.kind === 'working';
  const transcript = useTranscript(isWorking ? state.agentId : null);
  const agentStop = useAgentStop({ sessionId, agentId: isWorking ? state.agentId : null });
  const openTranscript = () =>
    useAppStore
      .getState()
      .openDrawer({ kind: 'transcript', sessionId, payload: { agentId: state.agentId } });
  return (
    <ItemWorkLine
      state={itemWorkStateOf({ state })}
      detail={isWorking ? agentStepPhraseOf({ transcript }) : outcomeDetailOf({ state })}
      agentId={isWorking ? state.agentId : null}
      isAgentWaiting={agentStop.isBlocked}
      action={
        <>
          {isWorking && (
            <Button
              size="xs"
              variant={STOP_LOOK.variant}
              intent={STOP_LOOK.intent}
              isBusy={agentStop.phase !== 'idle'}
              onClick={agentStop.stop}
            >
              {ITEM_WORK_WORDS.verb.stop}
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={openTranscript}>
            {ITEM_WORK_WORDS.verb.openTranscript}
          </Button>
          {onDismiss !== undefined && !isWorking && (
            <IconButton
              icon={X}
              label={DISMISS_LABEL}
              size="xs"
              variant="ghost"
              onClick={onDismiss}
            />
          )}
        </>
      }
    />
  );
};
