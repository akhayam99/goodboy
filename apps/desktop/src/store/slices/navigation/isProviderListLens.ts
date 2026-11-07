const PROVIDER_LIST_LENSES: ReadonlySet<string> = new Set([
  'linear',
  'gitlab_issues',
  'jira_issues',
  'slack_threads',
]);

type Params = {
  readonly lens: string | null | undefined;
};

export const isProviderListLens = ({ lens }: Params): boolean =>
  lens !== null && lens !== undefined && PROVIDER_LIST_LENSES.has(lens);
