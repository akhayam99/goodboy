import type { OverrideSettings } from '@goodboy/types';
import type { PlanPage } from './components/SettingsStudio/workspacePages';

export type WorkspaceSettingField =
  | 'branchPrefix'
  | 'branchTemplate'
  | 'attribution'
  | 'parallelAgents'
  | 'verbosity'
  | 'afterMerge'
  | 'replyVoice'
  | 'replyStyleNote'
  | 'replyTemplateFixed'
  | 'replyTemplateNoChange'
  | 'resolveOnGithub'
  | 'editPostedReply'
  | 'resolveCommitStyle'
  | 'permissionMode'
  | 'roles'
  | 'aboutWork'
  | 'workingRules'
  | 'explainMore'
  | 'workflowRules';

export const FIELD_PAGE: Readonly<Record<WorkspaceSettingField, PlanPage>> = {
  branchPrefix: 'general',
  branchTemplate: 'general',
  attribution: 'general',
  parallelAgents: 'general',
  verbosity: 'general',
  afterMerge: 'after-merge',
  replyVoice: 'review-replies',
  replyStyleNote: 'review-replies',
  replyTemplateFixed: 'review-replies',
  replyTemplateNoChange: 'review-replies',
  resolveOnGithub: 'review-replies',
  editPostedReply: 'review-replies',
  resolveCommitStyle: 'review-replies',
  permissionMode: 'permissions',
  roles: 'profile',
  aboutWork: 'profile',
  workingRules: 'profile',
  explainMore: 'profile',
  workflowRules: 'workflow-rules',
};

type OverrideOwner =
  | { readonly kind: 'field'; readonly field: WorkspaceSettingField }
  | { readonly kind: 'providers' };

const OVERRIDE_OWNER: Readonly<Record<keyof OverrideSettings, OverrideOwner>> = {
  defaultBranchPrefix: { kind: 'field', field: 'branchPrefix' },
  defaultBranchTemplate: { kind: 'field', field: 'branchTemplate' },
  attributionFooter: { kind: 'field', field: 'attribution' },
  parallelAgents: { kind: 'field', field: 'parallelAgents' },
  defaultVerbosity: { kind: 'field', field: 'verbosity' },
  afterMerge: { kind: 'field', field: 'afterMerge' },
  replyVoice: { kind: 'field', field: 'replyVoice' },
  replyStyleNote: { kind: 'field', field: 'replyStyleNote' },
  replyTemplateFixed: { kind: 'field', field: 'replyTemplateFixed' },
  replyTemplateNoChange: { kind: 'field', field: 'replyTemplateNoChange' },
  resolveOnGithub: { kind: 'field', field: 'resolveOnGithub' },
  resolveCommitStyle: { kind: 'field', field: 'resolveCommitStyle' },
  defaultProviderId: { kind: 'providers' },
  providerBindings: { kind: 'providers' },
  taskModels: { kind: 'providers' },
  roleModels: { kind: 'providers' },
  providerPool: { kind: 'providers' },
  workflowRules: { kind: 'field', field: 'workflowRules' },
};

export const isWorkspaceOwnedOverride = (key: string): key is keyof OverrideSettings =>
  Object.entries(OVERRIDE_OWNER).some(
    ([candidate, owner]) => candidate === key && owner.kind === 'field',
  );

const FIELDS = Object.keys(FIELD_PAGE).filter((key): key is WorkspaceSettingField =>
  Object.hasOwn(FIELD_PAGE, key),
);

export const pageKeys = ({
  page,
}: {
  readonly page: PlanPage;
}): ReadonlyArray<WorkspaceSettingField> => FIELDS.filter((field) => FIELD_PAGE[field] === page);
