import { DEFAULT_BRANCH_TEMPLATE } from '@goodboy/core';
import {
  AFTER_MERGE_RULES,
  REPLY_VOICES,
  RESOLVE_COMMIT_STYLES,
  type OverrideSettings,
} from '@goodboy/types';
import { DEFAULT_AFTER_MERGE_RULE } from '../../../store/slices/branch-cleanup';
import { DEFAULT_PERMISSION_MODE, MODE_COPY, PICKER_MODES } from '../../permissions/modeCopy';
import { EDIT_POSTED_REPLY_OFF, EDIT_POSTED_REPLY_ON } from '../../resolve/editPostedReplySetting';
import {
  REPLY_SETTINGS_DEFAULT,
  REPLY_TEMPLATE_FIXED_DEFAULT,
  REPLY_TEMPLATE_NO_CHANGE_DEFAULT,
} from '../../resolve/replySettings';
import { COMMIT_STYLE_LABEL, VOICE_LABEL } from '../../resolve/replySettingsCopy';
import { AFTER_MERGE_SHORT_LABEL } from '../components/SettingsStudio/afterMergeCopy';
import { FIELD_PAGE, type WorkspaceSettingField } from '../pageKeys';
import { DEFAULT_BRANCH_PREFIX } from '../settings';
import { VERBOSITY_LABEL, VERBOSITY_LEVELS } from '../verbosity';
import type { WorkspacePage } from '../components/SettingsStudio/workspacePages';
import type { WorkspaceSettingsSnapshot, WorkspaceSettingsWrite } from './snapshot';

export type FieldValue = string | boolean | ReadonlyArray<string>;

export type WorkspaceFieldDef = {
  readonly id: WorkspaceSettingField;
  readonly page: WorkspacePage;
  readonly label: string;
  readonly fallback: FieldValue;
  readonly stored: (snapshot: WorkspaceSettingsSnapshot) => FieldValue | null;
  readonly display: (value: FieldValue) => string;
  readonly write: (value: FieldValue | null) => Partial<WorkspaceSettingsWrite>;
};

type TypedDef<Value extends FieldValue> = {
  readonly id: WorkspaceSettingField;
  readonly label: string;
  readonly fallback: Value;
  readonly parse: (value: FieldValue) => Value | null;
  readonly stored: (snapshot: WorkspaceSettingsSnapshot) => Value | null;
  readonly display: (value: Value) => string;
  readonly write: (value: Value | null) => Partial<WorkspaceSettingsWrite>;
};

const ONE_LINE_LIMIT = 40;

const oneLine = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat === '') {
    return 'None';
  }
  return flat.length > ONE_LINE_LIMIT ? `${flat.slice(0, ONE_LINE_LIMIT - 1)}…` : flat;
};

const onOff = (value: boolean): string => (value ? 'On' : 'Off');

const listText = (value: ReadonlyArray<string>): string =>
  value.length === 0 ? 'None' : value.join(', ');

const asText = (value: FieldValue): string | null => (typeof value === 'string' ? value : null);

const asFlag = (value: FieldValue): boolean | null => (typeof value === 'boolean' ? value : null);

const asList = (value: FieldValue): ReadonlyArray<string> | null =>
  typeof value === 'string' || typeof value === 'boolean' ? null : value;

const oneOf =
  <Option extends string>(options: ReadonlyArray<Option>) =>
  (value: FieldValue): Option | null =>
    options.find((option) => option === value) ?? null;

const textOrNull = (value: string | null | undefined): string | null =>
  value == null || value.trim() === '' ? null : value;

const listOrNull = (value: ReadonlyArray<string>): ReadonlyArray<string> | null =>
  value.length === 0 ? null : value;

const erase = <Value extends FieldValue>(def: TypedDef<Value>): WorkspaceFieldDef => ({
  id: def.id,
  page: FIELD_PAGE[def.id],
  label: def.label,
  fallback: def.fallback,
  stored: def.stored,
  display: (value) => {
    const parsed = def.parse(value);
    return parsed === null ? '' : def.display(parsed);
  },
  write: (value) => {
    if (value === null) {
      return def.write(null);
    }
    const parsed = def.parse(value);
    return parsed === null ? {} : def.write(parsed);
  },
});

const override = <Key extends keyof OverrideSettings>(
  key: Key,
  value: OverrideSettings[Key],
): Partial<WorkspaceSettingsWrite> => ({ overrides: { [key]: value } });

const WORKSPACE_FIELDS: ReadonlyArray<WorkspaceFieldDef> = [
  erase({
    id: 'branchPrefix',
    label: 'Branch prefix',
    fallback: DEFAULT_BRANCH_PREFIX,
    parse: asText,
    stored: ({ overrides }) => overrides?.defaultBranchPrefix ?? null,
    display: (value) => value,
    write: (value) => override('defaultBranchPrefix', value),
  }),
  erase({
    id: 'branchTemplate',
    label: 'Branch name',
    fallback: DEFAULT_BRANCH_TEMPLATE,
    parse: asText,
    stored: ({ overrides }) => textOrNull(overrides?.defaultBranchTemplate),
    display: (value) => value,
    write: (value) =>
      override('defaultBranchTemplate', value === DEFAULT_BRANCH_TEMPLATE ? null : value),
  }),
  erase({
    id: 'attribution',
    label: 'Attribution line',
    fallback: true,
    parse: asFlag,
    stored: ({ overrides }) => overrides?.attributionFooter ?? null,
    display: onOff,
    write: (value) => override('attributionFooter', value),
  }),
  erase({
    id: 'parallelAgents',
    label: 'Parallel agents',
    fallback: false,
    parse: asFlag,
    stored: ({ overrides }) => overrides?.parallelAgents ?? null,
    display: onOff,
    write: (value) => override('parallelAgents', value),
  }),
  erase({
    id: 'verbosity',
    label: 'Output verbosity',
    fallback: 'normal',
    parse: oneOf(VERBOSITY_LEVELS),
    stored: ({ overrides }) => overrides?.defaultVerbosity ?? null,
    display: (value) => VERBOSITY_LABEL[value],
    write: (value) => override('defaultVerbosity', value),
  }),
  erase({
    id: 'afterMerge',
    label: 'When a pull request merges',
    fallback: DEFAULT_AFTER_MERGE_RULE,
    parse: oneOf(AFTER_MERGE_RULES),
    stored: ({ overrides }) => overrides?.afterMerge ?? null,
    display: (value) => AFTER_MERGE_SHORT_LABEL[value],
    write: (value) => override('afterMerge', value),
  }),
  erase({
    id: 'replyVoice',
    label: 'Voice',
    fallback: REPLY_SETTINGS_DEFAULT.voice,
    parse: oneOf(REPLY_VOICES),
    stored: ({ overrides }) => overrides?.replyVoice ?? null,
    display: (value) => VOICE_LABEL[value],
    write: (value) => override('replyVoice', value),
  }),
  erase({
    id: 'replyStyleNote',
    label: 'Style note',
    fallback: '',
    parse: asText,
    stored: ({ overrides }) => textOrNull(overrides?.replyStyleNote),
    display: oneLine,
    write: (value) => override('replyStyleNote', textOrNull(value)),
  }),
  erase({
    id: 'replyTemplateFixed',
    label: 'When fixed',
    fallback: REPLY_TEMPLATE_FIXED_DEFAULT,
    parse: asText,
    stored: ({ overrides }) => textOrNull(overrides?.replyTemplateFixed),
    display: oneLine,
    write: (value) => override('replyTemplateFixed', textOrNull(value)),
  }),
  erase({
    id: 'replyTemplateNoChange',
    label: 'When not changing',
    fallback: REPLY_TEMPLATE_NO_CHANGE_DEFAULT,
    parse: asText,
    stored: ({ overrides }) => textOrNull(overrides?.replyTemplateNoChange),
    display: oneLine,
    write: (value) => override('replyTemplateNoChange', textOrNull(value)),
  }),
  erase({
    id: 'resolveOnGithub',
    label: 'Resolve the thread after replying',
    fallback: REPLY_SETTINGS_DEFAULT.resolveOnGithub,
    parse: asFlag,
    stored: ({ overrides }) => overrides?.resolveOnGithub ?? null,
    display: onOff,
    write: (value) => override('resolveOnGithub', value),
  }),
  erase({
    id: 'editPostedReply',
    label: 'Edit the posted reply',
    fallback: true,
    parse: asFlag,
    stored: ({ editPostedReply }) => (editPostedReply === null ? null : editPostedReply !== '0'),
    display: onOff,
    write: (value) => ({
      editPostedReply: value === false ? EDIT_POSTED_REPLY_OFF : EDIT_POSTED_REPLY_ON,
    }),
  }),
  erase({
    id: 'resolveCommitStyle',
    label: 'Commit style',
    fallback: REPLY_SETTINGS_DEFAULT.commitStyle,
    parse: oneOf(RESOLVE_COMMIT_STYLES),
    stored: ({ overrides }) => overrides?.resolveCommitStyle ?? null,
    display: (value) => COMMIT_STYLE_LABEL[value],
    write: (value) => override('resolveCommitStyle', value),
  }),
  erase({
    id: 'permissionMode',
    label: 'Default for new sessions',
    fallback: DEFAULT_PERMISSION_MODE,
    parse: oneOf(PICKER_MODES),
    stored: ({ permissionMode }) => permissionMode,
    display: (value) => MODE_COPY[value].label,
    write: (value) => ({ permissionMode: value ?? DEFAULT_PERMISSION_MODE }),
  }),
  erase({
    id: 'roles',
    label: 'Your roles',
    fallback: [],
    parse: asList,
    stored: ({ profile }) => listOrNull(profile.roles),
    display: listText,
    write: (value) => ({ profile: { roles: value ?? [] } }),
  }),
  erase({
    id: 'aboutWork',
    label: 'About your work',
    fallback: '',
    parse: asText,
    stored: ({ profile }) => textOrNull(profile.aboutWork),
    display: oneLine,
    write: (value) => ({ profile: { aboutWork: textOrNull(value) } }),
  }),
  erase({
    id: 'workingRules',
    label: 'How agents should work with you',
    fallback: '',
    parse: asText,
    stored: ({ profile }) => textOrNull(profile.workingRules),
    display: oneLine,
    write: (value) => ({ profile: { workingRules: textOrNull(value) } }),
  }),
  erase({
    id: 'explainMore',
    label: 'Explain more when it touches',
    fallback: [],
    parse: asList,
    stored: ({ profile }) => listOrNull(profile.explainMore),
    display: listText,
    write: (value) => ({ profile: { explainMore: value ?? [] } }),
  }),
];

export const sameValue = (left: FieldValue, right: FieldValue): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const fieldDef = ({
  field,
}: {
  readonly field: WorkspaceSettingField;
}): WorkspaceFieldDef => {
  const def = WORKSPACE_FIELDS.find((candidate) => candidate.id === field);
  if (def === undefined) {
    throw new Error(`no workspace setting field ${field}`);
  }
  return def;
};

export const effectiveValue = ({
  def,
  snapshot,
}: {
  readonly def: WorkspaceFieldDef;
  readonly snapshot: WorkspaceSettingsSnapshot;
}): FieldValue => def.stored(snapshot) ?? def.fallback;

export const isChanged = ({
  def,
  snapshot,
}: {
  readonly def: WorkspaceFieldDef;
  readonly snapshot: WorkspaceSettingsSnapshot;
}): boolean => {
  const stored = def.stored(snapshot);
  return stored !== null && !sameValue(stored, def.fallback);
};
