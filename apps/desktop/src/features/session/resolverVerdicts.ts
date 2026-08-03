import type { ResolverThreadOutcome } from '../../store/types';

export type ResolverVerdict = {
  readonly threadId: string;
  readonly prose: string | null;
  readonly reply: string | null;
};

type Params = {
  readonly threadIds: ReadonlyArray<string>;
  readonly outcomes: Readonly<Record<string, ResolverThreadOutcome>>;
};

const proseOf = ({
  outcome,
  reply,
}: {
  readonly outcome: ResolverThreadOutcome;
  readonly reply: string;
}): string => {
  if (outcome.kind === 'wontfix') {
    return outcome.reason.trim();
  }
  if (outcome.kind === 'analyzed') {
    return reply;
  }
  return '';
};

export const resolverVerdicts = ({
  threadIds,
  outcomes,
}: Params): ReadonlyArray<ResolverVerdict> => {
  const keys = threadIds.length > 0 ? threadIds : Object.keys(outcomes);
  return keys.flatMap((threadId) => {
    const outcome = outcomes[threadId];
    if (outcome === undefined) {
      return [];
    }
    const reply = outcome.reply?.trim() ?? '';
    const prose = proseOf({ outcome, reply });
    if (prose === '' && reply === '') {
      return [];
    }
    return [
      {
        threadId,
        prose: prose === '' ? null : prose,
        reply: reply === '' || reply === prose ? null : reply,
      },
    ];
  });
};
