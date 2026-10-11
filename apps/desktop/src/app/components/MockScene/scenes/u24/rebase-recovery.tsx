import { RebaseRecoveryBannerScene } from './RebaseRecoveryBannerScene';
import { RewriterTranscriptScene } from './RewriterTranscriptScene';

export const U24_REBASE_RECOVERY_SCENES = {
  'rebase-stuck-note': () => <RebaseRecoveryBannerScene state="stuck" isNoteOpen />,
  'rebase-origin-moved': () => <RebaseRecoveryBannerScene state="origin-moved" />,
  'rebase-push-failed': () => <RebaseRecoveryBannerScene state="push-failed" />,
  'rewriter-transcript-finished': () => <RewriterTranscriptScene />,
};
