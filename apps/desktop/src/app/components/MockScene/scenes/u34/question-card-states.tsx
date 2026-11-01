import type { ComponentType } from 'react';
import { QuestionCardStatesScene } from './QuestionCardStatesScene';

export const U34_QUESTION_CARD_SCENES = {
  'u34-question-card-states': QuestionCardStatesScene,
} satisfies Readonly<Record<string, ComponentType>>;
