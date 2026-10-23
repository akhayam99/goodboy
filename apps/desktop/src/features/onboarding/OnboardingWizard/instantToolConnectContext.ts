import { createContext } from 'react';
import type { WorkspaceId } from '@goodboy/types';

export type InstantTool = 'gitlab' | 'bitbucket' | 'linear' | 'jira';

type InstantConnectParams = {
  readonly workspaceId: WorkspaceId;
  readonly tool: InstantTool;
};

export type InstantToolConnect = ((params: InstantConnectParams) => void) | null;

export const InstantToolConnectContext = createContext<InstantToolConnect>(null);
