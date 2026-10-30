import type { ComponentType } from 'react';
import { RunQuestionsScene } from './RunQuestionsScene';
import { RunQuestionsShotScene } from './RunQuestionsShotScene';

export const U30_RUN_QUESTIONS_SCENES = {
  'u30-run-questions': RunQuestionsScene,
  'u30-run-questions-shot': RunQuestionsShotScene,
} satisfies Readonly<Record<string, ComponentType>>;
