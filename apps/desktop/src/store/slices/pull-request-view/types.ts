import type { MountId, SessionId } from '@goodboy/types';
import type { PullRequestEdit, PullRequestViewState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type LoadPullRequestViewParams = Readonly<{
  sessionId: SessionId;
  mountId?: MountId;
  force?: boolean;
}>;

export type NotePullRequestEditParams = Readonly<{
  sessionId: SessionId;
  prNumber: number;
  mountId?: MountId;
  what: PullRequestEdit['what'];
}>;

export type PullRequestViewSlice = PullRequestViewState & {
  loadPullRequestView(params: LoadPullRequestViewParams): Promise<void>;
  notePullRequestEdit(params: NotePullRequestEditParams): void;
};
