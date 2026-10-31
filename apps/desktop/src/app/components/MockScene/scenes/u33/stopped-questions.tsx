import type { ComponentType } from 'react';
import { StoppedQuestionsScene } from './StoppedQuestionsScene';

export const U33_STOPPED_QUESTIONS_SCENES = {
  'u33-run-stopped-questions': StoppedQuestionsScene,
} satisfies Readonly<Record<string, ComponentType>>;
