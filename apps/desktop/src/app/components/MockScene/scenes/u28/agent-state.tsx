import type { ComponentType } from 'react';
import { AgentStateRunsScene } from './AgentStateRunsScene';

export const U28_AGENT_STATE_SCENES: Readonly<Record<string, ComponentType>> = {
  'u28-agent-state-runs': AgentStateRunsScene,
};
