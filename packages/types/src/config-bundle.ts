import type { WorkspaceId } from './ids';

// The Rust side (apps/desktop/src-tauri/src/config_export.rs) is the source
// of truth for the actual version number. This literal type pins the shape
// of the JSON envelope on the TS side; bumps land in both places.
export type ConfigBundleSchemaVersion = 1;

export type ConfigBundleWorkspace = Readonly<{
  id: WorkspaceId;
  name: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
  overrides: {
    defaultProviderId: string | null;
    defaultWorkflowId: string | null;
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

export type ConfigBundleStep = Readonly<{
  id: string;
  workflowId: string;
  ordinal: number;
  name: string;
  promptPrefix: string;
  providerOverride: string | null;
  modelOverride: string | null;
}>;

export type ConfigBundleWorkflow = Readonly<{
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  steps: ReadonlyArray<ConfigBundleStep>;
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
  schemaVersion: ConfigBundleSchemaVersion;
  exportedAt: string;
  workspaces: ReadonlyArray<ConfigBundleWorkspace>;
  skills: ReadonlyArray<ConfigBundleSkill>;
  workflows: ReadonlyArray<ConfigBundleWorkflow>;
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
    workflows: number;
    permissionRules: number;
    budgetRules: number;
  }>;
}>;
