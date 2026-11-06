import type { NotificationAction } from '@goodboy/db';
import type { ToastAction } from '../../../../shared/components/Toast';
import { openAgentRevealEvent } from '../../../../shared/utils/openAgentReveal';
import { agentPlace, type useAppStore } from '../../../../store';
import { continueNotifiedAgent } from '../../continueNotifiedAgent';

type Params = {
  readonly action: Extract<NotificationAction, { kind: 'continue-agent' | 'open-agent' }>;
  readonly store: ReturnType<typeof useAppStore.getState>;
};

export const mapAgentAction = ({ action, store }: Params): ToastAction => {
  const { sessionId, agentId } = action;
  if (action.kind === 'continue-agent') {
    return {
      label: 'Continue',
      onClick: () => {
        continueNotifiedAgent({ sessionId, agentId });
      },
    };
  }
  return {
    label: 'Open agent',
    onClick: () => {
      store.navigate({ to: agentPlace({ sessionId, agentId }) });
      window.dispatchEvent(openAgentRevealEvent());
    },
  };
};
