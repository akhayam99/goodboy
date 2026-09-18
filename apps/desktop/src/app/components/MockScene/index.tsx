import { useEffect } from 'react';
import { ToastProvider } from '../Toast';
import { WorkspaceScene } from './scenes/WorkspaceScene';
import { WorkflowScene } from './scenes/WorkflowScene';
import { ShellScene } from './scenes/ShellScene';
import { MountsScene } from './scenes/MountsScene';
import { MountMismatchScene } from './scenes/MountMismatchScene';
import { ResolveScene } from './scenes/ResolveScene';
import { ResolveItemScene } from './scenes/ResolveItemScene';
import { BoardScene } from './scenes/BoardScene';
import { TranscriptMountScene } from './scenes/TranscriptMountScene';
import { BoardShellScene } from './scenes/BoardShellScene';
import {
  ArtifactGeneratingScene,
  ArtifactReportScene,
  ArtifactWireframeHighScene,
  ArtifactWireframeLowScene,
} from './scenes/ArtifactScenes';
import {
  ArtifactCreateReportScene,
  ArtifactCreateWireframeScene,
} from './scenes/ArtifactCreationScenes';
import { ActivityFilterScene, ActivityTimelineScene } from './scenes/ActivityScenes';
import {
  WorkflowBuilderScene,
  WorkflowRunScene,
  OpenQuestionsScene,
  TranscriptScene,
  CommandPaletteScene,
} from './scenes/FlowAuditScenes';
import {
  ScriptsLensScene,
  ScriptsSidebarScene,
  ResolveQueueShellScene,
  ResolvePublishBlockedScene,
  ArtifactsLensShellScene,
} from './scenes/SurfaceAuditScenes';
import { LensSwitcherClosedScene, LensSwitcherScene } from './scenes/LensSwitcherScenes';

const SCENES = {
  workspace: WorkspaceScene,
  workflow: WorkflowScene,
  shell: ShellScene,
  mounts: MountsScene,
  'mount-mismatch': MountMismatchScene,
  resolve: ResolveScene,
  'resolve-item': ResolveItemScene,
  board: BoardScene,
  'transcript-mount': TranscriptMountScene,
  'board-shell': BoardShellScene,
  'artifact-report': ArtifactReportScene,
  'artifact-wireframe-low': ArtifactWireframeLowScene,
  'artifact-wireframe-high': ArtifactWireframeHighScene,
  'artifact-generating': ArtifactGeneratingScene,
  'artifact-create-report': ArtifactCreateReportScene,
  'artifact-create-wireframe': ArtifactCreateWireframeScene,
  activity: ActivityTimelineScene,
  'activity-filter': ActivityFilterScene,
  'workflow-builder': WorkflowBuilderScene,
  'workflow-run': WorkflowRunScene,
  'open-questions': OpenQuestionsScene,
  transcript: TranscriptScene,
  'command-palette': CommandPaletteScene,
  'scripts-lens': ScriptsLensScene,
  'scripts-sidebar': ScriptsSidebarScene,
  'resolve-queue-shell': ResolveQueueShellScene,
  'resolve-publish-blocked': ResolvePublishBlockedScene,
  'artifacts-lens-shell': ArtifactsLensShellScene,
  'lens-switcher': LensSwitcherScene,
  'lens-switcher-closed': LensSwitcherClosedScene,
};

export const MockScene = () => {
  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

  const sceneName = new URLSearchParams(window.location.search).get('scene') ?? 'workspace';
  const Scene = SCENES[sceneName as keyof typeof SCENES] ?? WorkspaceScene;

  return (
    <ToastProvider>
      <Scene />
    </ToastProvider>
  );
};
