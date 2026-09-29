import { invokeCommand } from '../../shared/lib/invokeCommand';

export type ReleaseNote = {
  readonly version: string;
  readonly publishedAt: string;
  readonly body: string;
  readonly htmlUrl: string;
};

export const fetchReleases = async (): Promise<ReadonlyArray<ReleaseNote>> => {
  return invokeCommand<ReleaseNote[]>('releases_list');
};
