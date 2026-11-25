import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { slackDraftVersionOf } from './versions';
import { sessionIdOf } from './ids';

export const answerSlackReply = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'answerSlackReply'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const store = getStore();
  const draft = (store.sessionSlackDrafts[sessionId] ?? []).find(
    (candidate) => candidate.id === action.draftId,
  );
  if (draft === undefined) {
    return refusedResult({ code: 'already-decided', message: 'Decided on your Mac.' });
  }
  if (slackDraftVersionOf({ draft }) !== action.seenVersion) {
    return refusedResult({
      code: 'version-changed',
      message: 'The draft changed while you read it.',
      changes: [{ label: 'Draft', was: action.text, now: draft.body }],
    });
  }
  try {
    await store.decideSessionSlackDraft({
      sessionId,
      draftId: draft.id,
      status: action.verdict === 'send' ? 'sent' : 'discarded',
    });
  } catch (error) {
    console.error('[bridge] answerSlackReply failed', error);
    return failedResult({ error: 'Could not answer the draft. Reconnect Slack on your Mac.' });
  }
  return doneResult();
};
