import type { ReactNode } from 'react';
import { cn, Divider, StatusDot, tintClasses, type Tone } from '@goodboy/ui';
import { FolderGit2 } from 'lucide-react';
import { useAppStore } from '../../../store';
import { IntegrationGlyph } from '../../../features/integrations/components/IntegrationGlyph';
import { BetaPill } from '../../../shared/components/BetaPill';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';

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
  tone,
}: FooterButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    title={title ?? label}
    aria-label={title ?? label}
    className={cn(
      'relative flex items-center gap-1.5 rounded px-2 py-1 text-2xs font-medium transition-colors',
      active
        ? 'bg-foreground text-background'
        : pulse
          ? 'animate-soft-pulse text-info hover:bg-info/10'
          : cn(
              tone == null ? 'text-muted-foreground hover:text-foreground' : tintClasses(tone).text,
              'hover:bg-muted/50',
            ),
      connected === false && 'opacity-40',
    )}
  >
    {icon}
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
                icon={<IntegrationGlyph provider="github" size="xs" />}
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
                icon={<IntegrationGlyph provider="gitlab" size="xs" />}
                label="GitLab"
                title={gitlabEnabled ? 'launch a session from a GitLab issue' : 'Connect GitLab'}
                onClick={onOpenGitlab}
                active={activeStudio === 'gitlab'}
                connected={gitlabEnabled}
              />
            </>
          )}
          <FooterButton
            icon={<IntegrationGlyph provider="linear" size="xs" />}
            label="Linear"
            title={linearEnabled ? 'launch a session from a Linear issue' : 'Connect Linear'}
            onClick={onOpenLinear}
            active={activeStudio === 'linear'}
            connected={linearEnabled}
          />
          {isSimpleWorkspace ? null : (
            <FooterButton
              icon={<IntegrationGlyph provider="sentry" size="xs" />}
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
            title="open the workflow library for this workspace"
            onClick={onOpenWorkflows}
            active={activeStudio === 'workflow'}
            tone="primary"
          />
          <FooterButton
            icon={<CONCEPT_ICONS.providers size={12} aria-hidden />}
            label="Providers"
            title="connect and manage your provider accounts"
            onClick={onOpenProviders}
            pulse={noProviderConnected && activeStudio !== 'provider'}
            active={activeStudio === 'provider'}
            tone="info"
          />
          <FooterButton
            icon={<CONCEPT_ICONS.budget size={12} aria-hidden />}
            label="Budget"
            title="open budget studio"
            onClick={onOpenBudget}
            active={activeStudio === 'budget'}
            tone="warning"
          />
          <FooterButton
            icon={<CONCEPT_ICONS.impact size={12} aria-hidden />}
            label="Impact"
            title="see how orchestration changed the way this workspace works"
            onClick={onOpenImpact}
            active={activeStudio === 'impact'}
            tone="success"
          />
        </div>
      </div>
    </div>
  );
};
