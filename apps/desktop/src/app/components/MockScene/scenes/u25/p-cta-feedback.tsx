import { CtaFeedbackScene } from './CtaFeedbackScene';

export const U25_P_CTA_FEEDBACK_SCENES = {
  'cta-push-pending': () => <CtaFeedbackScene variant="pending" />,
  'cta-push-done': () => <CtaFeedbackScene variant="done" />,
  'cta-push-failed': () => <CtaFeedbackScene variant="failed" />,
};
