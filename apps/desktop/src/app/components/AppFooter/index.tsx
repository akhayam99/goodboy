import type { ReactNode } from 'react';
import { cn, Divider, StatusDot, tintClasses, type Tone } from '@goodboy/ui';
import { FolderGit2 } from 'lucide-react';
import { useAppStore } from '../../../store';
import { IntegrationGlyph } from '../../../features/integrations/components/IntegrationGlyph';
import { BetaPill } from '../../../shared/components/BetaPill';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';

type FooterButtonProps = {
  icon: ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
  pulse?: boolean;
  active?: boolean;
  connected?: boolean;
  tone?: Tone;
};

const FooterButton = ({
  icon,
  label,
  title,
  onClick,
  pulse,
  active,
  connected,
  tone = 'neutral',
}: FooterButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    title={title ?? label}
    aria-label={title ?? label}
    className={cn(
      'relative flex items-center gap-1.5 rounded px-2 py-1 text-2xs font-medium transition-colors',
      active
        ? 'bg-muted text-foreground'
        : pulse
          ? 'animate-soft-pulse text-info hover:bg-info/10'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      connected === false && 'opacity-40',
    )}
  >
    <span className={cn('flex items-center', active && tintClasses(tone).icon)}>{icon}</span>
    <span>{label}</span>
    {connected === false ? (
      <StatusDot tone="warning" size="sm" className="absolute right-0 top-0 ring-1 ring-subtle" />
    ) : null}
  </button>
);

type Props = {
  activeStudio: string | null;
  onOpenWorkflows: () => void;
  onOpenProviders: () => void;
  onOpenBudget: () => void;
  onOpenImpact: () => void;
  onOpenChangelog: () => void;
  onOpenGithub: () => void;
  onOpenLinear: () => void;
  onOpenSentry: () => void;
  onOpenGitlab: () => void;
  onConvertToDevProject: () => void;
  githubEnabled: boolean;
  linearEnabled: boolean;
  sentryEnabled: boolean;
  gitlabEnabled: boolean;
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
  onOpenSentry,
  onOpenGitlab,
  onConvertToDevProject,
  githubEnabled,
  linearEnabled,
  sentryEnabled,
  gitlabEnabled,
  isSimpleWorkspace,
}: Props) => {
  const noProviderConnected = useAppStore(
    (s) => !s.providers.some((p) => p.connection === 'connected'),
  );

  return (
    <div className="flex shrink-0 flex-col">
      <Divider />
      <div className="relative flex h-9 items-center justify-between bg-background px-2">
        <div className="flex items-center gap-0.5">
          {isSimpleWorkspace ? (
            <FooterButton
              icon={<FolderGit2 size={12} aria-hidden />}
              label="Add a repo"
              title="turn this workspace into a dev project backed by a git repository"
              onClick={onConvertToDevProject}
            />
          ) : (
            <>
              <FooterButton
                icon={<IntegrationGlyph provider="github" size="xs" useBrandColor />}
                label="GitHub"
                title={
                  githubEnabled
                    ? 'review and act on pull requests across this workspace'
                    : 'Connect GitHub'
                }
                onClick={onOpenGithub}
                active={activeStudio === 'github'}
                connected={githubEnabled}
              />
              <FooterButton
                icon={<IntegrationGlyph provider="gitlab" size="xs" useBrandColor />}
                label="GitLab"
                title={
                  gitlabEnabled
                    ? 'review merge requests and launch a session from a GitLab issue'
                    : 'Connect GitLab'
                }
                onClick={onOpenGitlab}
                active={activeStudio === 'gitlab'}
                connected={gitlabEnabled}
              />
            </>
          )}
          <FooterButton
            icon={<IntegrationGlyph provider="linear" size="xs" useBrandColor />}
            label="Linear"
            title={linearEnabled ? 'launch a session from a Linear issue' : 'Connect Linear'}
            onClick={onOpenLinear}
            active={activeStudio === 'linear'}
            connected={linearEnabled}
          />
          {isSimpleWorkspace ? null : (
            <FooterButton
              icon={<IntegrationGlyph provider="sentry" size="xs" useBrandColor />}
              label="Sentry"
              title={sentryEnabled ? 'launch a session from a Sentry issue' : 'Connect Sentry'}
              onClick={onOpenSentry}
              active={activeStudio === 'sentry'}
              connected={sentryEnabled}
            />
          )}
        </div>

        <BetaPill className="pointer-events-none absolute inset-x-0 mx-auto w-fit" />

        <div className="flex items-center gap-0.5">
          <FooterButton
            icon={<CONCEPT_ICONS.workflows size={12} aria-hidden />}
            label="Workflows"
            tone={CONCEPT_TONE.workflows}
            title="open the workflow library for this workspace"
            onClick={onOpenWorkflows}
            active={activeStudio === 'workflow'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.providers size={12} aria-hidden />}
            label="Providers"
            tone={CONCEPT_TONE.providers}
            title="connect and manage your provider accounts"
            onClick={onOpenProviders}
            pulse={noProviderConnected && activeStudio !== 'provider'}
            active={activeStudio === 'provider'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.budget size={12} aria-hidden />}
            label="Budget"
            tone={CONCEPT_TONE.budget}
            title="open budget studio"
            onClick={onOpenBudget}
            active={activeStudio === 'budget'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.impact size={12} aria-hidden />}
            label="Impact"
            tone={CONCEPT_TONE.impact}
            title="see how orchestration changed the way this workspace works"
            onClick={onOpenImpact}
            active={activeStudio === 'impact'}
          />
          <FooterButton
            icon={<CONCEPT_ICONS.changelog size={12} aria-hidden />}
            label="Changelog"
            tone={CONCEPT_TONE.changelog}
            title="see what changed, release by release"
            onClick={onOpenChangelog}
            active={activeStudio === 'changelog'}
          />
        </div>
      </div>
    </div>
  );
};
