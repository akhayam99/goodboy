import { STORY_PLAN, STORY_RUN } from '../../scenes/story/storyContent';

export const GUARD_BRANCH = 'hl/fix-duplicate-credit';

export const AUTO_STORY = {
  first:
    'This touches payments-api and ledger-core, so I will not edit anything myself. A Planner reads both repositories first, and nothing is written until you approve its plan.',
  third: STORY_RUN.lead,
  final: STORY_RUN.final,
  implementerNote:
    'Reading the webhook consumers first. Then the credit is guarded on the event id, so a repeated delivery returns the original credit.',
  testerNote:
    'Running the existing posting checks in ledger-core against the guarded credit. Nothing in ledger-core is edited.',
  plannerTask: 'Plan the fix for HBL-412: one credit per event id.',
  implementerTask: STORY_RUN.implementerTask,
  implementerSummary: STORY_RUN.implementerSummary,
  testerTask: STORY_RUN.testerTask,
  testerSummary: STORY_RUN.testerSummary,
  planTitle: STORY_PLAN.title,
} as const;
