import { createContext } from 'react';
import type { MenuPoint } from '@goodboy/ui';
import type { ObjectTarget } from '../../types';

export type ObjectMenuRequest = {
  readonly target: ObjectTarget;
  readonly point: MenuPoint;
  readonly anchorKey: string | null;
  readonly opener: HTMLElement | null;
};

export type ObjectMenuContextValue = {
  readonly open: (request: ObjectMenuRequest) => void;
};

export const ObjectMenuContext = createContext<ObjectMenuContextValue | null>(null);
