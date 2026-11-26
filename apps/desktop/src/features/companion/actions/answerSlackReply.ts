import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { dropPosted, markPosted, postedBodyOf } from './postedSlackDrafts';
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
    if (action.verdict === 'discard') {
      await store.decideSessionSlackDraft({ sessionId, draftId: draft.id, status: 'discarded' });
      return doneResult();
    }
    const channelId = draft.target.channelId ?? '';
    const threadTs = draft.target.threadTs ?? '';
    if (channelId === '' || threadTs === '') {
      return refusedResult({ code: 'unknown-target', message: 'This draft has no Slack thread.' });
    }
    const alreadyPosted = postedBodyOf({ draftId: draft.id });
    const typed = action.text.trim();
    const body = alreadyPosted ?? (typed === '' ? draft.body : typed);
    if (alreadyPosted === null) {
      await store.replyToSlackThread({
        workspaceId: draft.workspaceId,
        channelId,
        threadTs,
        text: body,
      });
      markPosted({ draftId: draft.id, body });
    }
    await store.decideSessionSlackDraft({ sessionId, draftId: draft.id, status: 'sent', body });
    dropPosted({ draftId: draft.id });
  } catch (error) {
    console.error('[bridge] answerSlackReply failed', error);
    return failedResult({ error: "Couldn't answer the draft. Reconnect Slack on your Mac." });
  }
  return doneResult();
};
