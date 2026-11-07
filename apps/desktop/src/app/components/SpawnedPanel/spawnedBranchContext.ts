import { createContext } from 'react';
import type { AgentId } from '@goodboy/types';

const NO_LABELS: ReadonlyMap<AgentId, string> = new Map();

export const SpawnedBranchContext = createContext<ReadonlyMap<AgentId, string>>(NO_LABELS);
