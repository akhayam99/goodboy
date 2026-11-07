import type { SessionExternalTaskProvider } from '@goodboy/types';

const PROVIDER_OF_LIST_LENS: ReadonlyMap<string, SessionExternalTaskProvider> = new Map([
  ['linear', 'linear'],
  ['gitlab_issues', 'gitlab'],
  ['jira_issues', 'jira'],
  ['slack_threads', 'slack'],
]);

type Params = {
  readonly lens: string | null | undefined;
};

export const providerOfListLens = ({ lens }: Params): SessionExternalTaskProvider | null => {
  if (lens === null || lens === undefined) {
    return null;
  }
  return PROVIDER_OF_LIST_LENS.get(lens) ?? null;
};
