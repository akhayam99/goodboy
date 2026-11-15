import { createContext, type ComponentType } from 'react';
import type { Session } from '@goodboy/types';

export type SessionHeadProps = {
  readonly session: Session;
};

export const SessionHeadContext = createContext<ComponentType<SessionHeadProps> | null>(null);
