import { loadPullRequestView } from './loadPullRequestView';
import { notePullRequestEdit } from './notePullRequestEdit';
import { pullRequestViewInitialState } from './state';
import type {
  LoadPullRequestViewParams,
  NotePullRequestEditParams,
  PullRequestViewSlice,
} from './types';
import type { SliceDeps } from '../../slice-types';

export const createPullRequestViewSlice = ({ set, get }: SliceDeps): PullRequestViewSlice => ({
  ...pullRequestViewInitialState,
  loadPullRequestView: (params: LoadPullRequestViewParams) =>
    loadPullRequestView({ set, get, ...params }),
  notePullRequestEdit: (params: NotePullRequestEditParams) =>
    notePullRequestEdit({ set, ...params }),
});
