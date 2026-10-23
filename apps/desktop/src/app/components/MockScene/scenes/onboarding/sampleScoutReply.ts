type Params = {
  readonly focus: string;
  readonly folder: string;
};

const SAMPLE_REPLY = 'This is a sample response. No agent is connected in this playground.';

export const sampleScoutReply = ({ focus, folder }: Params): string => {
  const asked = focus.toLowerCase();
  if (asked.includes('organized')) {
    return `${folder} is a small TypeScript service. src/webhooks takes the processor events, src/invoices owns balances and credits, and src/ledger talks to ledger-core over HTTP. Tests sit in test, one folder per module. Nothing was changed.`;
  }
  if (asked.includes('bug')) {
    return `Found one in src/webhooks/handler.ts of ${folder}. A retried webhook posts a second credit, because the handler never checks whether it already processed that event id. A guard keyed on the event id fixes it. Nothing was changed.`;
  }
  if (asked.includes('readme')) {
    return `The README of ${folder} covers install and tests. A new teammate would miss how to start the processor sandbox, which environment variables are required and how it reaches ledger-core. Nothing was changed.`;
  }
  return SAMPLE_REPLY;
};
