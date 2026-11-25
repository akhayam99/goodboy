import { openPermissionAsksOf } from '../../permissions/openPermissionAsksOf';
import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { isAgentOfSession } from './targets';
import { permissionHashOf } from './versions';
import { sessionIdOf, agentIdOf } from './ids';

export const answerPermission = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'answerPermission'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const agentId = agentIdOf({ value: action.agentId });
  if (!isAgentOfSession({ store: getStore(), sessionId, agentId })) {
    return refusedResult({ code: 'unknown-target', message: "This agent isn't on your Mac." });
  }
  if (getStore().transcripts[agentId] === undefined) {
    try {
      await getStore().loadAgentTranscript(sessionId, agentId, { isSelecting: false });
    } catch (error) {
      console.error('[bridge] answerPermission transcript failed', error);
      return failedResult({ error: "Couldn't read the request." });
    }
  }
  const store = getStore();
  const events = store.transcripts[agentId] ?? [];
  const ask = openPermissionAsksOf({ events, turnState: store.agentTurnState[agentId] }).find(
    (candidate) => candidate.toolUseId === action.requestId,
  );
  if (ask === undefined) {
    const isDecided = events.some(
      (event) => event.kind === 'permission_decision' && event.toolUseId === action.requestId,
    );
    return isDecided
      ? refusedResult({ code: 'already-decided', message: 'Decided on your Mac.' })
      : refusedResult({ code: 'unknown-target', message: "This request isn't on your Mac." });
  }
  const hash = permissionHashOf({ toolName: ask.toolName, input: ask.input });
  if (hash !== action.seenInputHash) {
    return refusedResult({
      code: 'version-changed',
      message: 'The request changed while you read it.',
      changes: [{ label: ask.toolName, was: 'as you read it', now: 'a different input' }],
    });
  }
  const target = {
    sessionId,
    agentId,
    toolUseId: ask.toolUseId,
    toolName: ask.toolName,
    runId: ask.runId,
  };
  try {
    if (action.verdict === 'allow') {
      await store.allowAndContinue({ ...target, input: ask.input });
      return doneResult();
    }
    await store.denyWithReason({ ...target, reason: '' });
  } catch (error) {
    console.error('[bridge] answerPermission failed', error);
    return failedResult({ error: "Couldn't answer the request." });
  }
  return doneResult();
};
