export const DEMO_REPLIES = {
  generic:
    'On it. I will read src/webhooks and the tests next to it first, then report back before anything is pushed.',
  spawn:
    'Starting from the plan. I will make the change, run the tests it touches and report back before anything is pushed.',
  answer: 'Thanks, that settles it. Carrying on with your choice.',
} as const satisfies Record<string, string>;
