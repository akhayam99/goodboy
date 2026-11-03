import type { ComponentType } from 'react';
import { RunQuestionsScene } from './RunQuestionsScene';

export const U32_RUN_QUESTIONS_SCENES = {
  'u32-run-questions': RunQuestionsScene,
} satisfies Readonly<Record<string, ComponentType>>;
