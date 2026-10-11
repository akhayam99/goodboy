import type { ComponentType } from 'react';
import { CommentsTriageScene } from './CommentsTriageScene';

export const U24_COMMENTS_TRIAGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'fixcomments-mixed': () => <CommentsTriageScene phase="mixed" />,
  'fixcomments-question': () => <CommentsTriageScene phase="question" />,
  'fixcomments-applied': () => <CommentsTriageScene phase="applied" />,
};
