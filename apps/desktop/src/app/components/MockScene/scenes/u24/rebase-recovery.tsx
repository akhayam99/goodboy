import { RebaseRecoveryBannerScene } from './RebaseRecoveryBannerScene';
import { RewriterTranscriptScene } from './RewriterTranscriptScene';

export const U24_REBASE_RECOVERY_SCENES = {
  'rebase-stuck-note': () => <RebaseRecoveryBannerScene state="stuck" isNoteOpen />,
  'rebase-origin-moved': () => <RebaseRecoveryBannerScene state="origin-moved" />,
  'rebase-origin-moved-long-title': () => (
    <RebaseRecoveryBannerScene state="origin-moved" query="title=long" />
  ),
  'rebase-origin-settled': () => (
    <RebaseRecoveryBannerScene state="origin-moved" query="origin=caught-up" />
  ),
  'rebase-done-card': () => <RebaseRecoveryBannerScene state="done" />,
  'rebase-push-failed': () => <RebaseRecoveryBannerScene state="push-failed" />,
  'rewriter-transcript-finished': () => <RewriterTranscriptScene />,
};
