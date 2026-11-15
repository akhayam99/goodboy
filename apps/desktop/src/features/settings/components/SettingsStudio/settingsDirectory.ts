import type { Tone } from '@goodboy/ui';
import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import { APP_SECTIONS, IPHONE_SECTION_ID, appSectionOf, type AppSection } from './appSections';
import { PERMISSIONS_SECTION_ID } from '../../../permissions/openPermissionSettings';
import type { RailSubtitles } from './railSubtitles';
import { WORKSPACE_PAGES, workspacePageOf, type WorkspacePage } from './workspacePages';

type Concept = keyof typeof CONCEPT_ICONS;

export type SettingsAttention = {
  readonly text: string;
  readonly tone: Tone;
};

type SettingsPage = {
  readonly key: string;
  readonly label: string;
  readonly attention: SettingsAttention | null;
  readonly target: SettingsScopeChange;
  readonly isHidden?: boolean;
};

export type SettingsGroup = {
  readonly scope: SettingsPageScope;
  readonly label: string;
  readonly concept: Concept;
  readonly place: string;
  readonly attention: string | undefined;
  readonly tone: Tone | undefined;
  readonly needsWorkspace: boolean;
  readonly pages: ReadonlyArray<SettingsPage>;
};

export type SettingsStatus = {
  readonly subtitles: RailSubtitles;
};

type Params = {
  readonly status: SettingsStatus;
  readonly workspaceName: string | null;
  readonly isIphonePaired?: boolean;
};

const ATTENTION_TONES: ReadonlyArray<Tone> = ['info', 'warning', 'danger'];

const attentionOf = ({
  text,
  tone,
}: {
  readonly text: string | undefined;
  readonly tone: Tone | undefined;
}): SettingsAttention | null => {
  if (text === undefined || tone === undefined || !ATTENTION_TONES.includes(tone)) {
    return null;
  }
  return { text, tone };
};

const appAttention = ({
  section,
  subtitles,
}: {
  readonly section: AppSection;
  readonly subtitles: RailSubtitles;
}): SettingsAttention | null => {
  if (section === 'general') {
    return attentionOf({ text: subtitles.updatesText, tone: subtitles.updatesTone });
  }
  if (section === 'storage') {
    return attentionOf({ text: subtitles.storageText, tone: subtitles.storageTone });
  }
  return null;
};

type WorkspaceAttentionParams = {
  readonly page: WorkspacePage;
  readonly subtitles: RailSubtitles;
};

const workspaceAttention = ({
  page,
  subtitles,
}: WorkspaceAttentionParams): SettingsAttention | null => {
  if (page === 'projects') {
    return attentionOf({ text: subtitles.workspaceText, tone: subtitles.workspaceTone });
  }
  if (page === PERMISSIONS_SECTION_ID) {
    return attentionOf({
      text: subtitles.securityFindingsText,
      tone: subtitles.securityFindingsTone,
    });
  }
  return null;
};

const THIS_MAC = 'This Mac';

const THIS_WORKSPACE = 'This workspace';

const appGroup = ({
  status,
  isIphonePaired = false,
}: Omit<Params, 'workspaceName'>): SettingsGroup => ({
  scope: 'app',
  label: THIS_MAC,
  concept: 'settings',
  place: THIS_MAC,
  attention: undefined,
  tone: undefined,
  needsWorkspace: false,
  pages: APP_SECTIONS.map((section): SettingsPage => ({
    key: `app:${section.id}`,
    label: section.label,
    attention: appAttention({ section: section.id, subtitles: status.subtitles }),
    target: { scope: 'app', section: section.id },
    isHidden: section.id === IPHONE_SECTION_ID && !isIphonePaired,
  })),
});

const workspacePagesOf = ({ status }: Pick<Params, 'status'>): ReadonlyArray<SettingsPage> =>
  WORKSPACE_PAGES.map((page): SettingsPage => ({
    key: `workspace:${page.id}`,
    label: page.label,
    attention: workspaceAttention({ page: page.id, subtitles: status.subtitles }),
    target: { scope: 'workspace', section: page.id },
  }));

const workspaceGroup = ({ status, workspaceName }: Params): SettingsGroup => ({
  scope: 'workspace',
  label: workspaceName ?? THIS_WORKSPACE,
  concept: 'workspace',
  needsWorkspace: true,
  place: workspaceName ?? THIS_WORKSPACE,
  attention: status.subtitles.workspaceText,
  tone: status.subtitles.workspaceTone,
  pages: workspacePagesOf({ status }),
});

export const settingsDirectory = (params: Params): ReadonlyArray<SettingsGroup> => {
  const groups = [appGroup(params), workspaceGroup(params)];
  return groups.filter((group) => params.workspaceName !== null || !group.needsWorkspace);
};

type PageKeyParams = {
  readonly scope: SettingsPageScope;
  readonly section?: string;
};

export const settingsPageKey = ({ scope, section }: PageKeyParams): string => {
  if (scope === 'app') {
    return `app:${appSectionOf({ section })}`;
  }
  return `workspace:${workspacePageOf({ section })}`;
};
