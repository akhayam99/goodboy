import type { ComponentType } from 'react';
import { AgentTreeScene } from './AgentTreeScene';

export const AGENT_TREE_SCENES = {
  'agent-tree-lead': () => <AgentTreeScene theme="dark" />,
  'agent-tree-lead-light': () => <AgentTreeScene theme="light" />,
  'agent-tree-lead-folded': () => <AgentTreeScene theme="dark" isFolded />,
  'agent-tree-lead-folded-light': () => <AgentTreeScene theme="light" isFolded />,
} satisfies Readonly<Record<string, ComponentType>>;
