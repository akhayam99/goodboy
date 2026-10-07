import { ChecksScene } from './ChecksScene';

export const U21_CHECKS_SCENES = {
  'branch-checks': () => <ChecksScene variant="runs" />,
  'branch-checks-failing': () => <ChecksScene variant="failing" />,
  'branch-checks-denied': () => <ChecksScene variant="denied" />,
  'branch-checks-empty': () => <ChecksScene variant="empty" />,
  'branch-checks-no-pr': () => <ChecksScene variant="no-pr" />,
  'branch-checks-gitlab': () => <ChecksScene variant="gitlab" />,
  'branch-checks-loading': () => <ChecksScene variant="loading" />,
};
