import type { ComponentType } from 'react';
import { AgentPageScene } from './AgentPageScene';
import { ArtifactsRowsScene } from './ArtifactsRowsScene';
import { ScriptsEmptyGroupScene } from './ScriptsEmptyGroupScene';
import { ScriptsRowsScene } from './ScriptsRowsScene';

export const U23_LISTS_SCENES: Readonly<Record<string, ComponentType>> = {
  'agent-finished-model': () => <AgentPageScene isRunning={false} />,
  'agent-running-stop': () => <AgentPageScene isRunning />,
  'artifacts-rows': ArtifactsRowsScene,
  'scripts-rows': ScriptsRowsScene,
  'scripts-empty-group': ScriptsEmptyGroupScene,
};
