import { RebaseRecoveryBannerScene } from '../u24/RebaseRecoveryBannerScene';

export const U25_B_PUSH_FIX_SCENES = {
  'push-failed-hook': () => <RebaseRecoveryBannerScene state="push-failed" />,
  'push-fixing': () => <RebaseRecoveryBannerScene state="fixing-push" />,
};
