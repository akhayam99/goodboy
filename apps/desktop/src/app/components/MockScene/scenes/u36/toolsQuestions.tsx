import type { ComponentType } from 'react';
import { OpenQuestionsScene } from '../flow-audit/OpenQuestionsScene';
import { LENS_QUESTIONS } from '../flow-audit/fixtures';
import { C08RunScene } from '../u25/C08RunScene';

const FIRST_QUESTION_ID = LENS_QUESTIONS[0]?.id ?? null;

export const U36_TOOLS_QUESTIONS_SCENES: Readonly<Record<string, ComponentType>> = {
  'u36-p7-tools-stay-light': () => (
    <C08RunScene state="working" selection="list" isToolOpen theme="light" />
  ),
  'u36-p7-tools-stay-dark': () => (
    <C08RunScene state="working" selection="list" isToolOpen theme="dark" />
  ),
  'u36-p8-question-light': () => (
    <OpenQuestionsScene drawerQuestionId={FIRST_QUESTION_ID} theme="light" />
  ),
  'u36-p8-question-dark': () => (
    <OpenQuestionsScene drawerQuestionId={FIRST_QUESTION_ID} theme="dark" />
  ),
};
