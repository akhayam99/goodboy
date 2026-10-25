import { brandId, type IsoDateTime, type MountId, type ProjectId } from '@goodboy/types';
import type { MountGithubState } from '../../../types';

type Params = {
  readonly mountId: MountId;
  readonly projectId?: ProjectId;
  readonly fetchedAt?: string;
};

export const aMountGithub = ({
  mountId,
  projectId = brandId<ProjectId>({ value: 'project-payments-api' }),
  fetchedAt = '2026-10-07T08:00:00.000Z',
}: Params): MountGithubState => ({
  pr: null,
  linkedIssues: [],
  fetchedAt: brandId<IsoDateTime>({ value: fetchedAt }),
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
  mountId,
  projectId,
  revision: 1,
  repository: 'harborline/payments-api',
  host: 'github.com',
  branch: 'ak/fix-credit',
  prs: [],
  links: [],
});
