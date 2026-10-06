import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { runObjectAction } from '../../../../actions/registry';
import type { ActionConfirm, ActionEnv } from '../../../../actions/types';
import { useActionEnv } from '../../../../actions/useActionEnv';
import { focusQuestionAnswer } from '../../../../context/focusQuestionAnswer';
import { askButtons, type AskButton, type AskButtonFacts } from '../../askButtons';
import { askVerb } from '../../askVerb';
import type { ParsedAskAnswer } from '../../parseAskAnswer';

export type AskAction = AskButton & {
  readonly confirm: ActionConfirm | null;
  readonly run: () => void;
};

type Params = {
  readonly sessionId: SessionId;
  readonly answer: ParsedAskAnswer;
  readonly facts: AskButtonFacts;
};

type RunParams = {
  readonly button: AskButton;
  readonly sessionId: SessionId;
  readonly env: ActionEnv;
};

const runButton = ({ button, sessionId, env }: RunParams): void => {
  const state = env.getState();
  switch (button.kind) {
    case 'answer':
      focusQuestionAnswer({ questionId: button.questionId, prefill: button.prefill });
      state.navigate({ to: sessionPlace({ sessionId, lens: 'questions' }) });
      return;
    case 'review':
      void runObjectAction({
        target: { kind: 'session', sessionId },
        actionId: 'session.review',
        env,
      });
      return;
    case 'tell': {
      if (button.prefill !== '') {
        const existing = state.agentDraft[button.agentId] ?? '';
        state.setAgentDraft(
          button.agentId,
          existing === '' ? button.prefill : `${existing}\n${button.prefill}`,
        );
      }
      void runObjectAction({
        target: { kind: 'agent', sessionId, agentId: button.agentId },
        actionId: 'agent.message',
        env,
      });
      return;
    }
    default: {
      const exhaustive: never = button;
      return exhaustive;
    }
  }
};

type ConfirmParams = {
  readonly button: AskButton;
  readonly sessionId: SessionId;
  readonly state: AppStore;
};

const confirmOf = ({ button, sessionId, state }: ConfirmParams): ActionConfirm | null => {
  switch (button.kind) {
    case 'review':
      return (
        askVerb({ state, target: { kind: 'session', sessionId }, actionId: 'session.review' })
          ?.confirm ?? null
      );
    case 'tell':
      return (
        askVerb({
          state,
          target: { kind: 'agent', sessionId, agentId: button.agentId },
          actionId: 'agent.message',
        })?.confirm ?? null
      );
    case 'answer':
      return null;
    default: {
      const exhaustive: never = button;
      return exhaustive;
    }
  }
};

export const useAskActions = ({ sessionId, answer, facts }: Params): ReadonlyArray<AskAction> => {
  const env = useActionEnv({ origin: 'button' });
  return useMemo(() => {
    const state = useAppStore.getState();
    return askButtons({ answer, facts }).map((button) => ({
      ...button,
      confirm: confirmOf({ button, sessionId, state }),
      run: () => runButton({ button, sessionId, env }),
    }));
  }, [answer, env, facts, sessionId]);
};
