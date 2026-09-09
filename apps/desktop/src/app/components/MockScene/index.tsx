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
