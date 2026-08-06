import { Fragment } from 'react';
import { Divider } from '@goodboy/ui';
import { FolderGit2 } from 'lucide-react';
import { useAppStore } from '../../../store';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import { BetaPill } from '../../../shared/components/BetaPill';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { FOOTER_CATEGORIES } from './categories';
import { FooterButton } from './FooterButton';
import { IntegrationCategoryGroup } from './IntegrationCategoryGroup';

type Props = {
  activeStudio: string | null;
  onOpenWorkflows: () => void;
  onOpenProviders: () => void;
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
  onConvertToDevProject: () => void;
  githubEnabled: boolean;
  linearEnabled: boolean;
  jiraEnabled: boolean;
  sentryEnabled: boolean;
  gitlabEnabled: boolean;
  bitbucketEnabled: boolean;
  slackEnabled: boolean;
  isSimpleWorkspace: boolean;
};

export const AppFooter = ({
  activeStudio,
  onOpenWorkflows,
  onOpenProviders,
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
  onConvertToDevProject,
  githubEnabled,
  linearEnabled,
  jiraEnabled,
  sentryEnabled,
  gitlabEnabled,
  bitbucketEnabled,
  slackEnabled,
  isSimpleWorkspace,
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

  return (
    <div className="flex shrink-0 flex-col">
      <Divider />
      <div className="grid h-9 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 bg-background px-2 [&>*:last-child]:justify-self-end">
        <div className="flex items-center gap-1.5">
          {FOOTER_CATEGORIES.map((category, index) => (
            <Fragment key={category.id}>
              {index > 0 ? (
                <Divider orientation="vertical" className="h-4 shrink-0 self-center" />
              ) : null}
              {category.id === 'code-host' && isSimpleWorkspace ? (
                <FooterButton
                  icon={<FolderGit2 size={12} aria-hidden />}
                  label="Add a repo"
                  title="Turn this workspace into a dev project backed by a git repository"
                  onClick={onConvertToDevProject}
                />
              ) : (
                <IntegrationCategoryGroup
                  category={category}
                  enabled={enabled}
                  openers={openers}
                  activeStudio={activeStudio}
                  isSimpleWorkspace={isSimpleWorkspace}
                />
              )}
            </Fragment>
          ))}
        </div>

        <BetaPill />

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
            icon={<CONCEPT_ICONS.budget size={12} aria-hidden />}
            label="Budget"
            tone={CONCEPT_TONE.budget}
            title="Open budget studio"
            onClick={onOpenBudget}
            active={activeStudio === 'budget'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.impact size={12} aria-hidden />}
            label="Impact"
            tone={CONCEPT_TONE.impact}
            title="See how orchestration changed the way this workspace works"
            onClick={onOpenImpact}
            active={activeStudio === 'impact'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.changelog size={12} aria-hidden />}
            label="Changelog"
            tone={CONCEPT_TONE.changelog}
            title="See what changed, release by release"
            onClick={onOpenChangelog}
            active={activeStudio === 'changelog'}
          />
        </div>
      </div>
    </div>
  );
};
