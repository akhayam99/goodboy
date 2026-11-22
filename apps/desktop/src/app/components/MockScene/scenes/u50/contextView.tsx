import type { ComponentType } from 'react';
import { ContextViewScene } from './ContextViewScene';

export const U50_CONTEXT_VIEW_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-context-view-light': () => <ContextViewScene theme="light" />,
  'u50-context-view-dark': () => <ContextViewScene theme="dark" />,
};
