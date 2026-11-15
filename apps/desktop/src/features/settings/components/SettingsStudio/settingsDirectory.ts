import type { Tone } from '@goodboy/ui';
import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import { APP_SECTIONS, appSectionOf, type AppSection } from './appSections';
import { MODELS_PAGE_SECTION, isModelsPage } from '../../isModelsPage';
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
};

const ATTENTION_TONES: ReadonlyArray<Tone> = ['info', 'warning', 'danger'];

type RankParams = {
  readonly attention: SettingsAttention | null;
};

const rankOf = ({ attention }: RankParams): number =>
  attention === null ? -1 : ATTENTION_TONES.indexOf(attention.tone);

type WorstParams = {
  readonly attentions: ReadonlyArray<SettingsAttention | null>;
};

const worstAttention = ({ attentions }: WorstParams): SettingsAttention | null =>
  attentions.reduce<SettingsAttention | null>(
    (worst, attention) =>
      rankOf({ attention }) > rankOf({ attention: worst }) ? attention : worst,
    null,
  );

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
  if (section === 'updates') {
    return attentionOf({ text: subtitles.updatesText, tone: subtitles.updatesTone });
  }
  if (section === 'storage') {
    return worstAttention({
      attentions: [
        attentionOf({
          text: subtitles.securityFindingsText,
          tone: subtitles.securityFindingsTone,
        }),
        attentionOf({ text: subtitles.storageText, tone: subtitles.storageTone }),
      ],
    });
  }
  return null;
};

const appGroup = ({ status }: Pick<Params, 'status'>): SettingsGroup => ({
  scope: 'app',
  label: 'App',
  concept: 'settings',
  place: 'This Mac',
  attention: undefined,
  tone: undefined,
  needsWorkspace: false,
  pages: APP_SECTIONS.map((section): SettingsPage => ({
    key: `app:${section.id}`,
    label: section.label,
    attention: appAttention({ section: section.id, subtitles: status.subtitles }),
    target: { scope: 'app', section: section.id },
  })),
});

const MODELS_AFTER_PAGE: WorkspacePage = 'general';

const MODELS_PAGE_KEY = `workspace:${MODELS_PAGE_SECTION}`;

const modelsPage: SettingsPage = {
  key: MODELS_PAGE_KEY,
  label: NAMES.models,
  attention: null,
  target: { scope: 'workspace', section: MODELS_PAGE_SECTION },
};

const workspacePagesOf = ({ status }: Pick<Params, 'status'>): ReadonlyArray<SettingsPage> =>
  WORKSPACE_PAGES.flatMap((page): ReadonlyArray<SettingsPage> => {
    const entry: SettingsPage = {
      key: `workspace:${page.id}`,
      label: page.label,
      attention:
        page.id === 'projects'
          ? attentionOf({
              text: status.subtitles.workspaceText,
              tone: status.subtitles.workspaceTone,
            })
          : null,
      target: { scope: 'workspace', section: page.id },
    };
    return page.id === MODELS_AFTER_PAGE ? [entry, modelsPage] : [entry];
  });

const workspaceGroup = ({ status, workspaceName }: Params): SettingsGroup => ({
  scope: 'workspace',
  label: 'This workspace',
  concept: 'workspace',
  needsWorkspace: true,
  place: workspaceName ?? 'This workspace',
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
  if (isModelsPage({ section })) {
    return MODELS_PAGE_KEY;
  }
  return `workspace:${workspacePageOf({ section })}`;
};
