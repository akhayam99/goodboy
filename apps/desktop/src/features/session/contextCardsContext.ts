import { createContext, type ComponentType } from 'react';
import type { Session } from '@goodboy/types';

export type ContextCardsProps = {
  readonly session: Session;
};

export const ContextCardsContext = createContext<ComponentType<ContextCardsProps> | null>(null);
