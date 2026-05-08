import type { WorkspaceId } from './ids';

export const CONFIG_BUNDLE_SCHEMA_VERSION = 1 as const;

export type ConfigBundleWorkspace = Readonly<{
  id: WorkspaceId;
  name: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
  overrides: {
    defaultProviderId: string | null;
    defaultPhaseTemplateId: string | null;
    defaultBranchPrefix: string | null;
    parallelEnabled: boolean | null;
  };
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

export type ConfigBundlePhaseDefinition = Readonly<{
  id: string;
  templateId: string;
  ordinal: number;
  name: string;
  promptPrefix: string;
  providerOverride: string | null;
  modelOverride: string | null;
}>;

export type ConfigBundlePhaseTemplate = Readonly<{
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  definitions: ReadonlyArray<ConfigBundlePhaseDefinition>;
  createdAt: string;
  updatedAt: string;
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

export type ConfigBundleSettings = Readonly<{
  editorBinary: string | null;
  enableParallelAgents: string | null;
  maxParallelism: string | null;
  providerPricingConfig: string | null;
}>;

export type ConfigBundle = Readonly<{
  schemaVersion: typeof CONFIG_BUNDLE_SCHEMA_VERSION;
  exportedAt: string;
  workspaces: ReadonlyArray<ConfigBundleWorkspace>;
  skills: ReadonlyArray<ConfigBundleSkill>;
  phaseTemplates: ReadonlyArray<ConfigBundlePhaseTemplate>;
  permissionRules: ReadonlyArray<ConfigBundlePermissionRule>;
  budgetRules: ReadonlyArray<ConfigBundleBudgetRule>;
  settings: ConfigBundleSettings;
}>;

export type ConfigBundleValidationError = Readonly<{
  field: string;
  message: string;
}>;

export type ConfigBundleImportResult = Readonly<{
  ok: boolean;
  errors: ReadonlyArray<ConfigBundleValidationError>;
  stats: Readonly<{
    workspaces: number;
    skills: number;
    phaseTemplates: number;
    permissionRules: number;
    budgetRules: number;
  }>;
}>;
