import type { IssueBriefSource } from '../../../../store/slices/issue-briefs/types';

type Params = {
  readonly task: Omit<IssueBriefSource, 'body' | 'noun'>;
  readonly body: string;
  readonly noun?: string;
};

export const issueBriefSourceFor = ({ task, body, noun = 'issue' }: Params): IssueBriefSource => ({
  provider: task.provider,
  externalId: task.externalId,
  identifier: task.identifier,
  title: task.title,
  url: task.url,
  body,
  noun,
});
