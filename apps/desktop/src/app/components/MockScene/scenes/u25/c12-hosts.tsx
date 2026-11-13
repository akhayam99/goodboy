import { BITBUCKET_PR_RECORD, GITHUB_PR_RECORD, GITLAB_MR_RECORD } from './c12/hostPrSeed';
import { HostPrScene } from './c12/HostPrScene';

export const U25_C12_HOST_SCENES = {
  'c12-pr-github': () => <HostPrScene record={GITHUB_PR_RECORD} />,
  'c12-mr-gitlab': () => <HostPrScene record={GITLAB_MR_RECORD} />,
  'c12-pr-bitbucket': () => <HostPrScene record={BITBUCKET_PR_RECORD} />,
};
