import { createContext, useContext } from 'react';
import type { SessionDiff } from '../diff/hooks/useSessionDiff';

export const BranchDiffContext = createContext<SessionDiff | null>(null);

export const useBranchDiff = (): SessionDiff | null => useContext(BranchDiffContext);
