import { createElement, type ComponentType, type ReactElement } from 'react';
import { TaskLinksScene } from '../scenes/TaskLinksScene';
import { TaskLinksHoverScene } from '../scenes/TaskLinksHoverScene';
import { TaskLinksUndoScene } from '../scenes/TaskLinksUndoScene';
import { WorkspaceScene } from '../scenes/WorkspaceScene';
import { DemoPlayground } from '../demo/DemoPlayground';
import { WorkflowScene } from '../scenes/WorkflowScene';
import { ShellScene } from '../scenes/ShellScene';
import { ChatShellScene } from '../scenes/ChatShellScene';
import { ChatRoomScene } from '../scenes/ChatRoomScene';
import { SessionAskScene } from '../scenes/SessionAskScene';
import { InboxScene } from '../scenes/InboxScene';
import { InboxSourceScene } from '../scenes/InboxSourceScene';
import { ConversationScene } from '../scenes/ConversationScene';
import { MountsScene } from '../scenes/MountsScene';
import { OverviewFullScene } from '../scenes/OverviewFullScene';
import { OverviewManyScene } from '../scenes/OverviewManyScene';
import { OverviewBranchTasksScene } from '../scenes/OverviewBranchTasksScene';
import { OverviewUnassignedNotesScene } from '../scenes/OverviewUnassignedNotesScene';
import { LinkScopeScene } from '../scenes/LinkScopeScene';
import { OverviewRefreshingScene } from '../scenes/OverviewRefreshingScene';
import { MountMismatchScene } from '../scenes/MountMismatchScene';
import { ForeignBranchScene } from '../scenes/ForeignBranchScene';
import { ResolveScene } from '../scenes/ResolveScene';
import { ResolveLaunchScene } from '../scenes/ResolveLaunchScene';
import { ResolveSelectScene } from '../scenes/ResolveSelectScene';
import { ResolveBulkScene } from '../scenes/ResolveBulkScene';
import { BranchCommentsScene } from '../scenes/BranchCommentsScene';
import { BranchLaneScene } from '../scenes/BranchLaneScene';
import { BranchNarrowScene } from '../scenes/BranchNarrowScene';
import { BranchPushScene } from '../scenes/BranchPushScene';
import { BranchReplyOnlyScene } from '../scenes/BranchReplyOnlyScene';
import { ResolveDriftScene } from '../scenes/ResolveDriftScene';
import { ResolveGitlabScene } from '../scenes/ResolveGitlabScene';
import { ResolveBitbucketScene } from '../scenes/ResolveBitbucketScene';
import { ResolveItemScene } from '../scenes/ResolveItemScene';
import { ResolveFailedHistoryScene } from '../scenes/ResolveFailedHistoryScene';
import { ResolveFailedRunScene } from '../scenes/ResolveFailedRunScene';
import { ResolveRunAnsweredScene } from '../scenes/ResolveRunAnsweredScene';
import { ResolveRunQuestionScene } from '../scenes/ResolveRunQuestionScene';
import { ResolveRunWorkingScene } from '../scenes/ResolveRunWorkingScene';
import { FixRunQuestionScene } from '../scenes/FixRunQuestionScene';
import { FixRunMultiScene } from '../scenes/FixRunMultiScene';
import { FixRunMultiDoneScene } from '../scenes/FixRunMultiDoneScene';
import { SpaceDiffCommentScene } from '../scenes/SpaceDiffCommentScene';
import { SpaceDiffSplitScene } from '../scenes/SpaceDiffSplitScene';
import { BoardScene } from '../scenes/BoardScene';
import { BoardSelectedScene } from '../scenes/BoardSelectedScene';
import { BoardDeleteConfirmScene } from '../scenes/BoardDeleteConfirmScene';
import { TranscriptMountScene } from '../scenes/TranscriptMountScene';
import { BoardShellScene } from '../scenes/BoardShellScene';
import {
  ArtifactGeneratingScene,
  ArtifactReportScene,
  ArtifactWireframeHighScene,
  ArtifactWireframeLowScene,
} from '../scenes/ArtifactScenes';
import { ArtifactPlanCommentsScene } from '../scenes/ArtifactPlanCommentsScene';
import {
  ArtifactCreateReportScene,
  ArtifactCreateWireframeScene,
} from '../scenes/ArtifactCreationScenes';
import { ActivityTimelineScene } from '../scenes/ActivityScenes';
import { ActivityRunScene } from '../scenes/ActivityRunScene';
import { ActivityRunFinishedScene } from '../scenes/ActivityRunFinishedScene';
import { ActivityLogScene } from '../scenes/ActivityLogScene';
import { ActivityResolvesScene } from '../scenes/ActivityResolvesScene';
import { ActivityQuestionScene } from '../scenes/ActivityQuestionScene';
import { ActivityOneSignalScene } from '../scenes/ActivityOneSignalScene';
import { ActivityGroupsScene } from '../scenes/ActivityGroupsScene';
import { ContextDrawerScene } from '../scenes/ContextDrawerScene';
import { WorkflowRunScene } from '../scenes/flow-audit/WorkflowRunScene';
import { OpenQuestionsScene } from '../scenes/flow-audit/OpenQuestionsScene';
import { OpenQuestionProseScene } from '../scenes/flow-audit/OpenQuestionProseScene';
import { TranscriptScene } from '../scenes/flow-audit/TranscriptScene';
import { CommandPaletteScene } from '../scenes/flow-audit/CommandPaletteScene';
import { SearchScene } from '../scenes/search/SearchScene';
import {
  ScriptsLensScene,
  ResolveQueueShellScene,
  ResolvePublishBlockedScene,
  ArtifactsLensShellScene,
} from '../scenes/SurfaceAuditScenes';
import { LensSwitcherClosedScene, LensSwitcherScene } from '../scenes/LensSwitcherScenes';
import { CardRailsScene } from '../scenes/CardRailsScene';
import { ProvidersScene } from '../scenes/ProvidersScene';
import { ImpactScene } from '../scenes/ImpactScene';
import { ImpactDeletedScene } from '../scenes/ImpactDeletedScene';
import {
  ModelPickerCodexScene,
  ModelPickerCursorScene,
  ModelPickerScene,
  ModelPickerTriggersScene,
} from '../scenes/ModelPickerScenes';
import { ModelPickerClaudeScene } from '../scenes/ModelPickerClaudeScene';
import { ModelPickerAutoScene } from '../scenes/ModelPickerAutoScene';
import { RunsOnScene } from '../scenes/RunsOnScene';

import { FrameScene } from '../scenes/audit/FrameScene';
import { FirstRunScene } from '../scenes/audit/FirstRunScene';
import { FirstLapScene } from '../scenes/audit/FirstLapScene';
import { FirstLapOverviewScene } from '../scenes/audit/FirstLapOverviewScene';
import { FirstLapPublishScene } from '../scenes/audit/FirstLapPublishScene';
import { FirstLapMoveScene } from '../scenes/audit/FirstLapMoveScene';
import { FirstLapMovingScene } from '../scenes/audit/FirstLapMovingScene';
import { FirstLapReportScene } from '../scenes/audit/FirstLapReportScene';
import { BoardStatesScene } from '../scenes/audit/BoardStatesScene';
import { SessionStatesScene } from '../scenes/audit/SessionStatesScene';
import { SessionHoverScene } from '../scenes/sessions/SessionHoverScene';
import { SessionSwitcherScene } from '../scenes/sessions/SessionSwitcherScene';
import { SessionsMenuScene } from '../scenes/sessions/SessionsMenuScene';
import { FeaturesStartTabsScene } from '../scenes/features/StartTabsScene';
import { FeaturesReviewPushConfirmScene } from '../scenes/features/ReviewPushConfirmScene';
import { FeaturesWriteReviewScene } from '../scenes/features/WriteReviewScene';
import { SessionStartScene } from '../scenes/audit/SessionStartScene';
import { WorkspaceStatesScene } from '../scenes/audit/WorkspaceStatesScene';
import { SettingsAppScene } from '../scenes/audit/SettingsAppScene';
import { SettingsNoWorkspaceScene } from '../scenes/audit/SettingsNoWorkspaceScene';
import { SettingsProvidersScene } from '../scenes/audit/SettingsProvidersScene';
import { SettingsToolsScene } from '../scenes/audit/SettingsToolsScene';
import { SettingsWorkspaceScene } from '../scenes/audit/SettingsWorkspaceScene';
import { OnboardingScene } from '../scenes/audit/OnboardingScene';
import { sceneParam } from '../scenes/audit/sceneParams';
import { ToastsScene } from '../scenes/audit/ToastsScene';
import { UpdateConfirmScene } from '../scenes/audit/UpdateConfirmScene';
import { UpdateWhatsNewScene } from '../scenes/audit/UpdateWhatsNewScene';
import { NotificationsScene } from '../scenes/audit/NotificationsScene';
import { ChangelogScene } from '../scenes/audit/ChangelogScene';
import { GuideScene } from '../scenes/audit/GuideScene';
import { ArtifactStatesScene } from '../scenes/audit/ArtifactStatesScene';
import { InboxStatesScene } from '../scenes/audit/InboxStatesScene';
import { CompanionScene } from '../scenes/audit/CompanionScene';
import { ReviewModesScene } from '../scenes/audit/ReviewModesScene';
import { CodeLayersScene } from '../scenes/CodeLayersScene';
import { WorkflowStudioScene } from '../scenes/audit/WorkflowStudioScene';
import { RulesTeleportScene } from '../scenes/audit/RulesTeleportScene';
import { WorkflowBuilderModesScene } from '../scenes/audit/WorkflowBuilderModesScene';
import { FormsAuditScene } from '../scenes/audit/FormsAuditScene';
import { ImpactScopesScene } from '../scenes/audit/ImpactScopesScene';
import { ExploreScene } from '../scenes/audit/ExploreScene';
import { DesignScaleScene } from '../scenes/DesignScaleScene';
import { ListboxScene } from '../scenes/ListboxScene';
import { FeaturesImpactOverviewScene } from '../scenes/features/ImpactOverviewScene';
import { FeaturesNewerDataScene } from '../scenes/features/NewerDataScene';
import { RepoStatusScene } from '../scenes/features/RepoStatusScene';
import { PaletteQueryScene } from '../scenes/features/PaletteQueryScene';
import { PaletteStateScene } from '../scenes/features/PaletteStateScene';
import { FeaturesReportSheetScene } from '../scenes/features/ReportSheetScene';
import { FeaturesScriptDrawerScene } from '../scenes/features/ScriptDrawerScene';
import { FeaturesComposerMenuScene } from '../scenes/features/ComposerMenuScene';
import { FeaturesSlackPermissionsScene } from '../scenes/features/SlackPermissionsScene';
import { WorkspaceProjectsScene } from '../scenes/features/WorkspaceProjectsScene';
import { BrandKickoffScene } from '../scenes/brand/KickoffScene';
import { BrandLookupScene } from '../scenes/brand/LookupScene';
import { BrandSlackScene } from '../scenes/brand/SlackScene';
import { BrandContextScene } from '../scenes/brand/ContextScene';
import { BrandCompareScene } from '../scenes/brand/CompareScene';
import { BrandDiffScene } from '../scenes/brand/DiffScene';
import { BrandDiffLargeScene } from '../scenes/brand/DiffLargeScene';
import { BrandDiffEditsOnlyScene } from '../scenes/brand/DiffEditsOnlyScene';
import { BrandDiffEmptyScene } from '../scenes/brand/DiffEmptyScene';
import { BrandDiffManyFilesScene } from '../scenes/brand/DiffManyFilesScene';
import { DiffNotesScene } from '../scenes/brand/DiffNotesScene';
import { BrandDiffUnpushedScene } from '../scenes/brand/DiffUnpushedScene';
import { BrandHistoryScene } from '../scenes/brand/HistoryScene';
import { BrandHistoryPlanScene } from '../scenes/brand/HistoryPlanScene';
import { BrandHistoryResultScene } from '../scenes/brand/HistoryResultScene';
import { BrandHistorySquashScene } from '../scenes/brand/HistorySquashScene';
import { BrandHistoryStoppedScene } from '../scenes/brand/HistoryStoppedScene';
import { BrandHistoryTrialScene } from '../scenes/brand/HistoryTrialScene';
import { BrandLimitsScene } from '../scenes/brand/LimitsScene';
import { BrandCodexScene } from '../scenes/brand/CodexScene';
import { BrandStorageScene } from '../scenes/brand/StorageScene';
import { DemoIssueScene } from '../scenes/demo/DemoIssueScene';
import { DemoRunScene } from '../scenes/demo/DemoRunScene';
import { DemoStorageScene } from '../scenes/demo/DemoStorageScene';
import { BrandSecurityFindingsScene } from '../scenes/brand/SecurityFindingsScene';
import { BrandToolsScene } from '../scenes/brand/ToolsScene';
import { AgentBriefScene } from '../scenes/AgentBriefScene';
import { AgentBriefQuestionScene } from '../scenes/AgentBriefQuestionScene';
import { PlannerTranscriptScene } from '../scenes/PlannerTranscriptScene';
import { PlannerTranscriptDrawerScene } from '../scenes/PlannerTranscriptDrawerScene';
import { PlannerTranscriptReplacedScene } from '../scenes/PlannerTranscriptReplacedScene';
import { PlannerTranscriptRevisingScene } from '../scenes/PlannerTranscriptRevisingScene';
import { ScribeProposalCreatingScene } from '../scenes/ScribeProposalCreatingScene';
import { ScribeProposalFailedScene } from '../scenes/ScribeProposalFailedScene';
import { ScribeProposalTranscriptScene } from '../scenes/ScribeProposalTranscriptScene';
import { FixRunScene } from '../scenes/FixRunScene';
import { CrashReportScene } from '../scenes/audit/ReportScenes';
import { BrandTileScene } from '../scenes/onboarding/BrandTileScene';
import { WriterWaitScene } from '../scenes/nogit/WriterWaitScene';
import { NOGIT_CHANGES_SCENES } from '../scenes/nogit/changesScenes';
import { GitLaterScene, type GitLaterState } from '../scenes/nogit/GitLaterScene';
import { PickScene, type PickSceneState } from '../scenes/nogit/PickScene';
import { FoldersScene, type FoldersSceneState } from '../scenes/nogit/FoldersScene';
import { SplashScene } from '../scenes/onboarding/SplashScene';
import { SetupMenuScene } from '../scenes/onboarding/SetupMenuScene';
import {
  NewWorkspaceScene,
  type NewWorkspaceSceneState,
} from '../scenes/onboarding/NewWorkspaceScene';
import { WizardStepScene, type WizardSceneState } from '../scenes/onboarding/WizardStepScene';
import { HomeScene, type HomeSceneState } from '../scenes/onboarding/HomeScene';

type SceneTheme = 'dark' | 'light';

const SCENE_THEMES: ReadonlyArray<SceneTheme> = ['dark', 'light'];

type ThemedProps = {
  readonly theme: SceneTheme;
};

type ThemedParams = {
  readonly id: string;
  readonly render: (props: ThemedProps) => ReactElement;
};

const themed = ({ id, render }: ThemedParams): ReadonlyArray<readonly [string, ComponentType]> =>
  SCENE_THEMES.map((theme) => [`${id}-${theme}`, () => render({ theme })] as const);

const NEW_WORKSPACE_STATES: ReadonlyArray<NewWorkspaceSceneState> = [
  'empty',
  'repo',
  'many',
  'plain',
  'conflict',
  'denied',
  'scratch',
];

const WIZARD_STEP_STATES: ReadonlyArray<WizardSceneState> = [
  'welcome',
  'agents-ready',
  'agents-signin',
  'agents-none',
  'agents-error',
  'tools-github',
  'tools-linear',
  'tools-nogit',
  'first-ask',
  'first-task',
];

const HOME_STATES: ReadonlyArray<HomeSceneState> = ['list', 'new', 'empty'];

const OnboardingHomeScene = () =>
  createElement(HomeScene, {
    state: HOME_STATES.find((state) => state === sceneParam({ key: 'state' })) ?? 'list',
    theme: sceneParam({ key: 'theme' }) === 'light' ? 'light' : 'dark',
  });

const ONBOARDING_SCENES: Readonly<Record<string, ComponentType>> = Object.fromEntries([
  ['onboarding', OnboardingScene],
  ['onboarding-home', OnboardingHomeScene],
  ...themed({
    id: 'onboarding-brand-tile',
    render: ({ theme }) => createElement(BrandTileScene, { theme }),
  }),
  ...themed({
    id: 'onboarding-splash',
    render: ({ theme }) => createElement(SplashScene, { theme }),
  }),
  ...themed({
    id: 'onboarding-setup-menu',
    render: ({ theme }) => createElement(SetupMenuScene, { theme }),
  }),
  ...NEW_WORKSPACE_STATES.flatMap((state) =>
    themed({
      id: `onboarding-new-workspace-${state}`,
      render: ({ theme }) => createElement(NewWorkspaceScene, { state, theme }),
    }),
  ),
  ...WIZARD_STEP_STATES.flatMap((state) =>
    themed({
      id: `onboarding-step-${state}`,
      render: ({ theme }) => createElement(WizardStepScene, { state, theme }),
    }),
  ),
  ...HOME_STATES.flatMap((state) =>
    themed({
      id: `onboarding-home-${state}`,
      render: ({ theme }) => createElement(HomeScene, { state, theme }),
    }),
  ),
]);

const GIT_LATER_STATES: ReadonlyArray<GitLaterState> = [
  'none',
  'review',
  'tracked',
  'detected',
  'empty',
];

const PICK_STATES: ReadonlyArray<PickSceneState> = ['code', 'docs', 'inside', 'big'];

const FOLDERS_STATES: ReadonlyArray<FoldersSceneState> = ['home', 'settings'];

const NOGIT_SCENES: Readonly<Record<string, ComponentType>> = Object.fromEntries([
  ...themed({
    id: 'u26-nogit-writer-wait',
    render: ({ theme }) => createElement(WriterWaitScene, { theme }),
  }),
  ...GIT_LATER_STATES.flatMap((state) =>
    themed({
      id: `u26-nogit-git-later-${state}`,
      render: ({ theme }) => createElement(GitLaterScene, { state, theme }),
    }),
  ),
  ...PICK_STATES.flatMap((state) =>
    themed({
      id: `u26-nogit-pick-${state}`,
      render: ({ theme }) => createElement(PickScene, { state, theme }),
    }),
  ),
  ...FOLDERS_STATES.flatMap((state) =>
    themed({
      id: `u26-nogit-folders-${state}`,
      render: ({ theme }) => createElement(FoldersScene, { state, theme }),
    }),
  ),
]);

export const BASE_SCENES = {
  demo: DemoPlayground,
  workspace: WorkspaceScene,
  workflow: WorkflowScene,
  shell: ShellScene,
  'column-rail': () => createElement(ShellScene, { isRail: true }),
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
  'foreign-stranded': () => createElement(ForeignBranchScene, { state: 'stranded' }),
  'foreign-picker': () => createElement(ForeignBranchScene, { state: 'picker' }),
  resolve: ResolveScene,
  'resolve-select': ResolveSelectScene,
  'resolve-launch': ResolveLaunchScene,
  'resolve-bulk-launch': () => createElement(ResolveBulkScene, { stage: 'launch' }),
  'resolve-bulk-answers': () => createElement(ResolveBulkScene, { stage: 'answers' }),
  'resolve-bulk-review': () => createElement(ResolveBulkScene, { stage: 'review' }),
  'resolve-bulk-accepted': () => createElement(ResolveBulkScene, { stage: 'accepted' }),
  'resolve-bulk-retry': () => createElement(ResolveBulkScene, { stage: 'retry' }),
  'branch-comments': BranchCommentsScene,
  'branch-commits': BrandHistoryScene,
  'branch-files': BrandDiffScene,
  'branch-lane-working': () => createElement(BranchLaneScene, { variant: 'working' }),
  'branch-lane-chain': () => createElement(BranchLaneScene, { variant: 'chain' }),
  'branch-narrow': BranchNarrowScene,
  'branch-push': BranchPushScene,
  'branch-reply-bundled': () => createElement(BranchReplyOnlyScene, { variant: 'bundled' }),
  'branch-reply-alone': () => createElement(BranchReplyOnlyScene, { variant: 'alone' }),
  'branch-reply-posted': () => createElement(BranchReplyOnlyScene, { variant: 'posted' }),
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
  'model-picker-auto': ModelPickerAutoScene,
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
  'brand-diff-unpushed': BrandDiffUnpushedScene,
  'diff-notes': DiffNotesScene,
  'brand-history': BrandHistoryScene,
  'brand-history-plan': BrandHistoryPlanScene,
  'brand-history-trial': BrandHistoryTrialScene,
  'brand-history-stopped': BrandHistoryStoppedScene,
  'brand-history-result': BrandHistoryResultScene,
  'brand-history-squash': BrandHistorySquashScene,
  'brand-limits': BrandLimitsScene,
  'brand-codex': BrandCodexScene,
  'brand-storage': BrandStorageScene,
  'demo-issue': DemoIssueScene,
  'demo-run': DemoRunScene,
  'demo-storage': DemoStorageScene,
  'brand-security-findings': BrandSecurityFindingsScene,
  'brand-tools': BrandToolsScene,
  'agent-brief': AgentBriefScene,
  'agent-brief-question': AgentBriefQuestionScene,
  'planner-transcript': PlannerTranscriptScene,
  'planner-transcript-revising': PlannerTranscriptRevisingScene,
  'planner-transcript-replaced': PlannerTranscriptReplacedScene,
  'planner-transcript-drawer': PlannerTranscriptDrawerScene,
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
  ...ONBOARDING_SCENES,
  ...NOGIT_SCENES,
  ...NOGIT_CHANGES_SCENES,
};
