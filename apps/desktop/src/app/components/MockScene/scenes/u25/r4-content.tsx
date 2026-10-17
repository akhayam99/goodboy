import { ActivityRunScene } from '../ActivityRunScene';
import { MountsScene } from '../MountsScene';
import { OpenQuestionsScene } from '../flow-audit/OpenQuestionsScene';
import { LENS_QUESTIONS } from '../flow-audit/fixtures';

export const U25_R4_CONTENT_SCENES = {
  'r4-context-cards': () => <ActivityRunScene contextTab="goal" />,
  'r4-context-summary': () => <ActivityRunScene contextTab="summary" />,
  'r4-overview-title': () => <MountsScene variant="linked-title" />,
  'r4-questions': () => <OpenQuestionsScene />,
  'r4-questions-drawer': () => (
    <OpenQuestionsScene drawerQuestionId={LENS_QUESTIONS[0]?.id ?? null} />
  ),
};
