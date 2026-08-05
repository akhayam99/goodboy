import type { WorkspaceId } from '@goodboy/types';

type Params = {
  readonly task: {
    readonly externalId: string;
    readonly mountWorkspaceId?: WorkspaceId | null;
  };
};

export const integrationTaskKey = ({ task }: Params): string =>
  `${task.externalId}:${task.mountWorkspaceId ?? ''}`;
