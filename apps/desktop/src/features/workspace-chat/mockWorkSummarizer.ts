import type { ChatSummarizer } from './createMemoryChatBackend';

type CannedBrief = {
  readonly match: RegExp;
  readonly brief: Readonly<Record<string, unknown>>;
};

const SUMMARY_DELAY_MS = 600;

const CANNED: ReadonlyArray<CannedBrief> = [
  {
    match: /consent/i,
    brief: {
      title: 'Ask for consent again when the policy changes',
      goal: 'Ask for consent again when the policy version changes. The version is saved with each order but never compared, so people who agreed to an old policy are not asked again.',
      know: [
        'Consent is step 4, in steps.ts:88.',
        'consent.ts saves the version per order.',
        'Nothing compares that version later.',
      ],
      files: [
        'payments-api/src/questionnaire/steps.ts:88',
        'payments-api/src/questionnaire/ConsentStep.tsx:14',
        'payments-api/src/api/consent.ts:31',
      ],
      projects: ['payments-api'],
    },
  },
  {
    match: /retry|twice/i,
    brief: {
      title: 'Send notify-relay messages once on a failure',
      goal: 'Stop notify-relay from sending a message twice when a send fails. The queue and the HTTP client both retry today. Keep the queue retry and remove the other.',
      know: [
        'worker.ts:52 sets maxAttempts: 2 on the job.',
        'client.ts:19 wraps calls in withRetry(1).',
        'The queue already backs off between tries.',
      ],
      files: ['notify-relay/src/queue/worker.ts:52', 'notify-relay/src/http/client.ts:19'],
      projects: ['notify-relay', 'payments-api'],
    },
  },
];

export const mockWorkSummarizer: ChatSummarizer = async ({ userMessage }) => {
  await new Promise((resolve) => {
    setTimeout(resolve, SUMMARY_DELAY_MS);
  });
  const canned = CANNED.find((candidate) => candidate.match.test(userMessage));
  return canned === undefined ? '' : JSON.stringify(canned.brief);
};
