import type { SessionId, AgentId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import type { SendTurnResult } from '../../../store/slices/turn/types';
import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { turnRefusalOf } from '../../../store/slices/turn/refusal/turnRefusalOf';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { bumpSendSequence, sendSequenceOf } from './sendSequence';
import { isAgentOfSession } from './targets';
import { sessionIdOf, agentIdOf } from './ids';

type TurnParams = {
  readonly store: AppStore;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly content: string;
};

const acceptedTurnOf = ({
  store,
  sessionId,
  agentId,
  content,
}: TurnParams): Promise<SendTurnResult | undefined> =>
  new Promise((resolve, reject) => {
    const turn = store.sendTurn({
      sessionId,
      agentId,
      content,
      origin: 'operator',
      onStarted: () => resolve(undefined),
    });
    turn.then(resolve, reject);
  });

export const sendToAgent = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'sendToAgent'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const agentId = agentIdOf({ value: action.agentId });
  const store = getStore();
  if (!isAgentOfSession({ store, sessionId, agentId })) {
    return refusedResult({ code: 'unknown-target', message: "This agent isn't on your Mac." });
  }
  const current = sendSequenceOf({ agentId: action.agentId });
  if (current !== action.seenVersion) {
    return refusedResult({
      code: 'version-changed',
      message: 'Another message went to this agent first.',
      changes: [{ label: 'Messages', was: action.seenVersion, now: current }],
    });
  }
  const content = action.text.trim();
  if (content.length === 0) {
    return failedResult({ error: 'The message is empty.' });
  }
  try {
    const sent = await acceptedTurnOf({ store, sessionId, agentId, content });
    if (sent?.blockedOverBudget === true) {
      return failedResult({ error: 'The session is over its limit. Raise it first.' });
    }
    if (sent !== undefined && turnRefusalOf({ result: sent }) !== null) {
      return failedResult({ error: "The agent can't take a message right now. Try again." });
    }
  } catch (error) {
    console.error('[bridge] sendToAgent failed', error);
    return failedResult({ error: "Couldn't send the message." });
  }
  bumpSendSequence({ agentId: action.agentId });
  return doneResult();
};
