import type { ComponentType } from 'react';
import { LeadAskLongAnswerScene } from './LeadAskLongAnswerScene';

export const U47_LEAD_ASK_SCENES = {
  'u47-lead-ask-long-answer': () => <LeadAskLongAnswerScene />,
} satisfies Readonly<Record<string, ComponentType>>;
