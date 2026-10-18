import type { ProviderId } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';
import type { ToolRailEntry } from '../../../integrations/toolRailEntries';
import type { ProviderRailStatus } from '../../../providers/providerRailStatus';
import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import { APP_SECTIONS, appSectionOf, type AppSection } from './appSections';
import type { RailSubtitles } from './railSubtitles';
import { SCOPE_ITEMS } from './settingsScopes';
import { WORKSPACE_PAGES, workspacePageOf } from './workspacePages';

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

type SettingsProviderEntry = {
  readonly id: ProviderId;
  readonly label: string;
  readonly status: ProviderRailStatus;
};

export type SettingsStatus = {
  readonly subtitles: RailSubtitles;
  readonly providers: ReadonlyArray<SettingsProviderEntry>;
  readonly tools: ReadonlyArray<ToolRailEntry>;
};

type Params = {
  readonly status: SettingsStatus;
  readonly workspaceName: string | null;
};

const scopeMeta = (
  scope: Exclude<SettingsPageScope, 'app'>,
): Pick<SettingsGroup, 'scope' | 'label' | 'concept' | 'needsWorkspace'> => {
  const item = SCOPE_ITEMS.find((candidate) => candidate.scope === scope);
  return {
    scope,
    label: item?.label ?? 'Settings',
    concept: item?.concept ?? 'settings',
    needsWorkspace: item?.needsWorkspace ?? true,
  };
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

type FoldParams = {
  readonly group: SettingsGroup;
};

export const foldAttentionOf = ({ group }: FoldParams): SettingsAttention | null =>
  worstAttention({
    attentions: [
      attentionOf({ text: group.attention, tone: group.tone }),
      ...group.pages.map((page) => page.attention),
    ],
  });

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

const workspaceGroup = ({ status, workspaceName }: Params): SettingsGroup => ({
  ...scopeMeta('workspace'),
  place: workspaceName ?? 'This workspace',
  attention: status.subtitles.workspaceText,
  tone: status.subtitles.workspaceTone,
  pages: WORKSPACE_PAGES.map((page): SettingsPage => ({
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
  })),
});

const providerPages = ({ status, workspaceName }: Params): ReadonlyArray<SettingsPage> => {
  const defaults: ReadonlyArray<SettingsPage> =
    workspaceName === null
      ? []
      : [
          {
            key: 'providers:defaults',
            label: NAMES.models,
            attention: null,
            target: { scope: 'providers' },
          },
        ];
  const accounts = status.providers.map((provider): SettingsPage => ({
    key: `provider:${provider.id}`,
    label: provider.label,
    attention: attentionOf({ text: provider.status.subtitle, tone: provider.status.tone }),
    target: { scope: 'providers', provider: provider.id },
  }));
  if (defaults.length + accounts.length > 0) {
    return [...defaults, ...accounts];
  }
  return [
    {
      key: 'providers',
      label: NAMES.providersAndModels,
      attention: attentionOf({
        text: status.subtitles.providersText,
        tone: status.subtitles.providersTone,
      }),
      target: { scope: 'providers' },
    },
  ];
};

const providersGroup = (params: Params): SettingsGroup => ({
  ...scopeMeta('providers'),
  place: params.workspaceName ?? 'This Mac',
  attention: params.status.subtitles.providersText,
  tone: params.status.subtitles.providersTone,
  pages: providerPages(params),
});

const toolsGroup = ({ status, workspaceName }: Params): SettingsGroup => ({
  ...scopeMeta('tools'),
  place: workspaceName ?? 'This workspace',
  attention: undefined,
  tone: undefined,
  pages: status.tools.map((entry): SettingsPage => ({
    key: `tool:${entry.tool}`,
    label: entry.label,
    attention: null,
    target: { scope: 'tools', tool: entry.tool },
  })),
});

export const settingsDirectory = (params: Params): ReadonlyArray<SettingsGroup> => {
  const groups = [
    appGroup(params),
    workspaceGroup(params),
    providersGroup(params),
    toolsGroup(params),
  ];
  return groups.filter((group) => params.workspaceName !== null || !group.needsWorkspace);
};

type PageKeyParams = {
  readonly scope: SettingsPageScope;
  readonly section?: string;
  readonly provider?: ProviderId;
  readonly tool?: ToolRailEntry['tool'];
};

export const settingsPageKey = ({ scope, section, provider, tool }: PageKeyParams): string => {
  if (scope === 'app') {
    return `app:${appSectionOf({ section })}`;
  }
  if (scope === 'providers') {
    return provider === undefined ? 'providers:defaults' : `provider:${provider}`;
  }
  if (scope === 'tools') {
    return tool === undefined ? 'tools' : `tool:${tool}`;
  }
  return `workspace:${workspacePageOf({ section })}`;
};
