import type { BranchRequestFacts } from '../branches/branchFactsOf';

type Params = {
  readonly request: Pick<BranchRequestFacts, 'noun'>;
};

const REQUEST_SHORT = { '#': 'PR', '!': 'MR' } as const satisfies Readonly<
  Record<'#' | '!', string>
>;

export const requestShortOf = ({ request }: Params): string => REQUEST_SHORT[request.noun];
