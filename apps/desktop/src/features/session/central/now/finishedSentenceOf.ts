import type { PullRequestStateKind } from '@goodboy/types';
import type { BranchFacts } from '../branches/branchFactsOf';

type RequestFacts = NonNullable<BranchFacts['request']>;

type Params = {
  readonly facts: ReadonlyArray<BranchFacts>;
};

type RequestParams = {
  readonly request: RequestFacts;
};

type StateParams = RequestParams & {
  readonly isLead: boolean;
};

const checksSentenceOf = ({ request }: RequestParams): string | null => {
  const ref = `${request.noun}${request.number}`;
  if (request.checksWord === 'checks passing') {
    return `Checks passed on ${ref}.`;
  }
  if (request.checksWord === 'checks failing') {
    return `Checks failed on ${ref}.`;
  }
  if (request.checksWord === 'checks running') {
    return `Checks are running on ${ref}.`;
  }
  return null;
};

const stateWordOf = ({ request }: RequestParams): string => {
  const state: PullRequestStateKind = request.state;
  switch (state) {
    case 'merged':
      return 'merged';
    case 'closed':
      return 'closed';
    case 'queued':
      return 'in the merge queue';
    case 'approved':
      return 'approved';
    case 'draft':
      return 'still a draft';
    case 'open':
      return request.isDraft ? 'still a draft' : 'ready for review';
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

const stateSentenceOf = ({ request, isLead }: StateParams): string => {
  const word = stateWordOf({ request });
  return isLead
    ? `${request.noun}${request.number} is ${word}.`
    : `${word.charAt(0).toUpperCase()}${word.slice(1)}.`;
};

export const finishedSentenceOf = ({ facts }: Params): string | null => {
  const [only] = facts;
  if (facts.length !== 1 || only === undefined || only.request === null) {
    return null;
  }
  const { request } = only;
  if (request.state === 'merged' || request.state === 'closed') {
    return stateSentenceOf({ request, isLead: true });
  }
  const checks = checksSentenceOf({ request });
  if (checks === null) {
    return stateSentenceOf({ request, isLead: true });
  }
  return request.checksWord === 'checks passing'
    ? `${checks} ${stateSentenceOf({ request, isLead: false })}`
    : checks;
};
