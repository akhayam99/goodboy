import type { LaunchMountSource } from './launchMountFor';
import type { InboxRecord } from './types';

type Params = {
  readonly record: InboxRecord;
};

export const launchMountSourceOf = ({ record }: Params): LaunchMountSource => ({
  provider: record.provider,
  url: record.url,
  sentryProject:
    record.payload.provider === 'sentry' ? (record.payload.issue.project?.slug ?? null) : null,
});
