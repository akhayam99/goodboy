import { createContext } from 'react';
import type { AgentId } from '@goodboy/types';

export const AutoSelectAgentContext = createContext<((agentId: AgentId) => void) | null>(null);
