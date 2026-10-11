import type { ComponentType } from 'react';
import { FixCommentsScene } from './FixCommentsScene';

export const U24_COMMENTS_FIX_SCENES: Readonly<Record<string, ComponentType>> = {
  'fixcomments-list': () => <FixCommentsScene phase="list" />,
  'fixcomments-selected': () => <FixCommentsScene phase="selected" />,
  'fixcomments-running': () => <FixCommentsScene phase="running" />,
};
