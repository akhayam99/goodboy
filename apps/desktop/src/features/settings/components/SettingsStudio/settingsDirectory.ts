import type { ProviderId } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_TONE, type CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ToolRailEntry } from '../../../integrations/toolRailEntries';
import type { ProviderRailStatus } from '../../../providers/providerRailStatus';
import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import { APP_SECTIONS, type AppSection } from './appSections';
import type { RailSubtitles } from './railSubtitles';
import { SHORTCUT_ROW_COUNT } from './shortcutRows';
import { SCOPE_ITEMS } from './settingsScopes';
import { WORKSPACE_PAGES, workspacePageOf, type WorkspacePage } from './workspacePages';

type Concept = keyof typeof CONCEPT_ICONS;

export type SettingsPageGlyph =
  | { readonly kind: 'concept'; readonly concept: Concept }
  | { readonly kind: 'defaults' }
  | { readonly kind: 'provider'; readonly provider: ProviderId };

type SettingsAttention = {
  readonly text: string;
  readonly tone: Tone;
};

export type SettingsPage = {
  readonly key: string;
  readonly label: string;
  readonly glyph: SettingsPageGlyph;
  readonly tone: Tone;
  readonly quiet: string;
  readonly attention: SettingsAttention | null;
  readonly target: SettingsScopeChange;
  readonly isDanger: boolean;
};

export type SettingsGroup = {
  readonly scope: SettingsPageScope;
  readonly label: string;
  readonly concept: Concept;
  readonly place: string;
  readonly subtitle: string | undefined;
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
  readonly toolsInventory: string;
  readonly workspacePages: Readonly<Partial<Record<WorkspacePage, string>>>;
};

type Params = {
  readonly status: SettingsStatus;
  readonly workspaceName: string | null;
};

const APP_QUIET: Readonly<Record<AppSection, string>> = {
  general: 'Updates, theme, editor',
  shortcuts: `${SHORTCUT_ROW_COUNT} shortcuts`,
  backup: 'Export or import',
  storage: 'Disk space Goodboy uses',
  branches: 'Merged, stale branches',
  'security-findings': 'Secrets in saved scripts',
  help: 'Guide and bug report',
  danger: 'Wipe local data',
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
    return attentionOf({ text: subtitles.generalText, tone: subtitles.generalTone });
  }
  if (section === 'storage') {
    return attentionOf({ text: subtitles.storageText, tone: subtitles.storageTone });
  }
  if (section === 'security-findings') {
    return attentionOf({
      text: subtitles.securityFindingsText,
      tone: subtitles.securityFindingsTone,
    });
  }
  return null;
};

const appGroup = ({ status }: Pick<Params, 'status'>): SettingsGroup => ({
  scope: 'app',
  label: 'App',
  concept: 'settings',
  place: 'This Mac',
  subtitle: undefined,
  tone: undefined,
  needsWorkspace: false,
  pages: APP_SECTIONS.map((section): SettingsPage => ({
    key: `app:${section.id}`,
    label: section.label,
    glyph: { kind: 'concept', concept: section.concept },
    tone: CONCEPT_TONE[section.concept],
    quiet: APP_QUIET[section.id],
    attention: appAttention({ section: section.id, subtitles: status.subtitles }),
    target: { scope: 'app', section: section.id },
    isDanger: section.id === 'danger',
  })),
});

const workspaceGroup = ({ status, workspaceName }: Params): SettingsGroup => ({
  ...scopeMeta('workspace'),
  place: workspaceName ?? 'This workspace',
  subtitle: status.subtitles.workspaceText ?? workspaceName ?? undefined,
  tone: status.subtitles.workspaceTone,
  pages: WORKSPACE_PAGES.map((page): SettingsPage => ({
    key: `workspace:${page.id}`,
    label: page.label,
    glyph: { kind: 'concept', concept: page.concept },
    tone: CONCEPT_TONE[page.concept],
    quiet: status.workspacePages[page.id] ?? page.hint,
    attention:
      page.id === 'projects'
        ? attentionOf({
            text: status.subtitles.workspaceText,
            tone: status.subtitles.workspaceTone,
          })
        : null,
    target: { scope: 'workspace', section: page.id },
    isDanger: page.id === 'danger',
  })),
});

const providerPages = ({ status, workspaceName }: Params): ReadonlyArray<SettingsPage> => {
  const defaults: ReadonlyArray<SettingsPage> =
    workspaceName === null
      ? []
      : [
          {
            key: 'providers:defaults',
            label: 'Defaults',
            glyph: { kind: 'defaults' },
            tone: 'primary',
            quiet: 'Model for each job',
            attention: null,
            target: { scope: 'providers' },
            isDanger: false,
          },
        ];
  const accounts = status.providers.map((provider): SettingsPage => ({
    key: `provider:${provider.id}`,
    label: provider.label,
    glyph: { kind: 'provider', provider: provider.id },
    tone: 'neutral',
    quiet: provider.status.subtitle,
    attention: attentionOf({ text: provider.status.subtitle, tone: provider.status.tone }),
    target: { scope: 'providers', provider: provider.id },
    isDanger: false,
  }));
  if (defaults.length + accounts.length > 0) {
    return [...defaults, ...accounts];
  }
  return [
    {
      key: 'providers',
      label: 'Providers & models',
      glyph: { kind: 'concept', concept: 'providers' },
      tone: CONCEPT_TONE.providers,
      quiet: 'Connect a provider',
      attention: attentionOf({
        text: status.subtitles.providersText,
        tone: status.subtitles.providersTone,
      }),
      target: { scope: 'providers' },
      isDanger: false,
    },
  ];
};

const providersGroup = (params: Params): SettingsGroup => ({
  ...scopeMeta('providers'),
  place: params.workspaceName ?? 'This Mac',
  subtitle: params.status.subtitles.providersText,
  tone: params.status.subtitles.providersTone,
  pages: providerPages(params),
});

const toolsGroup = ({ status, workspaceName }: Params): SettingsGroup => ({
  ...scopeMeta('tools'),
  place: workspaceName ?? 'This workspace',
  subtitle: status.toolsInventory,
  tone: undefined,
  pages: status.tools.map((entry): SettingsPage => ({
    key: `tool:${entry.tool}`,
    label: entry.label,
    glyph: { kind: 'concept', concept: entry.tool },
    tone: CONCEPT_TONE[entry.tool],
    quiet: entry.subtitle,
    attention: null,
    target: { scope: 'tools', tool: entry.tool },
    isDanger: false,
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
    return `app:${APP_SECTIONS.find((entry) => entry.id === section)?.id ?? 'general'}`;
  }
  if (scope === 'providers') {
    return provider === undefined ? 'providers:defaults' : `provider:${provider}`;
  }
  if (scope === 'tools') {
    return tool === undefined ? 'tools' : `tool:${tool}`;
  }
  return `workspace:${workspacePageOf({ section })}`;
};
