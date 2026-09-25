import { useEffect } from 'react';
import { ToastProvider } from '../Toast';
import { WorkspaceScene } from './scenes/WorkspaceScene';
import { WorkflowScene } from './scenes/WorkflowScene';
import { ShellScene } from './scenes/ShellScene';
import { ChatShellScene } from './scenes/ChatShellScene';
import { InboxScene } from './scenes/InboxScene';
import { ConversationScene } from './scenes/ConversationScene';
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
import { ActivityRunScene } from './scenes/ActivityRunScene';
import { WorkflowBuilderScene } from './scenes/flow-audit/WorkflowBuilderScene';
import { WorkflowRunScene } from './scenes/flow-audit/WorkflowRunScene';
import { OpenQuestionsScene } from './scenes/flow-audit/OpenQuestionsScene';
import { TranscriptScene } from './scenes/flow-audit/TranscriptScene';
import { CommandPaletteScene } from './scenes/flow-audit/CommandPaletteScene';
import {
  ScriptsLensScene,
  ResolveQueueShellScene,
  ResolvePublishBlockedScene,
  ArtifactsLensShellScene,
} from './scenes/SurfaceAuditScenes';
import { LensSwitcherClosedScene, LensSwitcherScene } from './scenes/LensSwitcherScenes';
import { CardRailsScene } from './scenes/CardRailsScene';
import { ProvidersScene } from './scenes/ProvidersScene';
import { ImpactScene } from './scenes/ImpactScene';
import {
  ModelPickerCodexScene,
  ModelPickerCursorScene,
  ModelPickerScene,
  ModelPickerTriggersScene,
} from './scenes/ModelPickerScenes';

import { FrameScene } from './scenes/audit/FrameScene';
import { BoardStatesScene } from './scenes/audit/BoardStatesScene';
import { SessionStatesScene } from './scenes/audit/SessionStatesScene';
import { WorkspaceStatesScene } from './scenes/audit/WorkspaceStatesScene';
import { SettingsAppScene } from './scenes/audit/SettingsAppScene';
import { SettingsNoWorkspaceScene } from './scenes/audit/SettingsNoWorkspaceScene';
import { SettingsProvidersScene } from './scenes/audit/SettingsProvidersScene';
import { SettingsToolsScene } from './scenes/audit/SettingsToolsScene';
import { SettingsWorkspaceScene } from './scenes/audit/SettingsWorkspaceScene';
import { OnboardingScene } from './scenes/audit/OnboardingScene';
import { ToastsScene } from './scenes/audit/ToastsScene';
import { UpdateConfirmScene } from './scenes/audit/UpdateConfirmScene';
import { NotificationsScene } from './scenes/audit/NotificationsScene';
import { ChangelogScene } from './scenes/audit/ChangelogScene';
import { ArtifactStatesScene } from './scenes/audit/ArtifactStatesScene';
import { InboxStatesScene } from './scenes/audit/InboxStatesScene';
import { CompanionScene } from './scenes/audit/CompanionScene';
import { ReviewModesScene } from './scenes/audit/ReviewModesScene';
import { WorkflowStudioScene } from './scenes/audit/WorkflowStudioScene';
import { WorkflowBuilderModesScene } from './scenes/audit/WorkflowBuilderModesScene';
import { ImpactScopesScene } from './scenes/audit/ImpactScopesScene';
import { ExploreScene } from './scenes/audit/ExploreScene';

export const MOCK_SCENES = {
  workspace: WorkspaceScene,
  workflow: WorkflowScene,
  shell: ShellScene,
  'chat-shell': ChatShellScene,
  inbox: InboxScene,
  conversation: ConversationScene,
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
  'activity-run': ActivityRunScene,
  'workflow-builder': WorkflowBuilderScene,
  'workflow-run': WorkflowRunScene,
  'open-questions': OpenQuestionsScene,
  transcript: TranscriptScene,
  'command-palette': CommandPaletteScene,
  'scripts-lens': ScriptsLensScene,
  'resolve-queue-shell': ResolveQueueShellScene,
  'resolve-publish-blocked': ResolvePublishBlockedScene,
  'artifacts-lens-shell': ArtifactsLensShellScene,
  'card-rails': CardRailsScene,
  'lens-switcher': LensSwitcherScene,
  'lens-switcher-closed': LensSwitcherClosedScene,
  providers: ProvidersScene,
  impact: ImpactScene,
  'model-picker': ModelPickerScene,
  'model-picker-cursor': ModelPickerCursorScene,
  'model-picker-codex': ModelPickerCodexScene,
  'model-picker-triggers': ModelPickerTriggersScene,
  frame: FrameScene,
  'board-states': BoardStatesScene,
  'session-states': SessionStatesScene,
  'workspace-states': WorkspaceStatesScene,
  'settings-app': SettingsAppScene,
  'settings-no-workspace': SettingsNoWorkspaceScene,
  'settings-providers': SettingsProvidersScene,
  'settings-tools': SettingsToolsScene,
  'settings-workspace': SettingsWorkspaceScene,
  onboarding: OnboardingScene,
  toasts: ToastsScene,
  'update-confirm': UpdateConfirmScene,
  notifications: NotificationsScene,
  changelog: ChangelogScene,
  'artifact-states': ArtifactStatesScene,
  'inbox-states': InboxStatesScene,
  companion: CompanionScene,
  'review-modes': ReviewModesScene,
  'workflow-studio': WorkflowStudioScene,
  'workflow-builder-modes': WorkflowBuilderModesScene,
  'impact-scopes': ImpactScopesScene,
  explore: ExploreScene,
};

export const MockScene = () => {
  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

  const params = new URLSearchParams(window.location.search);
  const sceneName = params.get('scene') ?? 'workspace';
  const Scene =
    Object.entries(MOCK_SCENES).find(([key]) => key === sceneName)?.[1] ?? WorkspaceScene;

  useEffect(() => {
    if (params.get('theme') !== 'light') {
      return;
    }
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  return (
    <ToastProvider>
      <Scene />
    </ToastProvider>
  );
};
