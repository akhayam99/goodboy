import { BitbucketMarksScene } from './BitbucketMarksScene';
import { BitbucketPageScene } from './BitbucketPageScene';

export const U23_BITBUCKET_SCENES = {
  'branch-pr-bitbucket': () => <BitbucketPageScene variant="pr" />,
  'branch-pr-bitbucket-merge': () => <BitbucketPageScene variant="merge" />,
  'branch-pr-bitbucket-denied': () => <BitbucketPageScene variant="denied" />,
  'branch-checks-bitbucket-rows': () => <BitbucketPageScene variant="checks" />,
  'session-marks-bitbucket': BitbucketMarksScene,
};
