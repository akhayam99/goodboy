export type ChatTurnOutcome =
  { readonly status: 'done' } | { readonly status: 'failed'; readonly error: string };
