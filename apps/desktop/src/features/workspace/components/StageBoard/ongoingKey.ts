import type { SessionExternalTaskProvider } from '@goodboy/types';

type Params = {
  readonly task: {
    readonly provider: SessionExternalTaskProvider;
    readonly externalId: string;
  };
};

export const ongoingKey = ({ task }: Params): string => `${task.provider}:${task.externalId}`;
