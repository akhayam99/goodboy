import { GitlabPageScene } from './GitlabPageScene';

export const U23_GITLAB_SCENES = {
  'branch-pr-gitlab': () => <GitlabPageScene variant="open" />,
  'branch-pr-gitlab-merge': () => <GitlabPageScene variant="merge" />,
  'branch-pr-gitlab-denied': () => <GitlabPageScene variant="denied" />,
  'branch-checks-gitlab-jobs': () => <GitlabPageScene variant="jobs" />,
  'branch-pr-gitlab-none': () => <GitlabPageScene variant="none" />,
};
