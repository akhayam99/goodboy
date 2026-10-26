import { THREAD_IDS } from '../../scenes/resolveSeed';

export const STORY_THREAD_IDS = {
  idempotency: THREAD_IDS.idempotency,
  logging: THREAD_IDS.logRedact,
  retry: THREAD_IDS.retryConstant,
} as const;

type CommentCopy = {
  readonly body: string;
  readonly path: string;
  readonly line: number;
};

export const STORY_COMMENTS: Readonly<Record<string, CommentCopy>> = {
  [STORY_THREAD_IDS.idempotency]: {
    body: 'Is the idempotency key the event id alone? Two deliveries of one event must map to one credit.',
    path: 'src/webhooks/applyWebhook.ts',
    line: 13,
  },
  [STORY_THREAD_IDS.logging]: {
    body: 'Log the event id when a duplicate is skipped, so on-call can count redeliveries.',
    path: 'src/webhooks/applyWebhook.ts',
    line: 9,
  },
  [STORY_THREAD_IDS.retry]: {
    body: 'Each retry builds a fresh key, so a retried delivery looks new. Can the retry send the original event id?',
    path: 'src/webhooks/retryPolicy.ts',
    line: 7,
  },
};

export const STORY_FIX_COMMITS: Readonly<Record<string, string>> = {
  [STORY_THREAD_IDS.idempotency]: 'fix(webhooks): key the credit on the event id alone',
  [STORY_THREAD_IDS.logging]: 'chore(webhooks): log the event id of a skipped duplicate',
  [STORY_THREAD_IDS.retry]: 'fix(retry): send the original event id on every retry',
};

export const STORY_FIX_DIFF = [
  'diff --git a/src/webhooks/retryPolicy.ts b/src/webhooks/retryPolicy.ts',
  '--- a/src/webhooks/retryPolicy.ts',
  '+++ b/src/webhooks/retryPolicy.ts',
  '@@ -10,4 +10,5 @@ export const scheduleRetry = (delivery: WebhookDelivery): void => {',
  '   const attempt = delivery.attempt + 1;',
  '-  const delayMs = 1000;',
  '-  setTimeout(() => sendWebhook(delivery), delayMs);',
  '+  const delayMs = Math.min(2 ** attempt * 1000, MAX_BACKOFF_MS);',
  "+  logger.info('retrying delivery', { eventId: delivery.event.id, attempt });",
  '+  setTimeout(() => sendWebhook({ ...delivery, attempt, idempotencyKey: delivery.event.id }), delayMs);',
  '   };',
  'diff --git a/src/webhooks/applyWebhook.ts b/src/webhooks/applyWebhook.ts',
  '--- a/src/webhooks/applyWebhook.ts',
  '+++ b/src/webhooks/applyWebhook.ts',
  '@@ -11,3 +11,4 @@ export const applyWebhook = async (event: ProcessorEvent): Promise<WebhookResult> => {',
  '   if (await seenEvents.has(event.id)) {',
  "+    logger.info('skipped a redelivered event', { eventId: event.id });",
  '     return { status: 200, credited: false };',
  '   }',
].join('\n');

export const RESOLVE_FIX_SUMMARY =
  'retryPolicy.ts now retries with the original event id as the idempotency key and logs the event id on every attempt. The retry suite passes, and a reply is drafted for the thread.';

export const RESOLVE_FIX_NARRATION =
  'The retry builds a fresh key on every attempt. Passing the original event id instead.';
