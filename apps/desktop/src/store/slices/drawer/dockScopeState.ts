import type { SessionId } from '@goodboy/types';

export type DockScope = SessionId | null;

export type DockScopeState = {
  readonly dockScope: DockScope | undefined;
};

export const dockScopeInitialState: DockScopeState = {
  dockScope: undefined,
};
