import type { WorkspaceId } from './ids';
import type { ProviderPolicy } from './provider-policy';
import type { ProviderId } from './provider-registry';
import type { ProviderBindings, RoleModelPreferences, TaskModelPreferences } from './settings';

export const CONFIG_BUNDLE_SCHEMA_VERSION = 3 as const;

export type ConfigBundleProfile = Readonly<{
  rolesJson: string | null;
  aboutWork: string | null;
  workingRules: string | null;
  explainMoreJson: string | null;
}>;

export type ConfigBundleProject = Readonly<{
  id: string;
  name: string;
  rootPath?: string;
  kind: 'repo' | 'folder';
  description: string | null;
  starredAt: string | null;
  baseBranch: string | null;
  rootCommit: string | null;
  remoteUrl: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type ConfigBundleWorkspaceOverrides = Readonly<{
  defaultProviderId: string | null;
  defaultBranchPrefix: string | null;
  defaultVerbosity: string | null;
  providerBindings: ProviderBindings | null;
  taskModels: TaskModelPreferences | null;
  roleModels: RoleModelPreferences | null;
  parallelAgents: boolean | null;
  providerPool: ReadonlyArray<ProviderId> | ProviderPolicy | null;
  attributionFooter: boolean | null;
  replyVoice: string | null;
  replyStyleNote: string | null;
  replyTemplateFixed: string | null;
  replyTemplateNoChange: string | null;
  resolveOnGithub: boolean | null;
  resolveCommitStyle: string | null;
  defaultBranchTemplate?: string | null;
}>;

export type ConfigBundleWorkspace = Readonly<{
  id: WorkspaceId;
  name: string;
  rootPath?: string;
  projects: ReadonlyArray<ConfigBundleProject>;
  createdAt: string;
  updatedAt: string;
  overrides: ConfigBundleWorkspaceOverrides;
  profile?: ConfigBundleProfile;
}>;

export type ConfigBundleSkill = Readonly<{
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  filePath: string;
  body: string;
  frontmatterJson: string;
  createdAt: string;
  updatedAt: string;
}>;

export type ConfigBundleStep = Readonly<{
  id: string;
  workflowId: string;
  ordinal: number;
  name: string;
  promptPrefix: string;
  providerOverride: string | null;
  modelOverride: string | null;
  role: string | null;
  effort: string | null;
  expectedOutput: string | null;
  orchestratorReason: string | null;
}>;

export type ConfigBundleWorkflow = Readonly<{
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  steps: ReadonlyArray<ConfigBundleStep>;
  createdAt: string;
  updatedAt: string;
  isPreset: boolean;
  origin: string | null;
  goal: string | null;
  processText: string | null;
}>;

export type ConfigBundlePermissionRule = Readonly<{
  id: string;
  scope: string;
  workspaceId: string | null;
  sessionId: string | null;
  patternTool: string;
  patternArgsMatcher: string | null;
  decision: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}>;

export type ConfigBundleBudgetRule = Readonly<{
  id: string;
  provider: string;
  period: string;
  capUsd: number;
  alertThresholdPct: number;
  createdAt: string;
}>;

export type ConfigBundleScript = Readonly<{
  id: string;
  projectId: string;
  name: string;
  body: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}>;

export type ConfigBundleToolBinding = Readonly<{
  workspaceId: string;
  projectId?: string;
  provider: string;
  configJson: string;
}>;

export type ConfigBundleAppPreferences = Readonly<{
  editorBinary: string | null;
  editorDefault: string | null;
  hiddenModelsJson: string | null;
}>;

export type ConfigBundle = Readonly<{
  schemaVersion: number;
  exportedAt: string;
  workspaces: ReadonlyArray<ConfigBundleWorkspace>;
  skills: ReadonlyArray<ConfigBundleSkill>;
  phaseTemplates: ReadonlyArray<ConfigBundleWorkflow>;
  permissionRules: ReadonlyArray<ConfigBundlePermissionRule>;
  budgetRules: ReadonlyArray<ConfigBundleBudgetRule>;
  scripts: ReadonlyArray<ConfigBundleScript>;
  toolBindings: ReadonlyArray<ConfigBundleToolBinding>;
  appPreferences: ConfigBundleAppPreferences;
}>;

export type ConfigBundleValidationError = Readonly<{
  field: string;
  message: string;
}>;

export type ConfigBundleImportStats = Readonly<{
  workspaces: number;
  skills: number;
  phaseTemplates: number;
  permissionRules: number;
  budgetRules: number;
  scripts: number;
  toolBindings: number;
  unresolvedProjects: number;
}>;

export type ConfigBundleImportResult = Readonly<{
  ok: boolean;
  errors: ReadonlyArray<ConfigBundleValidationError>;
  stats: ConfigBundleImportStats;
}>;

export type ExportGroups = Readonly<{
  workspaces: boolean;
  projects: boolean;
  folderPaths: boolean;
  profile: boolean;
  workflowsYours: boolean;
  workflowsOrchestrated: boolean;
  scripts: boolean;
  permissionRules: boolean;
  budgetRules: boolean;
  integrations: boolean;
  appPreferences: boolean;
}>;

export const DEFAULT_EXPORT_GROUPS: ExportGroups = {
  workspaces: true,
  projects: true,
  folderPaths: false,
  profile: true,
  workflowsYours: true,
  workflowsOrchestrated: false,
  scripts: true,
  permissionRules: true,
  budgetRules: true,
  integrations: true,
  appPreferences: true,
};

export type LeftOutFinding = Readonly<{
  fingerprint: string;
  subjectKind: string;
  subjectId: string;
  secretKind: string;
  last4: string;
}>;

export type ExportCounts = Readonly<{
  workspaces: number;
  projects: number;
  skills: number;
  phaseTemplates: number;
  permissionRules: number;
  budgetRules: number;
  scripts: number;
  toolBindings: number;
}>;

export type ExportPreview = Readonly<{
  counts: ExportCounts;
  leftOutFindings: ReadonlyArray<LeftOutFinding>;
}>;

export type ImportManifest = Readonly<{
  schemaVersion: number;
  exportedAt: string;
  workspaceCount: number;
  projectCount: number;
  workflowCount: number;
}>;

export type WorkspaceMatchAction = 'merge' | 'add';

export type WorkspaceMatch = Readonly<{
  bundleId: string;
  name: string;
  existingId: string | null;
  action: WorkspaceMatchAction;
}>;

export type ProjectMatchVerdict =
  'same_repository' | 'same_name_unconfirmed' | 'different_repository' | 'not_found';

export type ProjectMatch = Readonly<{
  bundleProjectId: string;
  name: string;
  hasPath: boolean;
  resolvedPath: string | null;
  verdict: ProjectMatchVerdict;
}>;

export type ImportGroupStat = Readonly<{
  group: string;
  adds: number;
  updates: number;
}>;

export type ImportPreview = Readonly<{
  manifest: ImportManifest;
  workspaceMatches: ReadonlyArray<WorkspaceMatch>;
  projectMatches: ReadonlyArray<ProjectMatch>;
  groupStats: ReadonlyArray<ImportGroupStat>;
}>;
