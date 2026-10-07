import { TaskLinksScene } from './scenes/TaskLinksScene';
import { TaskLinksHoverScene } from './scenes/TaskLinksHoverScene';
import { TaskLinksUndoScene } from './scenes/TaskLinksUndoScene';
import { UndoToastBridge } from '../UndoToastBridge';
import { useEffect } from 'react';
import { ToastProvider } from '../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../features/actions/components/ObjectMenuProvider';
import { finish as finishOnboarding } from '../../../features/onboarding/onboarding-store';
import { WorkspaceScene } from './scenes/WorkspaceScene';
import { WorkflowScene } from './scenes/WorkflowScene';
import { ShellScene } from './scenes/ShellScene';
import { ChatShellScene } from './scenes/ChatShellScene';
import { ChatRoomScene } from './scenes/ChatRoomScene';
import { SessionAskScene } from './scenes/SessionAskScene';
import { InboxScene } from './scenes/InboxScene';
import { InboxSourceScene } from './scenes/InboxSourceScene';
import { ConversationScene } from './scenes/ConversationScene';
import { MountsScene } from './scenes/MountsScene';
import { OverviewFullScene } from './scenes/OverviewFullScene';
import { OverviewManyScene } from './scenes/OverviewManyScene';
import { OverviewBranchTasksScene } from './scenes/OverviewBranchTasksScene';
import { OverviewUnassignedNotesScene } from './scenes/OverviewUnassignedNotesScene';
import { LinkScopeScene } from './scenes/LinkScopeScene';
import { OverviewRefreshingScene } from './scenes/OverviewRefreshingScene';
import { MountMismatchScene } from './scenes/MountMismatchScene';
import { ForeignBranchScene } from './scenes/ForeignBranchScene';
import { ResolveScene } from './scenes/ResolveScene';
import { ResolveLaunchScene } from './scenes/ResolveLaunchScene';
import { ResolveSelectScene } from './scenes/ResolveSelectScene';
import { ResolveBulkScene } from './scenes/ResolveBulkScene';
import { BranchCommentsScene } from './scenes/BranchCommentsScene';
import { BranchLaneScene } from './scenes/BranchLaneScene';
import { BranchNarrowScene } from './scenes/BranchNarrowScene';
import { BranchPushScene } from './scenes/BranchPushScene';
import { BranchReplyOnlyScene } from './scenes/BranchReplyOnlyScene';
import { ResolveDriftScene } from './scenes/ResolveDriftScene';
import { ResolveGitlabScene } from './scenes/ResolveGitlabScene';
import { ResolveBitbucketScene } from './scenes/ResolveBitbucketScene';
import { ResolveItemScene } from './scenes/ResolveItemScene';
import { ResolveFailedHistoryScene } from './scenes/ResolveFailedHistoryScene';
import { ResolveFailedRunScene } from './scenes/ResolveFailedRunScene';
import { ResolveRunAnsweredScene } from './scenes/ResolveRunAnsweredScene';
import { ResolveRunQuestionScene } from './scenes/ResolveRunQuestionScene';
import { ResolveRunWorkingScene } from './scenes/ResolveRunWorkingScene';
import { FixRunQuestionScene } from './scenes/FixRunQuestionScene';
import { FixRunMultiScene } from './scenes/FixRunMultiScene';
import { FixRunMultiDoneScene } from './scenes/FixRunMultiDoneScene';
import { SpaceDiffCommentScene } from './scenes/SpaceDiffCommentScene';
import { SpaceDiffSplitScene } from './scenes/SpaceDiffSplitScene';
import { BoardScene } from './scenes/BoardScene';
import { BoardOngoingScene } from './scenes/BoardOngoingScene';
import { BoardSelectedScene } from './scenes/BoardSelectedScene';
import { BoardDeleteConfirmScene } from './scenes/BoardDeleteConfirmScene';
import { TranscriptMountScene } from './scenes/TranscriptMountScene';
import { BoardShellScene } from './scenes/BoardShellScene';
import {
  ArtifactGeneratingScene,
  ArtifactReportScene,
  ArtifactWireframeHighScene,
  ArtifactWireframeLowScene,
} from './scenes/ArtifactScenes';
import { ArtifactPlanCommentsScene } from './scenes/ArtifactPlanCommentsScene';
import {
  ArtifactCreateReportScene,
  ArtifactCreateWireframeScene,
} from './scenes/ArtifactCreationScenes';
import { ActivityTimelineScene } from './scenes/ActivityScenes';
import { ActivityRunScene } from './scenes/ActivityRunScene';
import { ActivityRunFinishedScene } from './scenes/ActivityRunFinishedScene';
import { ActivityLogScene } from './scenes/ActivityLogScene';
import { ActivityResolvesScene } from './scenes/ActivityResolvesScene';
import { ActivityQuestionScene } from './scenes/ActivityQuestionScene';
import { ActivityOneSignalScene } from './scenes/ActivityOneSignalScene';
import { ActivityGroupsScene } from './scenes/ActivityGroupsScene';
import { ContextDrawerScene } from './scenes/ContextDrawerScene';
import { WorkflowBuilderScene } from './scenes/flow-audit/WorkflowBuilderScene';
import { WorkflowRunScene } from './scenes/flow-audit/WorkflowRunScene';
import { OpenQuestionsScene } from './scenes/flow-audit/OpenQuestionsScene';
import { OpenQuestionProseScene } from './scenes/flow-audit/OpenQuestionProseScene';
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
import { ImpactDeletedScene } from './scenes/ImpactDeletedScene';
import {
  ModelPickerCodexScene,
  ModelPickerCursorScene,
  ModelPickerScene,
  ModelPickerTriggersScene,
} from './scenes/ModelPickerScenes';
import { ModelPickerClaudeScene } from './scenes/ModelPickerClaudeScene';
import { RunsOnScene } from './scenes/RunsOnScene';

import { FrameScene } from './scenes/audit/FrameScene';
import { FirstRunScene } from './scenes/audit/FirstRunScene';
import { FirstLapScene } from './scenes/audit/FirstLapScene';
import { FirstLapOverviewScene } from './scenes/audit/FirstLapOverviewScene';
import { FirstLapPublishScene } from './scenes/audit/FirstLapPublishScene';
import { FirstLapMoveScene } from './scenes/audit/FirstLapMoveScene';
import { FirstLapMovingScene } from './scenes/audit/FirstLapMovingScene';
import { FirstLapReportScene } from './scenes/audit/FirstLapReportScene';
import { BoardStatesScene } from './scenes/audit/BoardStatesScene';
import { SessionStatesScene } from './scenes/audit/SessionStatesScene';
import { SessionHoverScene } from './scenes/sessions/SessionHoverScene';
import { SessionSwitcherScene } from './scenes/sessions/SessionSwitcherScene';
import { SessionsMenuScene } from './scenes/sessions/SessionsMenuScene';
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
import { GuideScene } from './scenes/audit/GuideScene';
import { ArtifactStatesScene } from './scenes/audit/ArtifactStatesScene';
import { InboxStatesScene } from './scenes/audit/InboxStatesScene';
import { CompanionScene } from './scenes/audit/CompanionScene';
import { ReviewModesScene } from './scenes/audit/ReviewModesScene';
import { CodeLayersScene } from './scenes/CodeLayersScene';
import { WorkflowStudioScene } from './scenes/audit/WorkflowStudioScene';
import { RulesTeleportScene } from './scenes/audit/RulesTeleportScene';
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
import { PaletteStateScene } from './scenes/features/PaletteStateScene';
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
import { BrandDiffLargeScene } from './scenes/brand/DiffLargeScene';
import { BrandDiffEditsOnlyScene } from './scenes/brand/DiffEditsOnlyScene';
import { BrandDiffEmptyScene } from './scenes/brand/DiffEmptyScene';
import { BrandDiffManyFilesScene } from './scenes/brand/DiffManyFilesScene';
import { DiffNotesScene } from './scenes/brand/DiffNotesScene';
import { ResolveNotesScene } from './scenes/ResolveNotesScene';
import { BrandHistoryScene } from './scenes/brand/HistoryScene';
import { BrandHistoryPlanScene } from './scenes/brand/HistoryPlanScene';
import { BrandHistoryResultScene } from './scenes/brand/HistoryResultScene';
import { BrandHistorySquashScene } from './scenes/brand/HistorySquashScene';
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
import { PlannerTranscriptScene } from './scenes/PlannerTranscriptScene';
import { PlannerTranscriptDrawerScene } from './scenes/PlannerTranscriptDrawerScene';
import { PlannerTranscriptExpandedScene } from './scenes/PlannerTranscriptExpandedScene';
import { PlannerTranscriptReplacedScene } from './scenes/PlannerTranscriptReplacedScene';
import { PlannerTranscriptRevisingScene } from './scenes/PlannerTranscriptRevisingScene';
import { ScribeProposalCreatingScene } from './scenes/ScribeProposalCreatingScene';
import { ScribeProposalFailedScene } from './scenes/ScribeProposalFailedScene';
import { ScribeProposalTranscriptScene } from './scenes/ScribeProposalTranscriptScene';
import { FixRunScene } from './scenes/FixRunScene';
import { ReportSheetHost } from '../../../features/bug-report/components/ReportSheetHost';
import { CrashReportScene, useReportSheetParam } from './scenes/audit/ReportScenes';
import { U21_KEYS_ROWS_SCENES } from './scenes/u21/keys-rows';
import { U21_STATES_SCENES } from './scenes/u21/states';
import { U21_DRAWERS_SCENES } from './scenes/u21/drawers';
import { U21_CHECKS_SCENES } from './scenes/u21/checks';
import { U21_SIDEBAR_SCENES } from './scenes/u21/sidebar';
import { U21_BRANCH_SCENES } from './scenes/u21/branch';
import { U21_SETTINGS_SCENES } from './scenes/u21/settings';
import { U21_BOARD_SCENES } from './scenes/u21/board';

export const MOCK_SCENES = {
  workspace: WorkspaceScene,
  workflow: WorkflowScene,
  shell: ShellScene,
  'column-rail': () => <ShellScene isRail />,
  'chat-shell': ChatShellScene,
  'chat-room': ChatRoomScene,
  inbox: InboxScene,
  'inbox-source': InboxSourceScene,
  conversation: ConversationScene,
  mounts: MountsScene,
  'overview-full': OverviewFullScene,
  'overview-projects-many': OverviewManyScene,
  'overview-branch-tasks': OverviewBranchTasksScene,
  'overview-unassigned-notes': OverviewUnassignedNotesScene,
  'link-scope': LinkScopeScene,
  'task-links': TaskLinksScene,
  'task-links-hover': TaskLinksHoverScene,
  'task-links-undo': TaskLinksUndoScene,
  'overview-refreshing': OverviewRefreshingScene,
  'mount-mismatch': MountMismatchScene,
  'foreign-stranded': () => <ForeignBranchScene state="stranded" />,
  'foreign-picker': () => <ForeignBranchScene state="picker" />,
  resolve: ResolveScene,
  'resolve-select': ResolveSelectScene,
  'resolve-launch': ResolveLaunchScene,
  'resolve-bulk-launch': () => <ResolveBulkScene stage="launch" />,
  'resolve-bulk-answers': () => <ResolveBulkScene stage="answers" />,
  'resolve-bulk-review': () => <ResolveBulkScene stage="review" />,
  'resolve-bulk-accepted': () => <ResolveBulkScene stage="accepted" />,
  'resolve-bulk-retry': () => <ResolveBulkScene stage="retry" />,
  'branch-comments': BranchCommentsScene,
  'branch-commits': BrandHistoryScene,
  'branch-files': BrandDiffScene,
  'branch-lane-working': () => <BranchLaneScene variant="working" />,
  'branch-lane-chain': () => <BranchLaneScene variant="chain" />,
  'branch-narrow': BranchNarrowScene,
  'branch-push': BranchPushScene,
  'branch-reply-bundled': () => <BranchReplyOnlyScene variant="bundled" />,
  'branch-reply-alone': () => <BranchReplyOnlyScene variant="alone" />,
  'branch-reply-posted': () => <BranchReplyOnlyScene variant="posted" />,
  'resolve-item': ResolveItemScene,
  'resolve-failed': ResolveFailedRunScene,
  'resolve-run-question': ResolveRunQuestionScene,
  'resolve-run-working': ResolveRunWorkingScene,
  'resolve-run-answered': ResolveRunAnsweredScene,
  'resolve-failed-history': ResolveFailedHistoryScene,
  'resolve-drift': ResolveDriftScene,
  'resolve-gitlab': ResolveGitlabScene,
  'resolve-bitbucket': ResolveBitbucketScene,
  board: BoardScene,
  'board-ongoing': BoardOngoingScene,
  'board-selected': BoardSelectedScene,
  'board-delete-confirm': BoardDeleteConfirmScene,
  'transcript-mount': TranscriptMountScene,
  'board-shell': BoardShellScene,
  'artifact-report': ArtifactReportScene,
  'artifact-plan-comments': ArtifactPlanCommentsScene,
  'artifact-wireframe-low': ArtifactWireframeLowScene,
  'artifact-wireframe-high': ArtifactWireframeHighScene,
  'artifact-generating': ArtifactGeneratingScene,
  'artifact-create-report': ArtifactCreateReportScene,
  'artifact-create-wireframe': ArtifactCreateWireframeScene,
  activity: ActivityTimelineScene,
  'activity-log': ActivityLogScene,
  'activity-run': ActivityRunScene,
  'activity-run-finished': ActivityRunFinishedScene,
  'activity-resolves': ActivityResolvesScene,
  'activity-question': ActivityQuestionScene,
  'activity-one-signal': ActivityOneSignalScene,
  'activity-groups': ActivityGroupsScene,
  'context-drawer': ContextDrawerScene,
  'session-ask': SessionAskScene,
  'workflow-builder': WorkflowBuilderScene,
  'workflow-run': WorkflowRunScene,
  'open-questions': OpenQuestionsScene,
  'open-question-prose': OpenQuestionProseScene,
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
  'runs-on-codex-default': RunsOnScene,
  frame: FrameScene,
  'first-run': FirstRunScene,
  'first-lap': FirstLapScene,
  'overview-first-lap': FirstLapOverviewScene,
  'first-lap-publish': FirstLapPublishScene,
  'first-lap-move': FirstLapMoveScene,
  'first-lap-moving': FirstLapMovingScene,
  'first-lap-report': FirstLapReportScene,
  'board-states': BoardStatesScene,
  'session-states': SessionStatesScene,
  'sessions-menu': SessionsMenuScene,
  'session-hover': SessionHoverScene,
  'session-switcher': SessionSwitcherScene,
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
  guide: GuideScene,
  'artifact-states': ArtifactStatesScene,
  'inbox-states': InboxStatesScene,
  companion: CompanionScene,
  'review-modes': ReviewModesScene,
  'code-layers': CodeLayersScene,
  'workflow-studio': WorkflowStudioScene,
  'rules-no-limits': WorkflowStudioScene,
  'rules-teleport': RulesTeleportScene,
  'rail-ticket-ids': MountsScene,
  'workflow-builder-modes': WorkflowBuilderModesScene,
  forms: FormsAuditScene,
  'impact-scopes': ImpactScopesScene,
  'impact-deleted': ImpactDeletedScene,
  explore: ExploreScene,
  'design-scale': DesignScaleScene,
  listbox: ListboxScene,
  'features-impact-overview': FeaturesImpactOverviewScene,
  'features-newer-data': FeaturesNewerDataScene,
  'repo-status': RepoStatusScene,
  'palette-query': PaletteQueryScene,
  'palette-state': PaletteStateScene,
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
  'brand-diff-empty': BrandDiffEmptyScene,
  'brand-diff-edits-only': BrandDiffEditsOnlyScene,
  'brand-diff-large': BrandDiffLargeScene,
  'diff-notes': DiffNotesScene,
  'resolve-notes': ResolveNotesScene,
  'brand-history': BrandHistoryScene,
  'brand-history-plan': BrandHistoryPlanScene,
  'brand-history-trial': BrandHistoryTrialScene,
  'brand-history-stopped': BrandHistoryStoppedScene,
  'brand-history-result': BrandHistoryResultScene,
  'brand-history-squash': BrandHistorySquashScene,
  'brand-limits': BrandLimitsScene,
  'brand-codex': BrandCodexScene,
  'brand-storage': BrandStorageScene,
  'brand-security-findings': BrandSecurityFindingsScene,
  'brand-tools': BrandToolsScene,
  'agent-brief': AgentBriefScene,
  'agent-brief-question': AgentBriefQuestionScene,
  'planner-transcript': PlannerTranscriptScene,
  'planner-transcript-revising': PlannerTranscriptRevisingScene,
  'planner-transcript-replaced': PlannerTranscriptReplacedScene,
  'planner-transcript-drawer': PlannerTranscriptDrawerScene,
  'planner-transcript-expanded': PlannerTranscriptExpandedScene,
  'scribe-proposal-creating': ScribeProposalCreatingScene,
  'scribe-proposal-failed': ScribeProposalFailedScene,
  'scribe-proposal-transcript': ScribeProposalTranscriptScene,
  'fix-run': FixRunScene,
  'fix-run-question': FixRunQuestionScene,
  'resolve-transcript-drawer': FixRunQuestionScene,
  'resolve-transcript-drawer-multi': FixRunMultiScene,
  'resolve-transcript-drawer-multi-done': FixRunMultiDoneScene,
  'space-diff-split': SpaceDiffSplitScene,
  'space-diff-comment': SpaceDiffCommentScene,
  'crash-report': CrashReportScene,
  ...U21_KEYS_ROWS_SCENES,
  ...U21_STATES_SCENES,
  ...U21_DRAWERS_SCENES,
  ...U21_CHECKS_SCENES,
  ...U21_SIDEBAR_SCENES,
  ...U21_BRANCH_SCENES,
  ...U21_SETTINGS_SCENES,
  ...U21_BOARD_SCENES,
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
      <UndoToastBridge />
      <ObjectMenuProvider>
        <Scene />
        <ReportSheetHost />
      </ObjectMenuProvider>
    </ToastProvider>
  );
};
