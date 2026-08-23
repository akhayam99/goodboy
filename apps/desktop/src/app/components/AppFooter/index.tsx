import { Divider } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import { UpdateIndicator } from '../../../features/updater/components/UpdateIndicator';
import { BetaPill } from '../../../shared/components/BetaPill';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import { FOOTER_INTEGRATIONS } from './categories';
import { FooterButton } from './FooterButton';
import { IntegrationAddPopover } from './IntegrationAddPopover';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../features/integrations/components/IntegrationGlyph';
import { MoreStudiosPopover } from './MoreStudiosPopover';

const SETTINGS_LABEL = `Open settings (${shortcutGlyphs('settings.open')})`;

type Props = {
  activeStudio: string | null;
  onOpenWorkflows: () => void;
  onOpenProviders: () => void;
  onOpenSettings: () => void;
  onOpenBudget: () => void;
  onOpenImpact: () => void;
  onOpenChangelog: () => void;
  onOpenGithub: () => void;
  onOpenLinear: () => void;
  onOpenJira: () => void;
  onOpenSentry: () => void;
  onOpenGitlab: () => void;
  onOpenBitbucket: () => void;
  onOpenSlack: () => void;
  githubEnabled: boolean;
  linearEnabled: boolean;
  jiraEnabled: boolean;
  sentryEnabled: boolean;
  gitlabEnabled: boolean;
  bitbucketEnabled: boolean;
  slackEnabled: boolean;
};

export const AppFooter = ({
  activeStudio,
  onOpenWorkflows,
  onOpenProviders,
  onOpenSettings,
  onOpenBudget,
  onOpenImpact,
  onOpenChangelog,
  onOpenGithub,
  onOpenLinear,
  onOpenJira,
  onOpenSentry,
  onOpenGitlab,
  onOpenBitbucket,
  onOpenSlack,
  githubEnabled,
  linearEnabled,
  jiraEnabled,
  sentryEnabled,
  gitlabEnabled,
  bitbucketEnabled,
  slackEnabled,
}: Props) => {
  const noProviderConnected = useAppStore(
    (s) => !s.providers.some((p) => p.connection === 'connected'),
  );
  const enabled = {
    github: githubEnabled,
    gitlab: gitlabEnabled,
    bitbucket: bitbucketEnabled,
    linear: linearEnabled,
    jira: jiraEnabled,
    sentry: sentryEnabled,
    slack: slackEnabled,
  } satisfies Record<IntegrationGlyphProvider, boolean>;

  const openers = {
    github: onOpenGithub,
    gitlab: onOpenGitlab,
    bitbucket: onOpenBitbucket,
    linear: onOpenLinear,
    jira: onOpenJira,
    sentry: onOpenSentry,
    slack: onOpenSlack,
  } satisfies Record<IntegrationGlyphProvider, () => void>;
  const connectedMembers = FOOTER_INTEGRATIONS.filter((member) => enabled[member.provider]);

  return (
    <div className="flex shrink-0 flex-col">
      <Divider />
      <div className="grid h-9 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 bg-background px-2 [&>*:last-child]:justify-self-end">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <div
            role="group"
            aria-label="Connected integrations"
            className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {connectedMembers.map((member) => {
              const label = integrationLabel({ provider: member.provider });
              return (
                <FooterButton
                  key={member.provider}
                  icon={<IntegrationGlyph provider={member.provider} size="xs" useBrandColor />}
                  label={label}
                  title={label}
                  onClick={openers[member.provider]}
                  active={activeStudio === member.provider}
                  showLabel={false}
                />
              );
            })}
          </div>
          {connectedMembers.length > 0 ? (
            <Divider orientation="vertical" className="h-4 shrink-0 self-center" />
          ) : null}
          <IntegrationAddPopover
            members={FOOTER_INTEGRATIONS}
            enabled={enabled}
            openers={openers}
            isEmpty={connectedMembers.length === 0}
            active={FOOTER_INTEGRATIONS.some(
              (member) => member.provider === activeStudio && !enabled[member.provider],
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <BetaPill />
          <UpdateIndicator variant="pip" />
        </div>

        <div className="flex items-center gap-0.5">
          <FooterButton
            icon={<CONCEPT_ICONS.workflows size={12} aria-hidden />}
            label="Workflows"
            tone={CONCEPT_TONE.workflows}
            title="Open the workflow library for this workspace"
            onClick={onOpenWorkflows}
            active={activeStudio === 'workflow'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.providers size={12} aria-hidden />}
            label="Providers"
            tone={CONCEPT_TONE.providers}
            title="Connect and manage your provider accounts"
            onClick={onOpenProviders}
            pulse={noProviderConnected && activeStudio !== 'provider'}
            active={activeStudio === 'provider'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.settings size={12} aria-hidden />}
            label="Settings"
            tone={CONCEPT_TONE.settings}
            title={SETTINGS_LABEL}
            onClick={onOpenSettings}
            active={activeStudio === 'settings'}
          />
          <MoreStudiosPopover
            activeStudio={activeStudio}
            openers={{
              budget: onOpenBudget,
              impact: onOpenImpact,
              changelog: onOpenChangelog,
            }}
          />
        </div>
      </div>
    </div>
  );
};
