import { createContext } from 'react';
import type { SessionId } from '@goodboy/types';

export type CodeActionTarget = {
  readonly sessionId: SessionId | null;
  readonly workingDir: string | null;
};

export const CodeActionTargetContext = createContext<CodeActionTarget>({
  sessionId: null,
  workingDir: null,
});
