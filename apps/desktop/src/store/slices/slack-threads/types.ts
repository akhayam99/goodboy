import type { WorkspaceId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export type SlackWorkspaceParams = {
  readonly workspaceId: WorkspaceId;
};

export type SlackChannelParams = SlackWorkspaceParams & {
  readonly channelId: string;
};

export type SlackThreadParams = SlackChannelParams & {
  readonly threadTs: string;
};

export type SlackReplyParams = SlackThreadParams & {
  readonly text: string;
};

export type SlackReactionParams = SlackThreadParams & {
  readonly messageTs: string;
  readonly name: string;
};
