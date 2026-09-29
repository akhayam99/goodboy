import { useEffect } from 'react';
import { ToastProvider } from '../Toast';
import { ObjectMenuProvider } from '../../../features/actions/components/ObjectMenuProvider';
import { finish as finishOnboarding } from '../../../features/onboarding/onboarding-store';
import { WorkspaceScene } from './scenes/WorkspaceScene';
import { WorkflowScene } from './scenes/WorkflowScene';
import { ShellScene } from './scenes/ShellScene';
import { ChatShellScene } from './scenes/ChatShellScene';
import { ChatRoomScene } from './scenes/ChatRoomScene';
import { InboxScene } from './scenes/InboxScene';
import { InboxSourceScene } from './scenes/InboxSourceScene';
import { ConversationScene } from './scenes/ConversationScene';
import { MountsScene } from './scenes/MountsScene';
import { MountMismatchScene } from './scenes/MountMismatchScene';
import { ResolveScene } from './scenes/ResolveScene';
import { ResolveSelectScene } from './scenes/ResolveSelectScene';
import { ResolveDriftScene } from './scenes/ResolveDriftScene';
import { ResolveCommitStoryScene } from './scenes/ResolveCommitStoryScene';
import { ResolveItemScene } from './scenes/ResolveItemScene';
import { ResolveFailedHistoryScene } from './scenes/ResolveFailedHistoryScene';
import { ResolveFailedRunScene } from './scenes/ResolveFailedRunScene';
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
import { ActivityQuestionScene } from './scenes/ActivityQuestionScene';
import { ActivityOneSignalScene } from './scenes/ActivityOneSignalScene';
import { ContextDrawerScene } from './scenes/ContextDrawerScene';
import { WorkflowBuilderScene } from './scenes/flow-audit/WorkflowBuilderScene';
import { WorkflowRunScene } from './scenes/flow-audit/WorkflowRunScene';
import { OpenQuestionsScene } from './scenes/flow-audit/OpenQuestionsScene';
import { TranscriptScene } from './scenes/flow-audit/TranscriptScene';
import { CommandPaletteScene } from './scenes/flow-audit/CommandPaletteScene';
import { SearchScene } from './scenes/search/SearchScene';
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
import { ModelPickerClaudeScene } from './scenes/ModelPickerClaudeScene';

import { FrameScene } from './scenes/audit/FrameScene';
import { BoardStatesScene } from './scenes/audit/BoardStatesScene';
import { SessionStatesScene } from './scenes/audit/SessionStatesScene';
import { FeaturesStartTabsScene } from './scenes/features/StartTabsScene';
import { FeaturesReviewPushConfirmScene } from './scenes/features/ReviewPushConfirmScene';
import { FeaturesWriteReviewScene } from './scenes/features/WriteReviewScene';
import { SessionStartScene } from './scenes/audit/SessionStartScene';
import { WorkspaceStatesScene } from './scenes/audit/WorkspaceStatesScene';
import { SettingsAppScene } from './scenes/audit/SettingsAppScene';
import { SettingsNoWorkspaceScene } from './scenes/audit/SettingsNoWorkspaceScene';
import { SettingsProvidersScene } from './scenes/audit/SettingsProvidersScene';
import { SettingsToolsScene } from './scenes/audit/SettingsToolsScene';
import { SettingsWorkspaceScene } from './scenes/audit/SettingsWorkspaceScene';
import { OnboardingScene } from './scenes/audit/OnboardingScene';
import { ToastsScene } from './scenes/audit/ToastsScene';
import { UpdateConfirmScene } from './scenes/audit/UpdateConfirmScene';
import { UpdateWhatsNewScene } from './scenes/audit/UpdateWhatsNewScene';
import { NotificationsScene } from './scenes/audit/NotificationsScene';
import { ChangelogScene } from './scenes/audit/ChangelogScene';
import { ArtifactStatesScene } from './scenes/audit/ArtifactStatesScene';
import { InboxStatesScene } from './scenes/audit/InboxStatesScene';
import { CompanionScene } from './scenes/audit/CompanionScene';
import { ReviewModesScene } from './scenes/audit/ReviewModesScene';
import { CodeLayersScene } from './scenes/CodeLayersScene';
import { WorkflowStudioScene } from './scenes/audit/WorkflowStudioScene';
import { WorkflowBuilderModesScene } from './scenes/audit/WorkflowBuilderModesScene';
import { FormsAuditScene } from './scenes/audit/FormsAuditScene';
import { ImpactScopesScene } from './scenes/audit/ImpactScopesScene';
import { ExploreScene } from './scenes/audit/ExploreScene';
import { DesignScaleScene } from './scenes/DesignScaleScene';
import { ListboxScene } from './scenes/ListboxScene';
import { FeaturesImpactOverviewScene } from './scenes/features/ImpactOverviewScene';
import { FeaturesNewerDataScene } from './scenes/features/NewerDataScene';
import { RepoStatusScene } from './scenes/features/RepoStatusScene';
import { PaletteQueryScene } from './scenes/features/PaletteQueryScene';
import { FeaturesReportSheetScene } from './scenes/features/ReportSheetScene';
import { FeaturesScriptDrawerScene } from './scenes/features/ScriptDrawerScene';
import { FeaturesComposerMenuScene } from './scenes/features/ComposerMenuScene';
import { FeaturesSlackPermissionsScene } from './scenes/features/SlackPermissionsScene';
import { WorkspaceProjectsScene } from './scenes/features/WorkspaceProjectsScene';
import { BrandKickoffScene } from './scenes/brand/KickoffScene';
import { BrandLookupScene } from './scenes/brand/LookupScene';
import { BrandSlackScene } from './scenes/brand/SlackScene';
import { BrandContextScene } from './scenes/brand/ContextScene';
import { BrandCompareScene } from './scenes/brand/CompareScene';
import { BrandDiffScene } from './scenes/brand/DiffScene';
import { BrandDiffManyFilesScene } from './scenes/brand/DiffManyFilesScene';
import { BrandHistoryScene } from './scenes/brand/HistoryScene';
import { BrandHistoryPlanScene } from './scenes/brand/HistoryPlanScene';
import { BrandHistoryResultScene } from './scenes/brand/HistoryResultScene';
import { BrandHistoryStoppedScene } from './scenes/brand/HistoryStoppedScene';
import { BrandHistoryTrialScene } from './scenes/brand/HistoryTrialScene';
import { BrandLimitsScene } from './scenes/brand/LimitsScene';
import { BrandCodexScene } from './scenes/brand/CodexScene';
import { BrandStorageScene } from './scenes/brand/StorageScene';
import { BrandSecurityFindingsScene } from './scenes/brand/SecurityFindingsScene';
import { BrandToolsScene } from './scenes/brand/ToolsScene';
import { useBrandChrome } from './scenes/brand/brandChrome';
import { applyDocumentTheme } from '../../../shared/lib/theme';
import { AgentBriefScene } from './scenes/AgentBriefScene';
import { AgentBriefQuestionScene } from './scenes/AgentBriefQuestionScene';
import { AgentBriefResolverScene } from './scenes/AgentBriefResolverScene';
import { ReportSheetHost } from '../../../features/bug-report/components/ReportSheetHost';
import { CrashReportScene, useReportSheetParam } from './scenes/audit/ReportScenes';

export const MOCK_SCENES = {
  workspace: WorkspaceScene,
  workflow: WorkflowScene,
  shell: ShellScene,
  'chat-shell': ChatShellScene,
  'chat-room': ChatRoomScene,
  inbox: InboxScene,
  'inbox-source': InboxSourceScene,
  conversation: ConversationScene,
  mounts: MountsScene,
  'mount-mismatch': MountMismatchScene,
  resolve: ResolveScene,
  'resolve-select': ResolveSelectScene,
  'resolve-item': ResolveItemScene,
  'resolve-failed': ResolveFailedRunScene,
  'resolve-failed-history': ResolveFailedHistoryScene,
  'resolve-drift': ResolveDriftScene,
  'resolve-commit-story': ResolveCommitStoryScene,
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
  'activity-question': ActivityQuestionScene,
  'activity-one-signal': ActivityOneSignalScene,
  'context-drawer': ContextDrawerScene,
  'workflow-builder': WorkflowBuilderScene,
  'workflow-run': WorkflowRunScene,
  'open-questions': OpenQuestionsScene,
  transcript: TranscriptScene,
  'command-palette': CommandPaletteScene,
  search: SearchScene,
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
  'model-picker-claude': ModelPickerClaudeScene,
  'model-picker-triggers': ModelPickerTriggersScene,
  frame: FrameScene,
  'board-states': BoardStatesScene,
  'session-states': SessionStatesScene,
  'session-start': SessionStartScene,
  'workspace-states': WorkspaceStatesScene,
  'settings-app': SettingsAppScene,
  'settings-no-workspace': SettingsNoWorkspaceScene,
  'settings-providers': SettingsProvidersScene,
  'settings-tools': SettingsToolsScene,
  'settings-workspace': SettingsWorkspaceScene,
  onboarding: OnboardingScene,
  toasts: ToastsScene,
  'update-confirm': UpdateConfirmScene,
  'update-whats-new': UpdateWhatsNewScene,
  notifications: NotificationsScene,
  changelog: ChangelogScene,
  'artifact-states': ArtifactStatesScene,
  'inbox-states': InboxStatesScene,
  companion: CompanionScene,
  'review-modes': ReviewModesScene,
  'code-layers': CodeLayersScene,
  'workflow-studio': WorkflowStudioScene,
  'workflow-builder-modes': WorkflowBuilderModesScene,
  forms: FormsAuditScene,
  'impact-scopes': ImpactScopesScene,
  explore: ExploreScene,
  'design-scale': DesignScaleScene,
  listbox: ListboxScene,
  'features-impact-overview': FeaturesImpactOverviewScene,
  'features-newer-data': FeaturesNewerDataScene,
  'repo-status': RepoStatusScene,
  'palette-query': PaletteQueryScene,
  'features-report-sheet': FeaturesReportSheetScene,
  'features-script-drawer': FeaturesScriptDrawerScene,
  'features-composer-menu': FeaturesComposerMenuScene,
  'slack-permissions': FeaturesSlackPermissionsScene,
  'workspace-projects': WorkspaceProjectsScene,
  'brand-kickoff': BrandKickoffScene,
  'features-start-tabs': FeaturesStartTabsScene,
  'features-review-push-confirm': FeaturesReviewPushConfirmScene,
  'features-write-review': FeaturesWriteReviewScene,
  'brand-lookup': BrandLookupScene,
  'brand-slack': BrandSlackScene,
  'brand-context': BrandContextScene,
  'brand-compare': BrandCompareScene,
  'brand-diff': BrandDiffScene,
  'brand-diff-many': BrandDiffManyFilesScene,
  'brand-history': BrandHistoryScene,
  'brand-history-plan': BrandHistoryPlanScene,
  'brand-history-trial': BrandHistoryTrialScene,
  'brand-history-stopped': BrandHistoryStoppedScene,
  'brand-history-result': BrandHistoryResultScene,
  'brand-limits': BrandLimitsScene,
  'brand-codex': BrandCodexScene,
  'brand-storage': BrandStorageScene,
  'brand-security-findings': BrandSecurityFindingsScene,
  'brand-tools': BrandToolsScene,
  'agent-brief': AgentBriefScene,
  'agent-brief-question': AgentBriefQuestionScene,
  'agent-brief-resolver': AgentBriefResolverScene,
  'crash-report': CrashReportScene,
};

const BRAND_HIDDEN_TOASTS = ['File drop is unavailable'];

export const MockScene = () => {
  useReportSheetParam();
  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
  }, []);

  const params = new URLSearchParams(window.location.search);
  const sceneName = params.get('scene') ?? 'workspace';
  const Scene =
    Object.entries(MOCK_SCENES).find(([key]) => key === sceneName)?.[1] ?? WorkspaceScene;

  if (params.get('brand') === '1') {
    finishOnboarding();
  }

  useEffect(() => {
    if (params.get('brand') !== '1') {
      return;
    }
    const drop = () =>
      document.querySelectorAll('[role="alert"], [role="status"]').forEach((node) => {
        if (BRAND_HIDDEN_TOASTS.some((text) => node.textContent?.includes(text))) {
          (node as HTMLElement).style.display = 'none';
        }
      });
    const observer = new MutationObserver(drop);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useBrandChrome({ isBrand: params.get('brand') === '1' });

  useEffect(() => {
    if (params.get('theme') !== 'light') {
      return;
    }
    applyDocumentTheme({ theme: 'light' });
  }, []);

  return (
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
        <ReportSheetHost />
      </ObjectMenuProvider>
    </ToastProvider>
  );
};
