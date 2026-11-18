import { PushFailureScene } from './PushFailureScene';

export const U25_B_INT_FIX_SCENES = {
  'branch-push-failed': () => <PushFailureScene variant="plain" />,
  'branch-force-push-failed': () => <PushFailureScene variant="force" />,
  'branch-force-push-origin-moved': () => <PushFailureScene variant="origin-moved" />,
  'branch-force-push-origin-checked': () => <PushFailureScene variant="origin-checked" />,
};
