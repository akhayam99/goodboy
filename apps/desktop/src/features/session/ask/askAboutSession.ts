import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sumSessionCost } from '../../../store/slices/sessions/sumSessionCost';
import { askRightNow, askRightNowText } from './askRightNow';
import { askDigestOf } from './collectAskPackInput';

type Params = {
  readonly sessionId: SessionId;
  readonly question: string;
};

export const askAboutSession = ({ sessionId, question }: Params): void => {
  const state = useAppStore.getState();
  const rightNow = askRightNowText(
    askRightNow({
      ...askDigestOf({ state, sessionId, now: Date.now() }),
      description: '',
      cost: sumSessionCost(state.sessionTelemetry[sessionId] ?? []),
    }),
  );
  state.openAsk({ sessionId });
  void state.sendAskQuestion({ sessionId, question, rightNow });
};
