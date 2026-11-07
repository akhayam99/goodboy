import type { GhRunner, GhRunOptions } from './gh';
import { GhCliError, GhJsonParseError, runJson } from './gh';

const REVIEW_AUTHORS_QUERY = `query($owner:String!,$name:String!,$pr:Int!){
  repository(owner:$owner,name:$name){
    pullRequest(number:$pr){
      reviews(last:100){
        nodes{
          author{__typename login}
        }
      }
    }
  }
}`;

type RawReviewAuthors = {
  readonly data?: {
    readonly repository?: {
      readonly pullRequest?: {
        readonly reviews?: {
          readonly nodes?: ReadonlyArray<{
            readonly author?: {
              readonly __typename?: string | null;
              readonly login?: string | null;
            } | null;
          } | null> | null;
        } | null;
      } | null;
    } | null;
  } | null;
  readonly errors?: ReadonlyArray<{ readonly message: string }>;
};

type Params = {
  readonly runner: GhRunner;
  readonly repo: string;
  readonly prNumber: number;
  readonly opts: GhRunOptions;
};

export const fetchReviewBotLogins = async ({
  runner,
  repo,
  prNumber,
  opts,
}: Params): Promise<ReadonlySet<string> | null> => {
  const [owner = '', name = ''] = repo.split('/');
  if (owner === '' || name === '') {
    return null;
  }
  try {
    const raw = await runJson<RawReviewAuthors>({
      runner,
      args: [
        'api',
        'graphql',
        '-f',
        `query=${REVIEW_AUTHORS_QUERY}`,
        '-F',
        `owner=${owner}`,
        '-F',
        `name=${name}`,
        '-F',
        `pr=${prNumber}`,
      ],
      opts,
      shape: 'object',
    });
    const nodes = raw.data?.repository?.pullRequest?.reviews?.nodes;
    if ((raw.errors ?? []).length > 0 || nodes === undefined || nodes === null) {
      return null;
    }
    return new Set(
      nodes
        .filter((node) => node?.author?.__typename === 'Bot')
        .map((node) => (node?.author?.login ?? '').toLowerCase())
        .filter((login) => login !== ''),
    );
  } catch (err) {
    if (err instanceof GhCliError || err instanceof GhJsonParseError) {
      return null;
    }
    throw err;
  }
};
