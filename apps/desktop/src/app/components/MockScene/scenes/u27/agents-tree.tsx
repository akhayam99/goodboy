import type { ComponentType } from 'react';
import { AgentsTreeScene } from './AgentsTreeScene';

export const U27_AGENTS_TREE_SCENES: Readonly<Record<string, ComponentType>> = {
  'u27-agents-tree-light': () => <AgentsTreeScene theme="light" isFocused={false} />,
  'u27-agents-tree-dark': () => <AgentsTreeScene theme="dark" isFocused={false} />,
  'u27-agents-tree-focus-light': () => <AgentsTreeScene theme="light" isFocused />,
  'u27-agents-tree-focus-dark': () => <AgentsTreeScene theme="dark" isFocused />,
};
