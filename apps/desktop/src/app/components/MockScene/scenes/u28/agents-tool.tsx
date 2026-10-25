import type { ComponentType } from 'react';
import { AgentsToolScene } from './AgentsToolScene';
import { AGENTS_TOOL_RUNNER_ID } from './agentsToolSeed';

export const U28_AGENTS_TOOL_SCENES: Readonly<Record<string, ComponentType>> = {
  'u28-agents-tool-loose': () => (
    <AgentsToolScene isEmpty={false} selectedAgentId={AGENTS_TOOL_RUNNER_ID} />
  ),
  'u28-agents-tool-empty': () => <AgentsToolScene isEmpty />,
};
