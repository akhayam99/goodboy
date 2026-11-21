import { Suspense, lazy } from 'react';
import { SkeletonRow } from '@goodboy/ui';
import type { Project, WorkspaceGitStatus } from '@goodboy/types';

const Detail = lazy(() =>
  import('./ProjectGitDetail').then((module) => ({ default: module.ProjectGitDetail })),
);

type Props = {
  readonly project: Project;
  readonly status: WorkspaceGitStatus | null;
};

export const LazyProjectGitDetail = ({ project, status }: Props) => (
  <Suspense fallback={<SkeletonRow label="Reading git status" />}>
    <Detail project={project} status={status} />
  </Suspense>
);
